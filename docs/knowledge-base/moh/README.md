# Country MOH Knowledge Base

This directory contains country-specific Ministry of Health (MOH) SOPs, protocols, and guidelines.

## Vertical Code Pattern: `MOH_<ISO3>`

Examples: `MOH_MMR` (Myanmar), `MOH_BGD` (Bangladesh), `MOH_IDN` (Indonesia)

## Directory Structure

```
moh/
├── README.md              (this file)
├── MMR/                   Myanmar
│   └── README.md
├── BGD/                   Bangladesh
│   └── README.md
└── IDN/                   Indonesia
    └── README.md
```

## Redistribution Requirement

**Each country directory requires written redistribution permission from the relevant MOH before any content can be ingested.**

At minimum:
1. Email confirmation from the MOH or UNFPA Country Office
2. Note any restrictions (e.g. "not for commercial use", "must display MOH logo")
3. Record permission in the `.meta.json` sidecar under `redistributionOk` + `redistributionNotes`

## Ingestion Instructions

1. Create directory `moh/<ISO3>/`
2. Place PDF or Markdown files there
3. Create `.meta.json` sidecars per file
4. Run: `npm run ingest-clinical -- --file path/to/file.pdf --vertical MOH_MMR`
   (replace `MMR` with the correct ISO-3166-1 alpha-3 code)

## Priority Countries (matching UNFPA APAC operations)

| ISO3 | Country | MOH Permission | Status |
|------|---------|---------------|--------|
| MMR | Myanmar | ⏳ Not obtained | Priority |
| BGD | Bangladesh | ⏳ Not obtained | Priority |
| IDN | Indonesia | ⏳ Not obtained | Priority |
| NPL | Nepal | ⏳ Not obtained | Priority |
| PHL | Philippines | ⏳ Not obtained | Priority |
| KHM | Cambodia | ⏳ Not obtained | |
| PNG | Papua New Guinea | ⏳ Not obtained | |
| TLS | Timor-Leste | ⏳ Not obtained | |

## ⚠️ CODEOWNERS

Changes to this directory require approval from `@unfpa-otg/clinical-reviewers`.
