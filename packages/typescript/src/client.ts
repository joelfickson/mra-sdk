import {
  AuthedTransport,
  InMemoryTokenStore,
  type RefreshTokenFn,
  type Signer,
  type TokenStore,
} from './auth/index.js';
import { Transport, type RetryPolicy, type TelemetryHooks } from './http/index.js';
import {
  ConfigurationResource,
  OnboardingResource,
  RawMaterialResource,
  SalesResource,
  StockResource,
  UtilitiesResource,
} from './resources/index.js';
import { InMemoryOfflineQueue, OfflineSalesQueue, type OfflineQueue } from './offline/index.js';

export const DEFAULT_BASE_URL = 'https://eis-api.mra.mw';

export interface MraEisOptions {
  /** Base URL of the EIS API. Defaults to the production URL above. */
  baseUrl?: string;
  /** Persistent terminal-token store. Defaults to in-memory (lost on restart). */
  tokenStore?: TokenStore;
  /** Required for endpoints that send `x-signature` (terminal-activated-confirmation). */
  signer?: Signer;
  /** Custom token refresh hook. If omitted, the SDK refreshes via /configuration/request-new-terminal-token. */
  refresh?: RefreshTokenFn;
  /** Override fetch (for tests or custom transports). */
  fetchImpl?: typeof fetch;
  /** Default headers added to every request. */
  defaultHeaders?: Record<string, string>;
  /** Telemetry hooks. */
  telemetry?: TelemetryHooks;
  /** Retry policy applied to every request. */
  retry?: RetryPolicy;
  /** Offline queue for sales submissions. Defaults to InMemoryOfflineQueue. */
  offlineQueue?: OfflineQueue;
}

export class MraEis {
  readonly transport: Transport;
  readonly auth: AuthedTransport;
  readonly tokenStore: TokenStore;

  readonly configuration: ConfigurationResource;
  readonly onboarding: OnboardingResource;
  readonly sales: SalesResource;
  readonly stock: StockResource;
  readonly rawMaterial: RawMaterialResource;
  readonly utilities: UtilitiesResource;
  readonly offline: OfflineSalesQueue;

  constructor(options: MraEisOptions = {}) {
    const transportOpts: ConstructorParameters<typeof Transport>[0] = {
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    };
    if (options.fetchImpl) transportOpts.fetchImpl = options.fetchImpl;
    if (options.defaultHeaders) transportOpts.defaultHeaders = options.defaultHeaders;
    if (options.telemetry) transportOpts.telemetry = options.telemetry;
    if (options.retry) transportOpts.retry = options.retry;
    this.transport = new Transport(transportOpts);

    this.tokenStore = options.tokenStore ?? new InMemoryTokenStore();

    const authOpts: ConstructorParameters<typeof AuthedTransport>[0] = {
      transport: this.transport,
      tokenStore: this.tokenStore,
      refresh: options.refresh ?? defaultRefresh,
    };
    if (options.signer) authOpts.signer = options.signer;
    this.auth = new AuthedTransport(authOpts);

    this.configuration = new ConfigurationResource(this.auth);
    this.onboarding = new OnboardingResource(this.auth);
    this.sales = new SalesResource(this.auth);
    this.stock = new StockResource(this.auth);
    this.rawMaterial = new RawMaterialResource(this.auth);
    this.utilities = new UtilitiesResource(this.auth);

    const offlineQueue = options.offlineQueue ?? new InMemoryOfflineQueue();
    this.offline = new OfflineSalesQueue(this.sales, offlineQueue);
  }
}

/**
 * Default token refresh: hits /api/v1/configuration/request-new-terminal-token.
 * The endpoint's response shape is `ObjectAPIResponse` (loose typing) so we
 * inspect a few common field names for the new token. Override via
 * `MraEisOptions.refresh` if your tenant returns a different shape.
 */
const defaultRefresh: RefreshTokenFn = async (transport) => {
  const env = await transport.request<{
    data?: {
      token?: string;
      accessToken?: string;
      expiresAt?: number | string;
      expiresIn?: number;
    } | null;
  }>({
    method: 'POST',
    path: '/api/v1/configuration/request-new-terminal-token',
  });
  const data = env.data ?? {};
  const value = data.token ?? data.accessToken;
  if (!value) {
    throw new Error(
      'Token refresh succeeded but response did not contain `data.token` or `data.accessToken`. Provide a custom `refresh` callback.',
    );
  }
  const expiresAt =
    typeof data.expiresAt === 'number'
      ? data.expiresAt
      : typeof data.expiresAt === 'string'
        ? Date.parse(data.expiresAt)
        : data.expiresIn !== undefined
          ? Date.now() + data.expiresIn * 1000
          : Date.now() + 60 * 60 * 1000;
  return { value, expiresAt };
};
