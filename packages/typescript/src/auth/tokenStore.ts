/**
 * A short-lived terminal access token issued by the EIS API.
 *
 * `expiresAt` is the absolute expiry time as a unix-millis timestamp. Storage
 * implementations should preserve it so the SDK can refresh proactively.
 */
export interface AccessToken {
  value: string;
  expiresAt: number;
}

/**
 * Persistent store for the terminal access token.
 *
 * Implementations must be safe to call from concurrent requests. Implementations
 * that hit disk (filesystem, keychain) should serialise writes internally.
 */
export interface TokenStore {
  get(): Promise<AccessToken | undefined>;
  set(token: AccessToken): Promise<void>;
  clear(): Promise<void>;
}

export class InMemoryTokenStore implements TokenStore {
  private token: AccessToken | undefined;

  async get(): Promise<AccessToken | undefined> {
    return this.token;
  }

  async set(token: AccessToken): Promise<void> {
    this.token = token;
  }

  async clear(): Promise<void> {
    this.token = undefined;
  }
}

/** Returns true if the token is missing or within `skewMs` of expiry. */
export function isExpired(token: AccessToken | undefined, nowMs: number, skewMs = 30_000): boolean {
  if (!token) return true;
  return token.expiresAt - nowMs <= skewMs;
}
