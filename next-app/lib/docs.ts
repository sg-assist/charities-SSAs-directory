/**
 * Docs library — reads and parses markdown documents from the knowledge base.
 * Works for both local development and production (when docs are in the repo).
 */

import * as fs from 'fs';
import * as path from 'path';

// Resolve docs directory relative to the Next.js app root
const DOCS_DIR = path.join(process.cwd(), '..', 'docs', 'knowledge-base', 'directory');

export interface DocFrontmatter {
  code: string;
  title: string;
  tier: string;
  audience: string;
  status: string;
  block: string;  // G = Government, E = Eldercare, D = Disability, M = Mental Health, F = Family, H = Healthcare, C = Community
  org: string;    // DIR
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
  const m = code.match(/^DIR-([A-Z])-/);
  return m ? m[1] : 'G';
}

function buildDocFrontmatter(code: string, fm: Record<string, string>): DocFrontmatter {
  return {
    code,
    title: fm.TITLE || code,
    tier: fm.TIER || '',
    audience: fm.AUDIENCE || '',
    status: fm.STATUS || '',
    block: getBlock(code),
    org: 'DIR',
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
  G: {
    label: 'Government & Policy',
    description: 'Government agencies, guidelines, and policies — MOH, MSF, AIC, NCSS.',
    color: 'teal',
  },
  E: {
    label: 'Eldercare',
    description: 'Nursing homes, day care centres, home care services, and eldercare resources.',
    color: 'blue',
  },
  D: {
    label: 'Disability',
    description: 'Disability support organisations, early intervention, special education, and therapy services.',
    color: 'purple',
  },
  M: {
    label: 'Mental Health',
    description: 'Mental health organisations, counselling services, support groups, and crisis helplines.',
    color: 'green',
  },
  F: {
    label: 'Family Services',
    description: 'Family service centres, counselling, social work, and family support programmes.',
    color: 'amber',
  },
  H: {
    label: 'Healthcare',
    description: 'Healthcare charities, foundations, hospitals, and medical assistance programmes.',
    color: 'rose',
  },
  C: {
    label: 'Community',
    description: 'Community-based organisations, volunteer groups, and grassroots services.',
    color: 'sky',
  },
};
