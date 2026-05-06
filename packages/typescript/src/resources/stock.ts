import type { AuthedTransport } from '../auth/index.js';
import type { components } from '../generated/schema.js';
import { unwrap, type ApiEnvelope } from './_envelope.js';

type InventoryTransferRequest = components['schemas']['InventoryTransferRequest'];
type WarehouseInventoryPage =
  components['schemas']['WarehouseInventoryItemDtoGenericInventoryDtoResponse'];
type GoodsReceivingModel = components['schemas']['GoodsReceivingModel'];
type StockAdjustmentRequestDto = components['schemas']['StockAdjustmentRequestDto'];
type AdjustmentReason = components['schemas']['AdjustmentReasonDto'];
type Supplier = components['schemas']['SupplierDto'];

export class StockResource {
  constructor(private readonly auth: AuthedTransport) {}

  /** POST /api/v1/stock/transfer-inventory */
  async transferInventory(request: InventoryTransferRequest): Promise<unknown> {
    const path = '/api/v1/stock/transfer-inventory';
    const env = await this.auth.request<ApiEnvelope<unknown>>({
      method: 'POST',
      path,
      body: request,
    });
    return unwrap(env, { method: 'POST', path });
  }

  /** GET /api/v1/stock/warehouse-inventory */
  async warehouseInventory(query: { page: number; pageSize: number }): Promise<WarehouseInventoryPage> {
    const path = '/api/v1/stock/warehouse-inventory';
    const env = await this.auth.request<ApiEnvelope<WarehouseInventoryPage>>({
      method: 'GET',
      path,
      query,
    });
    return unwrap(env, { method: 'GET', path });
  }

  /** POST /api/v1/stock/submit-informal-purchase */
  async submitInformalPurchase(payload: GoodsReceivingModel): Promise<unknown> {
    const path = '/api/v1/stock/submit-informal-purchase';
    const env = await this.auth.request<ApiEnvelope<unknown>>({
      method: 'POST',
      path,
      body: payload,
    });
    return unwrap(env, { method: 'POST', path });
  }

  /** POST /api/v1/stock/submit-adjustment */
  async submitAdjustment(payload: StockAdjustmentRequestDto): Promise<unknown> {
    const path = '/api/v1/stock/submit-adjustment';
    const env = await this.auth.request<ApiEnvelope<unknown>>({
      method: 'POST',
      path,
      body: payload,
    });
    return unwrap(env, { method: 'POST', path });
  }

  /** POST /api/v1/stock/getStockAdjustmentReasons */
  async getAdjustmentReasons(): Promise<AdjustmentReason[]> {
    const path = '/api/v1/stock/getStockAdjustmentReasons';
    const env = await this.auth.request<ApiEnvelope<AdjustmentReason[]>>({
      method: 'POST',
      path,
    });
    return unwrap(env, { method: 'POST', path });
  }

  /** POST /api/v1/stock/get-suppliers */
  async getSuppliers(): Promise<Supplier[]> {
    const path = '/api/v1/stock/get-suppliers';
    const env = await this.auth.request<ApiEnvelope<Supplier[]>>({
      method: 'POST',
      path,
    });
    return unwrap(env, { method: 'POST', path });
  }
}
