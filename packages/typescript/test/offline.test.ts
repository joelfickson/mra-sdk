import { describe, expect, it, vi } from 'vitest';
import {
  InMemoryOfflineQueue,
  MraEis,
  MraOfflineQueuedError,
  type SalesInvoice,
} from '../src/index.js';

const noSleep = () => Promise.resolve();

const dummyInvoice = (n: number): SalesInvoice =>
  ({ invoiceNumber: `INV-${n}` } as unknown as SalesInvoice);

const makeFetch = (handlers: Array<(input: string, init: RequestInit) => Response | Promise<Response>>) => {
  let i = 0;
  return vi.fn(async (input: string, init: RequestInit) => {
    const handler = handlers[i++];
    if (!handler) throw new Error(`unexpected fetch call ${i}`);
    return handler(input, init);
  });
};

describe('InMemoryOfflineQueue', () => {
  it('persists across enqueue and surfaces pending entries', async () => {
    const q = new InMemoryOfflineQueue();
    expect(await q.size()).toBe(0);
    const e = await q.enqueue(dummyInvoice(1));
    expect(e.status).toBe('pending');
    expect(await q.size()).toBe(1);
    expect((await q.peekPending()).map((x) => x.id)).toEqual([e.id]);
  });

  it('transitions to submitted and reduces size', async () => {
    const q = new InMemoryOfflineQueue();
    const e = await q.enqueue(dummyInvoice(1));
    await q.markSubmitting(e.id);
    await q.markSubmitted(e.id);
    expect(await q.size()).toBe(0);
    const all = await q.all();
    expect(all[0]?.status).toBe('submitted');
    expect(all[0]?.attempts).toBe(1);
  });

  it('markFailed returns to pending and records lastError', async () => {
    const q = new InMemoryOfflineQueue();
    const e = await q.enqueue(dummyInvoice(1));
    await q.markSubmitting(e.id);
    await q.markFailed(e.id, 'boom');
    expect(await q.size()).toBe(1);
    const all = await q.all();
    expect(all[0]?.status).toBe('pending');
    expect(all[0]?.lastError).toBe('boom');
  });
});

