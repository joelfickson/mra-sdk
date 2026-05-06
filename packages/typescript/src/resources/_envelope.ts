import { MraValidationError } from '../http/index.js';
import type { components } from '../generated/schema.js';

export type ApiError = components['schemas']['APIError'];

/**
 * Every MRA EIS endpoint returns this envelope shape (under different
 * `*APIResponse` schema names). We unwrap to expose just the `data` field
 * and translate non-empty `errors` into a typed exception.
 */
export interface ApiEnvelope<T> {
  statusCode?: number;
  remark?: string | null;
  data?: T | null;
  errors?: ApiError[] | null;
}

export function unwrap<T>(envelope: ApiEnvelope<T>, ctx: { method: string; path: string }): T {
  if (envelope.errors && envelope.errors.length > 0) {
    const first = envelope.errors[0];
    const message = first?.errorMessage ?? envelope.remark ?? 'EIS API returned errors';
    const problem: import('../http/index.js').ProblemDetails = {
      title: message,
      errors: Object.fromEntries(
        envelope.errors.map((e, i) => [String(i), [e.errorMessage ?? 'unknown']]),
      ),
    };
    if (envelope.statusCode !== undefined) problem.status = envelope.statusCode;
    if (envelope.remark) problem.detail = envelope.remark;
    throw new MraValidationError(message, {
      method: ctx.method,
      path: ctx.path,
      status: envelope.statusCode,
      problem,
    });
  }
  return envelope.data as T;
}
