# Plan: Singapore Health Foundations Directory + Comprehensive Report

**Branch**: `claude/add-health-charities-directory-i1C5f`
**Date**: 2026-04-02
**Status**: Research complete. Execution pending.

---

## Context

The user needs two documents added to the UNFPA knowledge base:
1. A structured KB document (UNFPA-R-05) mapping Singapore-based foundations relevant to maternal, reproductive, and children's health
2. A comprehensive standalone report (50+ pages) deeply profiling each foundation, their health priorities, and UNFPA relevance

All research has been completed via web searches with verified sources. This plan breaks the work into manageable, non-timeout-prone chunks.

---

## Research Summary (Verified Data)

### Tier 1 — Direct Maternal/Child Health Funders

| Foundation | Key Health Programme | Scale | Source |
|---|---|---|---|
| **Temasek Foundation** | Richard Magnus Endowment for mothers & children | S$100M endowment (June 2023) | temasekfoundation.org.sg |
| | Integrated Maternal and Child Wellness Hub (IMCWH) | S$2.5M+ pilot at polyclinics | singhealthdukenus.com.sg |
| | Public Health Innovations grants | Open call for proposals | temasekfoundation.org.sg |
| **Tanoto Foundation** | Medical Research Fund (MRF) — maternal fertility, neonatal allergies | Up to S$5M/year (launched 2023) | tanotofoundation.org |
| | TF Centre for CHaMP at KKH | S$3M donation | tanotofoundation.org |
| | Total medical research since 2009 | S$20M+ | tanotofoundation.org |
| **Quantedge Advancement Initiative** | PAA Health for Human Potential Community (with Gates, Tanoto, Temasek Foundation) | US$100M target by 2030 | philanthropyasiaalliance.org |
| | Nutrition International — Philippines women/adolescents | Active grant | quantedge.org |
| **DBS Foundation** | KidSTART Pregnant Mum & Baby Nutrition Programme | Launched Sept 2025 | dbs.com/newsroom |
| | Social Enterprise Grant Programme (healthcare eligible) | SGD 50K–250K per grant | dbs.com/foundation |
| | Total commitment | S$102.6M in 2024; S$1B over decade | dbs.com/foundation |

### Tier 2 — Significant Health Givers (not exclusively maternal/child)

| Foundation | 2024 Disbursement | Total Assets | Health Focus | Source |
|---|---|---|---|---|
| **Lee Foundation** | S$33.2M | S$13.6B | S$50M to SingHealth Duke-NUS; medical bursaries | singhealth.com.sg, givepedia.org |
| **Moh Family Foundation** | S$22.4M | Not disclosed | 75.1% to health sector | Soristic 2024/2025 reports |
| **Low Tuck Kwong Foundation** | S$23.2M (S$127.6M in 2023) | Not disclosed | Hospitals in Singapore and region | cf.org.sg, charityguidepoint.sg |
| **Shaw Foundation** | ~S$5M | Not disclosed | NKF (largest recipient); paediatric research | shaw.sg |
| **Ngee Ann Kongsi** | S$40.6M | Not disclosed | S$40M to SingHealth; S$12.5M TCM at NTU | thengeeannkongsi.com.sg |

### Tier 3 — Ecosystem Enablers & Intermediaries

| Entity | Role | Scale | Source |
|---|---|---|---|
| **Community Foundation of Singapore (CFS)** | Cause-neutral DAF sponsor; channel for international giving | S$28.4M disbursed (2024); S$353M raised lifetime | cf.org.sg |
| **Lien Foundation** | Eldercare, palliative care, early childhood (exiting) | S$24.4M disbursed (2024) | lienfoundation.org |
| **AVPN** | Network of 700+ social investors; MNCHN pooled fund | US$1M pooled fund for SE Asia maternal/child health | avpn.asia |
| **Philanthropy Asia Alliance (PAA)** | Temasek-linked convener; Health for Human Potential Community | US$100M target by 2030 (launched May 2025) | philanthropyasiaalliance.org |

### Tier 4 — Civil Society & Operational Charities

| Organisation | Focus | Scale | Source |
|---|---|---|---|
| **AWARE Singapore** | Gender equality; reproductive rights advocacy | Leading women's rights org | aware.org.sg |
| **KKH** | Women's & children's hospital | S$30M+ philanthropic funding (Oct 2024 centenary) | kkh.com.sg |
| **WAH Foundation** | Midwife training in Cambodia (with KKH) | 400+ trained; 90% drop in maternal mortality | wahfoundation.org |
| **Singapore Children's Society** | Child welfare | 20,187 children/families reached (2024) | childrensociety.org.sg |
| **Club Rainbow** | Children with chronic illnesses | Active programmes | clubrainbow.org |
| **KidSTART** | Early childhood for low-income families | MSF-linked | kidstart.sg |
| **Ishk Tolaram Foundation** | Healthcare in Nigeria/Indonesia | Singapore-registered CLG | ishktolaram.com |
| **Octava Foundation** | Mental wellbeing; education | Singapore & SE Asia | octavafoundation.org |

