#!/usr/bin/env npx tsx
/**
 * Knowledge Base Verification Script
 *
 * Parses all markdown documents in docs/knowledge-base/directory/ and:
 * 1. Extracts organization entries, URLs, phone numbers
 * 2. Checks each URL is reachable (HEAD request)
 * 3. Validates phone number format (Singapore)
 * 4. Checks LAST_VERIFIED frontmatter dates for staleness
 * 5. Generates a verification report
 *
 * Usage:
 *   npx tsx scripts/verify-kb.ts              # Full verification
 *   npx tsx scripts/verify-kb.ts --urls-only  # Skip phone number checks
 *   npx tsx scripts/verify-kb.ts --stale 60   # Set staleness threshold (days)
 *   npx tsx scripts/verify-kb.ts --doc DIR-E-01  # Verify single document
 *
 * Output:
 *   docs/knowledge-base/directory/VERIFICATION-REPORT.md
 */

import * as fs from 'fs';
import * as path from 'path';

interface Finding {
  severity: 'error' | 'warning' | 'info';
  type: string;
  message: string;
  context?: string;
}

interface DocVerification {
  file: string;
  code: string;
  title: string;
  lastVerified: string | null;
  daysSinceVerified: number | null;
  urlsFound: number;
  urlsOk: number;
  urlsFailed: number;
  phonesFound: number;
  phonesValid: number;
  findings: Finding[];
}

const KB_DIR = path.resolve(__dirname, '../../docs/knowledge-base/directory');
const REPORT_PATH = path.join(KB_DIR, 'VERIFICATION-REPORT.md');

// ── Utilities ───────────────────────────────────────────────────────────

function parseFrontmatter(raw: string): { content: string; frontmatter: Record<string, string> } {
  const frontmatter: Record<string, string> = {};
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { content: raw, frontmatter };

  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Z_]+):\s*(.+)$/);
    if (kv) frontmatter[kv[1].trim()] = kv[2].trim();
  }

  return { content: match[2].trim(), frontmatter };
}

/** Normalise a URL for deduplication: lowercase host, strip trailing slash and www. */
function normaliseUrl(url: string): string {
  try {
    const u = new URL(url);
    let host = u.host.toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    let pathname = u.pathname;
    if (pathname.endsWith('/') && pathname.length > 1) pathname = pathname.slice(0, -1);
    return `https://${host}${pathname}${u.search}`;
  } catch {
    return url;
  }
}

/** Extract all URLs from markdown content (http/https only). */
function extractUrls(content: string): string[] {
  const urls = new Set<string>();

  // Match markdown links [text](url)
  const mdLinkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let m;
  while ((m = mdLinkRe.exec(content)) !== null) {
    urls.add(normaliseUrl(m[2]));
  }

  // Match bare URLs
  const bareUrlRe = /(?<![(\[])https?:\/\/[^\s<>()\[\]"'|`,]+/g;
  while ((m = bareUrlRe.exec(content)) !== null) {
    urls.add(normaliseUrl(m[0].replace(/[.,;:]+$/, '')));
  }

  // Match plain domain references in tables (e.g., "sgenable.sg", "www.aic.sg")
  // Only capture ones with clear domain structure (at least one dot, known TLDs)
  const domainRe = /(?<![a-zA-Z0-9/@.])(?:www\.)?([a-z0-9][-a-z0-9]*\.)+(com|sg|org|gov|edu|net|org\.sg|com\.sg|gov\.sg|edu\.sg)(\.[a-z]{2,})?(?:\/[^\s,;:]*)?/gi;
  while ((m = domainRe.exec(content)) !== null) {
    const domain = m[0].toLowerCase();
    const fullUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    urls.add(normaliseUrl(fullUrl));
  }

  return Array.from(urls);
}

/** Extract Singapore phone numbers (8-digit starting with 3,6,8,9 or 1800-xxx-xxxx). */
function extractPhones(content: string): string[] {
  const phones = new Set<string>();

  // 8-digit Singapore numbers (local landline/mobile): 3xxx, 6xxx, 8xxx, 9xxx
  const localRe = /\b([3689])\d{3}[\s-]?\d{4}\b/g;
  let m;
  while ((m = localRe.exec(content)) !== null) {
    phones.add(m[0].replace(/[\s-]/g, ''));
  }

  // Toll-free 1800-xxx-xxxx
  const tollFreeRe = /\b1800[-\s]?\d{3}[-\s]?\d{4}\b/g;
  while ((m = tollFreeRe.exec(content)) !== null) {
    phones.add(m[0].replace(/[\s]/g, ''));
  }

  // 4-digit short codes (1767, 1771, etc.)
  const shortRe = /\b17[67]\d\b/g;
  while ((m = shortRe.exec(content)) !== null) {
    phones.add(m[0]);
  }

  return Array.from(phones);
}

/** Check if a URL is reachable. Returns status code or error message. */
async function checkUrl(url: string, timeout = 10000): Promise<{ ok: boolean; status: number | string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'SG-Directory-Bot/1.0 (Verification; admin@sgassist.sg)',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    // Some servers reject HEAD — retry with GET
    if (response.status === 405 || response.status === 403) {
      const getController = new AbortController();
      const getTimer = setTimeout(() => getController.abort(), timeout);
      const getResponse = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'SG-Directory-Bot/1.0 (Verification; admin@sgassist.sg)',
        },
        signal: getController.signal,
      });
      clearTimeout(getTimer);
      return { ok: getResponse.ok, status: getResponse.status };
    }

    return { ok: response.ok, status: response.status };
  } catch (error) {
    const message = (error as Error).message || String(error);
    return { ok: false, status: message.slice(0, 50) };
  }
}