describe('OfflineSalesQueue.submit', () => {
  it('returns online result when submission succeeds', async () => {
    const fetchImpl = makeFetch([
      () =>
        new Response(JSON.stringify({ statusCode: 200, data: { invoiceNumber: 'IV-1' } }), {
          status: 200,
        }),
    ]);
    const client = new MraEis({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await client.tokenStore.set({ value: 't', expiresAt: Date.now() + 60_000 });

    const out = await client.offline.submit(dummyInvoice(1));
    expect(out.kind).toBe('online');
    if (out.kind === 'online') expect(out.result).toEqual({ invoiceNumber: 'IV-1' });
    expect(await client.offline.storage.size()).toBe(0);
  });

  it('queues and throws MraOfflineQueuedError on a network failure', async () => {
    const fetchImpl = makeFetch([() => Promise.reject(new TypeError('fetch failed'))]);
    const client = new MraEis({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await client.tokenStore.set({ value: 't', expiresAt: Date.now() + 60_000 });

    await expect(client.offline.submit(dummyInvoice(2))).rejects.toBeInstanceOf(
      MraOfflineQueuedError,
    );
    expect(await client.offline.storage.size()).toBe(1);
  });

  it('queues on 5xx but propagates 4xx unchanged', async () => {
    const fetchImpl = makeFetch([
      () => new Response('', { status: 503 }),
      () =>
        new Response(JSON.stringify({ statusCode: 400, errors: [{ errorMessage: 'bad' }] }), {
          status: 400,
        }),
    ]);
    const client = new MraEis({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await client.tokenStore.set({ value: 't', expiresAt: Date.now() + 60_000 });

    await expect(client.offline.submit(dummyInvoice(1))).rejects.toBeInstanceOf(
      MraOfflineQueuedError,
    );
    expect(await client.offline.storage.size()).toBe(1);

    // 400 should NOT be queued.
    await expect(client.offline.submit(dummyInvoice(2))).rejects.toMatchObject({
      name: 'MraValidationError',
    });
    expect(await client.offline.storage.size()).toBe(1);
  });

  it('persists the entry before throwing (crash-safety contract)', async () => {
    const queue = new InMemoryOfflineQueue();
    const fetchImpl = makeFetch([() => Promise.reject(new TypeError('fetch failed'))]);
    const client = new MraEis({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      offlineQueue: queue,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await client.tokenStore.set({ value: 't', expiresAt: Date.now() + 60_000 });

    await expect(client.offline.submit(dummyInvoice(7))).rejects.toBeInstanceOf(
      MraOfflineQueuedError,
    );
    const entries = await queue.all();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.invoice).toEqual(dummyInvoice(7));
  });
});

describe('OfflineSalesQueue.sync', () => {
  it('returns zeros when the queue is empty', async () => {
    const fetchImpl = makeFetch([]);
    const client = new MraEis({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await client.tokenStore.set({ value: 't', expiresAt: Date.now() + 60_000 });
    expect(await client.offline.sync()).toEqual({ attempted: 0, succeeded: 0, skipped: 0, failed: 0 });
  });

  it('drains pending entries into the server and marks them submitted', async () => {
    const fetchImpl = makeFetch([
      () => Promise.reject(new TypeError('fetch failed')), // initial submit
      () =>
        new Response(JSON.stringify({ statusCode: 200, data: { invoiceNumber: 'IV-3' } }), {
          status: 200,
        }), // sync replay
    ]);
    const client = new MraEis({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await client.tokenStore.set({ value: 't', expiresAt: Date.now() + 60_000 });

    await expect(client.offline.submit(dummyInvoice(3))).rejects.toBeInstanceOf(
      MraOfflineQueuedError,
    );
    expect(await client.offline.storage.size()).toBe(1);

    const result = await client.offline.sync();
    expect(result).toEqual({ attempted: 1, succeeded: 1, skipped: 0, failed: 0 });
    expect(await client.offline.storage.size()).toBe(0);
  });

  it('uses alreadyAccepted to dedupe entries the server has already', async () => {
    const fetchImpl = makeFetch([
      () => Promise.reject(new TypeError('fetch failed')),
      () =>
        new Response(
          JSON.stringify({ statusCode: 200, data: { invoiceNumber: 'INV-9' } }),
          { status: 200 },
        ), // lastSubmittedOffline
      // No further fetches because alreadyAccepted returns true
    ]);
    const client = new MraEis({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await client.tokenStore.set({ value: 't', expiresAt: Date.now() + 60_000 });
    await expect(client.offline.submit(dummyInvoice(9))).rejects.toBeInstanceOf(
      MraOfflineQueuedError,
    );
    const result = await client.offline.sync({
      alreadyAccepted: ({ lastSubmittedOffline, entry }) => {
        return (
          (lastSubmittedOffline as { invoiceNumber?: string } | undefined)?.invoiceNumber ===
          (entry.invoice as { invoiceNumber?: string }).invoiceNumber
        );
      },
    });
    expect(result).toEqual({ attempted: 1, succeeded: 0, skipped: 1, failed: 0 });
  });

  it('breaks the batch on a network error during replay', async () => {
    const fetchImpl = makeFetch([
      () => Promise.reject(new TypeError('fetch failed')), // initial submit #1
      () => Promise.reject(new TypeError('fetch failed')), // initial submit #2
      () => Promise.reject(new TypeError('fetch failed')), // sync replay #1
      // No further calls - we should bail out
    ]);
    const client = new MraEis({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await client.tokenStore.set({ value: 't', expiresAt: Date.now() + 60_000 });

    await expect(client.offline.submit(dummyInvoice(1))).rejects.toBeInstanceOf(
      MraOfflineQueuedError,
    );
    await expect(client.offline.submit(dummyInvoice(2))).rejects.toBeInstanceOf(
      MraOfflineQueuedError,
    );

    const result = await client.offline.sync();
    expect(result.attempted).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(await client.offline.storage.size()).toBe(2);
  });
});
