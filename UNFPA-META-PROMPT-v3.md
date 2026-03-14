# UNFPA Research Intelligence System
## Meta-Prompt and Operating Manual
### Version 3.0

---

## WHAT THIS PROMPT IS FOR

This prompt governs the building of a two-layer knowledge system. The two layers are built in sequence — Layer 2 first, then Layer 1.

**Layer 2 — The Structured Knowledge Base** (built first — this is what this prompt governs)
Synthesised, researcher-written documents covering UNFPA's programme areas, methods, evidence base, and comparison with PMNCH. These documents are written from research into publicly available sources. They are structured for querying — each answers a specific question a practitioner or decision-maker would actually ask. This layer is built before any PDFs are ingested.

**Layer 1 — The Ingested Reports** (added later, as a supplement)
Raw published material downloaded from UNFPA, PMNCH, and partner websites: country programme documents, annual reports, State of World Population reports, evaluation findings, technical guidance, strategic plans. When ingested, these sit alongside Layer 2 and extend its depth and currency. They do not replace Layer 2 — they add primary source detail that the synthesised documents can reference and link to.

**The build sequence matters**: Layer 2 is built first because it provides the analytical framework. When the raw PDFs arrive in Layer 1, the system already knows how to read them — what questions to ask, what to look for, what to flag. A knowledge base without that framework is just a pile of PDFs.

---

## THE LAYER 2 DOCUMENT LIST

These are the documents that make up the structured knowledge base. They are grouped into five blocks and built in phases. Each document answers a specific question — that is the test for whether a document belongs here.

### Document format (every document must follow this)

```
---
CODE: [e.g. UNFPA-W-03]
TITLE: [plain language title]
TIER: [Orientation / Working]
AUDIENCE: [Practitioner / Decision-maker / Both]
STATUS: [Seed / Draft / Complete]
---

## WHAT THIS DOCUMENT COVERS
[1–2 sentences. What question does this document answer?]

## KEY FACTS
[Bullet points. The most important things to know.]

## DETAIL
[Substantive content. Always include: what UNFPA/PMNCH says officially,
what the independent evidence says, and where there is a gap or dispute.]

## CURRENT STATUS
[State of this programme/policy/report as of the most recent available information.]

## SOURCES
[Every source cited. UNFPA documents link to unfpa.org. PMNCH to who.int/pmnch.]

## RELATED DOCUMENTS
[2–5 codes of related corpus documents.]
```

---

### BLOCK A: ORIENTATION — WHAT THESE ORGANISATIONS ARE

*Build these 8 documents first. Everything else depends on them. Each is 1,000–2,000 words.*

**UNFPA-O-01** | UNFPA in Plain Language: What It Does, How It Works, Who Funds It
The 90-second brief on UNFPA. Mandate. Geographic reach. Budget size and top donors. Three transformative results. Where the money goes. No history. No detail. Just what anyone needs before a first meeting.

**UNFPA-O-02** | UNFPA's Three Transformative Results: The Framework in Practice
The three goals: zero preventable maternal deaths, zero unmet need for family planning, zero gender-based violence and harmful practices. What each target means operationally. How UNFPA measures progress. What the current numbers show. Where the gaps are.

**UNFPA-O-03** | UNFPA's Country Programme Model: How Programmes Are Designed and Delivered
How a country programme works from CPD to implementation. The role of government partners and NGOs. How resources are allocated across countries. What "national ownership" means in practice.

**UNFPA-O-04** | UNFPA's ICPD Mandate: The 1994 Foundation and What It Still Means Today
What the 1994 Cairo conference established. The rights-based approach in plain language. What UNFPA can and cannot do under its mandate (particularly on abortion). Why this matters for current programme design.

**UNFPA-O-05** | PMNCH in Plain Language: What It Is, How It Differs from UNFPA
PMNCH (Partnership for Maternal, Newborn and Child Health) as a WHO-hosted multi-stakeholder platform. Its mandate vs. UNFPA's mandate. How they relate to each other. What PMNCH does that UNFPA does not, and vice versa. When to engage which organisation.

**UNFPA-O-06** | UNFPA vs. PMNCH: A Side-by-Side Comparison
Direct comparison table covering: mandate, governance, funding model, geographic focus, primary outputs, relationship to WHO, relationship to member states, relationship to civil society, and key publications. A decision-support tool for anyone choosing how to engage either organisation.

