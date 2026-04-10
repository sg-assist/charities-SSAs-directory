# Clinical Knowledge Base

This directory contains clinical guidelines for **midwives, nurses, and skilled birth attendants**.

## Vertical Code: `CLINICAL`

## Priority P0 Sources to Acquire

| Document | Source | Status |
|---|---|---|
| WHO MEC 5th/6th Ed (contraceptive eligibility) | who.int | ⏳ Not yet acquired |
| WHO Safe Abortion Care 2022 | who.int | ⏳ Not yet acquired |
| WHO ANC Recommendations 2016 | who.int | ⏳ Not yet acquired |
| WHO PCPNC (Pregnancy/Childbirth/PNC/Newborn) | who.int | ⏳ Not yet acquired |
| WHO IMPAC/MCPC (Managing Complications) | who.int | ⏳ Not yet acquired |
| WHO GBV Clinical Handbook 2019 | who.int | ⏳ Not yet acquired |
| MSF Essential Obstetric & Newborn Care | medicalguidelines.msf.org | ⏳ Not yet acquired |
| Sphere Handbook 2018 | spherestandards.org | ⏳ Not yet acquired |
| UNFPA Midwifery Handbook | unfpa.org | ⏳ Not yet acquired |

## Ingestion Instructions

1. Download the PDF to `docs/knowledge-base/clinical/who/`
2. Create a sidecar `.meta.json` file with source metadata (see example below)
3. Run: `npm run ingest-clinical -- --file path/to/file.pdf --vertical CLINICAL`
4. Verify chunks in the database: check that tables are not split across chunks
5. Get clinical sign-off before marking as `VERIFIED`

## Sidecar `.meta.json` Format

```json
{
  "sourceDocument": "WHO PCPNC 2023",
  "sourceEdition": "3rd edition, 2023",
  "sourceUrl": "https://www.who.int/publications/i/item/9789240091672",
  "pubYear": 2023,
  "redistributionOk": true,
  "redistributionNotes": "WHO permits redistribution of guidelines for non-commercial health purposes",
  "clinicalReviewer": null,
  "reviewedAt": null,
  "expiryDate": "2028-12-31"
}
```

## Clinical Review Requirement

**Every document in this directory requires clinical sign-off before use in the app.**

A qualified obstetrician, senior midwife, or GBV specialist must review the ingested chunks
and set `reviewedBy` and `reviewedAt` in the `ClinicalSource` database record.

Until `clinicalStatus = 'VERIFIED'`, chunks will be served with an amber disclaimer banner.

## ⚠️ CODEOWNERS

Changes to this directory require approval from `@unfpa-otg/clinical-reviewers`.
See `.github/CODEOWNERS` for details.
