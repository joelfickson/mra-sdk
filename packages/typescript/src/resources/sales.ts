import type { AuthedTransport } from '../auth/index.js';
import type { components } from '../generated/schema.js';
import { unwrap, type ApiEnvelope } from './_envelope.js';

type SalesInvoice = components['schemas']['SalesInvoice'];
type InvoiceResponse = components['schemas']['InvoiceResponse'];
type InvoiceLookupRequest = components['schemas']['InvoiceLookupRequest'];
type InvoiceLookupResponse = components['schemas']['InvoiceLookupResponse'];
type LastSubmittedInvoice = components['schemas']['LastSubmittedInvoice'];
type InvoiceAdjustmentRequest = components['schemas']['InvoiceAdjustmentRequest'];
type InvoiceAdjustmentResponse = components['schemas']['InvoiceAdjustmentResponse'];
type VoidReceiptCreateDto = components['schemas']['VoidReceiptCreateDto'];
type VoidReceiptResponseDto = components['schemas']['VoidReceiptResponseDto'];
type VoidReceiptFilterDto = components['schemas']['VoidReceiptFilterDto'];
type GetVoidReceiptsPage = components['schemas']['GetVoidReceiptResponseDtoPaginatedResponseDto'];

export class SalesResource {
  constructor(private readonly auth: AuthedTransport) {}

  /** POST /api/v1/sales/submit-sales-transaction */
  async submit(invoice: SalesInvoice): Promise<InvoiceResponse> {
    const path = '/api/v1/sales/submit-sales-transaction';
    const env = await this.auth.request<ApiEnvelope<InvoiceResponse>>({
      method: 'POST',
      path,
      body: invoice,
    });
    return unwrap(env, { method: 'POST', path });
  }

  /** POST /api/v1/sales/get-invoice-by-number */
  async lookup(request: InvoiceLookupRequest): Promise<InvoiceLookupResponse> {
    const path = '/api/v1/sales/get-invoice-by-number';
    const env = await this.auth.request<ApiEnvelope<InvoiceLookupResponse>>({
      method: 'POST',
      path,
      body: request,
    });
    return unwrap(env, { method: 'POST', path });
  }

  /** POST /api/v1/sales/last-submitted-online-transaction */
  async lastSubmittedOnline(): Promise<LastSubmittedInvoice> {
    const path = '/api/v1/sales/last-submitted-online-transaction';
    const env = await this.auth.request<ApiEnvelope<LastSubmittedInvoice>>({
      method: 'POST',
      path,
    });
    return unwrap(env, { method: 'POST', path });
  }

  /** POST /api/v1/sales/last-submitted-offline-transaction */
  async lastSubmittedOffline(): Promise<LastSubmittedInvoice> {
    const path = '/api/v1/sales/last-submitted-offline-transaction';
    const env = await this.auth.request<ApiEnvelope<LastSubmittedInvoice>>({
      method: 'POST',
      path,
    });
    return unwrap(env, { method: 'POST', path });
  }

  /** POST /api/v1/sales/process-credit-debit-note */
  async processCreditDebitNote(
    request: InvoiceAdjustmentRequest,
  ): Promise<InvoiceAdjustmentResponse> {
    const path = '/api/v1/sales/process-credit-debit-note';
    const env = await this.auth.request<ApiEnvelope<InvoiceAdjustmentResponse>>({
      method: 'POST',
      path,
      body: request,
    });
    return unwrap(env, { method: 'POST', path });
  }

  /** POST /api/v1/sales/cancel-receipt */
  async cancelReceipt(payload: VoidReceiptCreateDto): Promise<VoidReceiptResponseDto> {
    const path = '/api/v1/sales/cancel-receipt';
    const env = await this.auth.request<ApiEnvelope<VoidReceiptResponseDto>>({
      method: 'POST',
      path,
      body: payload,
    });
    return unwrap(env, { method: 'POST', path });
  }

  /** POST /api/v1/sales/get-void-receipts */
  async getVoidReceipts(filter: VoidReceiptFilterDto): Promise<GetVoidReceiptsPage> {
    const path = '/api/v1/sales/get-void-receipts';
    const env = await this.auth.request<ApiEnvelope<GetVoidReceiptsPage>>({
      method: 'POST',
      path,
      body: filter,
    });
    return unwrap(env, { method: 'POST', path });
  }
}
