# Introducing the UNFPA Partnership Catalyst: An AI-Powered Knowledge Tool

**Prepared by:** Dr. Asa Torkelsson, Chief, UNFPA Seoul Representation Office
**Date:** April 2026
**Audience:** UNFPA IT Team
**Purpose:** Introduction, technical briefing, and deployment approval pathway

---

## Opening: Why I Championed This

Colleagues, as many of you know, one of the most persistent challenges our teams face — whether in Seoul, Bangkok, or Dhaka — is the time it takes to prepare for a funding conversation. We know our programmes deeply. But translating what we do into language that resonates with a Singapore family office, a Korean corporate foundation, or a climate philanthropist? That takes hours of research, synthesis, and drafting. Hours our programme officers rarely have.

When the Lee Kuan Yew School of Public Policy (LKYSPP) at the National University of Singapore approached me with a proposal to address exactly this gap, I said yes immediately.

What they have built — in the form of a working prototype — is something I want to bring formally into UNFPA's infrastructure. Today I want to walk you, our IT team, through what this is, how it works, and what it would take to make it ours.

---

## The Problem: Two Broken Sides

Before I describe the tool, I want to be clear about the problem it solves — because it is not merely a convenience. It addresses a structural dysfunction that costs our organisation real impact.

**On the UNFPA side:**

Across our country offices and regional programmes, we have a wealth of evidence-based solutions: maternal health programmes delivering results in fragile settings, adolescent SRHR initiatives reducing early marriage, midwifery pipelines strengthening health systems. We know what works. We have the data, the country presence, and the implementation capacity.

What we consistently struggle with is **access to non-traditional funding**. Our staff spend significant time trying to navigate the philanthropy landscape — who funds what, at what scale, through what mechanisms — and still arrive at meetings underprepared or speaking in development jargon that does not land with a private donor.

**On the philanthropy side:**

In Singapore alone, there are hundreds of family offices, foundations, and corporate philanthropic vehicles managing significant capital. Many of them are actively seeking high-impact health, gender, and climate investments. But they lack the intelligence infrastructure to identify credible, scalable partners in development. They do not know us. They do not know what we do, or how their capital could move through our systems.

**The result:**

Two worlds that should be finding each other are instead passing each other by. Funding conversations that could open strategic partnerships never happen. Philanthropic capital that could complement Official Development Assistance sits underdeployed, or flows to less effective channels.

This is not primarily a communication problem. It is a **market failure** — a broken information environment where willing buyers and willing sellers cannot locate each other or speak the same language.

---

## The App's Role: Market-Maker and Matchmaker

Let me be direct about what this tool actually is, because the label matters for how we think about maintaining and scaling it.

This is **not** just a PPP design research project.

This is **not** just a static report about Singapore philanthropy.

This is a **market-creation and matchmaking system** — a tool designed to bridge the two broken sides I just described by giving UNFPA staff the intelligence and language they need to initiate, prepare for, and close funding conversations with non-traditional partners.

Think of it as a briefing room that is always open, always current, and always ready to help a programme officer walk into a room with a family office and speak their language — framing our maternal health work as a climate resilience investment, positioning our adolescent SRHR programmes as human capital returns, connecting our midwifery pipeline to gender equity metrics that a foundation's board understands.

The strategic reframe is important: when UNFPA's leadership considers whether to invest in maintaining this tool, the question is not "do we need a better chatbot?" The question is: **do we want to participate in the philanthropic market on our own terms, with our own intelligence, rather than waiting to be discovered?**

My view is unambiguous. We do.

---

## What the LKYSPP Team Delivered

The LKYSPP Policy Innovation Lab, under the leadership of student researchers Rani Opula Rajan, Prachi Sharma, Abhishek Tiwari, and Preeti Patil — with application development by Haojun See (MPP 2021) and On The Ground — produced two concrete deliverables:

### Deliverable 1: Singapore Philanthropy Landscape Report (60 pages)

This is original, deeply researched intelligence on Singapore's philanthropic ecosystem. It maps the major foundations, family offices, and corporate philanthropic vehicles active in health, gender, climate, and humanitarian contexts; analyses their funding priorities and decision-making criteria; and identifies where their interests intersect with UNFPA's mandate. This kind of intelligence would normally cost tens of thousands of dollars from a specialist consultancy and take months to produce.

The research is not sitting in a PDF drawer. It has been structured, chunked, and embedded into the AI tool — making it **queryable and actionable in real time**.

### Deliverable 2: AI-Powered Knowledge Tool (Prototype)

