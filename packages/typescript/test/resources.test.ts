import { describe, expect, it, vi } from 'vitest';
import {
  MraEis,
  MraValidationError,
  unwrap,
  type ApiEnvelope,
} from '../src/index.js';

const noSleep = () => Promise.resolve();

const makeFetch = (handlers: Array<(input: string, init: RequestInit) => Response>) => {
  let i = 0;
  return vi.fn(async (input: string, init: RequestInit) => {
    const handler = handlers[i++];
    if (!handler) throw new Error(`unexpected fetch call ${i}`);
    return handler(input, init);
  });
};

describe('unwrap', () => {
  it('returns data on success', () => {
    const env: ApiEnvelope<number> = { statusCode: 200, data: 42 };
    expect(unwrap(env, { method: 'POST', path: '/x' })).toBe(42);
  });
  it('throws MraValidationError when errors[] is non-empty', () => {
    const env: ApiEnvelope<number> = {
      statusCode: 400,
      errors: [{ errorMessage: 'bad input' }],
    };
    expect(() => unwrap(env, { method: 'POST', path: '/x' })).toThrowError(MraValidationError);
  });
});

describe('MraEis facade', () => {
  it('wires sales.submit through the authed transport with bearer token', async () => {
    const fetchImpl = makeFetch([
      (url, init) => {
        expect(url).toBe('https://eis-api.mra.mw/api/v1/sales/submit-sales-transaction');
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer demo');
        return new Response(JSON.stringify({ statusCode: 200, data: { invoiceNumber: 'IV-1' } }), {
          status: 200,
        });
      },
    ]);

    const client = new MraEis({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await client.tokenStore.set({ value: 'demo', expiresAt: Date.now() + 60_000 });

    // Cast: SalesInvoice has many fields we don't need to populate for the wiring smoke test
    const result = await client.sales.submit({} as never);
    expect(result).toEqual({ invoiceNumber: 'IV-1' });
  });

  it('translates a non-empty errors[] into MraValidationError', async () => {
    const fetchImpl = makeFetch([
      () =>
        new Response(
          JSON.stringify({
            statusCode: 422,
            errors: [{ errorCode: 'E1', errorMessage: 'invalid TIN' }],
          }),
          { status: 200 },
        ),
    ]);
    const client = new MraEis({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await client.tokenStore.set({ value: 'demo', expiresAt: Date.now() + 60_000 });

    await expect(client.utilities.ping()).rejects.toMatchObject({
      name: 'MraValidationError',
      message: 'invalid TIN',
    });
  });

  it('attaches x-signature on confirm-activation and skips Authorization (anonymous)', async () => {
    const fetchImpl = makeFetch([
      (url, init) => {
        expect(url).toBe(
          'https://eis-api.mra.mw/api/v1/onboarding/terminal-activated-confirmation',
        );
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBeUndefined();
        expect(headers['x-signature']).toBe('signed');
        return new Response(JSON.stringify({ statusCode: 200, data: true }), { status: 200 });
      },
    ]);
    const signer = { sign: vi.fn(async () => 'signed') };
    const client = new MraEis({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      signer,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    const ok = await client.onboarding.confirmActivation({} as never);
    expect(ok).toBe(true);
    expect(signer.sign).toHaveBeenCalled();
  });

  it('passes query parameters for raw-material list', async () => {
    const fetchImpl = makeFetch([
      (url) => {
        expect(url).toBe(
          'https://eis-api.mra.mw/api/v1/raw-material/get-raw-material?page=1&pageSize=25',
        );
        return new Response(JSON.stringify({ statusCode: 200, data: { items: [] } }), {
          status: 200,
        });
      },
    ]);
    const client = new MraEis({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await client.tokenStore.set({ value: 'demo', expiresAt: Date.now() + 60_000 });
    await client.rawMaterial.list({ page: 1, pageSize: 25 });
  });
});