/** Validate Singapore phone number format. */
function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, '');
  // 8-digit local
  if (/^[3689]\d{7}$/.test(cleaned)) return true;
  // 1800-xxx-xxxx
  if (/^1800\d{7}$/.test(cleaned)) return true;
  // Short codes
  if (/^17[67]\d$/.test(cleaned)) return true;
  return false;
}

/** Days between a date string (YYYY-MM-DD) and today. */
function daysSince(dateStr: string): number | null {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ── Per-document verification ───────────────────────────────────────────

async function verifyDocument(
  filePath: string,
  options: { urlsOnly: boolean; staleDays: number }
): Promise<DocVerification> {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { content, frontmatter } = parseFrontmatter(raw);
  const fileName = path.basename(filePath);

  const verification: DocVerification = {
    file: fileName,
    code: frontmatter.CODE || fileName.replace(/\.md$/, ''),
    title: frontmatter.TITLE || '',
    lastVerified: frontmatter.LAST_VERIFIED || null,
    daysSinceVerified: null,
    urlsFound: 0,
    urlsOk: 0,
    urlsFailed: 0,
    phonesFound: 0,
    phonesValid: 0,
    findings: [],
  };

  // Check staleness
  if (verification.lastVerified) {
    verification.daysSinceVerified = daysSince(verification.lastVerified);
    if (verification.daysSinceVerified !== null && verification.daysSinceVerified > options.staleDays) {
      verification.findings.push({
        severity: 'warning',
        type: 'stale',
        message: `Document last verified ${verification.daysSinceVerified} days ago (threshold: ${options.staleDays})`,
      });
    }
  } else {
    verification.findings.push({
      severity: 'warning',
      type: 'no-verification-date',
      message: 'Missing LAST_VERIFIED frontmatter field',
    });
  }

  // Extract and check URLs
  const urls = extractUrls(content);
  verification.urlsFound = urls.length;

  console.log(`  [${verification.code}] Checking ${urls.length} URLs...`);
  for (const url of urls) {
    const result = await checkUrl(url);
    if (result.ok) {
      verification.urlsOk++;
    } else {
      verification.urlsFailed++;
      verification.findings.push({
        severity: typeof result.status === 'number' && result.status === 404 ? 'error' : 'warning',
        type: 'broken-link',
        message: `${url} → ${result.status}`,
      });
    }
  }

  // Extract and check phones
  if (!options.urlsOnly) {
    const phones = extractPhones(content);
    verification.phonesFound = phones.length;
    for (const phone of phones) {
      if (validatePhone(phone)) {
        verification.phonesValid++;
      } else {
        verification.findings.push({
          severity: 'warning',
          type: 'invalid-phone',
          message: `Invalid phone format: ${phone}`,
        });
      }
    }
  }

  return verification;
}

// ── Report generation ───────────────────────────────────────────────────

function generateReport(verifications: DocVerification[]): string {
  const now = new Date().toISOString();
  const date = now.split('T')[0];

  const totalDocs = verifications.length;
  const totalUrls = verifications.reduce((sum, v) => sum + v.urlsFound, 0);
  const totalUrlsOk = verifications.reduce((sum, v) => sum + v.urlsOk, 0);
  const totalUrlsFailed = verifications.reduce((sum, v) => sum + v.urlsFailed, 0);
  const totalPhones = verifications.reduce((sum, v) => sum + v.phonesFound, 0);
  const totalPhonesValid = verifications.reduce((sum, v) => sum + v.phonesValid, 0);
  const totalErrors = verifications.reduce(
    (sum, v) => sum + v.findings.filter((f) => f.severity === 'error').length,
    0
  );
  const totalWarnings = verifications.reduce(
    (sum, v) => sum + v.findings.filter((f) => f.severity === 'warning').length,
    0
  );

  let report = `# Knowledge Base Verification Report

*Auto-generated by \`scripts/verify-kb.ts\` on ${date}*

## Summary

| Metric | Value |
|--------|-------|
| Documents checked | ${totalDocs} |
| URLs found | ${totalUrls} |
| URLs reachable | ${totalUrlsOk} |
| URLs failed | ${totalUrlsFailed} |
| Phone numbers found | ${totalPhones} |
| Phone numbers valid | ${totalPhonesValid} |
| Errors | ${totalErrors} |
| Warnings | ${totalWarnings} |

## Per-document results

| Code | Title | Last Verified | Days | URLs OK/Total | Phones Valid/Total | Issues |
|------|-------|---------------|------|---------------|--------------------|--------|
`;

  for (const v of verifications) {
    const daysText = v.daysSinceVerified !== null ? String(v.daysSinceVerified) : '—';
    const lastVerifiedText = v.lastVerified || '—';
    const urlRatio = v.urlsFound > 0 ? `${v.urlsOk}/${v.urlsFound}` : '0/0';
    const phoneRatio = v.phonesFound > 0 ? `${v.phonesValid}/${v.phonesFound}` : '0/0';
    const issueCount = v.findings.length;
    report += `| ${v.code} | ${v.title.slice(0, 50)} | ${lastVerifiedText} | ${daysText} | ${urlRatio} | ${phoneRatio} | ${issueCount} |\n`;
  }

  report += '\n## Detailed findings\n\n';

  for (const v of verifications) {
    if (v.findings.length === 0) continue;
    report += `### ${v.code} — ${v.title}\n\n`;
    for (const finding of v.findings) {
      const icon = finding.severity === 'error' ? '❌' : finding.severity === 'warning' ? '⚠️' : 'ℹ️';
      report += `- ${icon} **${finding.type}**: ${finding.message}\n`;
    }
    report += '\n';
  }

  if (totalErrors === 0 && totalWarnings === 0) {
    report += '\n*No issues found — all checks passed.*\n';
  }

  report += `\n---\n\n*Next scheduled verification: run \`npm run verify-kb\` or trigger the GitHub Actions workflow.*\n`;

  return report;
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const urlsOnly = args.includes('--urls-only');
  const staleDaysArg = args.find((_, i) => args[i - 1] === '--stale');
  const staleDays = staleDaysArg ? parseInt(staleDaysArg) : 90;
  const docArg = args.find((_, i) => args[i - 1] === '--doc');

  console.log('='.repeat(60));
  console.log('Knowledge Base Verification');
  console.log(`Directory: ${KB_DIR}`);
  console.log(`Staleness threshold: ${staleDays} days`);
  console.log(`Mode: ${urlsOnly ? 'URLs only' : 'Full verification'}`);
  console.log('='.repeat(60));

  if (!fs.existsSync(KB_DIR)) {
    console.error(`Directory not found: ${KB_DIR}`);
    process.exit(1);
  }

  let files = fs
    .readdirSync(KB_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'VERIFICATION-REPORT.md' && f !== 'INDEX.md')
    .sort();

  if (docArg) {
    files = files.filter((f) => f.startsWith(docArg));
    if (files.length === 0) {
      console.error(`No matching document: ${docArg}`);
      process.exit(1);
    }
  }

  console.log(`\nFound ${files.length} document(s)\n`);

  const verifications: DocVerification[] = [];
  for (const file of files) {
    const filePath = path.join(KB_DIR, file);
    const verification = await verifyDocument(filePath, { urlsOnly, staleDays });
    verifications.push(verification);

    const issues = verification.findings.length;
    const status = issues === 0 ? '✓' : `${issues} issue(s)`;
    console.log(
      `  ${verification.code}: ${verification.urlsOk}/${verification.urlsFound} URLs OK, ${verification.phonesValid}/${verification.phonesFound} phones OK — ${status}`
    );
  }

  // Write report
  const report = generateReport(verifications);
  fs.writeFileSync(REPORT_PATH, report, 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log(`Report written to: ${REPORT_PATH}`);
  const totalErrors = verifications.reduce(
    (sum, v) => sum + v.findings.filter((f) => f.severity === 'error').length,
    0
  );
  const totalWarnings = verifications.reduce(
    (sum, v) => sum + v.findings.filter((f) => f.severity === 'warning').length,
    0
  );
  console.log(`Errors: ${totalErrors} | Warnings: ${totalWarnings}`);
  console.log('='.repeat(60));

  // Exit with error code if there are errors (but not just warnings)
  if (totalErrors > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
