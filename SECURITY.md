# Security Policy

## Overview

This repository contains an AI-powered field tool used by UNFPA health workers in remote areas. Clinical content (drug dosing, emergency protocols, treatment guidelines) is life-critical. Security failures here are not data breaches — they are patient safety events.

## Threat Model

| Threat | Mitigations |
|---|---|
| Malicious modification of clinical content | CODEOWNERS + `clinical-review` label gate + SHA-256 checksums CI check |
| Supply chain attack via dependency | Pinned SHAs in package-lock.json; npm audit CI; Dependabot PRs require human review |
| Corrupted OTA update pushed to devices | Ed25519-signed manifests; app verifies signature before applying any update |
| Forked repo redistributed as official UNFPA tool | Apache 2.0 LICENSE notice prohibits falsely claiming UNFPA endorsement |
| GitHub Actions workflow tampering | CODEOWNERS protects `.github/workflows/`; all action refs pinned to commit SHA |
| Secrets exposed in repo | All keys in encrypted GitHub Secrets; `.env` in `.gitignore`; secret scanning enabled |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email: security@unfpa-otg.org (monitored by the technical team)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact (especially if clinical content could be affected)
- Suggested fix if you have one

We aim to acknowledge reports within 48 hours and resolve critical issues within 7 days.

## Clinical Content Integrity

Every file in `docs/knowledge-base/` has its SHA-256 hash recorded in `docs/knowledge-base/.checksums`. The CI pipeline (`content-integrity.yml`) verifies these hashes on every PR. Any change to clinical content without the `clinical-review` label blocks merging.

The formulary (`docs/knowledge-base/formulary/formulary.json`) is additionally protected by CODEOWNERS — only members of `@unfpa-otg/clinical-reviewers` can approve changes.

## OTA Update Security

Knowledge base updates delivered over-the-air to mobile apps are:
1. Signed with an Ed25519 key (private key held only by UNFPA admins, never in this repo)
2. Verified by the app before installation using the bundled public key
3. Rejected and discarded if the signature is invalid or missing
4. Applied atomically — old data is preserved if the update fails

## Branch Protection

- `main`: requires 2 PR approvals + passing CI + no force push
- All release tags are GPG-signed
- Direct pushes to `main` are disabled

## App Signing

- Android: APK/AAB signed with keystore stored in encrypted GitHub Secret
- iOS: Signed via Apple Developer certificates; notarized before distribution
- Neither signing key is committed to this repository

## Responsible Disclosure

If you discover that clinical content has been corrupted (intentionally or accidentally) in a deployed version of the app, please notify us immediately at security@unfpa-otg.org. Include the app version, the affected content, and the correct source information.
