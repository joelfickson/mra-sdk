import type { components } from '../generated/schema.js';

export type SalesInvoice = components['schemas']['SalesInvoice'];

export type QueuedInvoiceStatus = 'pending' | 'submitting' | 'submitted' | 'failed';

export interface QueuedInvoice {
  /** Stable client-generated ID. Used to dedupe replays and report in MraOfflineQueuedError. */
  id: string;
  invoice: SalesInvoice;
  enqueuedAt: number;
  attempts: number;
  status: QueuedInvoiceStatus;
  lastError?: string;
}

/**
 * Persistent durable queue for offline invoice submissions.
 *
 * Crash-safety contract: `enqueue` MUST persist the entry before returning. A
 * crash after enqueue but before submit must result in the entry still being
 * present after restart.
 *
 * Concurrency: implementations should be safe to call from concurrent fibers.
 */
export interface OfflineQueue {
  enqueue(invoice: SalesInvoice): Promise<QueuedInvoice>;
  /** Returns up to `limit` pending entries in enqueue order. */
  peekPending(limit?: number): Promise<QueuedInvoice[]>;
  /** Move to `submitting` (used to take ownership before a submit attempt). */
  markSubmitting(id: string): Promise<void>;
  markSubmitted(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  size(): Promise<number>;
  /** Convenience for tests/inspection. */
  all(): Promise<QueuedInvoice[]>;
}

const generateId = (): string => {
  // Prefer Web Crypto's randomUUID where available (Node 19+, modern browsers).
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  // Fallback: 128-bit random hex (good enough as a queue ID, not a security token).
  let out = '';
  for (let i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
};

export class InMemoryOfflineQueue implements OfflineQueue {
  private entries: QueuedInvoice[] = [];

  async enqueue(invoice: SalesInvoice): Promise<QueuedInvoice> {
    const entry: QueuedInvoice = {
      id: generateId(),
      invoice,
      enqueuedAt: Date.now(),
      attempts: 0,
      status: 'pending',
    };
    this.entries.push(entry);
    return entry;
  }

  async peekPending(limit?: number): Promise<QueuedInvoice[]> {
    const pending = this.entries.filter((e) => e.status === 'pending');
    return limit === undefined ? pending : pending.slice(0, limit);
  }

  async markSubmitting(id: string): Promise<void> {
    const entry = this.find(id);
    entry.status = 'submitting';
    entry.attempts += 1;
  }

  async markSubmitted(id: string): Promise<void> {
    const entry = this.find(id);
    entry.status = 'submitted';
    delete entry.lastError;
  }

  async markFailed(id: string, error: string): Promise<void> {
    const entry = this.find(id);
    entry.status = 'pending';
    entry.lastError = error;
  }

  async size(): Promise<number> {
    return this.entries.filter((e) => e.status !== 'submitted').length;
  }

  async all(): Promise<QueuedInvoice[]> {
    return [...this.entries];
  }

  private find(id: string): QueuedInvoice {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) throw new Error(`Unknown queue entry: ${id}`);
    return entry;
  }
}

export const OfflineQueueIds = { generateId };
