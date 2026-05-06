# @mra-sdk/mock-server

Prism-based mock of the MRA EIS API derived from `spec/swagger.json`.

## Usage

```sh
pnpm dev:mock
```

This boots Prism on http://localhost:4010 with dynamic responses generated
from the spec's example values. Use it to develop against the SDK without
hitting real MRA infrastructure.

To point the SDK at the mock:

```ts
import { MraEis } from 'mra-sdk';

const client = new MraEis({ baseUrl: 'http://localhost:4010' });
```

## Limitations

- Prism does not enforce or generate `x-signature` values - signed endpoints
  accept any signature header.
- The mock has no notion of state, so the offline reconciliation flow still
  needs to be exercised against a sandbox or a custom stateful mock.
- The MRA spec's `*APIResponse` envelope sometimes generates Prism responses
  that don't match the SDK's `unwrap` expectations exactly. Pass
  `Prefer: example=...` headers if you need a specific example.
