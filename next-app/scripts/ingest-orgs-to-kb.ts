#!/usr/bin/env npx tsx
/**
 * Organisation-to-Knowledge-Base Bridge
 *
 * Reads organisations from the database and generates markdown
 * knowledge base documents that can be chunked and embedded for
 * semantic search via the chat interface.
 *
 * This bridges KB2 (directory table) into KB1 (chat RAG).
 *
 * Usage:
 *   npx tsx scripts/ingest-orgs-to-kb.ts
 *   npx tsx scripts/ingest-orgs-to-kb.ts --dry-run
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

const OUTPUT_DIR = path.resolve(__dirname, '../../docs/knowledge-base/directory');

// Map category codes to block letters for document codes
const CATEGORY_BLOCK_MAP: Record<string, string> = {
  eldercare: 'E',
  disability: 'D',
  mental_health: 'M',
  family: 'F',
  healthcare: 'H',
  community: 'C',
  palliative: 'H',
  children: 'F',
  financial: 'G',
};

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface Organisation {
  id: string;
  name: string;
  type: string;
  categories: string[];
  description: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  registrationNo: string | null;
}

function generateOrgMarkdown(orgs: Organisation[], category: string, blockLetter: string): string {
  const title = `${formatCategory(category)} Organisations in Singapore`;
  const code = `DIR-${blockLetter}-ORG`;

  let content = `---
CODE: ${code}
TITLE: ${title}
TIER: Directory
AUDIENCE: Public
STATUS: Auto-generated
---

# ${title}

> Auto-generated from the organisation directory on ${new Date().toISOString().split('T')[0]}.
> This document lists organisations providing ${formatCategory(category).toLowerCase()} services in Singapore.

`;

  for (const org of orgs) {
    content += `## ${org.name}\n\n`;
    content += `${org.description}\n\n`;
    content += `- **Type**: ${org.type}\n`;
    if (org.categories.length > 0) {
      content += `- **Services**: ${org.categories.map(formatCategory).join(', ')}\n`;
    }
    if (org.address) content += `- **Address**: ${org.address}\n`;
    if (org.phone) content += `- **Phone**: ${org.phone}\n`;
    if (org.email) content += `- **Email**: ${org.email}\n`;
    if (org.website) content += `- **Website**: ${org.website}\n`;
    if (org.registrationNo) content += `- **Registration**: ${org.registrationNo}\n`;
    content += '\n---\n\n';
  }

  return content;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Organisation-to-Knowledge-Base Bridge');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('='.repeat(60));

  // Fetch all active organisations
  const orgs = await getPrisma().organisation.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  }) as unknown as Organisation[];

  console.log(`\nFound ${orgs.length} active organisations\n`);

  if (orgs.length === 0) {
    console.log('No organisations to process. Run scrapers first.');
    if (_prisma) await _prisma.$disconnect();
    return;
  }

  // Group by primary category
  const grouped: Record<string, Organisation[]> = {};
  for (const org of orgs) {
    const primaryCategory = org.categories[0] || 'community';
    if (!grouped[primaryCategory]) grouped[primaryCategory] = [];
    grouped[primaryCategory].push(org);
  }

  if (!dryRun) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let written = 0;
  for (const [category, categoryOrgs] of Object.entries(grouped)) {
    const blockLetter = CATEGORY_BLOCK_MAP[category] || 'C';
    const markdown = generateOrgMarkdown(categoryOrgs, category, blockLetter);
    const filename = `DIR-${blockLetter}-ORG-${category}.md`;

    if (dryRun) {
      console.log(`  [DRY] ${filename} — ${categoryOrgs.length} orgs (${markdown.length} chars)`);
    } else {
      const filePath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(filePath, markdown, 'utf-8');
      console.log(`  [WRITE] ${filename} — ${categoryOrgs.length} orgs`);
      written++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Complete: ${Object.keys(grouped).length} categories, ${written} files written`);
  if (dryRun) console.log('This was a DRY RUN — no files were written.');
  console.log('='.repeat(60));

  if (_prisma) await _prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  if (_prisma) _prisma.$disconnect().catch(() => {});
  process.exit(1);
});
