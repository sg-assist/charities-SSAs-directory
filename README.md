# UNFPA Knowledge Base

A public knowledge base covering UNFPA's programmes, mandate, evidence, and contested areas — built for the **Lee Kuan Yew School of Public Policy** and made openly available for anyone who works with or studies UNFPA and PMNCH.

**Live site:** [unfpa-lkyspp-otg.vercel.app](https://unfpa-lkyspp-otg.vercel.app) *(after deployment)*

---

## What this is

This repository contains two things:

1. **32 deep-research documents** — a structured knowledge base covering UNFPA's mandate, programme areas, data systems, and politically contested topics. Each document is 3,000–8,000 words, researched and written to be accurate, balanced, and genuinely useful for a sophisticated audience (not marketing copy).

2. **A Next.js web application** — a publicly accessible interface with:
   - A **chat interface** backed by semantic search (RAG) across all 32 documents
   - A **browsable knowledge base** where each document is a readable, linkable page
   - A **feedback mechanism** so readers can flag errors or suggest improvements

---

## Who built this

This knowledge base was produced by **[On The Ground](https://ontheground.agency)**, an agency specialising in research, communications, and AI-assisted knowledge work in the public interest.

The research was conducted for the **Lee Kuan Yew School of Public Policy (LKYSPP)** at the National University of Singapore, as part of preparing a policy practitioner audience to engage substantively with UNFPA's work, funding controversies, and evidence base.

**Research methodology:** Each document was produced using **[Claude Code](https://claude.ai/code)** by Anthropic — specifically using Claude's deep research capabilities to synthesise primary sources, UNFPA programme documents, academic literature, and journalistic records into structured, citable briefs. The workflow combined:

- Structured prompt design to ensure each document covered what a policy professional actually needs to know
- Iterative deep research using Claude's ability to reason across large bodies of source material
- Careful human review for factual accuracy and balance, particularly on contested topics (China programme, abortion policy, US defunding)
- Frontmatter tagging (CODE, TIER, AUDIENCE) to make the corpus navigable across different reader types

This is not AI-generated content that was published without review. It is AI-assisted research — the same way a skilled researcher uses a database, except the database reasons.

If you are interested in similar work for your organisation, contact On The Ground at [hello@ontheground.agency](mailto:hello@ontheground.agency).

---

## Knowledge base structure

The 32 documents are organised into five blocks:

| Block | Code | Description | Documents |
|---|---|---|---|
| **Orientation** | O | What UNFPA and PMNCH are, how they work, key terminology | 8 |
| **Programme Work** | W | Deep dives into specific programme areas — maternal health, family planning, GBV, fistula, midwifery, contraceptive supply | 10 |
| **Data & Evidence** | D | How UNFPA collects, reports, and uses population data and programme results | 4 |
| **Contested Areas** | C | Honest assessments of where UNFPA's work is disputed, controversial, or politically sensitive | 5 |
| **PMNCH** | PMNCH | The Partnership for Maternal, Newborn & Child Health — mandate, accountability work, relationship to UNFPA | 5 |

### Document naming convention

```
UNFPA-O-01  →  UNFPA · Orientation block · Document 01
UNFPA-W-05  →  UNFPA · Programme Work block · Document 05
PMNCH-C-02  →  PMNCH · Contested block · Document 02
```

Each document has a frontmatter header:
```yaml
---
CODE: UNFPA-O-01
TITLE: UNFPA in Plain Language: What It Does, How It Works, Who Funds It
TIER: Orientation
AUDIENCE: Both
STATUS: Complete
---
```

- **TIER**: Orientation (context-setting), Working (operational depth)
- **AUDIENCE**: Board (governance), Staff (operational), Both

---

## Technical setup

### Requirements

- Node.js 18+
- PostgreSQL database with [pgvector](https://github.com/pgvector/pgvector) extension (for the chat/RAG feature)
  - [Supabase](https://supabase.com) free tier works out of the box — pgvector is enabled by default
- OpenAI API key (for generating embeddings)
- Anthropic API key (for the chat responses)

### Local development

```bash
# 1. Clone the repository
git clone https://github.com/On-The-Ground-AI/unfpa-lkyspp-otg.git
cd unfpa-lkyspp-otg/next-app

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.local.example .env.local
# Edit .env.local with your DATABASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY

# 4. Generate Prisma client
npx prisma generate

# 5. Push database schema (creates the tables + pgvector extension)
npx prisma db push

# 6. Ingest the knowledge base documents
npx tsx scripts/ingest-knowledge.ts --all

# 7. Start the dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

The **knowledge base browsing** (`/knowledge`) works without a database — it reads directly from the markdown files. Only the **chat interface** requires the database and API keys.

### Ingestion script options

```bash
# Dry run — see what would be ingested without touching the database
npx tsx scripts/ingest-knowledge.ts --all --dry-run

# Force re-ingest (updates existing documents, regenerates embeddings)
npx tsx scripts/ingest-knowledge.ts --all --force

# Check corpus status
npx tsx scripts/ingest-knowledge.ts --status

# Ingest a single document
npx tsx scripts/ingest-knowledge.ts --file ../docs/knowledge-base/unfpa/UNFPA-O-01.md
```

### Environment variables

```bash
# PostgreSQL connection (Supabase, Neon, or any Postgres+pgvector instance)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
DATABASE_URL_UNPOOLED=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# OpenAI — generates the embeddings used for semantic search
OPENAI_API_KEY=sk-...

# Anthropic — powers the chat responses
ANTHROPIC_API_KEY=sk-ant-...

# Embedding config (defaults match schema, no need to change)
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

### Deploying to Vercel

1. Fork this repository
2. Create a new Vercel project, set **Root Directory** to `next-app`
3. Add the environment variables above in Vercel's settings
4. Deploy

Note: The knowledge base browsing pages are statically rendered at build time and do not require a database connection to function. Only the `/api/chat` endpoint requires the database and API keys.

---

## Repository structure

```
unfpa-lkyspp-otg/
├── README.md                        ← You are here
├── docs/
│   └── knowledge-base/
│       └── unfpa/
│           ├── INDEX.md             ← Document index
│           ├── UNFPA-O-01.md        ← Orientation documents
│           ├── UNFPA-O-02.md
│           ├── ...
│           ├── UNFPA-W-01.md        ← Programme Work documents
│           ├── ...
│           ├── UNFPA-D-01.md        ← Data & Evidence documents
│           ├── ...
│           ├── UNFPA-C-01.md        ← Contested Areas documents
│           ├── ...
│           ├── PMNCH-O-01.md        ← PMNCH documents
│           └── ...
└── next-app/
    ├── app/
    │   ├── page.tsx                 ← Chat interface (/)
    │   ├── layout.tsx               ← Site-wide layout + nav
    │   ├── globals.css
    │   ├── knowledge/
    │   │   ├── page.tsx             ← Knowledge base index (/knowledge)
    │   │   └── [slug]/
    │   │       └── page.tsx         ← Individual document (/knowledge/unfpa-o-01)
    │   └── api/
    │       ├── chat/route.ts        ← Chat API (POST /api/chat)
    │       └── admin/knowledge/
    │           ├── route.ts         ← List / trigger ingestion
    │           └── search/route.ts  ← Test semantic search
    ├── components/
    │   └── knowledge-chat.tsx       ← Chat UI component
    ├── lib/
    │   ├── prisma.ts                ← Prisma client singleton
    │   └── docs.ts                  ← Filesystem doc reader
    ├── services/
    │   ├── embeddingService.ts      ← OpenAI embedding wrapper
    │   ├── chunkingService.ts       ← Markdown-aware chunker
    │   └── knowledgeDocumentService.ts ← Ingest + semantic search
    ├── scripts/
    │   └── ingest-knowledge.ts      ← CLI ingestion script
    ├── types/
    │   └── corpus.ts                ← Shared TypeScript types
    └── prisma/
        └── schema.prisma            ← KnowledgeDocument + KnowledgeChunk models
```

---

## Feedback

If you find an error, have context that would improve a document, or want to flag something that seems out of date, email [UNFPA@ontheground.agency](mailto:UNFPA@ontheground.agency). Each document page also has a direct feedback button.

This knowledge base is intentionally versioned in git so corrections can be tracked transparently.

---

## Licence

The **code** (everything in `next-app/`) is released under the MIT licence.

The **documents** (everything in `docs/knowledge-base/`) are released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — you may reproduce, adapt, or build on them for any purpose with attribution to On The Ground / LKYSPP.

---

*Built by [On The Ground](https://ontheground.agency) · Research by Claude Code (Anthropic) · For LKYSPP, National University of Singapore*
