#!/usr/bin/env npx tsx
/**
 * Charities.gov.sg Scraper
 *
 * Scrapes the Commissioner of Charities public register to extract
 * charity details: name, UEN, address, activities, sector.
 *
 * Usage:
 *   npx tsx scripts/scrape-charities-gov.ts
 *   npx tsx scripts/scrape-charities-gov.ts --dry-run
 *   npx tsx scripts/scrape-charities-gov.ts --limit 50
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

function createPrismaClient() {
  const { PrismaPg } = require('@prisma/adapter-pg');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set');
  const adapter = new PrismaPg({ connectionString: dbUrl });
  return new PrismaClient({ adapter });
}

let _prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!_prisma) _prisma = createPrismaClient();
  return _prisma;
}

// ── Charity sector to category mapping ──────────────────────────────────

const SECTOR_CATEGORY_MAP: Record<string, string[]> = {
  'social and welfare': ['community'],
  'health': ['healthcare'],
  'education': ['children'],
  'community': ['community'],
  'arts and heritage': ['community'],
  'sports': ['community'],
  'religion': ['community'],
  'elderly': ['eldercare'],
  'children and youth': ['children'],
  'disability': ['disability'],
  'family': ['family'],
  'mental health': ['mental_health'],
};

function mapSectorToCategories(sector: string): string[] {
  const lowerSector = sector.toLowerCase();
  for (const [key, cats] of Object.entries(SECTOR_CATEGORY_MAP)) {
    if (lowerSector.includes(key)) return cats;
  }
  return ['community'];
}

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

// ── Main scraping logic ────────────────────────────────────────────────

interface CharityRecord {
  name: string;
  uen: string;
  sector: string;
  address?: string;
  postalCode?: string;
  activities?: string;
}

/**
 * Fetch charity data from charities.gov.sg
 *
 * The Commissioner of Charities provides a public API at:
 * https://www.charities.gov.sg/Pages/AdvanceSearch.aspx
 *
 * This function attempts to fetch data from the public API.
 * If the API is unavailable or changes format, it will fall back
 * to returning an empty array with a warning.
 */
async function fetchCharities(limit: number): Promise<CharityRecord[]> {
  const records: CharityRecord[] = [];

  try {
    // The charities.gov.sg search endpoint
    const searchUrl = 'https://www.charities.gov.sg/api/charity/search';
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SG-Directory-Bot/1.0 (admin@sgassist.sg)',
      },
      body: JSON.stringify({
        pageNo: 1,
        pageSize: Math.min(limit, 100),
        searchTerm: '',
        charityStatus: 'Registered',
      }),
    });

    if (!response.ok) {
      console.warn(`[CharitiesScraper] API returned ${response.status}. The API may have changed.`);
      console.warn('[CharitiesScraper] Falling back to empty results. Manual data entry may be required.');
      return records;
    }

    const data = await response.json();
    const items = data?.results || data?.charities || data?.data || [];

    for (const item of items.slice(0, limit)) {
      records.push({
        name: item.name || item.charityName || item.Name || '',
        uen: item.uen || item.UEN || item.registrationNumber || '',
        sector: item.sector || item.primarySector || item.Sector || 'Community',
        address: item.address || item.registeredAddress || '',
        postalCode: item.postalCode || item.PostalCode || '',
        activities: item.activities || item.primaryActivities || item.objectives || '',
      });
    }
  } catch (error) {
    console.warn(`[CharitiesScraper] Failed to fetch from API: ${error}`);
    console.warn('[CharitiesScraper] The charities.gov.sg API may require different authentication or have changed.');
    console.warn('[CharitiesScraper] You may need to update the API endpoint or use a different data source.');
  }

  return records;
}

async function upsertOrganisation(record: CharityRecord, dryRun: boolean) {
  const slug = deriveSlug(record.name);
  if (!slug || !record.name) return false;

  const categories = mapSectorToCategories(record.sector);
  const description = record.activities
    ? record.activities.slice(0, 500)
    : `${record.name} is a registered charity in Singapore operating in the ${record.sector} sector.`;

  if (dryRun) {
    console.log(`  [DRY] ${record.name} (${record.uen}) — ${categories.join(', ')}`);
    return true;
  }

  try {
    await getPrisma().organisation.upsert({
      where: { slug },
      create: {
        name: record.name,
        slug,
        type: 'charity',
        categories,
        description,
        address: record.address || null,
        postalCode: record.postalCode || null,
        registrationNo: record.uen || null,
        sourceUrl: 'https://www.charities.gov.sg',
        lastVerified: new Date(),
        isActive: true,
      },
      update: {
        description,
        address: record.address || undefined,
        postalCode: record.postalCode || undefined,
        registrationNo: record.uen || undefined,
        lastVerified: new Date(),
      },
    });
    return true;
  } catch (error) {
    console.error(`  [ERROR] Failed to upsert ${record.name}: ${error}`);
    return false;
  }
}

// ── CLI ────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((_, i) => args[i - 1] === '--limit');
  const limit = limitArg ? parseInt(limitArg) : 200;

  console.log('='.repeat(60));
  console.log('Charities.gov.sg Scraper');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit}`);
  console.log('='.repeat(60));

  const records = await fetchCharities(limit);
  console.log(`\nFetched ${records.length} charity records\n`);

  let created = 0;
  let errors = 0;

  for (const record of records) {
    const success = await upsertOrganisation(record, dryRun);
    if (success) created++;
    else errors++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Complete: ${created} processed, ${errors} errors`);
  if (dryRun) console.log('This was a DRY RUN — no changes were made.');
  console.log('='.repeat(60));

  if (_prisma) await _prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  if (_prisma) _prisma.$disconnect().catch(() => {});
  process.exit(1);
});
