import { describe, expect, it, vi } from 'vitest';
import {
  MraAuthError,
  MraNetworkError,
  MraServerError,
  MraValidationError,
  Transport,
  type TelemetryHooks,
} from '../src/http/index.js';

const makeFetch = (handlers: Array<() => Promise<Response> | Response>) => {
  let i = 0;
  return vi.fn(async () => {
    const handler = handlers[i++];
    if (!handler) throw new Error(`unexpected fetch call ${i}`);
    return handler();
  });
};

const noSleep = () => Promise.resolve();

describe('Transport', () => {
  it('returns parsed JSON body on 200', async () => {
    const fetchImpl = makeFetch([
      () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ]);
    const t = new Transport({
      baseUrl: 'https://example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });
    const res = await t.request<{ ok: boolean }>({ method: 'POST', path: '/x' });
    expect(res).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('returns undefined on 204', async () => {
    const fetchImpl = makeFetch([() => new Response(null, { status: 204 })]);
    const t = new Transport({
      baseUrl: 'https://example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });
    const res = await t.request<undefined>({ method: 'POST', path: '/x' });
    expect(res).toBeUndefined();
  });

  it('classifies 400 as MraValidationError and does not retry', async () => {
    const problem = { title: 'bad', status: 400 };
    const fetchImpl = makeFetch([
      () => new Response(JSON.stringify(problem), { status: 400 }),
    ]);
    const t = new Transport({
      baseUrl: 'https://example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });
    await expect(t.request({ method: 'POST', path: '/x' })).rejects.toBeInstanceOf(
      MraValidationError,
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('classifies 401 as MraAuthError', async () => {
    const fetchImpl = makeFetch([() => new Response('', { status: 401 })]);
    const t = new Transport({
      baseUrl: 'https://example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });
    await expect(t.request({ method: 'POST', path: '/x' })).rejects.toBeInstanceOf(
      MraAuthError,
    );
  });

  it('retries 5xx up to maxAttempts then throws MraServerError', async () => {
    const fetchImpl = makeFetch([
      () => new Response('', { status: 503 }),
      () => new Response('', { status: 503 }),
      () => new Response('', { status: 503 }),
    ]);
    const t = new Transport({
      baseUrl: 'https://example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
      retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
    });
    await expect(t.request({ method: 'POST', path: '/x' })).rejects.toBeInstanceOf(
      MraServerError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('recovers if a 5xx is followed by a 200', async () => {
    const fetchImpl = makeFetch([
      () => new Response('', { status: 502 }),
      () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ]);
    const t = new Transport({
      baseUrl: 'https://example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
      retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
    });
    const res = await t.request<{ ok: boolean }>({ method: 'POST', path: '/x' });
    expect(res).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries network errors then throws MraNetworkError', async () => {
    const fetchImpl = makeFetch([
      () => Promise.reject(new TypeError('fetch failed')),
      () => Promise.reject(new TypeError('fetch failed')),
    ]);
    const t = new Transport({
      baseUrl: 'https://example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
      retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 },
    });
    await expect(t.request({ method: 'POST', path: '/x' })).rejects.toBeInstanceOf(
      MraNetworkError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('invokes telemetry hooks on success', async () => {
    const fetchImpl = makeFetch([
      () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ]);
    const events: string[] = [];
    const telemetry: TelemetryHooks = {
      onRequest: (e) => events.push(`req:${e.method} ${e.path} #${e.attempt}`),
      onResponse: (e) => events.push(`res:${e.status}`),
      onError: () => events.push('err'),
    };
    const t = new Transport({
      baseUrl: 'https://example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      telemetry,
      sleep: noSleep,
    });
    await t.request({ method: 'POST', path: '/y' });
    expect(events).toEqual(['req:POST /y #1', 'res:200']);
  });

  it('serialises body and sets default headers', async () => {
    const fetchImpl = makeFetch([() => new Response(null, { status: 204 })]);
    const t = new Transport({
      baseUrl: 'https://example.test/',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      defaultHeaders: { 'X-Foo': 'bar' },
      sleep: noSleep,
    });
    await t.request({ method: 'POST', path: '/echo', body: { hello: 'world' } });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/echo',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ hello: 'world' }),
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Foo': 'bar',
        }),
      }),
    );
  });

  it('appends query parameters', async () => {
    const fetchImpl = makeFetch([() => new Response(null, { status: 204 })]);
    const t = new Transport({
      baseUrl: 'https://example.test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });
    await t.request({
      method: 'GET',
      path: '/list',
      query: { page: 1, pageSize: 50, missing: undefined },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/list?page=1&pageSize=50',
      expect.any(Object),
    );
  });
});
