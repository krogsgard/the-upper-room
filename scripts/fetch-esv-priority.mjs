/**
 * Priority ESV fetch — NT first, then remaining OT.
 * Smarter rate limiting with exponential backoff.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'src', 'data', 'esv-cache');
const TOKEN = 'e2ce4d1b60dc9181904eb7832e3e38c398d7c93c';
const DELAY_MS = 800;

const bibleStructure = JSON.parse(
  readFileSync(join(ROOT, 'src', 'data', 'bible-structure.json'), 'utf8')
);

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

const OT = bibleStructure.testament.OT;
const NT = bibleStructure.testament.NT;

// Build priority order: NT first, then remaining OT
const priorityPassages = [];

// NT all chapters
for (const book of NT) {
  for (let ch = 1; ch <= book.chapters; ch++) {
    priorityPassages.push({ book, chapter: ch });
  }
}

// Remaining OT (not yet cached)
for (const book of OT) {
  for (let ch = 1; ch <= book.chapters; ch++) {
    const cacheFile = join(CACHE_DIR, `${book.slug}-${ch}.json`);
    if (!existsSync(cacheFile)) {
      priorityPassages.push({ book, chapter: ch });
    }
  }
}

const total = priorityPassages.length;
console.log(`Passages to fetch: ${total}`);

let fetched = 0;
let skipped = 0;
let failed = 0;
let backoffMs = DELAY_MS;

for (const { book, chapter } of priorityPassages) {
  const cacheFile = join(CACHE_DIR, `${book.slug}-${chapter}.json`);

  if (existsSync(cacheFile)) {
    skipped++;
    if (skipped % 10 === 0) process.stdout.write(`\r[${skipped + fetched + failed}/${total + skipped}] Skipped ${skipped} cached...    `);
    continue;
  }

  const query = encodeURIComponent(`${book.name} ${chapter}`);
  const url = `https://api.esv.org/v3/passage/html/?q=${query}&include-headings=true&include-footnotes=false&include-verse-numbers=true&include-short-copyright=false&include-passage-horizontal-lines=false&include-heading-horizontal-lines=false`;

  let success = false;
  let attempts = 0;
  const maxAttempts = 5;

  while (!success && attempts < maxAttempts) {
    attempts++;
    try {
      const resp = await fetch(url, {
        headers: { Authorization: `Token ${TOKEN}` },
      });

      if (resp.ok) {
        const data = await resp.json();
        let html = data.passages?.[0] ?? '';
        if (html) {
          html = html.replace(/<small class="audio extra_text">.*?<\/small>/gs, '');
          html = html.replace(/<div class="footnotes extra_text">[\s\S]*?<\/div>/gs, '');
          html = html.replace(/<p>\(<a href="http:\/\/www\.esv\.org"[^>]*>ESV<\/a>\)<\/p>/g, '');
          writeFileSync(cacheFile, JSON.stringify({ html }), 'utf8');
          fetched++;
          success = true;
          backoffMs = DELAY_MS; // reset backoff on success
          process.stdout.write(`\r[F:${fetched} S:${skipped} X:${failed}] ${book.slug} ${chapter}          `);
        } else {
          failed++;
          success = true; // empty response, skip
        }
      } else if (resp.status === 429) {
        // Rate limited — exponential backoff
        backoffMs = Math.min(backoffMs * 2, 30000);
        process.stdout.write(`\r[F:${fetched} S:${skipped} X:${failed}] Rate limited, waiting ${backoffMs/1000}s...    `);
        await new Promise(r => setTimeout(r, backoffMs));
      } else {
        console.error(`\nHTTP ${resp.status} for ${book.slug} ${chapter}`);
        failed++;
        success = true;
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000));
      if (attempts >= maxAttempts) failed++;
    }
  }

  await new Promise(r => setTimeout(r, DELAY_MS));
}

console.log(`\n\nDone! Fetched: ${fetched}, Skipped: ${skipped}, Failed: ${failed}`);
console.log(`Total cached: ${fetched + skipped} / 1189`);
