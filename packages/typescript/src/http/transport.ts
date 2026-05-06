import {
  MraNetworkError,
  classifyHttpError,
  type MraError,
  type ProblemDetails,
} from './errors.js';
import type { TelemetryHooks } from './telemetry.js';

export interface RetryPolicy {
  /** Max attempts including the first. Defaults to 3 for safe ops, 1 for unsafe. */
  maxAttempts: number;
  /** Initial backoff in ms. Doubled per attempt. */
  baseDelayMs: number;
  /** Cap on backoff in ms. */
  maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
};

export const NO_RETRY: RetryPolicy = {
  maxAttempts: 1,
  baseDelayMs: 0,
  maxDelayMs: 0,
};

export interface TransportOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  defaultHeaders?: Record<string, string>;
  /** Telemetry hooks invoked once per request/response/error. */
  telemetry?: TelemetryHooks;
  /** Default retry policy for requests that don't override it. */
  retry?: RetryPolicy;
  /** Sleep function, swappable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

export interface RequestOptions {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
  retry?: Partial<RetryPolicy>;
  /** AbortSignal to propagate to fetch. */
  signal?: AbortSignal;
}

export class Transport {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly telemetry: TelemetryHooks;
  private readonly retry: RetryPolicy;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: TransportOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.telemetry = options.telemetry ?? {};
    this.retry = options.retry ?? DEFAULT_RETRY_POLICY;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async request<T>(req: RequestOptions): Promise<T> {
    const policy = mergeRetry(this.retry, req.retry);
    const url = this.buildUrl(req.path, req.query);
    const headers = this.buildHeaders(req);
    const init: RequestInit = { method: req.method, headers };
    if (req.body !== undefined) init.body = JSON.stringify(req.body);
    if (req.signal !== undefined) init.signal = req.signal;

    let lastError: MraError | undefined;
    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      const start = nowMs();
      this.telemetry.onRequest?.({ method: req.method, path: req.path, attempt, body: req.body });

      let res: Response;
      try {
        res = await this.fetchImpl(url, init);
      } catch (cause) {
        const err = new MraNetworkError(networkErrorMessage(cause), {
          method: req.method,
          path: req.path,
          attempt,
          cause,
        });
        this.telemetry.onError?.({
          method: req.method,
          path: req.path,
          attempt,
          body: req.body,
          durationMs: nowMs() - start,
          error: err,
        });
        lastError = err;
        if (attempt < policy.maxAttempts) {
          await this.sleep(backoffDelay(policy, attempt));
          continue;
        }
        throw err;
      }

      const durationMs = nowMs() - start;
      this.telemetry.onResponse?.({
        method: req.method,
        path: req.path,
        attempt,
        body: req.body,
        status: res.status,
        durationMs,
      });

      if (res.ok) {
        return (await parseJson<T>(res)) as T;
      }

      const problem = await safeReadProblem(res);
      const err = classifyHttpError(res.status, problem, {
        method: req.method,
        path: req.path,
        attempt,
      });
      this.telemetry.onError?.({
        method: req.method,
        path: req.path,
        attempt,
        body: req.body,
        durationMs,
        error: err,
      });

      // Retry only 5xx; 4xx fail fast.
      if (res.status >= 500 && attempt < policy.maxAttempts) {
        lastError = err;
        await this.sleep(backoffDelay(policy, attempt));
        continue;
      }
      throw err;
    }

    /* c8 ignore next */
    throw lastError ?? new Error('unreachable: retry loop exhausted without error');
  }

  private buildUrl(path: string, query: RequestOptions['query']): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private buildHeaders(req: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...this.defaultHeaders,
      ...req.headers,
    };
    if (req.body !== undefined && headers['Content-Type'] === undefined) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }
}

function mergeRetry(base: RetryPolicy, override: Partial<RetryPolicy> | undefined): RetryPolicy {
  if (!override) return base;
  return {
    maxAttempts: override.maxAttempts ?? base.maxAttempts,
    baseDelayMs: override.baseDelayMs ?? base.baseDelayMs,
    maxDelayMs: override.maxDelayMs ?? base.maxDelayMs,
  };
}

function backoffDelay(policy: RetryPolicy, attempt: number): number {
  const exp = policy.baseDelayMs * 2 ** (attempt - 1);
  return Math.min(exp, policy.maxDelayMs);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

async function parseJson<T>(res: Response): Promise<T | undefined> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (text.length === 0) return undefined;
  return JSON.parse(text) as T;
}

async function safeReadProblem(res: Response): Promise<ProblemDetails | undefined> {
  try {
    const text = await res.text();
    if (text.length === 0) return undefined;
    return JSON.parse(text) as ProblemDetails;
  } catch {
    return undefined;
  }
}

function networkErrorMessage(cause: unknown): string {
  if (cause instanceof Error) return `Network error: ${cause.message}`;
  return 'Network error';
}
