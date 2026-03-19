import Link from 'next/link';
import { getAllDocs, BLOCK_LABELS, type DocSummary } from '@/lib/docs';

export const metadata = {
  title: 'Knowledge Base — UNFPA Partnership Catalyst',
  description: 'Reference documents for UNFPA partnership development. Covers UNFPA\'s mandate, programmes, partnership models, climate-SRHR evidence, and Singapore\'s finance ecosystem.',
};

const BLOCK_ORDER = ['O', 'W', 'D', 'C', 'R'];

const BLOCK_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  O:     { bg: 'bg-blue-50',   text: 'text-blue-900',  border: 'border-blue-200',  badge: 'bg-blue-100 text-blue-800' },
  W:     { bg: 'bg-green-50',  text: 'text-green-900', border: 'border-green-200', badge: 'bg-green-100 text-green-800' },
  D:     { bg: 'bg-purple-50', text: 'text-purple-900',border: 'border-purple-200',badge: 'bg-purple-100 text-purple-800' },
  C:     { bg: 'bg-amber-50',  text: 'text-amber-900', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800' },
  PMNCH: { bg: 'bg-teal-50',   text: 'text-teal-900',  border: 'border-teal-200',  badge: 'bg-teal-100 text-teal-800' },
  R:     { bg: 'bg-rose-50',  text: 'text-rose-900',  border: 'border-rose-200',  badge: 'bg-rose-100 text-rose-800' },
};

function DocCard({ doc }: { doc: DocSummary }) {
  const blockKey = doc.frontmatter.org === 'PMNCH' ? 'PMNCH' : doc.frontmatter.block;
  const colors = BLOCK_COLORS[blockKey] || BLOCK_COLORS['O'];

  return (
    <Link
      href={`/knowledge/${doc.slug}`}
      className={`block p-4 border ${colors.border} ${colors.bg} hover:shadow-md transition-shadow rounded-lg group`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${colors.badge} flex-shrink-0`}>
          {doc.frontmatter.code}
        </span>
        <span className="text-xs text-slate-400">{doc.wordCount.toLocaleString()} words</span>
      </div>
      <p className={`text-sm font-semibold leading-snug ${colors.text} group-hover:underline`}>
        {doc.frontmatter.title}
      </p>
      <div className="flex gap-2 mt-2 flex-wrap">
        {doc.frontmatter.tier && (
          <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
            {doc.frontmatter.tier}
          </span>
        )}
        {doc.frontmatter.audience && (
          <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
            {doc.frontmatter.audience}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function KnowledgePage() {
  const docs = getAllDocs();

  // Group by block: UNFPA docs go into O/W/D/C; PMNCH docs into their own group
  const grouped: Record<string, DocSummary[]> = { O: [], W: [], D: [], C: [], R: [], PMNCH: [] };
  for (const doc of docs) {
    const key = doc.frontmatter.org === 'PMNCH' ? 'PMNCH' : doc.frontmatter.block;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(doc);
  }

  const sectionOrder = [...BLOCK_ORDER.filter(k => k !== 'R'), 'PMNCH', 'R'];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Knowledge Base</h1>
        <p className="text-slate-600 max-w-2xl">
          Reference documents for UNFPA partnership development. Covers UNFPA&apos;s mandate, programmes, partnership models,
          climate-SRHR evidence, and Singapore&apos;s finance ecosystem.
        </p>
        <p className="text-sm text-slate-400 mt-3">
          Total: {docs.length} documents · {docs.reduce((sum, d) => sum + d.wordCount, 0).toLocaleString()} words
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-10">
        {sectionOrder.map(blockKey => {
          const blockDocs = grouped[blockKey];
          if (!blockDocs || blockDocs.length === 0) return null;
          const meta = BLOCK_LABELS[blockKey];
          const colors = BLOCK_COLORS[blockKey];

          return (
            <section key={blockKey}>
              <div className="mb-4 pb-2 border-b border-slate-200">
                <div className="flex items-baseline gap-3">
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${colors.badge}`}>
                    {blockKey}
                  </span>
                  <h2 className="text-lg font-bold text-slate-800">{meta.label}</h2>
                  <span className="text-sm text-slate-400">{blockDocs.length} documents</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{meta.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {blockDocs.map(doc => (
                  <DocCard key={doc.slug} doc={doc} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="mt-12 pt-6 border-t border-slate-200 text-center">
        <p className="text-sm text-slate-400">
          Something wrong or out of date?{' '}
          <a
            href="mailto:UNFPA@ontheground.agency"
            className="text-blue-500 hover:underline"
          >
            Send feedback to UNFPA@ontheground.agency
          </a>
        </p>
      </div>
    </div>
  );
}
