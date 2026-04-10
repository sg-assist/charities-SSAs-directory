#!/usr/bin/env npx tsx
/**
 * Master Scrape Orchestrator
 *
 * Runs all scraping scripts in sequence:
 * 1. charities.gov.sg — registered charities
 * 2. NCSS — social service agencies
 * 3. AIC — care facilities
 * 4. Government guidelines — MOH, MSF, AIC, NCSS web pages
 *
 * Usage:
 *   npx tsx scripts/scrape-all.ts
 *   npx tsx scripts/scrape-all.ts --dry-run
 */

import { execSync } from 'child_process';
import * as path from 'path';

const SCRIPTS_DIR = path.resolve(__dirname);

const SCRAPERS = [
  { name: 'Charities.gov.sg', script: 'scrape-charities-gov.ts' },
  { name: 'NCSS Directory', script: 'scrape-ncss.ts' },
  { name: 'AIC Care Services', script: 'scrape-aic.ts' },
  { name: 'Government Guidelines', script: 'scrape-guidelines.ts' },
];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const passthrough = dryRun ? ' --dry-run' : '';

  console.log('='.repeat(60));
  console.log('Master Scrape Orchestrator');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Scrapers: ${SCRAPERS.length}`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  const results: { name: string; success: boolean; duration: number }[] = [];

  for (const scraper of SCRAPERS) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Running: ${scraper.name}`);
    console.log(`${'─'.repeat(60)}`);

    const scraperStart = Date.now();
    try {
      execSync(
        `npx tsx ${path.join(SCRIPTS_DIR, scraper.script)}${passthrough}`,
        {
          stdio: 'inherit',
          cwd: path.resolve(SCRIPTS_DIR, '..'),
          timeout: 120000, // 2 minute timeout per scraper
        }
      );
      results.push({ name: scraper.name, success: true, duration: Date.now() - scraperStart });
    } catch (error) {
      console.error(`\n  [ERROR] ${scraper.name} failed:`, error);
      results.push({ name: scraper.name, success: false, duration: Date.now() - scraperStart });
    }
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('Scrape Summary');
  console.log('='.repeat(60));

  for (const result of results) {
    const status = result.success ? 'OK' : 'FAILED';
    const duration = (result.duration / 1000).toFixed(1);
    console.log(`  ${status.padEnd(8)} ${result.name} (${duration}s)`);
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nTotal: ${succeeded} succeeded, ${failed} failed in ${totalDuration}s`);
  if (dryRun) console.log('\nThis was a DRY RUN — no changes were made.');
  console.log('='.repeat(60));

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
