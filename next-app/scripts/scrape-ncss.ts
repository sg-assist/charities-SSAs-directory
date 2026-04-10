#!/usr/bin/env npx tsx
/**
 * NCSS Social Service Directory Scraper
 *
 * Scrapes the National Council of Social Service directory to extract
 * SSA details: name, services, contact info, address.
 *
 * Usage:
 *   npx tsx scripts/scrape-ncss.ts
 *   npx tsx scripts/scrape-ncss.ts --dry-run
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

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

// ── Service type to category mapping ────────────────────────────────────

const SERVICE_CATEGORY_MAP: Record<string, string[]> = {
  'eldercare': ['eldercare'],
  'elderly': ['eldercare'],
  'aged care': ['eldercare'],
  'nursing home': ['eldercare'],
  'disability': ['disability'],
  'special needs': ['disability'],
  'mental health': ['mental_health'],
  'counselling': ['mental_health', 'family'],
  'family': ['family'],
  'children': ['children'],
  'youth': ['children'],
  'healthcare': ['healthcare'],
  'hospice': ['palliative'],
  'palliative': ['palliative'],
  'community': ['community'],
  'financial': ['financial'],
};

function mapServiceToCategories(services: string): string[] {
  const lower = services.toLowerCase();
  const categories = new Set<string>();
  for (const [keyword, cats] of Object.entries(SERVICE_CATEGORY_MAP)) {
    if (lower.includes(keyword)) {
      cats.forEach(c => categories.add(c));
    }
  }
  return categories.size > 0 ? Array.from(categories) : ['community'];
}

interface NcssRecord {
  name: string;
  services: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

/**
 * Fetch SSA data from NCSS directory.
 *
 * NCSS provides a social service directory that may be accessible via:
 * https://www.ncss.gov.sg/our-initiatives/resources-and-tools/service-directory
 *
 * If the API is not available, falls back gracefully.
 */
async function fetchNcssDirectory(): Promise<NcssRecord[]> {
  const records: NcssRecord[] = [];

  try {
    // Attempt to access the NCSS directory API
    const response = await fetch('https://www.ncss.gov.sg/api/directory/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SG-Directory-Bot/1.0 (admin@sgassist.sg)',
      },
      body: JSON.stringify({ pageSize: 200, pageNo: 1 }),
    });

    if (!response.ok) {
      console.warn(`[NCSSScraper] API returned ${response.status}. Trying alternative endpoints...`);

      // Try alternative endpoint
      const altResponse = await fetch('https://www.ncss.gov.sg/api/servicedirectory', {
        headers: { 'User-Agent': 'SG-Directory-Bot/1.0 (admin@sgassist.sg)' },
      });

      if (!altResponse.ok) {
        console.warn('[NCSSScraper] No accessible API found. Manual data entry may be required.');
        return records;
      }

      const altData = await altResponse.json();
      const items = altData?.results || altData?.data || [];
      for (const item of items) {
        records.push({
          name: item.name || item.organisationName || '',
          services: item.services || item.description || '',
          address: item.address || '',
          phone: item.phone || item.contactNumber || '',
          email: item.email || '',
          website: item.website || '',
        });
      }
      return records;
    }

    const data = await response.json();
    const items = data?.results || data?.data || [];

    for (const item of items) {
      records.push({
        name: item.name || item.organisationName || '',
        services: item.services || item.description || '',
        address: item.address || '',
        phone: item.phone || item.contactNumber || '',
        email: item.email || '',
        website: item.website || '',
      });
    }
  } catch (error) {
    console.warn(`[NCSSScraper] Failed to fetch: ${error}`);
    console.warn('[NCSSScraper] The NCSS directory may require browser-based access.');
  }

  return records;
}

async function upsertOrganisation(record: NcssRecord, dryRun: boolean) {
  const slug = deriveSlug(record.name);
  if (!slug || !record.name) return false;

  const categories = mapServiceToCategories(record.services);
  const description = record.services
    ? record.services.slice(0, 500)
    : `${record.name} is a social service agency registered with NCSS Singapore.`;

  if (dryRun) {
    console.log(`  [DRY] ${record.name} — ${categories.join(', ')}`);
    return true;
  }

  try {
    await getPrisma().organisation.upsert({
      where: { slug },
      create: {
        name: record.name,
        slug,
        type: 'ssa',
        categories,
        description,
        address: record.address || null,
        phone: record.phone || null,
        email: record.email || null,
        website: record.website || null,
        sourceUrl: 'https://www.ncss.gov.sg',
        lastVerified: new Date(),
        isActive: true,
      },
      update: {
        description,
        phone: record.phone || undefined,
        email: record.email || undefined,
        website: record.website || undefined,
        lastVerified: new Date(),
      },
    });
    return true;
  } catch (error) {
    console.error(`  [ERROR] Failed to upsert ${record.name}: ${error}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('NCSS Social Service Directory Scraper');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  const records = await fetchNcssDirectory();
  console.log(`\nFetched ${records.length} SSA records\n`);

  let created = 0, errors = 0;
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
