import {
  MraAuthError,
  Transport,
  type RequestOptions,
} from '../http/index.js';
import { isExpired, type AccessToken, type TokenStore } from './tokenStore.js';
import type { Signer } from './signer.js';

export interface RefreshTokenFn {
  /** Calls `/api/v1/configuration/request-new-terminal-token` and returns the new token. */
  (transport: Transport): Promise<AccessToken>;
}

export interface AuthedTransportOptions {
  transport: Transport;
  tokenStore: TokenStore;
  /** Optional - only required for endpoints that need an x-signature header. */
  signer?: Signer;
  /** Refresh callback invoked when a request comes back 401 or the token is expired. */
  refresh?: RefreshTokenFn;
  /** Clock injection for tests. */
  now?: () => number;
}

export interface AuthedRequestOptions extends RequestOptions {
  /** When true, the request is signed and gets an x-signature header. */
  sign?: boolean;
  /** When true, no Authorization header is added. Used by activation endpoints. */
  anonymous?: boolean;
}

/**
 * Wraps Transport with terminal-token bearer auth, optional request signing,
 * and 401-triggered token refresh-then-retry.
 */
export class AuthedTransport {
  private readonly transport: Transport;
  private readonly tokenStore: TokenStore;
  private readonly signer: Signer | undefined;
  private readonly refresh: RefreshTokenFn | undefined;
  private readonly now: () => number;
  private inflightRefresh: Promise<AccessToken> | undefined;

  constructor(options: AuthedTransportOptions) {
    this.transport = options.transport;
    this.tokenStore = options.tokenStore;
    this.signer = options.signer;
    this.refresh = options.refresh;
    this.now = options.now ?? Date.now;
  }

  get rawTransport(): Transport {
    return this.transport;
  }

  async request<T>(req: AuthedRequestOptions): Promise<T> {
    const headers: Record<string, string> = { ...req.headers };

    if (!req.anonymous) {
      const token = await this.ensureFreshToken();
      headers.Authorization = `Bearer ${token.value}`;
    }

    if (req.sign) {
      if (!this.signer) {
        throw new Error(
          'Request requires x-signature but no Signer was provided to AuthedTransport',
        );
      }
      const bodyBytes = req.body === undefined ? '' : JSON.stringify(req.body);
      headers['x-signature'] = await this.signer.sign(bodyBytes);
    }

    const baseReq: RequestOptions = { ...req, headers };

    try {
      return await this.transport.request<T>(baseReq);
    } catch (err) {
      if (err instanceof MraAuthError && !req.anonymous && this.refresh) {
        await this.tokenStore.clear();
        const fresh = await this.runRefresh();
        const retryHeaders = { ...headers, Authorization: `Bearer ${fresh.value}` };
        return await this.transport.request<T>({ ...req, headers: retryHeaders });
      }
      throw err;
    }
  }

  private async ensureFreshToken(): Promise<AccessToken> {
    const existing = await this.tokenStore.get();
    if (!isExpired(existing, this.now())) {
      return existing as AccessToken;
    }
    if (!this.refresh) {
      if (existing) return existing;
      throw new Error(
        'No access token available and no refresh callback configured. Activate the terminal first.',
      );
    }
    return this.runRefresh();
  }

  private async runRefresh(): Promise<AccessToken> {
    if (this.inflightRefresh) return this.inflightRefresh;
    if (!this.refresh) {
      throw new Error('refresh callback not configured');
    }
    const refresh = this.refresh;
    this.inflightRefresh = (async () => {
      try {
        const fresh = await refresh(this.transport);
        await this.tokenStore.set(fresh);
        return fresh;
      } finally {
        this.inflightRefresh = undefined;
      }
    })();
    return this.inflightRefresh;
  }
}
