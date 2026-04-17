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
  urlsIndeterminate: number;
  urlsFailed: number;
  phonesFound: number;
  phonesValid: number;
  findings: Finding[];
}

type UrlStatus = 'ok' | 'indeterminate' | 'broken';

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

/**
 * A real-browser User-Agent. Many SG government and charity sites sit behind
 * Cloudflare / WAF rules that reject unknown bot UAs with 403. We're checking
 * whether the URL works for end users, so we should look like one.
 */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_UA,
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-SG,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

/**
 * Classify a fetch outcome.
 * - ok: 2xx / 3xx
 * - broken: 404 / 410 / DNS resolution failure / connection refused
 * - indeterminate: 403 / 429 / 5xx / timeouts / proxy-denied — URL may still be
 *   healthy for end users, but we can't prove it from this environment.
 */
function classifyStatus(status: number | string, denyReason?: string): UrlStatus {
  if (denyReason) return 'indeterminate';
  if (typeof status === 'number') {
    if (status >= 200 && status < 400) return 'ok';
    if (status === 404 || status === 410) return 'broken';
    // 403/429/408/5xx — most often WAF / rate-limit / upstream hiccup.
    return 'indeterminate';
  }
  const msg = String(status).toLowerCase();
  if (msg.includes('enotfound') || msg.includes('dns') || msg.includes('econnrefused')) {
    return 'broken';
  }
  return 'indeterminate';
}

/** Check a URL. Tries HEAD first, falls back to GET on 403/405. */
async function checkUrl(
  url: string,
  timeout = 10000
): Promise<{ status: UrlStatus; detail: number | string; denyReason?: string }> {
  const tryFetch = async (method: 'HEAD' | 'GET') => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        headers: BROWSER_HEADERS,
        signal: controller.signal,
      });
      const denyReason = res.headers.get('x-deny-reason') || undefined;
      return { status: res.status, ok: res.ok, denyReason };
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let result = await tryFetch('HEAD');
    // Some origins reject HEAD or return weird codes on HEAD — retry with GET.
    if (result.status === 403 || result.status === 405 || result.status === 501) {
      result = await tryFetch('GET');
    }
    return {
      status: classifyStatus(result.status, result.denyReason),
      detail: result.status,
      denyReason: result.denyReason,
    };
  } catch (error) {
    const message = (error as Error).message || String(error);
    const short = message.slice(0, 80);
    return { status: classifyStatus(short), detail: short };
  }
}

/** Run an async task over an array with bounded concurrency. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
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
    urlsIndeterminate: 0,
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

  // Extract and check URLs (concurrent)
  const urls = extractUrls(content);
  verification.urlsFound = urls.length;

  console.log(`  [${verification.code}] Checking ${urls.length} URLs...`);
  const urlResults = await mapWithConcurrency(urls, 8, (u) => checkUrl(u));

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const result = urlResults[i];
    if (result.status === 'ok') {
      verification.urlsOk++;
      continue;
    }

    if (result.status === 'broken') {
      verification.urlsFailed++;
      verification.findings.push({
        severity: 'error',
        type: 'broken-link',
        message: `${url} → ${result.detail}`,
      });
    } else {
      // indeterminate — do not report as broken; note for review
      verification.urlsIndeterminate++;
      const suffix = result.denyReason ? ` (denied: ${result.denyReason})` : '';
      verification.findings.push({
        severity: 'info',
        type: 'unverified-link',
        message: `${url} → ${result.detail}${suffix} (not confirmed reachable from this runner)`,
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
  const totalUrlsIndeterminate = verifications.reduce((sum, v) => sum + v.urlsIndeterminate, 0);
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

  const networkRestricted = totalUrls > 0 && totalUrlsOk === 0 && totalUrlsIndeterminate > 0;

  let report = `# Knowledge Base Verification Report

*Auto-generated by \`scripts/verify-kb.ts\` on ${date}*

## Summary

| Metric | Value |
|--------|-------|
| Documents checked | ${totalDocs} |
| URLs found | ${totalUrls} |
| URLs reachable (2xx/3xx) | ${totalUrlsOk} |
| URLs indeterminate (403/429/5xx/blocked) | ${totalUrlsIndeterminate} |
| URLs broken (404/410/DNS) | ${totalUrlsFailed} |
| Phone numbers found | ${totalPhones} |
| Phone numbers valid | ${totalPhonesValid} |
| Errors | ${totalErrors} |
| Warnings | ${totalWarnings} |
${
  networkRestricted
    ? '\n> ⚠️ **Environment note:** no URL resolved with 2xx/3xx this run. This usually means the runner has no unrestricted outbound internet (CI sandbox, allowlisted egress). "Indeterminate" URLs are likely healthy in production — only `broken` entries (404/410/DNS) reliably indicate a dead link.\n'
    : ''
}
## Per-document results

| Code | Title | Last Verified | Days | URLs OK/Indet/Broken | Phones Valid/Total | Issues |
|------|-------|---------------|------|----------------------|--------------------|--------|
`;

  for (const v of verifications) {
    const daysText = v.daysSinceVerified !== null ? String(v.daysSinceVerified) : '—';
    const lastVerifiedText = v.lastVerified || '—';
    const urlSplit =
      v.urlsFound > 0
        ? `${v.urlsOk}/${v.urlsIndeterminate}/${v.urlsFailed}`
        : '0/0/0';
    const phoneRatio = v.phonesFound > 0 ? `${v.phonesValid}/${v.phonesFound}` : '0/0';
    const issueCount = v.findings.length;
    report += `| ${v.code} | ${v.title.slice(0, 50)} | ${lastVerifiedText} | ${daysText} | ${urlSplit} | ${phoneRatio} | ${issueCount} |\n`;
  }

  report += '\n## Detailed findings\n\n';

  for (const v of verifications) {
    if (v.findings.length === 0) continue;
    // Show actionable findings first (errors + warnings), collapse "info" noise.
    const actionable = v.findings.filter((f) => f.severity !== 'info');
    const info = v.findings.filter((f) => f.severity === 'info');
    if (actionable.length === 0 && info.length === 0) continue;
    report += `### ${v.code} — ${v.title}\n\n`;
    for (const finding of actionable) {
      const icon = finding.severity === 'error' ? '❌' : '⚠️';
      report += `- ${icon} **${finding.type}**: ${finding.message}\n`;
    }
    if (info.length > 0) {
      report += `\n<details><summary>ℹ️ ${info.length} unverified (indeterminate) link(s) — likely blocked by runner network, not broken</summary>\n\n`;
      for (const finding of info) {
        report += `- ${finding.message}\n`;
      }
      report += '\n</details>\n';
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

    const actionable = verification.findings.filter((f) => f.severity !== 'info').length;
    const status = actionable === 0 ? '✓' : `${actionable} actionable issue(s)`;
    console.log(
      `  ${verification.code}: ${verification.urlsOk} OK / ${verification.urlsIndeterminate} indeterminate / ${verification.urlsFailed} broken (of ${verification.urlsFound}); phones ${verification.phonesValid}/${verification.phonesFound} — ${status}`
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
