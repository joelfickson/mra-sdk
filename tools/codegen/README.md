# @mra-sdk/codegen

Generates TypeScript types from `spec/swagger.json` into `packages/typescript/src/generated/schema.d.ts`.

## Usage

```sh
pnpm codegen
```

The generated file is gitignored - regenerate locally and at build time.

## Spec drift check

```sh
pnpm spec:diff
```

Downloads the upstream MRA EIS spec and fails if it differs from the vendored copy. CI runs this on every PR.

When drift is detected:

1. Update `spec/swagger.json` with the upstream content
2. Add a dated entry to `spec/CHANGELOG-spec.md` describing the change
3. Run `pnpm codegen` and commit the regenerated types
