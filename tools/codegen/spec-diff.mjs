#!/usr/bin/env node
/**
 * Fails with a non-zero exit code if the upstream spec differs from spec/swagger.json.
 * Run in CI to catch silent upstream changes.
 *
 * Override the upstream URL with MRA_SPEC_URL.
 */
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const vendoredPath = resolve(repoRoot, 'spec', 'swagger.json');
const upstreamUrl = process.env.MRA_SPEC_URL ?? 'https://eis-api.mra.mw/swagger/v1/swagger.json';

const [vendoredRaw, upstreamRes] = await Promise.all([
  readFile(vendoredPath, 'utf8'),
  fetch(upstreamUrl),
]);

if (!upstreamRes.ok) {
  console.error(`Failed to fetch upstream spec: ${upstreamRes.status} ${upstreamRes.statusText}`);
  process.exit(2);
}

const upstreamRaw = await upstreamRes.text();

const normalize = (raw) => JSON.stringify(JSON.parse(raw));

if (normalize(vendoredRaw) === normalize(upstreamRaw)) {
  console.log('Spec is in sync with upstream.');
  process.exit(0);
}

console.error('Spec drift detected: spec/swagger.json differs from upstream.');
console.error('  - Update spec/swagger.json with the new upstream content');
console.error('  - Add a dated entry to spec/CHANGELOG-spec.md');
console.error('  - Run `pnpm codegen` to regenerate transport types');
process.exit(1);
