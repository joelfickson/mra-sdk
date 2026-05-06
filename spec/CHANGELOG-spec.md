# MRA EIS Spec Changelog

This file tracks every update to `spec/swagger.json` (vendored from the upstream MRA EIS API). Each entry records when we re-pulled the spec, what changed, and any SDK-side follow-ups.

The CI `spec-drift` job downloads the upstream spec and fails if it differs from the vendored copy without a corresponding entry here.

## 2026-05-06 - Initial capture

- Source: `https://eis-api.mra.mw/swagger/v1/swagger.json`
- OpenAPI version: `3.0.1`
- API title/version: `EISAPI` `1.0`
- Paths: 28
- Schemas: 94
- Tags: Configuration, OnBoarding, Sales, StockOperations, RawMaterial, Utilities

### Known spec gaps (verify on sandbox)

1. **No `securitySchemes` declared.** Authentication and `x-signature` requirements are documented out-of-band in the developer guide rather than in OpenAPI. The SDK models terminal-token + `x-signature` based on the developer guide and endpoint requirements.
2. **`x-signature` algorithm not specified.** SDK assumes RSA-SHA256 over the canonical (sorted-keys) JSON request body. To verify when sandbox access is available.
3. **No idempotency keys.** Offline replay relies on calling `/api/v1/sales/last-submitted-offline-transaction` to dedupe before re-submitting.
4. **`ProblemDetails` is referenced explicitly only on `/api/v1/stock/submit-informal-purchase`.** SDK treats `ProblemDetails` as the universal error envelope; this assumption needs sandbox confirmation.
5. **No `servers` declared in spec.** SDK defaults `baseUrl` to `https://eis-api.mra.mw` and exposes it as a constructor option.
