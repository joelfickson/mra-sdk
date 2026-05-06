/**
 * RFC 7807 ProblemDetails envelope. The MRA spec only references this on
 * /api/v1/stock/submit-informal-purchase but error responses elsewhere appear
 * to follow the same shape.
 */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
  [extension: string]: unknown;
}

export type MraErrorKind =
  | 'network'
  | 'validation'
  | 'auth'
  | 'server'
  | 'queued';

export interface MraErrorContext {
  method: string;
  path: string;
  status?: number | undefined;
  attempt?: number | undefined;
  problem?: ProblemDetails | undefined;
  cause?: unknown;
}

export class MraError extends Error {
  readonly kind: MraErrorKind;
  readonly status?: number | undefined;
  readonly path: string;
  readonly method: string;
  readonly attempt?: number | undefined;
  readonly problem?: ProblemDetails | undefined;

  constructor(kind: MraErrorKind, message: string, ctx: MraErrorContext) {
    super(message, ctx.cause === undefined ? undefined : { cause: ctx.cause });
    this.name = 'MraError';
    this.kind = kind;
    this.status = ctx.status;
    this.path = ctx.path;
    this.method = ctx.method;
    this.attempt = ctx.attempt;
    this.problem = ctx.problem;
  }
}

export class MraNetworkError extends MraError {
  constructor(message: string, ctx: MraErrorContext) {
    super('network', message, ctx);
    this.name = 'MraNetworkError';
  }
}

export class MraValidationError extends MraError {
  constructor(message: string, ctx: MraErrorContext) {
    super('validation', message, ctx);
    this.name = 'MraValidationError';
  }
}

export class MraAuthError extends MraError {
  constructor(message: string, ctx: MraErrorContext) {
    super('auth', message, ctx);
    this.name = 'MraAuthError';
  }
}

export class MraServerError extends MraError {
  constructor(message: string, ctx: MraErrorContext) {
    super('server', message, ctx);
    this.name = 'MraServerError';
  }
}

export class MraOfflineQueuedError extends MraError {
  readonly queueId: string;

  constructor(message: string, ctx: MraErrorContext & { queueId: string }) {
    super('queued', message, ctx);
    this.name = 'MraOfflineQueuedError';
    this.queueId = ctx.queueId;
  }
}

export function classifyHttpError(
  status: number,
  body: ProblemDetails | undefined,
  ctx: Omit<MraErrorContext, 'status' | 'problem'>,
): MraError {
  const fullCtx: MraErrorContext = { ...ctx, status, problem: body };
  const title = body?.title ?? body?.detail ?? `HTTP ${status}`;

  if (status === 401 || status === 403) {
    return new MraAuthError(title, fullCtx);
  }
  if (status >= 400 && status < 500) {
    return new MraValidationError(title, fullCtx);
  }
  return new MraServerError(title, fullCtx);
}
