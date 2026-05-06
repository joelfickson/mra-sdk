# Contributing

Thanks for considering a contribution. This project is an unofficial,
community-maintained SDK for the [MRA EIS API](https://eis-api.mra.mw). We aim
to give POS developers in Malawi a tested, batteries-included client so they
can focus on their product instead of re-implementing the same plumbing.

## Ground rules

- Be respectful in issues, PRs, and discussions.
- Don't claim affiliation with the Malawi Revenue Authority.
- Don't open PRs that materially change behaviour without an issue or
  discussion first - a five-minute back-and-forth saves both sides hours.
- Security issues: see [SECURITY.md](./SECURITY.md) (or email
  joel@sekuire.ai if that file is missing).

## Prerequisites

- Node.js 25.0.0 or newer
- pnpm 10.x (`corepack enable` will pick it up automatically)
- Git

## First-time setup

```sh
git clone git@github.com:joelfickson/mra-sdk.git
cd mra-sdk
pnpm install
pnpm codegen        # generate transport types from spec/swagger.json
pnpm build
pnpm test
```

If any of those four commands fails on a clean checkout, that's a bug -
please open an issue.

## Repo layout

```
spec/                   Vendored swagger.json - the source of truth
packages/typescript/    mra-sdk (the v1 deliverable)
packages/python/        Placeholder for a future Python SDK
packages/dotnet/        Placeholder for a future .NET SDK
tools/codegen/          Regenerates typed transport from spec/swagger.json
tools/mock-server/      Prism mock used during development
examples/               Runnable sample apps
```

## Development loop

```sh
# In one terminal: boot the Prism mock on http://localhost:4010
pnpm dev:mock

# In another terminal: run the example or your own scratch
pnpm --filter @mra-sdk/example-ts-node-pos start
```

Run the verification trio before opening a PR:

```sh
pnpm typecheck
pnpm test
pnpm build
```

If you touch a new MRA endpoint, add a unit test that drives it through a
mocked `fetchImpl` and asserts the URL, headers, and body. The existing tests
in `packages/typescript/test/` are good templates.

## Working on the spec

`spec/swagger.json` is vendored and version-pinned. Don't hand-edit it.

If upstream changes:

```sh
pnpm spec:diff   # fails if the vendored spec drifts from upstream
```

To pull a new upstream version:

1. Replace `spec/swagger.json` with the upstream file
2. Add a dated entry to `spec/CHANGELOG-spec.md` describing what changed
3. Run `pnpm codegen` and resolve any compile errors that surface
4. Update or add tests for the affected endpoints
5. Open a PR titled `spec: bump to <date>`

## Coding conventions

- Strict TypeScript: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- ESM source, dual ESM+CJS published via `tsup`
- No comments unless the *why* is non-obvious
- No silent fallbacks - errors should propagate or be wrapped in the
  `MraError` taxonomy with explicit kinds
- Domain types are hand-curated in `packages/typescript/src/types/` (when
  added); generated DTOs stay under `src/generated/` and are re-exported via
  `mra-sdk/raw` for escape hatches

## Tests

- Unit tests use Vitest (`vitest run`) and live in
  `packages/typescript/test/`
- Tests should not require network access. Use a mocked `fetchImpl` and
  inject `sleep: () => Promise.resolve()` to skip retry backoff
- For new resources, lock down the URL, headers, and body shape, and assert
  one happy path + one error path

End-to-end against a real MRA sandbox is a future addition gated on
`MRA_SANDBOX_TOKEN` - if you have credentials and want to help land that
suite, open an issue.

## Changesets

We use [Changesets](https://github.com/changesets/changesets) for versioning
and changelog generation:

```sh
pnpm changeset
```

Pick the package(s) you changed, a bump level (patch/minor/major), and write
a one-line summary aimed at the reader of the changelog. Commit the generated
file under `.changeset/` along with your code.

Internal-only packages (`@mra-sdk/codegen`, `@mra-sdk/mock-server`,
`@mra-sdk/example-ts-node-pos`) are ignored by the release workflow.

## Pull request checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [ ] New behaviour has a test
- [ ] Public API change has a changeset
- [ ] PR description explains the *why*

## Project decisions

- TypeScript ships first; Python and .NET come later. Issues for those
  packages are welcome but won't be picked up until the TS surface
  stabilises.
- Browser support is best-effort. The default offline queue is in-memory;
  Node-specific defaults (e.g. `better-sqlite3` queue) are added behind
  optional peer dependencies.
- The signing algorithm and offline reconciliation semantics are documented
  assumptions until verified against a real MRA sandbox - see
  `spec/CHANGELOG-spec.md`.

## Questions

Open a [GitHub Discussion](https://github.com/joelfickson/mra-sdk/discussions)
or an issue. Direct contact: joel@sekuire.ai.
