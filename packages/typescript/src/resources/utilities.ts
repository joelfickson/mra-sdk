import type { AuthedTransport } from '../auth/index.js';
import type { components } from '../generated/schema.js';
import { unwrap, type ApiEnvelope } from './_envelope.js';

type Vat5CertificateValidationRequest = components['schemas']['Vat5CertificateValidationRequest'];
type Vat5CertificateValidationResponse = components['schemas']['Vat5CertificateValidationResponse'];
type TerminalBlockRequest = components['schemas']['TerminalBlockRequest'];
type TerminalBlockResponse = components['schemas']['TerminalBlockResponse'];
type TerminalUnblockStatusResponse = components['schemas']['TerminalUnblockStatusResponse'];
type TinAuthorizationRequirementRequest =
  components['schemas']['TinAuthorizationRequirementRequest'];
type TinAuthorizationRequirementResponse =
  components['schemas']['TinAuthorizationRequirementResponse'];
type UnValidatedAuthorizationCode = components['schemas']['UnValidatedAuthorizationCode'];
type ValidatedAuthorizationCode = components['schemas']['ValidatedAuthorizationCode'];
type PongResponse = components['schemas']['PongResponse'];
type ProductIdentifier = components['schemas']['ProductIdentifier'];
type ProductState = components['schemas']['ProductState'];
type InventoryRequest = components['schemas']['InventoryRequest'];
type ProductsInventoryResponse = components['schemas']['ProductsInventoryResponse'];
type TaxpayerInitialInventoryUploadRequest =
  components['schemas']['TaxpayerInitialInventoryUploadRequest'];
type InitialInventoryResponse = components['schemas']['InitialInventoryResponse'];

export class UtilitiesResource {
  constructor(private readonly auth: AuthedTransport) {}

  async validateVat5Certificate(
    request: Vat5CertificateValidationRequest,
  ): Promise<Vat5CertificateValidationResponse> {
    const path = '/api/v1/utilities/validate-vat5-certificate';
    const env = await this.auth.request<ApiEnvelope<Vat5CertificateValidationResponse>>({
      method: 'POST',
      path,
      body: request,
    });
    return unwrap(env, { method: 'POST', path });
  }

  async getTerminalBlockingMessage(request: TerminalBlockRequest): Promise<TerminalBlockResponse> {
    const path = '/api/v1/utilities/get-terminal-blocking-message';
    const env = await this.auth.request<ApiEnvelope<TerminalBlockResponse>>({
      method: 'POST',
      path,
      body: request,
    });
    return unwrap(env, { method: 'POST', path });
  }

  async checkTerminalUnblockStatus(
    request: TerminalBlockRequest,
  ): Promise<TerminalUnblockStatusResponse> {
    const path = '/api/v1/utilities/check-terminal-unblock-status';
    const env = await this.auth.request<ApiEnvelope<TerminalUnblockStatusResponse>>({
      method: 'POST',
      path,
      body: request,
    });
    return unwrap(env, { method: 'POST', path });
  }

  async checkTinAuthorizationRequirement(
    request: TinAuthorizationRequirementRequest,
  ): Promise<TinAuthorizationRequirementResponse> {
    const path = '/api/v1/utilities/check-tin-authorization-requirement';
    const env = await this.auth.request<ApiEnvelope<TinAuthorizationRequirementResponse>>({
      method: 'POST',
      path,
      body: request,
    });
    return unwrap(env, { method: 'POST', path });
  }

  async validateAuthorizationCode(
    request: UnValidatedAuthorizationCode,
  ): Promise<ValidatedAuthorizationCode> {
    const path = '/api/v1/utilities/validate-authorization-code';
    const env = await this.auth.request<ApiEnvelope<ValidatedAuthorizationCode>>({
      method: 'POST',
      path,
      body: request,
    });
    return unwrap(env, { method: 'POST', path });
  }

  async ping(): Promise<PongResponse> {
    const path = '/api/v1/utilities/ping';
    const env = await this.auth.request<ApiEnvelope<PongResponse>>({
      method: 'POST',
      path,
    });
    return unwrap(env, { method: 'POST', path });
  }

  async productStatus(request: ProductIdentifier): Promise<ProductState> {
    const path = '/api/v1/utilities/product-status';
    const env = await this.auth.request<ApiEnvelope<ProductState>>({
      method: 'POST',
      path,
      body: request,
    });
    return unwrap(env, { method: 'POST', path });
  }

  async getTerminalSiteProducts(request: InventoryRequest): Promise<ProductsInventoryResponse[]> {
    const path = '/api/v1/utilities/get-terminal-site-products';
    const env = await this.auth.request<ApiEnvelope<ProductsInventoryResponse[]>>({
      method: 'POST',
      path,
      body: request,
    });
    return unwrap(env, { method: 'POST', path });
  }

  async taxpayerInitialInventoryUpload(
    request: TaxpayerInitialInventoryUploadRequest,
  ): Promise<InitialInventoryResponse> {
    const path = '/api/v1/utilities/taxpayer-initial-inventory-upload';
    const env = await this.auth.request<ApiEnvelope<InitialInventoryResponse>>({
      method: 'POST',
      path,
      body: request,
    });
    return unwrap(env, { method: 'POST', path });
  }
}
