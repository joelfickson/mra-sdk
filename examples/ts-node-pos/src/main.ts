/**
 * Minimal POS example: activates a terminal, submits a sale, demonstrates the
 * offline-queue replay path. Designed to run against the Prism mock at
 * http://localhost:4010 (see tools/mock-server) - boot it with `pnpm dev:mock`
 * in another terminal first.
 */
import {
  MraEis,
  MraOfflineQueuedError,
  MraValidationError,
} from 'mra-sdk';
import type { components } from 'mra-sdk/raw';

type UnActivatedTerminal = components['schemas']['UnActivatedTerminal'];
type SalesInvoice = components['schemas']['SalesInvoice'];

const baseUrl = process.env.MRA_BASE_URL ?? 'http://localhost:4010';

const placeholderInvoice = (n: number): SalesInvoice =>
  // The mock server doesn't validate body shape, so we send a bare placeholder.
  ({ invoiceNumber: `INV-${n}` } as unknown as SalesInvoice);

async function main(): Promise<void> {
  const client = new MraEis({ baseUrl });

  console.log(`Pointing at ${baseUrl}`);

  // Step 1 - terminal activation (anonymous). Prism validates the request body
  // against the OpenAPI schema; sending a placeholder fails with 422, which is
  // exactly what we'd want a real client to see for an incomplete payload.
  try {
    await client.onboarding.activateTerminal({} as UnActivatedTerminal);
    console.log('activation accepted (real terminal payload)');
  } catch (err) {
    if (err instanceof MraValidationError) {
      console.log(`activation rejected by validator: ${err.message} (expected against mock)`);
    } else {
      throw err;
    }
  }

  // Set a fake token so subsequent calls have an Authorization header. In a
  // real flow the activation -> confirmation cycle yields the token.
  await client.tokenStore.set({ value: 'demo-token', expiresAt: Date.now() + 60 * 60 * 1000 });

  // Step 2 - try submitting a sale online. Prism either rejects the placeholder
  // body (422) or fails to serialise the response (500); both are expected when
  // running against the mock and demonstrate the SDK's error taxonomy.
  try {
    await client.offline.submit(placeholderInvoice(Date.now()));
    console.log('online submit succeeded');
  } catch (err) {
    if (err instanceof MraOfflineQueuedError) {
      console.log(`online submit failed -> queued offline as ${err.queueId}`);
    } else if (err instanceof MraValidationError) {
      console.log(`online submit rejected by validator: ${err.message} (expected against mock)`);
    } else {
      throw err;
    }
  }

  // Step 3 - simulate offline submission by pointing at an unreachable URL.
  const offlineClient = new MraEis({ baseUrl: 'http://127.0.0.1:1' });
  await offlineClient.tokenStore.set({
    value: 'demo-token',
    expiresAt: Date.now() + 60 * 60 * 1000,
  });
  try {
    await offlineClient.offline.submit(placeholderInvoice(Date.now() + 1));
  } catch (err) {
    if (err instanceof MraOfflineQueuedError) {
      console.log(`queued offline as ${err.queueId}`);
    } else {
      throw err;
    }
  }
  console.log('offline queue size:', await offlineClient.offline.storage.size());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
