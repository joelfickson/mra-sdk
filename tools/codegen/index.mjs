#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const specPath = resolve(repoRoot, 'spec', 'swagger.json');
const tsOut = resolve(repoRoot, 'packages', 'typescript', 'src', 'generated', 'schema.d.ts');

const banner = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT.
 *
 * Regenerate with \`pnpm codegen\` from \`spec/swagger.json\`.
 * Source: https://eis-api.mra.mw/swagger/v1/swagger.json
 */
`;

const ast = await openapiTS(pathToFileURL(specPath), {
  exportType: true,
  immutable: false,
  alphabetize: true,
});

await mkdir(dirname(tsOut), { recursive: true });
await writeFile(tsOut, banner + astToString(ast), 'utf8');

console.log(`Wrote ${tsOut}`);