A live web application — currently accessible at unfpa-lkyspp-otg.vercel.app — that combines the LKYSPP research with a curated UNFPA knowledge base, connected to a conversational AI interface designed specifically for partnership preparation.

I want to share my own assessment of this tool clearly. When the LKYSPP team presented it to me, I said what I believe: **this is very exciting and genuinely valuable work**. It reflects next-generation development practice — using AI not as a gimmick but as an operational capability that supports real programme delivery. In a volatile funding environment where traditional ODA flows are under pressure and non-traditional partnerships are increasingly essential, this kind of tool supports the **agility** our organisation needs.

---

## What the AI Tool Can Do

The chat interface is not a general-purpose AI assistant. It is narrowly and deliberately designed for one purpose: **helping UNFPA staff prepare for partnership and funding conversations**, particularly in the Asia-Pacific context.

A staff member can ask it to:

- **Generate a funder pitch** — for example, positioning UNFPA's climate-SRHR nexus work for a family office focused on climate adaptation in Southeast Asia
- **Draft a briefing note** — a structured two-pager on reproductive health and climate resilience for a philanthropic partner unfamiliar with our mandate
- **Prepare meeting talking points** — for a conversation about blended finance mechanisms for health systems strengthening
- **Match our projects to a funder's priorities** — given a corporate foundation's focus on gender equity, which UNFPA programmes in the region align, and how?
- **Frame our work for climate funding** — how do we position maternal health or family planning in terms that speak to climate resilience investors?
- **Compare financing models** — what is the difference between a Development Impact Bond, a blended finance structure, and South-South cooperation, and which is appropriate for a given context?

The tool draws on two sources simultaneously: its curated internal knowledge base and live web search for current information. It returns comprehensive, ready-to-use responses — not fragments. Staff can export outputs directly to Word (.docx), PDF (.pdf), or PowerPoint (.pptx), meaning the gap between a query and a usable draft document is a matter of seconds.

**Knowledge base contents (32 curated documents across 6 thematic blocks):**

| Block | Contents |
|---|---|
| Orientation | UNFPA in plain language, three transformative results, country programme model, ICPD mandate, key terminology |
| Programme Work | Maternal health, family planning, GBV, FGM, child marriage, adolescent SRHR, midwifery, obstetric fistula |
| Data & Evidence | State of World Population, demographic dividend, census/CRVS systems, results reporting |
| Contested Areas | Politically sensitive topics UNFPA navigates — handled with care and accuracy |
| Resilience & Partnerships | PPP models, climate-SRHR nexus, Singapore philanthropic ecosystem (incorporating the 60-page landscape report) |
| PMNCH | Partnership for Maternal, Newborn & Child Health — overview and comparison with UNFPA |

Each document is 3,000–8,000 words, researched from primary sources, and structured for AI retrieval. The system uses semantic vector search — meaning a question about "financial returns on gender health" will surface relevant content about "reproductive health investment cases" even if those exact words were never used together.

---

## How It Was Built

For the IT team's assessment, here is the complete technology stack:

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 16 (React 19, TypeScript 5) |
| Styling | Tailwind CSS 4 |
| Backend | Next.js API routes (Node.js runtime) |
| Database | PostgreSQL with pgvector extension |
| ORM | Prisma 7 |
| Language model | Anthropic Claude Sonnet 4 (API) |
| Embedding model | OpenAI text-embedding-3-small (API) |
| Hosting (current) | Vercel |
| Document export | docx, pdfkit, pptxgenjs (open-source libraries) |

Every component is production-grade, open-source or commercially standard, and maintained by major technology organisations. There is no proprietary dependency that creates lock-in, and no bespoke infrastructure that cannot be replicated or migrated.

**How the knowledge base ingestion works:**

1. Documents are written in Markdown with structured metadata headers
2. An ingestion script parses each document, computes a SHA-256 fingerprint for change detection, and splits the content into ~1,000-word chunks that follow the document's heading structure
3. Each chunk is sent to OpenAI's embedding model, which returns a 1,536-dimensional numerical vector representing the chunk's meaning
4. Chunks and their embeddings are stored in PostgreSQL via the pgvector extension
5. At query time, the user's question is embedded the same way, and the database finds the most semantically similar chunks using vector cosine similarity
6. Retrieved chunks are passed to Claude alongside the user's question, and Claude synthesises a structured answer

Updating the knowledge base requires no programming: a staff member edits or adds a Markdown file, then runs a single command (`npm run ingest-all`) to re-process and update the database. Changed documents are detected automatically; unchanged ones are skipped.

