/**
 * Pre-fetch all ESV Bible passages with rate limiting.
 * Saves to src/data/esv-cache/{book-slug}-{chapter}.json
 * Skips files that already exist.
 *
 * Usage: node scripts/fetch-esv.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'src', 'data', 'esv-cache');
const TOKEN = 'e2ce4d1b60dc9181904eb7832e3e38c398d7c93c';
const DELAY_MS = 600; // ~1.6 req/sec — well under typical rate limits

const bibleStructure = JSON.parse(
  readFileSync(join(ROOT, 'src', 'data', 'bible-structure.json'), 'utf8')
);

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

const allBooks = [
  ...bibleStructure.testament.OT,
  ...bibleStructure.testament.NT,
];

// Build full list of passages to fetch
const passages = [];
for (const book of allBooks) {
  for (let ch = 1; ch <= book.chapters; ch++) {
    passages.push({ book, chapter: ch });
  }
}

console.log(`Total passages: ${passages.length}`);

let fetched = 0;
let skipped = 0;
let failed = 0;

for (const { book, chapter } of passages) {
  const cacheFile = join(CACHE_DIR, `${book.slug}-${chapter}.json`);

  if (existsSync(cacheFile)) {
    skipped++;
    process.stdout.write(`\r[${skipped + fetched + failed}/${passages.length}] Skipped (cached): ${book.slug} ${chapter}        `);
    continue;
  }

  const query = encodeURIComponent(`${book.name} ${chapter}`);
  const url = `https://api.esv.org/v3/passage/html/?q=${query}&include-headings=true&include-footnotes=false&include-verse-numbers=true&include-short-copyright=false&include-passage-horizontal-lines=false&include-heading-horizontal-lines=false`;

  let retries = 3;
  let success = false;

  while (retries > 0 && !success) {
    try {
      const resp = await fetch(url, {
        headers: { Authorization: `Token ${TOKEN}` },
      });

      if (resp.ok) {
        const data = await resp.json();
        let html = data.passages?.[0] ?? '';
        // Strip audio link
        html = html.replace(/<small class="audio extra_text">.*?<\/small>/gs, '');
        // Strip footnotes
        html = html.replace(/<div class="footnotes extra_text">[\s\S]*?<\/div>/gs, '');
        // Strip copyright link
        html = html.replace(/<p>\(<a href="http:\/\/www\.esv\.org"[^>]*>ESV<\/a>\)<\/p>/g, '');

        writeFileSync(cacheFile, JSON.stringify({ html }), 'utf8');
        fetched++;
        success = true;
        process.stdout.write(`\r[${skipped + fetched + failed}/${passages.length}] Fetched: ${book.slug} ${chapter}        `);
      } else if (resp.status === 429 || resp.status === 503) {
        // Rate limited — wait longer and retry
        process.stdout.write(`\r[${skipped + fetched + failed}/${passages.length}] Rate limited, waiting...        `);
        await new Promise(r => setTimeout(r, 5000));
        retries--;
      } else {
        process.stdout.write(`\r[${skipped + fetched + failed}/${passages.length}] HTTP ${resp.status}: ${book.slug} ${chapter}        `);
        retries = 0;
        failed++;
      }
    } catch (e) {
      retries--;
      if (retries === 0) failed++;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Rate limit delay
  await new Promise(r => setTimeout(r, DELAY_MS));
}

console.log(`\n\nDone! Fetched: ${fetched}, Skipped: ${skipped}, Failed: ${failed}`);
