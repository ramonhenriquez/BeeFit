import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Publish only the expected compiler output, never checkout files or backups.
// This is an artifact boundary check, not a substitute for source/secret review.
const root = path.resolve('dist');
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    assert(!entry.isSymbolicLink(), 'Unexpected symlink in the Pages artifact');
    if (entry.isDirectory()) await walk(absolute);
    else files.push(path.relative(root, absolute).split(path.sep).join('/'));
  }
}
await walk(root);
assert(files.includes('index.html'), 'Pages build must emit index.html');
for (const file of files) {
  assert(file === 'index.html' || /^assets\/[A-Za-z0-9_-]+\.(js|css)$/.test(file),
    `Unexpected Pages output: ${file}. Do not publish backups, environment files or other private data.`);
}
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const assets = [...html.matchAll(/(?:src|href)="(\/BeeFit\/assets\/[^"?#]+)"/g)].map((match) => match[1]);
assert(assets.some((url) => url.endsWith('.js')), 'Pages HTML must load JavaScript under /BeeFit/');
assert(assets.some((url) => url.endsWith('.css')), 'Pages HTML must load CSS under /BeeFit/');
assert(!/(?:src|href)="\/(?:src|assets)\//.test(html), 'Root-relative app asset would break project Pages');
for (const url of assets) assert(files.includes(url.slice('/BeeFit/'.length)), `Missing built asset: ${url}`);
console.log(`Verified /BeeFit/ asset paths and ${files.length} expected site files. Only dist/ is publishable.`);