---

## Handover Terms

I want to be direct about the commercial and operational terms.

**Cost of acquisition: Zero.**

The LKYSPP team has built this as an academic and public-service contribution. There is no licensing fee, no transfer fee, and no ongoing commercial obligation to the development team. The codebase is a gift.

**What UNFPA receives:** The full application codebase — every line of code, every configuration file, every ingestion script, and every knowledge document. Nothing is held back.

**Repository access — private vs. public:**

The current repository is hosted under a private GitHub organisation. UNFPA can choose:

- **Private (recommended):** The codebase is transferred to a private UNFPA GitHub organisation, visible only to authorised staff and vendors. Recommended given the sensitivity of the partnership intelligence and contested-areas content.
- **Public:** If UNFPA wished to contribute this as an open-source tool for the broader UN system, the application code (excluding knowledge content) could be made public at a later stage.

**Hosting options:**

| Option | Effort | Cost |
|---|---|---|
| Vercel (current) | None — already running | Free tier likely sufficient for staff-scale usage |
| Managed cloud (AWS/Azure/GCP) | Low — containerise and deploy | Variable; depends on database and compute sizing |
| UNFPA self-hosted | Medium — requires Node.js + PostgreSQL infrastructure | Internal IT cost only |

**External API dependencies (runtime):**

| Service | Purpose | Estimated cost (20–30 active users) |
|---|---|---|
| Anthropic (Claude Sonnet) | Conversation and synthesis | ~USD 30–150/month |
| OpenAI (text-embedding-3-small) | Query and document embeddings | ~USD 5–20/month |

UNFPA would need its own API keys for both services. These are standard commercial accounts with no minimum commitment.

**Long-term maintenance model:**

- **Knowledge stewardship** (programme staff): Adding or updating knowledge documents requires only writing Markdown files — no programming skill needed. Recommended: one designated knowledge steward per regional office.
- **Technical stewardship** (IT team): Running the ingestion pipeline when documents are updated, managing API keys, handling hosting, and making code-level modifications when features need to change.

If internal technical capacity is limited, the application is standard enough that any competent web development contractor could maintain it. The stack is widely known and the codebase is well-structured.

---

## Questions for the UNFPA IT Team: Approvals and Deployment Pathway

Deploying this tool inside UNFPA is not purely a technical question. Before any internal rollout, we need to work through a structured set of approvals. I am asking the IT team to assess each of the following areas and advise on the pathway and timeline.

Please treat this as a working checklist — not all items will apply, but each should be consciously addressed.

---

### A. Data Governance and Privacy

1. Does UNFPA HQ's data governance policy permit the use of third-party AI APIs (Anthropic, OpenAI) to process internal documents and staff queries? Is there a blanket policy, or does each tool require individual approval?
2. Is any content in the knowledge base — particularly the Singapore foundations intelligence and partnership strategy documents — classified or restricted? Does it require data residency controls (i.e., the data must not leave a specific jurisdiction)?
3. Do any knowledge base documents or chat query logs contain personal data or PII that would trigger obligations under GDPR, UN data protection frameworks, or national privacy laws?
4. Who is the designated Data Protection Officer (or equivalent) who must sign off on AI tool deployments involving external API data transfer?
5. Do chat queries submitted by staff constitute "organisational data" that requires retention, deletion, or classification policies?

---

### B. Cybersecurity and Vendor Risk

6. What is UNFPA's standard security assessment process for new tools that involve external API dependencies? Is there a formal vendor risk assessment or security questionnaire?
7. Are Anthropic and OpenAI on UNFPA's approved vendor list? If not, what is the procurement and approval pathway to add them?
8. Is a penetration test or application vulnerability assessment required before any internal-facing deployment?
9. Does the Vercel hosting platform meet UNFPA's cloud security standards (e.g., ISO 27001, SOC 2 Type II, FedRAMP equivalents)? If not, would self-hosted deployment resolve this?
10. Are there UNFPA security requirements around how API keys are stored and rotated? The application currently uses environment variables — does this meet your standards, or is a secrets management service (e.g., AWS Secrets Manager, HashiCorp Vault) required?

---

### C. Procurement and Legal

