/**
 * Screenshot key Bible pages for result.md
 * Usage: node scripts/screenshot.mjs
 * Prerequisites: npm run build, then serve dist with: npx astro preview
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SHOTS_DIR = join(ROOT, 'missions', 'MISSION-25049', 'screenshots');

if (!existsSync(SHOTS_DIR)) mkdirSync(SHOTS_DIR, { recursive: true });

const BASE = 'http://localhost:4321/the-upper-room';

const pages = [
  { name: 'bible-landing', url: `${BASE}/bible/`, waitFor: '#passage-content' },
  { name: 'john-3', url: `${BASE}/bible/john/3`, waitFor: null },
  { name: 'psalms-23', url: `${BASE}/bible/psalms/23`, waitFor: null },
  { name: 'romans-8', url: `${BASE}/bible/romans/8`, waitFor: null },
];

async function screenshot() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const results = [];

  for (const { name, url, waitFor } of pages) {
    console.log(`Screenshotting: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // If it's a redirect page, wait for the SPA to potentially load
      // Check if we were redirected to the SPA
      const currentUrl = page.url();
      if (currentUrl.includes('#')) {
        // We're in the SPA — wait for content to load
        await page.waitForTimeout(3000);
        const hasError = await page.$('#error-state:not([style*="display: none"])');
        if (hasError) {
          console.log(`  → SPA loaded but showing error state for ${name}`);
        } else {
          await page.waitForTimeout(2000);
          console.log(`  → SPA content loaded for ${name}`);
        }
      } else if (waitFor) {
        await page.waitForSelector(waitFor, { timeout: 10000 });
      }

      const shotPath = join(SHOTS_DIR, `${name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      results.push({ name, path: shotPath, url });
      console.log(`  ✓ Saved: ${shotPath}`);
    } catch (e) {
      console.error(`  ✗ Failed: ${e.message}`);
      results.push({ name, error: e.message, url });
    }
  }

  await browser.close();
  return results;
}

const results = await screenshot();
console.log('\nScreenshot results:');
results.forEach(r => {
  if (r.error) console.log(`  ✗ ${r.name}: ${r.error}`);
  else console.log(`  ✓ ${r.name}: ${r.path}`);
});
