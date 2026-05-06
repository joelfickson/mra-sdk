import type { AuthedTransport } from '../auth/index.js';
import type { components } from '../generated/schema.js';
import { unwrap, type ApiEnvelope } from './_envelope.js';

type RawMaterialPage =
  components['schemas']['TaxpayerRawMaterialDtoGenericInventoryDtoResponse'];
type RawmaterialConversion = components['schemas']['RawmaterialConversion'];

export class RawMaterialResource {
  constructor(private readonly auth: AuthedTransport) {}

  /** GET /api/v1/raw-material/get-raw-material */
  async list(query: { page: number; pageSize: number }): Promise<RawMaterialPage> {
    const path = '/api/v1/raw-material/get-raw-material';
    const env = await this.auth.request<ApiEnvelope<RawMaterialPage>>({
      method: 'GET',
      path,
      query,
    });
    return unwrap(env, { method: 'GET', path });
  }

  /** POST /api/v1/raw-material/submit-conversion */
  async submitConversion(payload: RawmaterialConversion): Promise<unknown> {
    const path = '/api/v1/raw-material/submit-conversion';
    const env = await this.auth.request<ApiEnvelope<unknown>>({
      method: 'POST',
      path,
      body: payload,
    });
    return unwrap(env, { method: 'POST', path });
  }
}
