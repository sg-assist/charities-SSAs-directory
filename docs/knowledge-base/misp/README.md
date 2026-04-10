# MISP Knowledge Base

This directory contains **Minimum Initial Service Package (MISP)** resources and humanitarian field manuals.

## Vertical Code: `MISP`

## Audience

All roles — midwives, CHWs, and UNFPA field officers.

## Priority P0 Sources to Acquire

| Document | Source | Status |
|---|---|---|
| IAWG MISP Field Manual 2018 | iawg.net | ⏳ Not yet acquired |
| IAWG IARH Kits Manual (6th ed) | unfpa.org | ⏳ Not yet acquired |
| UNFPA GBViE Minimum Standards | unfpa.org | ⏳ Not yet acquired |

## Ingestion Instructions

1. Download PDFs to this directory
2. Create `.meta.json` sidecars
3. Run: `npm run ingest-clinical -- --file path/to/file.pdf --vertical MISP`

## ⚠️ CODEOWNERS

Changes to this directory require approval from `@unfpa-otg/clinical-reviewers`.
