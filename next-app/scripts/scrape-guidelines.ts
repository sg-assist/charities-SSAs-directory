#!/usr/bin/env npx tsx
/**
 * Government Guidelines Scraper
 *
 * Fetches MOH and MSF guidelines documents and converts them to
 * markdown knowledge base documents for embedding in the chat RAG system.
 *
 * Usage:
 *   npx tsx scripts/scrape-guidelines.ts
 *   npx tsx scripts/scrape-guidelines.ts --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.resolve(__dirname, '../../docs/knowledge-base/directory');

// ── Known guideline sources ─────────────────────────────────────────────
// These are publicly available pages that we can fetch and extract text from.

const GUIDELINE_SOURCES = [
  {
    code: 'DIR-G-02',
    title: 'MOH Healthcare Subsidies and Financial Assistance',
    url: 'https://www.moh.gov.sg/healthcare-schemes-subsidies',
    tier: 'Reference',
    audience: 'Public',
  },
  {
    code: 'DIR-G-03',
    title: 'MSF Social Services and ComCare Framework',
    url: 'https://www.msf.gov.sg/what-we-do/comcare',
    tier: 'Reference',
    audience: 'Public',
  },
  {
    code: 'DIR-G-04',
    title: 'AIC Care Services and Subsidies Guide',
    url: 'https://www.aic.sg/care-services',
    tier: 'Reference',
    audience: 'Public',
  },
  {
    code: 'DIR-G-05',
    title: 'NCSS Social Service Landscape in Singapore',
    url: 'https://www.ncss.gov.sg/our-initiatives',
    tier: 'Reference',
    audience: 'Public',
  },
];

/**
 * Fetch a webpage and extract its main text content.
 * This is a simple extraction — for production use, consider using
 * a proper HTML parser like cheerio or a headless browser like Playwright.
 */
async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SG-Directory-Bot/1.0 (admin@sgassist.sg)',
      },
    });

    if (!response.ok) {
      console.warn(`  [WARN] Failed to fetch ${url}: HTTP ${response.status}`);
      return '';
    }

    const html = await response.text();

    // Simple HTML to text extraction
    // Strip script and style tags and their contents
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');

    // Convert common HTML elements to markdown
    text = text
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '') // strip remaining tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Clean up whitespace
    text = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n');

    return text.trim();
  } catch (error) {
    console.warn(`  [WARN] Error fetching ${url}: ${error}`);
    return '';
  }
}

function generateMarkdownDoc(
  code: string,
  title: string,
  content: string,
  sourceUrl: string,
  tier: string,
  audience: string
): string {
  return `---
CODE: ${code}
TITLE: ${title}
TIER: ${tier}
AUDIENCE: ${audience}
STATUS: Auto-generated
---

# ${title}

> This document was auto-generated from ${sourceUrl} on ${new Date().toISOString().split('T')[0]}.
> Please verify information directly with the source website for the most current details.

${content}

---

**Source**: [${sourceUrl}](${sourceUrl})
**Last scraped**: ${new Date().toISOString().split('T')[0]}
`;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Government Guidelines Scraper');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('='.repeat(60));

  // Ensure output directory exists
  if (!dryRun) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let fetched = 0, written = 0, failed = 0;

  for (const source of GUIDELINE_SOURCES) {
    console.log(`\nProcessing: ${source.code} — ${source.title}`);
    console.log(`  URL: ${source.url}`);

    const content = await fetchPageContent(source.url);

    if (!content || content.length < 100) {
      console.warn(`  [SKIP] Insufficient content extracted (${content.length} chars)`);
      failed++;
      continue;
    }

    fetched++;
    console.log(`  Extracted ${content.length} characters`);

    const markdown = generateMarkdownDoc(
      source.code,
      source.title,
      content,
      source.url,
      source.tier,
      source.audience
    );

    if (dryRun) {
      console.log(`  [DRY] Would write ${source.code}.md (${markdown.length} chars)`);
    } else {
      const filePath = path.join(OUTPUT_DIR, `${source.code}.md`);
      fs.writeFileSync(filePath, markdown, 'utf-8');
      console.log(`  [WRITE] ${filePath}`);
      written++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Complete: ${fetched} fetched, ${written} written, ${failed} failed`);
  if (dryRun) console.log('This was a DRY RUN — no files were written.');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