**UNFPA-O-07** | How UNFPA Fits in the Wider SRHR Architecture
Where UNFPA sits relative to WHO, UNICEF, the World Bank, bilateral donors, and major NGOs on sexual and reproductive health and rights. Who does what. Where mandates overlap and where there are gaps.

**UNFPA-O-08** | Key UNFPA Terminology: A Practical Glossary
Plain-language definitions of terms used constantly in UNFPA documents: SRHR, MISP, CPD, transformative results, unmet need, skilled birth attendance, EmOC, CRVS, harmful practices, normative vs. operational.

---

### BLOCK B: UNFPA'S CORE PROGRAMME AREAS

*Working documents on what UNFPA actually does in the field. 1,500–3,000 words each. Written for practitioners who need current guidance and for decision-makers who need to understand where resources are deployed.*

**UNFPA-W-01** | Maternal Health: Current Programme Approach and Evidence
What UNFPA funds and supports in maternal health. Skilled birth attendance, emergency obstetric care, midwifery strengthening. Current global numbers on maternal mortality. What interventions have the strongest evidence. Where UNFPA's approach has been most effective.

**UNFPA-W-02** | Obstetric Fistula: The Campaign to End Fistula
What fistula is and who it affects. UNFPA's Campaign to End Fistula: programme structure, countries covered, documented results. What surgical repair involves. Prevention vs. treatment balance. Current status of the campaign. Independent evaluation findings.

**UNFPA-W-03** | Family Planning: Unmet Need, Method Mix, and the Supply Chain
Global unmet need for family planning: current data and distribution. What UNFPA procures and distributes. How country programmes approach method mix. The rights-based approach in family planning practice. Community-based distribution: evidence and implementation.

**UNFPA-W-04** | The Minimum Initial Service Package (MISP) in Humanitarian Settings
What the MISP is and what it requires. The five MISP objectives. How it is operationalised in acute emergencies vs. protracted crises. Common implementation failures. Who is responsible for what in a humanitarian response.

**UNFPA-W-05** | Gender-Based Violence in Humanitarian Settings: UNFPA's Programme Role
GBV coordination in humanitarian settings. The GBV Area of Responsibility and UNFPA's lead role. Clinical management of rape: the current protocol. GBV Information Management System (GBVIMS): what it is and how it is used.

**UNFPA-W-06** | Female Genital Mutilation: The UNFPA-UNICEF Joint Programme
The joint programme structure. Community-based abandonment approach vs. legal/enforcement approach. What the evidence says about effective interventions. Current prevalence data and trends.

**UNFPA-W-07** | Child Marriage: Programme Approaches and Evidence
Global data on child marriage. UNFPA's programme approaches: community engagement, girls' empowerment, policy advocacy. What the evidence says works. How UNFPA coordinates with other actors.

**UNFPA-W-08** | Adolescent Sexual and Reproductive Health: Current Guidance
UNFPA's ASRH programming framework. Comprehensive Sexuality Education: what it covers, the evidence for it, the political controversy around it. Adolescent pregnancy: data and programme responses.

**UNFPA-W-09** | Midwifery: UNFPA's Investment in the Workforce
The State of the World's Midwifery reports: key findings. The case for midwifery as the central investment in maternal health. UNFPA's midwifery education and deployment programmes. The gap between supply and need.

**UNFPA-W-10** | Contraceptive Procurement: How UNFPA Moves Supplies
UNFPA as the world's largest contraceptive procurer. The procurement process. Quality standards. Last-mile distribution challenges. What happens when supply is disrupted.

---

### BLOCK C: POPULATION DATA AND EVIDENCE

**UNFPA-D-01** | The State of World Population Report: How to Use It
The annual flagship publication. What it covers, what it does not. How to find the data behind the narrative. Limitations: what it is good for and what it oversimplifies. Archive of recent themes and key findings.

**UNFPA-D-02** | Population Data: UNFPA's Role in Census and CRVS Support
What UNFPA funds in national statistical systems. Why census and civil registration matter for SRHR programming. The "invisible people" problem. How to access country-level population data.

**UNFPA-D-03** | Demographic Dividend: The Concept, the Evidence, and the Limitations
What the demographic dividend is. The conditions required to realise it. What the evidence shows. How UNFPA uses the concept in advocacy. Where the concept is overused or misapplied.

**UNFPA-D-04** | UNFPA's Results Reporting: What the Numbers Mean and Don't Mean
How UNFPA reports results in its annual reports and donor documents. The metrics used. Independent evaluations and where they diverge from self-reported results. How to read UNFPA's results framework critically.

