# ts-node-pos example

Tiny script that exercises the SDK against either the real MRA EIS API or the
Prism mock from `tools/mock-server`.

## Run against the mock

```sh
# Terminal A
pnpm dev:mock

# Terminal B
pnpm --filter @mra-sdk/example-ts-node-pos start
```

## Run against a real endpoint

```sh
MRA_BASE_URL=https://eis-api.mra.mw \
  pnpm --filter @mra-sdk/example-ts-node-pos start
```

You will need to supply a real activation payload and a working signer to go
beyond the activation step.
