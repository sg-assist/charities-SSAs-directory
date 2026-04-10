# Language Support Matrix

Languages supported by the UNFPA On-The-Ground app.

| Tier | Language | BCP-47 | Country | LLM Quality | Static Strings | KB Translated | Status |
|------|----------|--------|---------|-------------|---------------|---------------|--------|
| T1 | Burmese (Myanmar) | `my` | Myanmar | ⚠️ Limited | ✅ Planned | ⚠️ Partial (emergency only) | Pending validation |
| T1 | Bangla (Bengali) | `bn` | Bangladesh | 🟡 Moderate | ✅ Planned | ❌ | Pending validation |
| T1 | Nepali | `ne` | Nepal | 🟡 Moderate | ✅ Planned | ❌ | Pending validation |
| T1 | Bahasa Indonesia | `id` | Indonesia | 🟢 Good | ✅ Planned | ❌ | Pending validation |
| T1 | Tagalog/Filipino | `tl` | Philippines | 🟡 Moderate | ✅ Planned | ❌ | Pending validation |
| T2 | Khmer | `km` | Cambodia | ⚠️ Limited | ✅ Planned | ⚠️ Partial | Pending validation |
| T2 | Lao | `lo` | Laos | ⚠️ Limited | ✅ Planned | ❌ | Pending validation |
| T2 | Vietnamese | `vi` | Vietnam | 🟢 Good | ✅ Planned | ❌ | Pending validation |
| T2 | Urdu | `ur` | Pakistan | 🟡 Moderate | ✅ Planned | ❌ | RTL required |
| T2 | Dari | `prs` | Afghanistan | ⚠️ Limited | ✅ Planned | ❌ | RTL required |
| T2 | Hindi | `hi` | India | 🟢 Good | ✅ Planned | ❌ | Pending validation |
| T2 | Tok Pisin | `tpi` | PNG | ❌ Poor | ⚠️ Partial | ❌ | English fallback |
| T3 | French | `fr` | DRC, Côte d'Ivoire | 🟢 Good | ✅ Planned | ❌ | |
| T3 | Swahili | `sw` | Kenya, Tanzania | 🟢 Good | ✅ Planned | ❌ | |
| T3 | Portuguese | `pt` | Mozambique, Timor-Leste | 🟢 Good | ✅ Planned | ❌ | |
| T3 | Tetum | `tet` | Timor-Leste | ❌ Poor | ❌ | ❌ | Portuguese fallback |

## LLM Quality Ratings

| Rating | Meaning |
|--------|---------|
| 🟢 Good | Gemma 4 E2B produces clinically appropriate, grammatically correct responses. Validated by native speaker. |
| 🟡 Moderate | Generally understandable; some grammatical errors. Clinical content reviewed by native-speaker clinical staff. |
| ⚠️ Limited | Output may have errors. Pre-translated static content used for all safety-critical strings. LLM responses shown only for non-clinical queries, with English parallel. |
| ❌ Poor | LLM not safe for this language. App falls back to English LLM responses with pre-translated static danger signs and referral prompts. |

## Validation Process (Phase 0)

Before deployment in each T1 country:
1. Run 50 clinical test questions in target language through Gemma 4 E2B
2. Native-speaker clinical staff (midwife or CHW) reviews for accuracy, tone, completeness
3. Per-language quality rating assigned (🟢 🟡 ⚠️ ❌)
4. If ⚠️ or ❌: language limited to pre-translated static content + English LLM
5. Findings documented here with reviewer name and date

## Safety-Critical Static Strings (T1 — must be translated before deployment)

The following strings are compiled into Android `res/values-<lang>/` and iOS `Localizable.strings`:

1. Danger signs for pregnancy (15 strings)
2. Emergency action steps — PPH, eclampsia, newborn not breathing
3. Formulary drug names (local names in `formulary.json`)
4. Mode bar disclaimer text
5. Referral-to-facility message (Community mode)
6. Dose card UI labels
7. "Seek immediate care" prompt

## RTL Layout

Languages requiring right-to-left layout: **Urdu** (`ur`), **Dari** (`prs`), **Pashto** (`ps`).

- Android: `android:supportsRtl="true"` in manifest; Compose uses `LocalLayoutDirection`
- iOS: `layoutDirection` via SwiftUI `Environment`
- Markwon (Android) and MarkdownUI (iOS) support RTL via platform BiDi engine