---

### BLOCK D: PMNCH — THE PARALLEL ORGANISATION

**PMNCH-O-01** | PMNCH: Mandate, Structure, and Current Strategy
What PMNCH is. Its governance within WHO. Its board structure. The "Partners" model: who joins, what membership means. Its current strategic priorities.

**PMNCH-O-02** | PMNCH's Work: Advocacy, Accountability, and Knowledge
What PMNCH actually produces: advocacy platforms, accountability frameworks, knowledge products, and convening. The Every Woman Every Child movement and PMNCH's role in it.

**PMNCH-W-01** | PMNCH's Research and Evidence Work
PMNCH's knowledge outputs: what it publishes, what it commissions, what it synthesises. How PMNCH translates evidence into policy advocacy. Flagship publications and how to use them.

**PMNCH-W-02** | PMNCH's Accountability Framework: The What Works Series
The "What Works" series of evidence reviews. The accountability mechanism for partner commitments. How PMNCH tracks whether pledges are implemented. Strengths and limitations of the accountability model.

**PMNCH-W-03** | PMNCH and UNFPA: Where They Overlap and Where They Diverge
Detailed working document on programme overlaps, coordination arrangements, joint publications, and where the two organisations occupy different lanes. For someone managing relationships with both.

---

### BLOCK E: CONTESTED GROUND AND HONEST ASSESSMENT

**UNFPA-C-01** | The US Defunding Episodes: What Happened and What It Cost
A factual record of every US defunding episode from 1985 to the present. What Kemp-Kasten says. The determinations made. The actual programme impact each time. Current US position.

**UNFPA-C-02** | UNFPA and Abortion: What the Mandate Says vs. What Critics Claim
What UNFPA's mandate authorises. What UNFPA does and does not fund. The Helms Amendment constraint. The gap between the legal position and the political allegation. How to answer the question accurately in a public setting.

**UNFPA-C-03** | Comprehensive Sexuality Education: The Evidence vs. The Political Controversy
What CSE is. What the evidence shows about its effectiveness. The political opposition and its arguments. How UNFPA promotes CSE in practice in different country contexts.

**UNFPA-C-04** | Where UNFPA's Results Are Disputed: An Honest Assessment
Where independent evaluators have found gaps between UNFPA's reported results and on-the-ground reality. Where the evidence is strong, where it is weak, where reporting methodology inflates apparent impact. For anyone making resource allocation decisions.

**UNFPA-C-05** | The China Programme: What the Record Shows
The factual account of UNFPA's China programme during the one-child policy period. The allegations. The investigations. What the evidence supports and what it does not.

---

### BUILD ORDER

**Phase 1 — Foundation** (Block A, all 8 documents)
Build first. These are the base layer. Nothing else can be queried intelligently without them.

**Phase 2 — Core Programmes** (UNFPA-W-01 through UNFPA-W-05)
Build second. These cover the three transformative results in operational detail and are the most frequently needed by practitioners.

**Phase 3 — PMNCH Block** (Block D, all 5 documents)
Build to enable comparison queries.

**Phase 4 — Contested Ground** (Block E, all 5 documents)
Requires more careful sourcing but essential for the knowledge base to be useful in difficult conversations.

**Phase 5 — Remaining Working Documents**
Complete Blocks B, C in any order.

**Trigger for adding Layer 1**: Once Phase 1 and Phase 2 are complete and the system is queryable, begin downloading and ingesting the raw PDFs described in Part VI.

---

## PART I: THE TWO AUDIENCES AND WHAT THEY NEED

Every query to this system comes from one of two roles. The system should identify which role is asking and calibrate its response accordingly.

### Audience 1: The Practitioner
A programme officer, field coordinator, implementing partner, or technical advisor. They are working on a specific programme in a specific country. They need:
- Current technical guidance — what the standard says, what the protocol is
- Evidence on what works — what the research shows, not what the report claims
- Practical constraints — what typically goes wrong in implementation, what to watch for
- Cross-programme links — how their programme connects to others in the same country

**The practitioner's question sounds like**: "What does the MISP say about clinical management of rape in a camp setting?" or "What does the evidence say about community health workers distributing contraceptives?"

### Audience 2: The Decision-Maker
A senior programme manager, donor representative, government official, or strategic advisor. They are allocating resources, setting priorities, evaluating options, or advising on positioning. They need:
- Strategic overview — what is working at scale, where is the evidence strongest
- Honest assessment — where results are disputed, where reports overstate impact
- Comparative perspective — how UNFPA's approach compares to PMNCH, WHO, or bilateral programmes
- Gaps and risks — what is not being done, where capacity is overstretched

