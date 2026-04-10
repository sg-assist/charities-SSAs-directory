#!/usr/bin/env npx tsx
/**
 * AIC (Agency for Integrated Care) Scraper
 *
 * Scrapes AIC listings for nursing homes, day care centres,
 * home care services, and other eldercare/disability facilities.
 *
 * Usage:
 *   npx tsx scripts/scrape-aic.ts
 *   npx tsx scripts/scrape-aic.ts --dry-run
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

// ── Service type mapping ────────────────────────────────────────────────

const FACILITY_CATEGORIES: Record<string, string[]> = {
  'nursing home': ['eldercare'],
  'day care': ['eldercare'],
  'home care': ['eldercare'],
  'dementia': ['eldercare', 'mental_health'],
  'rehabilitation': ['healthcare'],
  'hospice': ['palliative'],
  'disability': ['disability'],
  'senior activity': ['eldercare', 'community'],
  'befriending': ['eldercare', 'community'],
};

function mapFacilityToCategories(facilityType: string): string[] {
  const lower = facilityType.toLowerCase();
  const cats = new Set<string>();
  for (const [keyword, categories] of Object.entries(FACILITY_CATEGORIES)) {
    if (lower.includes(keyword)) {
      categories.forEach(c => cats.add(c));
    }
  }
  return cats.size > 0 ? Array.from(cats) : ['eldercare'];
}

interface AicFacility {
  name: string;
  type: string;
  address?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  capacity?: number;
}

/**
 * Fetch facility data from AIC.
 *
 * AIC maintains care facility directories at:
 * https://www.aic.sg/care-services
 *
 * If the API is not accessible, returns empty array.
 */
async function fetchAicFacilities(): Promise<AicFacility[]> {
  const facilities: AicFacility[] = [];

  try {
    // Try the AIC care services API
    const response = await fetch('https://www.aic.sg/api/care-services/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SG-Directory-Bot/1.0 (admin@sgassist.sg)',
      },
      body: JSON.stringify({ pageSize: 200, pageNo: 1 }),
    });

    if (!response.ok) {
      console.warn(`[AICScraper] API returned ${response.status}. The AIC API may require different access.`);
      console.warn('[AICScraper] Consider using the AIC website\'s public listing pages instead.');
      return facilities;
    }

    const data = await response.json();
    const items = data?.results || data?.facilities || data?.data || [];

    for (const item of items) {
      facilities.push({
        name: item.name || item.facilityName || '',
        type: item.type || item.facilityType || item.serviceType || 'Care Facility',
        address: item.address || '',
        postalCode: item.postalCode || '',
        phone: item.phone || item.contactNumber || '',
        email: item.email || '',
        website: item.website || '',
        capacity: item.capacity || undefined,
      });
    }
  } catch (error) {
    console.warn(`[AICScraper] Failed to fetch: ${error}`);
    console.warn('[AICScraper] The AIC website may require browser-based scraping.');
  }

  return facilities;
}

async function upsertOrganisation(facility: AicFacility, dryRun: boolean) {
  const slug = deriveSlug(facility.name);
  if (!slug || !facility.name) return false;

  const categories = mapFacilityToCategories(facility.type);
  const description = `${facility.name} is a ${facility.type.toLowerCase()} facility in Singapore` +
    (facility.capacity ? `, with capacity for ${facility.capacity} residents` : '') +
    '. Coordinated through the Agency for Integrated Care (AIC).';

  if (dryRun) {
    console.log(`  [DRY] ${facility.name} (${facility.type}) — ${categories.join(', ')}`);
    return true;
  }

  try {
    await getPrisma().organisation.upsert({
      where: { slug },
      create: {
        name: facility.name,
        slug,
        type: 'ssa',
        categories,
        description,
        address: facility.address || null,
        postalCode: facility.postalCode || null,
        phone: facility.phone || null,
        email: facility.email || null,
        website: facility.website || null,
        sourceUrl: 'https://www.aic.sg',
        lastVerified: new Date(),
        isActive: true,
        metadata: facility.capacity ? { capacity: facility.capacity } : undefined,
      },
      update: {
        description,
        phone: facility.phone || undefined,
        email: facility.email || undefined,
        lastVerified: new Date(),
      },
    });
    return true;
  } catch (error) {
    console.error(`  [ERROR] Failed to upsert ${facility.name}: ${error}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('AIC Care Services Scraper');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  const facilities = await fetchAicFacilities();
  console.log(`\nFetched ${facilities.length} facility records\n`);

  let created = 0, errors = 0;
  for (const facility of facilities) {
    const success = await upsertOrganisation(facility, dryRun);
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
