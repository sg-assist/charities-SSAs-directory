# The Directory — Singapore Charities & Social Service Agencies

A comprehensive directory and AI-powered knowledge base of Singapore's charities, social service agencies (SSAs), voluntary welfare organisations (VWOs), and caregiving resources. Built by **SG Assist Pte Ltd** x **OTG (On The Ground)**.

**Live site:** [charities-ssa-directory.vercel.app](https://charities-ssa-directory.vercel.app)

---

## What this is

The Directory is a single platform for navigating Singapore's social service ecosystem. It serves two audiences:

- **People who need help** — caregivers, families, individuals looking for the right service (eldercare, disability support, mental health, financial assistance, etc.)
- **People who provide help** — social workers, case managers, volunteers, and organisation staff who need a quick reference to other services

The platform has three components:

1. **AI Chat Interface** — describe your situation in plain language, get matched to relevant organisations, services, subsidies, and next steps. Powered by Claude with RAG over the knowledge base.

2. **Organisation Directory** — a browsable, filterable, searchable table of Singapore organisations with contact details, service descriptions, and categories. Each entry has a "Report incorrect details" button.

3. **Knowledge Base** — deep-dive reference documents covering Singapore's social service landscape by sector (eldercare, disability, mental health, family services, healthcare, community).

---

## Coverage

| Sector | What's covered |
|--------|---------------|
| **Government** | MOH, MSF, AIC, NCSS, Commissioner of Charities — policies, subsidies, schemes |
| **Eldercare** | Nursing homes, senior day care, home care, caregiver support, dementia care |
| **Disability** | SG Enable, EIPIC, SPED schools, adult services, employment, assistive tech |
| **Mental Health** | Crisis helplines, counselling, community MH orgs, youth mental health |
| **Family Services** | Family Service Centres, family violence services, divorce support, children & youth |
| **Healthcare** | Healthcare foundations, chronic disease orgs, hospice, palliative care |
| **Community** | Befriending, volunteers, self-help groups, food banks, migrant worker support |
| **Financial Assistance** | ComCare, MediFund, CDC vouchers, self-help group grants |

---

## Technical stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4
- **AI Chat:** Anthropic Claude API (SSE streaming, agentic tool-use with web search)
- **Embeddings:** OpenAI text-embedding-3-small (1536 dimensions)
- **Database:** PostgreSQL + pgvector (via Prisma 7, Supabase-compatible)
- **Export:** Word document (.docx) generation from chat conversations
- **Deployment:** Vercel

---

## Local development

```bash
# 1. Clone the repository
git clone https://github.com/sg-assist/charities-SSAs-directory.git
cd charities-SSAs-directory/next-app

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.local.example .env.local
# Edit .env.local with your DATABASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY

# 4. Generate Prisma client
npx prisma generate

# 5. Push database schema
npx prisma db push

# 6. Ingest the knowledge base documents
npx tsx scripts/ingest-knowledge.ts --all

# 7. Start the dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

The **knowledge base** (`/knowledge`) and **directory** (`/directory`) work without a database — they read from markdown files and the API respectively. The **chat interface** requires the database and API keys.

---

## Scripts

### Knowledge base ingestion

```bash
npx tsx scripts/ingest-knowledge.ts --all           # ingest all markdown docs
npx tsx scripts/ingest-knowledge.ts --all --force    # force re-ingest
npx tsx scripts/ingest-knowledge.ts --all --dry-run  # preview
npx tsx scripts/ingest-knowledge.ts --status         # corpus status
```

### Data scraping (organisation directory)

```bash
npm run scrape-charities    # charities.gov.sg register
npm run scrape-ncss         # NCSS social service directory
npm run scrape-aic          # AIC care facilities
npm run scrape-guidelines   # MOH/MSF/AIC/NCSS guidelines
npm run scrape-all          # run all scrapers
```

### PDF ingestion

```bash
npm run ingest-pdfs         # ingest PDF documents
npm run ingest-all          # ingest everything (markdown + PDFs)
```

---

## Environment variables

```bash
# PostgreSQL (Supabase, Neon, or any Postgres+pgvector instance)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# OpenAI — generates embeddings for semantic search
OPENAI_API_KEY=sk-...

# Anthropic — powers chat responses
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Repository structure

```
charities-SSAs-directory/
├── README.md
├── docs/
│   └── knowledge-base/
│       └── directory/
│           ├── DIR-G-01.md        ← Government & policy overview
│           ├── DIR-E-01.md        ← Eldercare services
│           ├── DIR-D-01.md        ← Disability services
│           ├── DIR-M-01.md        ← Mental health services
│           ├── DIR-F-01.md        ← Family services
│           ├── DIR-H-01.md        ← Healthcare & palliative
│           └── DIR-C-01.md        ← Community organisations
└── next-app/
    ├── app/
    │   ├── page.tsx               ← Chat interface (/)
    │   ├── directory/page.tsx     ← Organisation directory (/directory)
    │   ├── knowledge/             ← Knowledge base pages (/knowledge)
    │   └── api/
    │       ├── chat/route.ts      ← Chat API (SSE streaming)
    │       ├── directory/route.ts ← Directory API (filtering, search)
    │       └── export/route.ts    ← Word export API
    ├── components/
    │   └── knowledge-chat.tsx     ← Chat UI component
    ├── services/
    │   ├── embeddingService.ts    ← OpenAI embeddings
    │   ├── chunkingService.ts     ← Document chunking
    │   ├── exportService.ts       ← Word document generation
    │   └── knowledgeDocumentService.ts
    ├── scripts/
    │   ├── ingest-knowledge.ts    ← Markdown ingestion
    │   ├── ingest-pdfs.ts         ← PDF ingestion
    │   ├── scrape-charities-gov.ts
    │   ├── scrape-ncss.ts
    │   ├── scrape-aic.ts
    │   ├── scrape-guidelines.ts
    │   ├── scrape-all.ts          ← Master scrape orchestrator
    │   └── ingest-orgs-to-kb.ts   ← Bridge org data → embedding KB
    └── prisma/
        └── schema.prisma          ← KnowledgeDocument, KnowledgeChunk, Organisation
```

---

## Knowledge base document format

Documents use YAML frontmatter:

```yaml
---
CODE: DIR-E-01
TITLE: Eldercare Services and Support in Singapore
TIER: Reference
AUDIENCE: Public
STATUS: Complete
---
```

Category codes: `G` (Government), `E` (Eldercare), `D` (Disability), `M` (Mental Health), `F` (Family), `H` (Healthcare), `C` (Community)

---

## Feedback

Found an error or have information to add? Use the feedback button on any page, or email [admin@sgassist.sg](mailto:admin@sgassist.sg).

---

## Licence

The **code** (everything in `next-app/`) is released under the MIT licence.

The **knowledge base documents** (everything in `docs/knowledge-base/`) are released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

---

*Built by SG Assist Pte Ltd x OTG*
