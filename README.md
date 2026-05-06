# mra-sdk

Open-source SDKs for the [Malawi Revenue Authority Electronic Invoicing System (EIS) API](https://eis-api.mra.mw/docs/).

This is an unofficial, community-maintained project. It is not affiliated with the Malawi Revenue Authority.

## Status

| Package | Status | Registry |
| --- | --- | --- |
| `@joelfickson/mra-eis-sdk` (TypeScript) | In development | npm (unpublished) |
| Python | Planned | - |
| .NET | Planned | - |

## What this gives you

- Typed clients over all 28 EIS endpoints (sales, onboarding, stock, raw-material, utilities, configuration)
- Terminal activation flow with `x-signature` request signing
- Automatic terminal-token refresh
- Offline queue + reconciliation against `last-submitted-offline-transaction`
- Pluggable interfaces for token storage, signing, and offline storage
- Typed error taxonomy mapping `ProblemDetails`

## Repo layout

```
spec/                 Vendored swagger.json (source of truth) + fixtures
packages/typescript/  @joelfickson/mra-eis-sdk
packages/python/      Placeholder for future Python SDK
packages/dotnet/      Placeholder for future .NET SDK
tools/codegen/        Generates typed transport from spec/swagger.json
tools/mock-server/    Prism-based mock used by contract tests
examples/             Sample applications
docs/                 Documentation site (Astro Starlight)
```

## Development

```sh
pnpm install
pnpm codegen          # regenerate typed transport from spec/swagger.json
pnpm build
pnpm test
pnpm dev:mock         # boot the mock server on http://localhost:4010
```

## Contributing

Issues and PRs welcome at https://github.com/joelfickson/mra-sdk.

## License

MIT - see [LICENSE](./LICENSE).
