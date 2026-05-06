import { generateKeyPairSync, createVerify } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  AuthedTransport,
  InMemoryTokenStore,
  RsaSigner,
  Transport,
  isExpired,
  type AccessToken,
} from '../src/index.js';

const noSleep = () => Promise.resolve();

describe('InMemoryTokenStore', () => {
  it('round-trips a token', async () => {
    const store = new InMemoryTokenStore();
    expect(await store.get()).toBeUndefined();
    await store.set({ value: 'abc', expiresAt: 99 });
    expect(await store.get()).toEqual({ value: 'abc', expiresAt: 99 });
    await store.clear();
    expect(await store.get()).toBeUndefined();
  });
});

describe('isExpired', () => {
  it('treats undefined as expired', () => {
    expect(isExpired(undefined, 0)).toBe(true);
  });
  it('treats tokens within skew as expired', () => {
    const t: AccessToken = { value: 'x', expiresAt: 1_000 };
    expect(isExpired(t, 980, 30)).toBe(true);
    expect(isExpired(t, 950, 30)).toBe(false);
  });
});

describe('RsaSigner', () => {
  it('produces a signature that the matching public key verifies', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const signer = new RsaSigner({
      privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }) as string,
    });
    const body = JSON.stringify({ hello: 'world', n: 1 });
    const sig = await signer.sign(body);

    const verifier = createVerify('SHA256');
    verifier.update(body, 'utf8');
    verifier.end();
    expect(verifier.verify(publicKey, Buffer.from(sig, 'base64'))).toBe(true);
  });
});

const makeFetch = (handlers: Array<(input: string, init: RequestInit) => Response>) => {
  let i = 0;
  return vi.fn(async (input: string, init: RequestInit) => {
    const handler = handlers[i++];
    if (!handler) throw new Error(`unexpected fetch call ${i}`);
    return handler(input, init);
  });
};

describe('AuthedTransport', () => {
  const baseUrl = 'https://example.test';
  const happy = { ok: true };

  const makeTransport = (fetchImpl: ReturnType<typeof makeFetch>) =>
    new Transport({
      baseUrl,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });

  it('attaches Authorization header from the token store', async () => {
    const fetchImpl = makeFetch([
      (_url, init) => {
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer tok-1');
        return new Response(JSON.stringify(happy), { status: 200 });
      },
    ]);
    const tokenStore = new InMemoryTokenStore();
    await tokenStore.set({ value: 'tok-1', expiresAt: Date.now() + 60_000 });

    const auth = new AuthedTransport({
      transport: makeTransport(fetchImpl),
      tokenStore,
    });

    const res = await auth.request<{ ok: boolean }>({ method: 'POST', path: '/x' });
    expect(res).toEqual(happy);
  });

  it('refreshes proactively when the token is expired', async () => {
    const fetchImpl = makeFetch([
      (_url, init) => {
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer fresh');
        return new Response(JSON.stringify(happy), { status: 200 });
      },
    ]);
    const tokenStore = new InMemoryTokenStore();
    await tokenStore.set({ value: 'old', expiresAt: 0 });

    const refresh = vi.fn(async (): Promise<AccessToken> => ({
      value: 'fresh',
      expiresAt: Date.now() + 60_000,
    }));

    const auth = new AuthedTransport({
      transport: makeTransport(fetchImpl),
      tokenStore,
      refresh,
    });
    await auth.request({ method: 'POST', path: '/x' });
    expect(refresh).toHaveBeenCalledOnce();
    expect((await tokenStore.get())?.value).toBe('fresh');
  });

  it('refreshes-then-retries on a 401 response', async () => {
    const fetchImpl = makeFetch([
      () => new Response('', { status: 401 }),
      (_url, init) => {
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer fresh');
        return new Response(JSON.stringify(happy), { status: 200 });
      },
    ]);
    const tokenStore = new InMemoryTokenStore();
    await tokenStore.set({ value: 'old', expiresAt: Date.now() + 60_000 });

    const refresh = vi.fn(async (): Promise<AccessToken> => ({
      value: 'fresh',
      expiresAt: Date.now() + 60_000,
    }));

    const auth = new AuthedTransport({
      transport: makeTransport(fetchImpl),
      tokenStore,
      refresh,
    });
    const res = await auth.request<{ ok: boolean }>({ method: 'POST', path: '/x' });
    expect(res).toEqual(happy);
    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent refreshes', async () => {
    const fetchImpl = makeFetch([
      (_u, init) => {
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer fresh');
        return new Response(JSON.stringify({ a: 1 }), { status: 200 });
      },
      (_u, init) => {
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer fresh');
        return new Response(JSON.stringify({ b: 2 }), { status: 200 });
      },
    ]);
    const tokenStore = new InMemoryTokenStore();
    await tokenStore.set({ value: 'old', expiresAt: 0 });

    const refresh = vi.fn(async (): Promise<AccessToken> => {
      await new Promise((r) => setTimeout(r, 10));
      return { value: 'fresh', expiresAt: Date.now() + 60_000 };
    });

    const auth = new AuthedTransport({
      transport: makeTransport(fetchImpl),
      tokenStore,
      refresh,
    });
    const [a, b] = await Promise.all([
      auth.request({ method: 'POST', path: '/a' }),
      auth.request({ method: 'POST', path: '/b' }),
    ]);
    expect(a).toEqual({ a: 1 });
    expect(b).toEqual({ b: 2 });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('skips Authorization for anonymous requests', async () => {
    const fetchImpl = makeFetch([
      (_url, init) => {
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBeUndefined();
        return new Response(JSON.stringify(happy), { status: 200 });
      },
    ]);
    const auth = new AuthedTransport({
      transport: makeTransport(fetchImpl),
      tokenStore: new InMemoryTokenStore(),
    });
    await auth.request({ method: 'POST', path: '/activate', anonymous: true });
  });

  it('signs requests when sign:true', async () => {
    const fetchImpl = makeFetch([
      (_url, init) => {
        const headers = init.headers as Record<string, string>;
        expect(headers['x-signature']).toBe(`sig:${JSON.stringify('hello')}`);
        return new Response(JSON.stringify(happy), { status: 200 });
      },
    ]);
    const tokenStore = new InMemoryTokenStore();
    await tokenStore.set({ value: 'tok', expiresAt: Date.now() + 60_000 });

    const signer = { sign: vi.fn(async (body: string) => `sig:${body}`) };
    const auth = new AuthedTransport({
      transport: makeTransport(fetchImpl),
      tokenStore,
      signer,
    });
    await auth.request({ method: 'POST', path: '/confirm', body: 'hello', sign: true });
    expect(signer.sign).toHaveBeenCalledWith(JSON.stringify('hello'));
  });

  it('throws when sign:true is set but no Signer is configured', async () => {
    const fetchImpl = makeFetch([]);
    const tokenStore = new InMemoryTokenStore();
    await tokenStore.set({ value: 'tok', expiresAt: Date.now() + 60_000 });
    const auth = new AuthedTransport({
      transport: makeTransport(fetchImpl),
      tokenStore,
    });
    await expect(
      auth.request({ method: 'POST', path: '/confirm', sign: true }),
    ).rejects.toThrow(/x-signature/);
  });
});