### Landscape Data

- ~2,400 registered charities in Singapore (COC data, ~2022)
- 126 philanthropic organisations tracked by Soristic (2025 edition)
- Total philanthropic giving: S$419M (FY2024 data)
- Singapore ranked 3rd on 2024 World Giving Index
- 250% tax deduction for IPC donations
- New 100% tax deduction for overseas humanitarian donations (2025–2028)
- 5 Sector Administrators (MOH for health charities)
- ~1,400 single-family offices (MAS 2023)
- S$5.4 trillion AUM in Singapore (MAS 2022)

---

## Files to Create/Modify

| File | Action | Size |
|------|--------|------|
| `docs/knowledge-base/unfpa/UNFPA-R-05.md` | **Create** | ~3,500 words |
| `docs/knowledge-base/unfpa/UNFPA-R-05-ANNEX-FOUNDATIONS-REPORT.md` | **Create** | ~15,000+ words |
| `docs/knowledge-base/unfpa/INDEX.md` | **Edit** | Add 1 row + update status line |

---

## Execution Steps

### Step 1: Write UNFPA-R-05.md (single Write, ~3,500 words)

The structured KB document. Follows exact format of UNFPA-R-04.md:
- YAML frontmatter (CODE, TITLE, TIER, AUDIENCE, STATUS)
- Sections: EXECUTIVE SUMMARY, KEY FACTS, regulatory environment, 4-tier foundation directory, engagement strategy matrix, implications for LKYSPP team, sources, related documents

### Step 2: Write Annex Report — Chapters 1-2 (Write, ~2,500 words)

Initial file creation with:
- Frontmatter + Table of Contents
- Chapter 1: Introduction and Methodology (~600 words)
- Chapter 2: Singapore's Philanthropic Landscape — Structural Overview (~1,500 words)

### Step 3: Append — Chapter 3 Part 1: Tier 1 Foundations (Edit, ~2,500 words)

- Temasek Foundation full profile (~1,200 words)
- Tanoto Foundation full profile (~1,200 words)

### Step 4: Append — Chapter 3 Part 2 + Chapter 4 Start (Edit, ~2,500 words)

- Quantedge Advancement Initiative (~800 words)
- DBS Foundation (~700 words)
- Chapter 4 start: Lee Foundation, Moh Family Foundation (~1,000 words)

### Step 5: Append — Chapter 4 Completion + Chapter 5 (Edit, ~2,500 words)

- Low Tuck Kwong Foundation, Shaw Foundation, Ngee Ann Kongsi (~1,500 words)
- Chapter 5: CFS, Lien Foundation, AVPN (~1,000 words)

### Step 6: Append — Chapter 5 Completion + Chapter 6 (Edit, ~2,500 words)

- PAA (~400 words)
- Chapter 6: Civil Society — AWARE, KKH, WAH Foundation, Singapore Children's Society, Club Rainbow, KidSTART, Ishk Tolaram, Octava (~2,000 words)

### Step 7: Append — Chapters 7-8: Cross-cutting Analysis (Edit, ~2,000 words)

- Chapter 7: Funding flows, gaps, concentration risk, gender lens, geographic focus (~1,200 words)
- Chapter 8: The Family Office Layer (~800 words)

### Step 8: Append — Chapters 9-10 + Appendices (Edit, ~2,000 words)

- Chapter 9: Strategic Engagement Recommendations for UNFPA (~800 words)
- Chapter 10: Conclusion (~400 words)
- Appendix A: Quick-Reference Table (~500 words)
- Appendix B: Methodology and Data Sources (~300 words)

### Step 9: Update INDEX.md (Edit)

- Add UNFPA-R-05 row to Block R table
- Update status line from "all 30 documents" to "31 documents"

### Step 10: Git commit + push

---

## Parallelization

- **Step 1** (R-05) and **Step 2** (Annex start) can run in parallel
- Steps 3–8 are sequential (each appends to the growing annex)
- Step 9 (INDEX) is independent, can run alongside any step
- Step 10 depends on all prior steps

## Timeout Mitigation

- Each write/edit operation targets ~2,000–3,000 words max
- If any step times out, split its content in half
- Each chunk is self-contained (complete sections) so partial failure is recoverable

## Verification

After completion:
1. `wc -w docs/knowledge-base/unfpa/UNFPA-R-05.md` — should be ~3,000–3,500
2. `wc -w docs/knowledge-base/unfpa/UNFPA-R-05-ANNEX-FOUNDATIONS-REPORT.md` — should be ~15,000+
3. `grep "UNFPA-R-05" docs/knowledge-base/unfpa/INDEX.md` — should show the new row
4. `git log --oneline -1` — should show the commit
