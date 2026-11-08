import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../nicovideo-speed-seek-sync.user.js', import.meta.url), 'utf8');
const repo = 'https://github.com/ButaMonky/nicovideo-speed-seek-sync';
const raw = 'https://raw.githubusercontent.com/ButaMonky/nicovideo-speed-seek-sync/main/nicovideo-speed-seek-sync.user.js';
for (const line of [
  '// @namespace    ' + repo,
  '// @version      1.2.1',
  '// @downloadURL  ' + raw,
  '// @updateURL    ' + raw,
  '// @homepageURL  ' + repo,
  '// @supportURL    ' + repo + '/issues',
  '// @license      MIT',
]) assert.ok(source.includes(line), `Missing metadata: ${line}`);
assert.ok(!source.includes('// @downloadURL  none'), 'Manual-only download URL must not remain');
assert.ok(source.includes('BEGIN ORIGINAL SPEED MODULE'), 'Upstream speed module boundary missing');
assert.ok(source.includes('END ORIGINAL SPEED MODULE'), 'Upstream speed module boundary missing');
assert.ok(source.includes('Nicovideo External Seek Clock Sync v0.1.4'), 'Seek component attribution missing');
assert.ok(source.includes('__NICO_SPEED_SEEK_BUNDLE__'), 'Duplicate-install guard missing');
assert.ok(source.includes('__NICO_EXTERNAL_SEEK_SYNC__'), 'Seek diagnostic API missing');
console.log('[verify] userscript metadata and integration markers passed');
