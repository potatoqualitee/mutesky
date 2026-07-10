#!/usr/bin/env node
// CLI wrapper around validateTrending (lib.js) for the codex curation pass
// in .github/workflows/trending.yml. Exits nonzero on any problem so the
// workflow reverts to the heuristic output. Optional env:
//   HEADLINES_FILE  -- headline dump from update.js; with BASELINE_STATE,
//   BASELINE_STATE  -- pre-curation state; phrases codex added must appear
//                      in a fetched headline.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTrending } from './lib.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const loadJson = filePath => readFile(filePath, 'utf8').then(JSON.parse);

const category = await loadJson(path.join(repoRoot, 'keywords', 'trending.json'));
const state = await loadJson(path.join(repoRoot, 'keywords', 'trending-state.json'));

let headlines = null;
let baselinePhrases = null;
let baselineUpdatedAt = null;
if (process.env.HEADLINES_FILE && process.env.BASELINE_STATE) {
    headlines = await loadJson(process.env.HEADLINES_FILE);
    const baseline = await loadJson(process.env.BASELINE_STATE);
    baselinePhrases = baseline.phrases || {};
    baselineUpdatedAt = baseline.updatedAt || null;
}

const problems = validateTrending({ category, state, headlines, baselinePhrases, baselineUpdatedAt });
if (problems.length) {
    console.error(`trending validation failed:\n  ${problems.join('\n  ')}`);
    process.exit(1);
}
const published = Object.keys(category['New Developments']?.keywords || {}).length;
console.log(`trending files valid: ${published} published, ${Object.keys(state.phrases || {}).length} tracked`);