11. At what level of annual vendor spend does a formal procurement process (RFP or equivalent) become mandatory? The estimated annual spend on Anthropic and OpenAI APIs is USD 500–2,000 for typical staff-scale usage — does this fall below the threshold?
12. Does accepting a zero-cost codebase transfer from an academic institution (NUS/LKYSPP) require a formal legal instrument — for example, an MOU, an IP assignment agreement, or an open-source license review?
13. Who in UNFPA Legal needs to review and sign off on the codebase transfer before IT can formally accept and deploy it?
14. If the knowledge base contains content derived from UNFPA's own published reports and data, does UNFPA retain full IP rights to that content, and does embedding it into an AI knowledge base require any internal clearance?
15. Does use of Anthropic's or OpenAI's APIs require review against any UN ethics or AI governance commitments UNFPA has made to member states or partner organisations?

---

### D. Infrastructure and Hosting

16. Can UNFPA formally accept external hosting on a platform like Vercel for a staff-facing internal tool, or does UNFPA policy require all such tools to be hosted on UNFPA-managed or UN-approved cloud infrastructure?
17. If self-hosted deployment is required: does UNFPA have existing containerised infrastructure (Kubernetes, Docker Compose, etc.) that a Next.js application could be deployed onto?
18. What is the standard approval pathway for provisioning a new PostgreSQL database instance with the pgvector extension? Which team owns database provisioning, and what are the typical lead times?
19. What CI/CD, deployment pipeline, and change management standards must the application comply with before it can be deployed in a UNFPA environment?
20. Is there a disaster recovery or uptime SLA requirement for internal tools? The current Vercel deployment offers 99.99% uptime — is this sufficient, or does UNFPA require a specific SLA with contractual commitments?

---

### E. Access Control and Identity

21. Should this tool be restricted to authenticated UNFPA staff only? If so, does it need to integrate with UNFPA's single sign-on (SSO) system or Active Directory / Azure AD?
22. The current prototype does not have user authentication — it is open to anyone with the URL. Is this acceptable for a staff tool, or must authentication be implemented before any deployment?
23. Should access be role-based — for example, restricting certain knowledge blocks (such as Contested Areas documents) to specific staff levels or roles?
24. Who will administer user access and role assignments? Is there an existing identity management system this should plug into?
25. Is there a requirement for audit logging of chat queries for compliance, accountability, or data governance purposes? If so, what retention period applies?

---

### F. AI and Algorithmic Governance

26. Has UNFPA adopted an internal AI use policy or responsible AI guidelines? If so, does this tool need to be reviewed against those guidelines before deployment?
27. Is there a requirement for human review before AI-generated outputs — such as funder pitches or briefing notes generated by this tool — are used in external communications? If so, how should that process be documented?
28. Does this tool need to be registered in a UNFPA AI inventory, disclosed to UNFPA's Executive Board, or reported to any UN-system-wide AI governance body (e.g., UN Chief Executives Board AI policy frameworks)?
29. Are there specific AI model vendors that UNFPA is prohibited from using — for example, due to data sovereignty concerns or geopolitical considerations?
30. What disclosures, if any, must UNFPA make to external partners or donors when content prepared with this tool is used in funding conversations?

---

## My Ask of the IT Team

I am not asking you to build anything. The LKYSPP team has already built it.

I am asking you to:

1. **Review the codebase** and assess its alignment with UNFPA's security and hosting standards
2. **Work through the approval checklist above** — identify which items apply, which require escalation, and what the realistic pathway and timeline looks like
3. **Advise on the hosting decision** — whether Vercel is acceptable or whether we need to prepare a self-hosted deployment
4. **Advise on the authentication requirement** — whether the prototype needs SSO integration before any internal use, or whether a phased approach (initially restricted URL, then SSO) is acceptable
5. **Facilitate the API vendor approval** — register Anthropic and OpenAI as vendors if they are not already on the approved list
6. **Participate in a technical handover session** with Haojun See and the LKYSPP development team — I can arrange this at any time

I would like to propose a 30-day assessment window, with a written recommendation from the IT team at the end: deploy as-is, deploy with modifications, or escalate for further governance review. I believe this tool can be genuinely operational within one quarter if we move efficiently.

---

## Closing

In 25 years working across the UN system — with FAO, IFAD, UN Women, the World Bank, and now UNFPA — I have rarely seen a tool this directly useful to our day-to-day work arrive with this few strings attached. The LKYSPP team built something real. It works. And it is being offered to us freely.

The market failure between UNFPA's programmatic capacity and the philanthropic community's capital is not going to fix itself. We need better tools to participate in that market actively, intelligently, and on our own terms.

This is one of those tools. I am asking you to help us bring it home.

**Dr. Asa Torkelsson**
Chief, UNFPA Seoul Representation Office
May 2024 — present
*April 2026*