**The decision-maker's question sounds like**: "Where has UNFPA's family planning investment had the most documented impact in East Africa?" or "How does PMNCH's accountability framework compare to UNFPA's results reporting?"

---

## PART II: HOW TO READ SOURCE MATERIAL

When researching and writing Layer 2 documents — and later when processing ingested PDFs from Layer 1 — apply these five reading lenses. Each lens generates different intelligence from the same source material.

### Lens 1: The Stated Intent Lens
What is this document trying to do? What problem does it say it is solving? Who is the intended audience? What commitments or targets does it contain?

*Apply to*: Strategic plans, country programme documents, conference declarations, annual reports.

### Lens 2: The Evidence Lens
What does this document claim as a result or finding? Is that claim supported by primary data, secondary synthesis, or assertion? Is there an independent evaluation that corroborates or challenges it? What methodology was used?

*Apply to*: Evaluation reports, research summaries, results frameworks, the evidence sections of technical guidance.
*Cross-reference with*: Independent evaluations (UNFPA's Independent Evaluation Office), Cochrane reviews, peer-reviewed literature on the same programme area.

### Lens 3: The Implementation Lens
What does this document reveal about how programmes actually run? Who does what? What are the reported constraints — funding gaps, staffing shortfalls, government partner weaknesses, supply chain failures? What does the lessons-learned section actually say?

*Apply to*: Country programme evaluations, humanitarian response reports, lessons-learned documents, after-action reviews.
*Watch for*: Gap between the programme design (what was planned) and the implementation narrative (what happened). This gap is where the real lessons are.

### Lens 4: The Gap Lens
What is this document not saying? What questions does it raise that it does not answer? What data would you need to verify its claims that is not provided? Where does it refer to a challenge without explaining how it was resolved?

*Apply to*: Every document. The gap lens is always running.
*Flag*: Any claim about results that is not tied to a specific data source. Any programme described as successful without an independent evaluation. Any target that appears in a plan but not in a subsequent results report.

### Lens 5: The Comparison Lens
How does this document's approach, finding, or recommendation compare to what PMNCH, WHO, UNICEF, or bilateral programmes say about the same topic? Where is there consensus? Where do approaches diverge and why?

*Apply to*: Technical guidance, programme design documents, strategic plans.
*Use when*: Answering questions about whether UNFPA's approach is standard or distinctive.

---

## PART III: RESEARCH TASKS THE SYSTEM MUST SUPPORT

These are the actual research operations the system needs to perform on the ingested documents. Each is a distinct task type with its own method.

### Task Type 1: Current Guidance Retrieval
**What it is**: Finding what the current official guidance or standard says on a specific topic.
**How to do it**: Locate the most recent technical guidance document on the topic. Check its publication date. Note whether it has been superseded. Extract the specific protocol, standard, or recommendation. Flag if there is a gap between the guidance and the evidence (i.e., guidance that is not evidence-based or that predates significant new research).
**Output format**: Plain statement of what the guidance says + source + date + any caveats.

### Task Type 2: Evidence Synthesis
**What it is**: Summarising what the available research actually shows about an intervention or approach.
**How to do it**: Identify all evaluation reports and research summaries in the corpus on the topic. Separate UNFPA's own assessments from independent evaluations. Note where they agree and where they diverge. Weight independent evaluations more heavily than self-reported results. Note the strength of evidence (RCT, quasi-experimental, observational, case study).
**Output format**: What the evidence supports, what it is uncertain about, and what gaps remain — with sources.

### Task Type 3: Country Programme Analysis
**What it is**: Understanding what UNFPA is doing in a specific country, how well it is working, and what the constraints are.
**How to do it**: Find the current country programme document (CPD). Find any country-level evaluation reports. Find the most recent country office annual report. Cross-reference with regional reports. Extract: programme priorities, budget, key implementing partners, documented results, documented challenges, evaluation findings.
**Output format**: Structured brief — priorities, scale, partners, results, constraints, open questions.

### Task Type 4: Comparative Analysis (UNFPA vs. PMNCH)
**What it is**: Comparing how UNFPA and PMNCH approach the same issue, topic, or country context.
**How to do it**: Identify relevant documents from both organisations on the topic. Apply the Comparison Lens. Note where mandates create different approaches (UNFPA as implementer vs. PMNCH as convener/advocate). Note where they work in the same space and whether they coordinate.
**Output format**: Side-by-side comparison — approach, outputs, evidence base, gaps, and recommended engagement strategy for the specific context.

### Task Type 5: Gap Analysis
**What it is**: Identifying what is not covered, not measured, or not working in UNFPA's current programmes.
**How to do it**: Review the strategic plan targets. Find the most recent results report. Map where results are reported against every target. Identify targets with no results data. Identify programme areas mentioned in country CPDs that do not appear in results reports. Identify topics covered in external research that UNFPA's own documents do not address.
**Output format**: List of gaps with severity assessment (critical gap / significant gap / minor gap) and suggested next step for each.

### Task Type 6: Contested Claim Investigation
**What it is**: When a claim about UNFPA (positive or negative) needs to be verified against the actual document record.
**How to do it**: Identify the specific claim. Find every document in the corpus that is relevant to it. Apply the Evidence Lens and the Gap Lens. Distinguish between what the documents support, what they are silent on, and what they contradict. Note if the claim comes from an interested party (UNFPA itself, a donor, a critic) and weight accordingly.
**Output format**: Verdict (supported / partially supported / unsupported / contradicted by evidence), with the specific documents and passages that justify the verdict.

---

## PART IV: THE PMNCH COMPARISON FRAMEWORK

PMNCH (Partnership for Maternal, Newborn and Child Health, hosted at WHO) is the main comparison organisation. When processing PMNCH documents, apply the same five lenses as for UNFPA documents, plus this additional frame:

**The Convener vs. Implementer Frame**
UNFPA implements programmes with its own country offices, staff, and supply chains. PMNCH convenes partners, advocates for commitments, and tracks accountability — it does not implement. This is the most important structural difference. Every comparison question must be read through this frame first.

Key comparison dimensions to track across the ingested documents:

| Dimension | UNFPA | PMNCH |
|---|---|---|
| Mandate | Implement + advocate | Advocate + convene |
| Accountability to | Executive Board / member states | Partners (multi-stakeholder) |
| Primary output | Programme delivery | Commitments + knowledge |
| Geographic presence | 150+ country offices | Secretariat only |
| Relationship to governments | Direct bilateral | Through WHO + partners |
| Evidence production | Evaluations of own programmes | Synthesis + accountability tracking |
| Funding model | Voluntary contributions (core + earmarked) | WHO hosted, donor funded |

When a comparative query comes in, locate the specific PMNCH document most relevant to the topic, apply the convener/implementer frame, and produce a comparison that is useful for someone deciding how to engage each organisation.

---

## PART V: OUTPUT STANDARDS

### Keep Outputs Short and Structured
A query should produce a response that fits on one screen. If a topic requires more, produce a short answer first and offer to go deeper on specific sub-questions.

### Source Everything
Every factual claim must cite the specific document it comes from. Use: [Document title, organisation, year, page/section if available]. Do not make claims that cannot be traced to an ingested document or to the evidence layer of this prompt.

### Distinguish Types of Claims
The system must be explicit about what type of claim it is making:
- **"UNFPA reports that..."** — from UNFPA's own publications
- **"Independent evaluation found that..."** — from third-party assessment
- **"The evidence suggests..."** — from peer-reviewed research
- **"It is unclear whether..."** — when the documents are ambiguous or silent

### Flag When the Document Record Is Insufficient
If a question cannot be answered from the ingested documents, say so plainly and specify what type of source would answer it. Do not fill gaps with inference presented as fact.

---

## PART VI: THE LAYER 2 DOCUMENT LIST

These are the documents that make up Layer 2. They are written by researchers, not ingested from PDFs. Each answers a specific question. Build them in the phase order below.

The document format for every Layer 2 document is:

```
---
CODE: [e.g. UNFPA-W-03]
TITLE: [plain language title]
TIER: [Orientation / Working]
AUDIENCE: [Practitioner / Decision-maker / Both]
STATUS: [Seed / Draft / Complete]
---

## WHAT THIS DOCUMENT COVERS
[1–2 sentences. What question does this answer?]

## KEY FACTS
[Bullet points. Most important things to know.]

## DETAIL
[Substantive content. Always include: what UNFPA/PMNCH says officially, what independent evidence says, and where there is a gap or dispute.]

## CURRENT STATUS
[State of this programme/policy as of the most recent available information.]

## SOURCES
[Every source cited, with enough detail to locate it.]

## RELATED DOCUMENTS
[2–5 codes of related corpus documents.]
```

---

### BLOCK A: ORIENTATION — WHAT THESE ORGANISATIONS ARE

*Build all 8 of these first. Nothing else can be queried intelligently without them.*

**UNFPA-O-01** | UNFPA in Plain Language: What It Does, How It Works, Who Funds It
The 90-second brief on UNFPA. Mandate. Geographic reach. Budget size and top donors. Three transformative results. Where the money goes. No history. No detail. Just what anyone needs before a first meeting.

**UNFPA-O-02** | UNFPA's Three Transformative Results: The Framework in Practice
The three goals: zero preventable maternal deaths, zero unmet need for family planning, zero gender-based violence and harmful practices. What each target means operationally. How UNFPA measures progress. What the current numbers show. Where the gaps are.

**UNFPA-O-03** | UNFPA's Country Programme Model: How Programmes Are Designed and Delivered
How a country programme works from CPD to implementation. The role of government partners and NGOs. How resources are allocated across countries. What "national ownership" means in practice.

**UNFPA-O-04** | UNFPA's ICPD Mandate: The 1994 Foundation and What It Still Means Today
What the 1994 Cairo conference established. The rights-based approach in plain language. What UNFPA can and cannot do under its mandate (particularly on abortion). Why this matters for current programme design.

**UNFPA-O-05** | PMNCH in Plain Language: What It Is, How It Differs from UNFPA
PMNCH as a WHO-hosted multi-stakeholder platform. Its mandate vs. UNFPA's mandate. How they relate to each other. What PMNCH does that UNFPA does not, and vice versa. When to engage which organisation.

**UNFPA-O-06** | UNFPA vs. PMNCH: A Side-by-Side Comparison
Direct comparison covering: mandate, governance, funding model, geographic focus, primary outputs, relationship to WHO, relationship to member states, relationship to civil society, and key publications. A decision-support tool for anyone choosing how to engage either organisation.

**UNFPA-O-07** | How UNFPA Fits in the Wider SRHR Architecture
Where UNFPA sits relative to WHO, UNICEF, the World Bank, bilateral donors, and major NGOs. Who does what. Where mandates overlap and where there are gaps.

**UNFPA-O-08** | Key UNFPA Terminology: A Practical Glossary
Plain-language definitions of terms used constantly in UNFPA documents: SRHR, MISP, CPD, transformative results, unmet need, skilled birth attendance, EmOC, CRVS, harmful practices, normative vs. operational.

---

### BLOCK B: UNFPA'S CORE PROGRAMME AREAS

*Written for practitioners who need current guidance, and for decision-makers who need to understand where resources go. Build UNFPA-W-01 through UNFPA-W-05 in Phase 2. The remainder in Phase 5.*

**UNFPA-W-01** | Maternal Health: Current Programme Approach and Evidence
What UNFPA funds and supports in maternal health. Skilled birth attendance, emergency obstetric care, midwifery strengthening. Current global numbers on maternal mortality. What interventions have the strongest evidence. Where UNFPA's approach has been most effective.

**UNFPA-W-02** | Obstetric Fistula: The Campaign to End Fistula
What fistula is and who it affects. UNFPA's Campaign to End Fistula: programme structure, countries covered, documented results. What surgical repair involves. Prevention vs. treatment balance. Current status. Independent evaluation findings.

**UNFPA-W-03** | Family Planning: Unmet Need, Method Mix, and the Supply Chain
Global unmet need for family planning: current data and distribution. What UNFPA procures and distributes. How country programmes approach method mix. The rights-based approach in practice. Community-based distribution: evidence and implementation.

**UNFPA-W-04** | The Minimum Initial Service Package (MISP) in Humanitarian Settings
What the MISP is and what it requires. The five MISP objectives. How it is operationalised in acute emergencies vs. protracted crises. Common implementation failures. Who is responsible for what in a humanitarian response.

**UNFPA-W-05** | Gender-Based Violence in Humanitarian Settings: UNFPA's Programme Role
GBV coordination in humanitarian settings. The GBV Area of Responsibility and UNFPA's lead role. Clinical management of rape: the current protocol. GBV Information Management System (GBVIMS). Psychosocial support frameworks.

**UNFPA-W-06** | Female Genital Mutilation: The UNFPA-UNICEF Joint Programme
The joint programme structure. Community-based abandonment approach vs. legal/enforcement approach. What the evidence says about effective interventions. Current prevalence data and trends. Where the programme operates and what results it reports.

**UNFPA-W-07** | Child Marriage: Programme Approaches and Evidence
Global data on child marriage. UNFPA's programme approaches: community engagement, girls' empowerment, policy advocacy. What the evidence says works. How UNFPA coordinates with other actors.

**UNFPA-W-08** | Adolescent Sexual and Reproductive Health: Current Guidance
UNFPA's ASRH programming framework. Comprehensive Sexuality Education: what it covers, the evidence for it, the political controversy. Adolescent pregnancy: data and programme responses. How UNFPA works in conservative country contexts.

**UNFPA-W-09** | Midwifery: UNFPA's Investment in the Workforce
The State of the World's Midwifery reports: key findings. The case for midwifery as the central investment in maternal health. UNFPA's midwifery education and deployment programmes. The gap between supply and need.

**UNFPA-W-10** | Contraceptive Procurement: How UNFPA Moves Supplies
UNFPA as the world's largest contraceptive procurer. The procurement process. Quality standards. Last-mile distribution challenges. What happens when supply is disrupted. Practical implications for programme design.

---

### BLOCK C: POPULATION DATA AND EVIDENCE

**UNFPA-D-01** | The State of World Population Report: How to Use It
The annual flagship publication. What it covers, what it does not. How the annual theme is chosen. How to find the data behind the narrative. Limitations: what SWOP is good for and what it oversimplifies.

**UNFPA-D-02** | Population Data: UNFPA's Role in Census and CRVS Support
What UNFPA funds in national statistical systems. Why census and civil registration matter for SRHR programming. The "invisible people" problem. How to access country-level population data.

**UNFPA-D-03** | Demographic Dividend: The Concept, the Evidence, and the Limitations
What the demographic dividend is. The conditions required to realise it. What the evidence shows. How UNFPA uses the concept in advocacy. Where it is overused or misapplied.

**UNFPA-D-04** | UNFPA's Results Reporting: What the Numbers Mean and Don't Mean
How UNFPA reports results in annual reports and donor documents. The metrics used. Independent evaluations and where they diverge from self-reported results. How to read UNFPA's results framework critically.

---

### BLOCK D: PMNCH — THE PARALLEL ORGANISATION

**PMNCH-O-01** | PMNCH: Mandate, Structure, and Current Strategy
What PMNCH is. Its structure within WHO. Its board governance. The "Partners" model: who joins, what membership means. Its current strategic priorities.

**PMNCH-O-02** | PMNCH's Work: Advocacy, Accountability, and Knowledge
What PMNCH actually produces: advocacy platforms, accountability frameworks, knowledge products, convening. The Every Woman Every Child movement. The Commitments to Every Woman Every Child: how they work.

**PMNCH-W-01** | PMNCH's Research and Evidence Work
PMNCH's knowledge outputs: what it publishes, commissions, synthesises. The relationship with Cochrane reviews and WHO guidelines. How PMNCH translates evidence into policy advocacy. Flagship publications and how to use them.

**PMNCH-W-02** | PMNCH's Accountability Framework: The What Works Series
The "What Works" evidence reviews. The accountability mechanism for partner commitments. How PMNCH tracks whether pledges are implemented. Strengths and limitations of the model.

**PMNCH-W-03** | PMNCH and UNFPA: Where They Overlap and Where They Diverge
Detailed working document on programme overlaps, coordination arrangements, joint publications, and where the two organisations occupy different lanes. For someone managing relationships with both.

---

### BLOCK E: CONTESTED GROUND AND HONEST ASSESSMENT

**UNFPA-C-01** | The US Defunding Episodes: What Happened and What It Cost
A factual record of every US defunding episode from 1985 to the present. What Kemp-Kasten says. The actual programme impact each time. How UNFPA managed the funding gaps. Current US position.

**UNFPA-C-02** | UNFPA and Abortion: What the Mandate Says vs. What Critics Claim
What UNFPA's mandate authorises. What UNFPA does and does not fund. The Helms Amendment constraint. The gap between the legal position and the political allegation. How to answer the question accurately in a public setting.

**UNFPA-C-03** | Comprehensive Sexuality Education: The Evidence vs. The Political Controversy
What CSE is. What the evidence shows. The political opposition and its arguments. How UNFPA promotes CSE in practice in different country contexts.

**UNFPA-C-04** | Where UNFPA's Results Are Disputed: An Honest Assessment
Where independent evaluators have found gaps between UNFPA's reported results and on-the-ground reality. Where the evidence is strong, where it is weak, where reporting methodology inflates apparent impact.

**UNFPA-C-05** | The China Programme: What the Record Shows
The factual account of UNFPA's China programme during the one-child policy period. The allegations. The investigations. What the evidence supports and what it does not. Why this remains relevant to current political attacks on UNFPA.

---

### BUILD PHASES

**Phase 1** — Block A in full (8 documents). Foundation. Build before anything else.

**Phase 2** — UNFPA-W-01 through UNFPA-W-05. The five highest-demand practitioner documents covering the three transformative results in operational detail.

**Phase 3** — Block D in full (5 documents). The full PMNCH block, enabling comparison queries.

**Phase 4** — Block E in full (5 documents). Contested ground. Requires careful sourcing but essential for credibility.

**Phase 5** — Remaining Block B, C documents (UNFPA-W-06 through W-10, UNFPA-D-01 through D-04).

**Phase 6 — Spiral expansion**: After Phases 1–5, apply the Unanswered Query Rule (Part VII). Every query the system cannot answer from existing documents generates a new document. The corpus grows from real use.

**Layer 1 trigger point**: Layer 1 PDFs are ingested after Phase 1 and Phase 2 are complete and queryable.

---

## PART VII: WHEN TO ADD LAYER 1 — AND WHAT TO DOWNLOAD

Layer 1 is added after Layer 2 is substantially built. At that point, ingesting the raw PDFs extends the system's depth without rebuilding it. The Layer 2 documents already define the questions; Layer 1 provides the primary sources to answer them in more detail.

**When Layer 2 is ready for Layer 1 supplementation**: once the Phase 1 and Phase 2 documents (Block A and the first half of Block B) are complete and queryable.

**What to download**, organised by source and priority:

### From unfpa.org (Priority 1 — get everything available)

**Annual flagship publications**
- State of World Population reports — all years available (2000–present minimum; ideally 1978–present)
- UNFPA Annual Reports — last 5 years minimum
- UNFPA Financial Reports — last 3 years

**Strategic framework documents**
- Current Strategic Plan (2022–2025)
- Previous Strategic Plans (2018–2021, 2014–2017)
- Integrated Resources Plans

**Programme technical guidance**
- UNFPA's humanitarian response guidelines (including MISP materials)
- GBV in humanitarian settings — coordination guidelines
- Clinical management of rape — current protocol
- Obstetric fistula — programme guide
- Midwifery education guidelines
- Family planning commodity management guides
- Comprehensive sexuality education technical guidance

**Evaluations (highest research value — get all available)**
- All Independent Evaluation Office (IEO) reports
- Country programme evaluations — all available
- Thematic evaluations (family planning, maternal health, GBV, humanitarian response)
- Meta-evaluations and synthesis reports

**Country programme documents**
- CPDs for priority countries (identify from the user's specific focus — if not specified, start with the 20 countries with the largest UNFPA budgets)

### From pmnch.int / who.int/pmnch (Priority 2)

- PMNCH Strategic Plans (current and previous)
- PMNCH Annual Reports — last 3 years
- What Works series — all volumes
- Accountability reports for Every Woman Every Child commitments
- Nairobi Summit (2019) outcome documents and progress reports
- Any joint UNFPA-PMNCH publications

### From WHO (Priority 3 — where relevant to UNFPA's programme areas)

- WHO guidelines on reproductive health, maternal health, GBV clinical response
- Joint WHO-UNFPA technical guidance
- Global Health Observatory data exports relevant to SRHR indicators

### From donor government review portals (Priority 4)

- FCDO (UK) multilateral aid review for UNFPA — most recent
- Sida (Sweden) assessment of UNFPA — most recent
- DANIDA review — most recent
- These are often the most candid external assessments of UNFPA's performance and are worth prioritising even if other downloads are incomplete

---

## PART VIII: HOW THIS SYSTEM GROWS

The corpus grows from use, not from planning. Apply one rule:

**The Unanswered Query Rule**: Every time a query comes in that the system cannot answer from the ingested documents, log it. At the end of each week, review the log. If a pattern of unanswered queries points to a missing document type, source and ingest it. If a pattern points to a gap in the analysis framework, update this prompt.

This keeps the corpus honest about what is actually useful rather than what looks comprehensive.

---

*Stored as: `docs/knowledge-base/unfpa/META-PROMPT-v3.md`*
*Update this prompt when the research framework changes. Version it. The ingested documents update automatically as new reports are downloaded.*
