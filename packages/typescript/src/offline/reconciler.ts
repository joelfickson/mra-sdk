import {
  MraNetworkError,
  MraOfflineQueuedError,
  MraServerError,
} from '../http/index.js';
import type { components } from '../generated/schema.js';
import type { SalesResource } from '../resources/sales.js';
import type { OfflineQueue, QueuedInvoice, SalesInvoice } from './queue.js';

type InvoiceResponse = components['schemas']['InvoiceResponse'];
type LastSubmittedInvoice = components['schemas']['LastSubmittedInvoice'];

export type SubmitOutcome =
  | { kind: 'online'; result: InvoiceResponse }
  | { kind: 'queued'; entry: QueuedInvoice };

export interface SyncResult {
  /** Number of entries the reconciler attempted to submit. */
  attempted: number;
  /** Entries that were successfully submitted to the server. */
  succeeded: number;
  /** Entries that the dedupe callback identified as already accepted server-side. */
  skipped: number;
  /** Entries left pending after this run (network error or server still failing). */
  failed: number;
}

export interface DedupeContext {
  lastSubmittedOffline: LastSubmittedInvoice | undefined;
  entry: QueuedInvoice;
}

export interface SyncOptions {
  /** Max entries to process per call. Defaults to 100. */
  batchSize?: number;
  /**
   * Callback that returns true if the queued entry has already been submitted
   * server-side. Use this to dedupe by comparing client-supplied invoice numbers
   * against `lastSubmittedOffline`.
   *
   * If omitted, the reconciler resubmits every queued entry. This is safe when
   * each invoice carries a globally unique client-supplied invoice number that
   * the server uses for dedupe.
   */
  alreadyAccepted?: (ctx: DedupeContext) => boolean;
}

/**
 * Submit-with-fallback + replay logic for offline-tolerant sales submission.
 *
 * Behaviour:
 * - `submit()` tries online first. On a network failure or 5xx server error the
 *   invoice is durably enqueued and `MraOfflineQueuedError` is thrown.
 *   Validation/auth errors propagate unchanged - they aren't transient.
 * - `sync()` drains the queue. For each entry it calls `submit-sales-transaction`
 *   and on success marks the entry submitted. The optional `alreadyAccepted`
 *   callback can short-circuit entries that the server already has.
 */
export class OfflineSalesQueue {
  constructor(
    private readonly sales: SalesResource,
    private readonly queue: OfflineQueue,
  ) {}

  get storage(): OfflineQueue {
    return this.queue;
  }

  async submit(invoice: SalesInvoice): Promise<SubmitOutcome> {
    try {
      const result = await this.sales.submit(invoice);
      return { kind: 'online', result };
    } catch (err) {
      if (err instanceof MraNetworkError || err instanceof MraServerError) {
        const entry = await this.queue.enqueue(invoice);
        throw new MraOfflineQueuedError(
          `Sales submission failed (${err.kind}); queued offline as ${entry.id}`,
          {
            method: 'POST',
            path: '/api/v1/sales/submit-sales-transaction',
            cause: err,
            queueId: entry.id,
          },
        );
      }
      throw err;
    }
  }

  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const batchSize = options.batchSize ?? 100;
    const pending = await this.queue.peekPending(batchSize);
    if (pending.length === 0) {
      return { attempted: 0, succeeded: 0, skipped: 0, failed: 0 };
    }

    let lastSubmittedOffline: LastSubmittedInvoice | undefined;
    if (options.alreadyAccepted) {
      try {
        lastSubmittedOffline = await this.sales.lastSubmittedOffline();
      } catch {
        // If we can't fetch the marker, fall through and let alreadyAccepted
        // decide based on `undefined`.
      }
    }

    let succeeded = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of pending) {
      if (
        options.alreadyAccepted &&
        options.alreadyAccepted({ lastSubmittedOffline, entry })
      ) {
        await this.queue.markSubmitted(entry.id);
        skipped += 1;
        continue;
      }

      await this.queue.markSubmitting(entry.id);
      try {
        await this.sales.submit(entry.invoice);
        await this.queue.markSubmitted(entry.id);
        succeeded += 1;
      } catch (err) {
        await this.queue.markFailed(entry.id, describeError(err));
        failed += 1;
        // Stop the batch on transport-level errors - retrying further entries
        // is unlikely to succeed and only burns retry budget.
        if (err instanceof MraNetworkError) break;
      }
    }

    return { attempted: pending.length, succeeded, skipped, failed };
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
