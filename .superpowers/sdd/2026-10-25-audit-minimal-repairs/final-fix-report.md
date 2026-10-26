# Final consolidated correction report

Base: `d1fc9a5cddf2cb9fef0f2ab82551cc07d65c0f56` on `codex/audit-minimal-repairs`.
Scope: whole-branch review findings I1, I2 and M1 only.

## Corrections and self-review

- **I1:** Decimal-first selection still ignores unrelated unsigned integers, but retains explicitly signed/accounting integer tokens alongside decimals. `-20 fee 1.00`, `(20) fee 1.00`, `20- fee 1.00`, `+20 fee 1.00` and `-1 2345.00` now have no amount and are ambiguous in both the real parser and real preview action. The existing collector already retains the negative fragment in the malformed grouping, so changing candidate selection blocks it without new accepted syntax. Collector, validator, amount limits, public result shape, confirmation rules and supported positive formats stay unchanged. Added the unsigned `20.00 document 7` positive preview regression too.
- **I2:** Only the three positive helper-suite URL setups change to `http://127.0.0.1:54321`. Destination guard, allow-list and every negative/security assertion are untouched. Shared cleanup and environment guard tests pass.
- **M1:** Existing region failure/empty feedback becomes focusable and is used only when the existing enabled-invalid-field/form-error query finds nothing. No new announcement or copy is added. Failed and empty region regressions verify submission focus, no focus movement while data settles or during editing, retained values, disabled location fields and no invalid save. Existing membership tests cover retry, cancelled stale reads, referral behavior, both locales and ordinary validation focus.
- Reviewed the complete correction diff. No unrelated production file, new dependency, schema, format, product flag, generic form helper or lifecycle change was introduced. Read the installed Next `use-client` and accessibility guides before the client edit. No database/service/browser mutation was performed.

## RED before production changes

```powershell
npm run test -- lib/bank-parse.test.ts 'app/[locale]/(admin)/admin/finances/actions.test.ts' 'app/[locale]/(member)/me/membership/MembershipWizard.test.tsx' e2e/admin-helpers.test.ts e2e/community-helpers.test.ts e2e/funnel-helpers.test.ts --maxWorkers=2 --minWorkers=1
```

Exit **1**: **6 files failed; 30 tests failed, 156 passed**. Ten new parser/preview cases returned an eligible fee/positive decimal instead of an unresolved amount. Two new membership cases retained focus on the edited birth-date field rather than existing region feedback. Eighteen existing helper tests failed on the rejected fake origin. Log: `output/final-fix-red.log`.

## GREEN and checks

Final focused command after production corrections and formatting:

```powershell
npm run test -- lib/bank-parse.test.ts 'app/[locale]/(admin)/admin/finances/actions.test.ts' 'app/[locale]/(admin)/admin/finances/BulkMatch.test.tsx' 'app/[locale]/(member)/me/membership/MembershipWizard.test.tsx' e2e/admin-helpers.test.ts e2e/community-helpers.test.ts e2e/funnel-helpers.test.ts e2e/cleanup-helpers.test.ts lib/env.test.ts --maxWorkers=2 --minWorkers=1
```

Exit **0**: **9 files / 241 tests passed**. Log: `output/final-fix-green.log`. Two intentional missing-credentials cleanup tests print their expected skip warnings; npm also prints an update notice. An earlier green pass ran the same first eight files, plus a nonexistent `lib/e2e-environment.test.ts` filter that matched nothing: **8 files / 209 tests passed**. The final command above replaces that filter with the actual environment suite and is the authoritative focused result.

```powershell
npm run typecheck
npx eslint lib/bank-parse.ts lib/bank-parse.test.ts 'app/[locale]/(admin)/admin/finances/actions.test.ts' 'app/[locale]/(member)/me/membership/MembershipWizard.tsx' 'app/[locale]/(member)/me/membership/MembershipWizard.test.tsx' e2e/admin-helpers.test.ts e2e/community-helpers.test.ts e2e/funnel-helpers.test.ts
npx prettier --check lib/bank-parse.ts lib/bank-parse.test.ts 'app/[locale]/(admin)/admin/finances/actions.test.ts' 'app/[locale]/(member)/me/membership/MembershipWizard.tsx' 'app/[locale]/(member)/me/membership/MembershipWizard.test.tsx' e2e/admin-helpers.test.ts e2e/community-helpers.test.ts e2e/funnel-helpers.test.ts
git diff --check
```

All final commands exit **0**. Logs: `output/final-fix-typecheck.log`, `output/final-fix-lint.log`, `output/final-fix-format.log`. The first formatting check exited **1** for the newly added membership test block only; `npx prettier --write 'app/[locale]/(member)/me/membership/MembershipWizard.test.tsx'` fixed it, then the final formatting check and focused tests passed. No type/lint failure occurred.

## Handoff boundary

Full-suite, full lint/format/Georgian scan, build, running-app screenshots/browser proof and independent scoped final review remain controller-owned gates. No push, merge, production claim or production operation. The controller's temporary `supabase/config.toml` modification and all `output/` evidence are preserved and excluded from this correction commit.
