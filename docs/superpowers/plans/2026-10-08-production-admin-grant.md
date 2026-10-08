# Plan: grant the first production admin through a dispatched workflow (ADR-045)

**Goal.** The owner (durumakh@gmail.com) becomes super_admin on the real site without anyone running
a script with production keys. Launch audit finding ADMIN-1 (2026-10-08).

**Task 1 (test first).** `lib/production-admin-workflow.test.ts` pins: manual dispatch, main-only,
`production-db` environment, read-only token, pinned project ref, the migration concurrency group,
only the three environment secrets, the four roles, inputs read only through env vars, strict email
validation before linking, the SQL template's two placeholders, the completed-member rule, the
no-op-when-held grant and the audit row with a via marker.

**Task 2.** `.github/workflows/production-admin.yml` + `scripts/production-grant-admin.sql`
(mirrors `admin_grant_role()`); ADR-045; a pointer from `scripts/grant-admin.mjs`.

**Task 3 (after merge).** Dispatch for durumakh@gmail.com / super_admin. If it refuses with "not a
completed member", the owner finishes the membership form first and it is dispatched again. Check:
the run's last step prints the roles held; `/admin` opens for the owner.

No migration, no app code, nothing visible on the site.
