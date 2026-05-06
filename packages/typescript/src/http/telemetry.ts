import type { MraError } from './errors.js';

export interface RequestTelemetry {
  method: string;
  path: string;
  attempt: number;
  body?: unknown;
}

export interface ResponseTelemetry extends RequestTelemetry {
  status: number;
  durationMs: number;
}

export interface ErrorTelemetry extends RequestTelemetry {
  durationMs: number;
  error: MraError;
}

export interface TelemetryHooks {
  onRequest?: (event: RequestTelemetry) => void;
  onResponse?: (event: ResponseTelemetry) => void;
  onError?: (event: ErrorTelemetry) => void;
}
