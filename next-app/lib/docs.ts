/**
 * Docs library — reads and parses markdown documents from the knowledge base.
 * Works for both local development and production (when docs are in the repo).
 */

import * as fs from 'fs';
import * as path from 'path';

// Resolve docs directory relative to the Next.js app root
// Works locally (docs are at ../docs/knowledge-base/unfpa relative to next-app)
const DOCS_DIR = path.join(process.cwd(), '..', 'docs', 'knowledge-base', 'unfpa');

export interface DocFrontmatter {
  code: string;
  title: string;
  tier: string;
  audience: string;
  status: string;
  block: string;  // O = Orientation, W = Work/Programme, D = Data, C = Contested
  org: string;    // UNFPA | PMNCH
}

export interface DocSummary {
  slug: string;
  frontmatter: DocFrontmatter;
  wordCount: number;
}

export interface DocFull extends DocSummary {
  content: string; // Markdown content, frontmatter stripped
}

// ─── Internal helpers ────────────────────────────────────────────────────────

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

function deriveSlug(filename: string): string {
  return filename.replace(/\.md$/, '').toLowerCase();
}

function getBlock(code: string): string {
  const m = code.match(/^(?:UNFPA|PMNCH)-([A-Z])-/);
  return m ? m[1] : 'O';
}

function getOrg(code: string): string {
  return code.startsWith('PMNCH') ? 'PMNCH' : 'UNFPA';
}

function buildDocFrontmatter(code: string, fm: Record<string, string>): DocFrontmatter {
  return {
    code,
    title: fm.TITLE || code,
    tier: fm.TIER || '',
    audience: fm.AUDIENCE || '',
    status: fm.STATUS || '',
    block: getBlock(code),
    org: getOrg(code),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getAllDocs(): DocSummary[] {
  if (!fs.existsSync(DOCS_DIR)) return [];

  const files = fs.readdirSync(DOCS_DIR)
    .filter(f => f.endsWith('.md') && f !== 'INDEX.md')
    .sort();

  return files.map(file => {
    const raw = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
    const { content, frontmatter } = parseFrontmatter(raw);
    const code = frontmatter.CODE || file.replace(/\.md$/, '');

    return {
      slug: deriveSlug(file),
      frontmatter: buildDocFrontmatter(code, frontmatter),
      wordCount: content.split(/\s+/).filter(Boolean).length,
    };
  });
}

export function getDoc(slug: string): DocFull | null {
  if (!fs.existsSync(DOCS_DIR)) return null;

  const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
  const file = files.find(f => deriveSlug(f) === slug);
  if (!file) return null;

  const raw = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
  const { content, frontmatter } = parseFrontmatter(raw);
  const code = frontmatter.CODE || file.replace(/\.md$/, '');

  return {
    slug,
    frontmatter: buildDocFrontmatter(code, frontmatter),
    wordCount: content.split(/\s+/).filter(Boolean).length,
    content,
  };
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(DOCS_DIR)) return [];
  return fs.readdirSync(DOCS_DIR)
    .filter(f => f.endsWith('.md') && f !== 'INDEX.md')
    .map(f => deriveSlug(f));
}

// ─── Block metadata ──────────────────────────────────────────────────────────

export const BLOCK_LABELS: Record<string, { label: string; description: string; color: string }> = {
  O: {
    label: 'Orientation',
    description: 'What UNFPA and PMNCH are, how they work, key terminology.',
    color: 'blue',
  },
  W: {
    label: 'Programme Work',
    description: 'Deep dives into specific programme areas — maternal health, family planning, GBV, and more.',
    color: 'green',
  },
  D: {
    label: 'Data & Evidence',
    description: 'How UNFPA collects, reports, and uses population data and programme results.',
    color: 'purple',
  },
  C: {
    label: 'Contested Areas',
    description: 'Honest assessments of where UNFPA\'s work is disputed, controversial, or politically sensitive.',
    color: 'amber',
  },
  PMNCH: {
    label: 'PMNCH',
    description: 'The Partnership for Maternal, Newborn & Child Health — its mandate, work, and relationship to UNFPA.',
    color: 'teal',
  },
  R: {
    label: 'Resilience & Partnerships',
    description: 'PPP models, climate–SRHR nexus, Singapore\'s finance ecosystem, and community resilience frameworks for the LKYSPP–UNFPA challenge.',
    color: 'rose',
  },
};
