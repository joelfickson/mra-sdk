import type { AuthedTransport } from '../auth/index.js';
import type { components } from '../generated/schema.js';
import { unwrap, type ApiEnvelope } from './_envelope.js';

type Configuration = components['schemas']['Configuration'];

export class ConfigurationResource {
  constructor(private readonly auth: AuthedTransport) {}

  /** GET /api/v1/configuration/get-latest-configs - retrieves device latest configs. */
  async getLatest(): Promise<Configuration> {
    const path = '/api/v1/configuration/get-latest-configs';
    const env = await this.auth.request<ApiEnvelope<Configuration>>({ method: 'POST', path });
    return unwrap(env, { method: 'POST', path });
  }

  /**
   * POST /api/v1/configuration/request-new-terminal-token - rotates the terminal access token.
   * The response shape is `ObjectAPIResponse` so `data` is loosely typed; cast at the call site.
   */
  async requestNewTerminalToken(): Promise<unknown> {
    const path = '/api/v1/configuration/request-new-terminal-token';
    const env = await this.auth.request<ApiEnvelope<unknown>>({ method: 'POST', path });
    return unwrap(env, { method: 'POST', path });
  }
}
