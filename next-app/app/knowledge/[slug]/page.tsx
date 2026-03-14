import { notFound } from 'next/navigation';
import Link from 'next/link';
import { marked } from 'marked';
import { getAllSlugs, getDoc, BLOCK_LABELS } from '@/lib/docs';

export async function generateStaticParams() {
  return getAllSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return {};
  return {
    title: `${doc.frontmatter.title} — UNFPA Knowledge Base`,
    description: `${doc.frontmatter.code} · ${doc.frontmatter.tier} · ${doc.wordCount.toLocaleString()} words`,
  };
}

const BLOCK_COLORS: Record<string, { badge: string; section: string }> = {
  O:     { badge: 'bg-blue-100 text-blue-800',   section: 'border-blue-300' },
  W:     { badge: 'bg-green-100 text-green-800',  section: 'border-green-300' },
  D:     { badge: 'bg-purple-100 text-purple-800',section: 'border-purple-300' },
  C:     { badge: 'bg-amber-100 text-amber-800',  section: 'border-amber-300' },
  PMNCH: { badge: 'bg-teal-100 text-teal-800',    section: 'border-teal-300' },
};

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  const blockKey = doc.frontmatter.org === 'PMNCH' ? 'PMNCH' : doc.frontmatter.block;
  const colors = BLOCK_COLORS[blockKey] || BLOCK_COLORS['O'];
  const blockMeta = BLOCK_LABELS[blockKey];

  // Render markdown to HTML server-side
  const htmlContent = await marked(doc.content, { async: false });

  const feedbackSubject = encodeURIComponent(`Feedback: ${doc.frontmatter.code} — ${doc.frontmatter.title}`);
  const feedbackBody = encodeURIComponent(
    `Document: ${doc.frontmatter.code}\nTitle: ${doc.frontmatter.title}\n\nFeedback:\n`
  );
  const mailtoHref = `mailto:UNFPA@ontheground.agency?subject=${feedbackSubject}&body=${feedbackBody}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6">
        <Link href="/knowledge" className="hover:text-slate-700 transition-colors">
          Knowledge Base
        </Link>
        <span>›</span>
        <span className={`font-mono text-xs px-2 py-0.5 rounded ${colors.badge}`}>
          {doc.frontmatter.code}
        </span>
      </nav>

      {/* Document header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 leading-tight mb-4">
          {doc.frontmatter.title}
        </h1>

        <div className="flex flex-wrap gap-2 items-center">
          <span className={`text-xs font-mono font-semibold px-2 py-1 rounded ${colors.badge}`}>
            {doc.frontmatter.code}
          </span>
          {blockMeta && (
            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
              {blockMeta.label}
            </span>
          )}
          {doc.frontmatter.tier && (
            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
              {doc.frontmatter.tier}
            </span>
          )}
          {doc.frontmatter.audience && (
            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
              Audience: {doc.frontmatter.audience}
            </span>
          )}
          <span className="text-xs text-slate-400 ml-auto">
            {doc.wordCount.toLocaleString()} words
          </span>
        </div>

        {doc.frontmatter.block === 'C' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
            <strong>Contested area:</strong> This document covers topics where UNFPA&apos;s work is disputed,
            politically sensitive, or where the evidence is genuinely uncertain. Multiple perspectives are presented.
          </div>
        )}
      </header>

      {/* Document body — markdown rendered to HTML */}
      <article
        className="prose prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: htmlContent as string }}
      />

      {/* Feedback section */}
      <div className="mt-12 pt-6 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Something wrong or missing?</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Flag an error, suggest a correction, or add context.
            </p>
          </div>
          <a
            href={mailtoHref}
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium text-white transition-opacity hover:opacity-90 flex-shrink-0"
            style={{ backgroundColor: '#009EDB' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,12 2,6"/>
            </svg>
            Send Feedback
          </a>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-8">
        <Link
          href="/knowledge"
          className="text-sm text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1"
        >
          ← Back to Knowledge Base
        </Link>
      </div>
    </div>
  );
}
