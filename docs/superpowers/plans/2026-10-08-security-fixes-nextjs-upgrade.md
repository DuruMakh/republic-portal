# Next.js security upgrade (R3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `next` from 16.2.10 to 16.3.8. That clears the published advisories that apply on our
Vercel setup:
- server-action CPU DoS;
- server-action id disclosure;
- cache confusion.

Clear the non-breaking transitive advisories at the same time.

**Architecture:** A dependency-only, code-only PR. No application code changes are expected. If the
build or a test breaks, fix only what the upgrade itself requires and record it in the ADR.

**Tech Stack:** npm, Next.js 16.3.8, eslint-config-next 16.3.8, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-security-audit-fixes-design.md` (sections 1, 4, 8)

## Global Constraints

- Gates before push: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run ka:scan`,
  `npm test`, `npm run build`. CI also runs `npm run e2e`.
- CLAUDE.md: dependency changes are recorded in DECISIONS.md. Next free ADR on main (recheck before
  merge).
- Never `npm audit fix --force`, which would cause major bumps: eslint-config-next 14, vitest 5,
  sharp 0.35. Those are dev or build-time only and are listed as accepted in the ADR.
- Merge = release for both sites. Stagger this push from R1's: the hobby daily deploy limit.

---

### Task 1: Upgrade and prove nothing moved

**Files:**
- Modify: `package.json` (`next`, `eslint-config-next`), `package-lock.json`
- Modify: `DECISIONS.md` (ADR)

- [ ] **Step 1: Record the failing evidence**

Run (Git Bash):

```bash
npm audit --json > "$TEMP/audit-before.json"
node -e "const a=require(process.env.TEMP+'/audit-before.json');console.log(a.vulnerabilities.next?.severity, a.metadata.vulnerabilities)"
```

Expected: `critical` and a total of 18.

- [ ] **Step 2: Upgrade**

```bash
npm install next@16.3.8 eslint-config-next@16.3.8
npm audit fix
```

Expected: `package.json` now reads `"next": "^16.3.8"` and `"eslint-config-next": "^16.3.8"`, and
`node -e "console.log(require('./package-lock.json').packages['node_modules/next'].version)"`
prints a version of at least 16.3.8.

- [ ] **Step 3: Verify the advisories are gone**

Run: `npm audit --json`. Expected:
- `next` is absent from `vulnerabilities`;
- what remains is limited to the dev/build-only set (vitest/tinypool/@vitest/mocker, sharp,
  eslint-config-next's braces/micromatch/fast-glob chain).

If `next` still appears, read its advisory ranges. If 16.3.8 is inside one, take the newest 16.x
published at least a week ago and note why in the ADR.

- [ ] **Step 4: Run the full gates**

Run each gate. Expected: all green.

- `npm run build` also runs the `postbuild` service-worker bundling (`scripts/build-sw.mjs`). Confirm
  `public/sw.js` was written.
- The build must still emit the delegate share image route
  `/delegates/[slug]/opengraph-image` (see `next.config.ts` `outputFileTracingIncludes`).

- [ ] **Step 5: Write the ADR**

```markdown
## ADR-0NN (2026-10-08): Next.js 16.3.8 for the published advisories

Security audit 2026-10-08, H2 (re-rated Medium on re-verification). 16.2.10 was inside 17 Next.js
advisories. On our Vercel setup the ones that apply are the server-action CPU DoS
(GHSA-m99w-x7hq-7vfj), the server-action id disclosure (GHSA-955p-x3mx-jcvp) and the request-body
cache confusion. The next/og RCE does not apply (no visitor text inside SVG; satori draws text as
glyph paths), nor do the Windows-hosting, AVIF/remotePatterns image, i18n-proxy or self-hosted cache
ones. `npm audit fix` (no --force) also cleared the transitive build-time items. Accepted and left:
vitest/tinypool (dev only, needs vitest 5), sharp 0.33 (build scripts only; R4 upgrades it when it
becomes a runtime dependency), eslint-config-next's glob chain (lint only).
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json DECISIONS.md
git commit -m "Upgrade Next.js to 16.3.8 for published advisories (audit H2)"
```

### Task 2: Release

- [ ] **Step 1: Push, PR, bind with ccd_pr.** The body leads with plain language: "a routine security
  update of the website framework; nothing visible changes."

- [ ] **Step 2: /qa on the demo preview.** Check:
  - home;
  - `/leaderboard`;
  - one `/delegates/<slug>` page, with its share image at `/delegates/<slug>/opengraph-image`
    returning a PNG;
  - `/join` (Google entry);
  - `/support` form submit;
  - an admin page signed in with a staging test admin;
  - no console errors or hydration warnings.

- [ ] **Step 3: Owner sign-off**

Plain language plus screenshots of the pages above. Wait for the yes.

- [ ] **Step 4: Merge after `quality` passes, then verify georgia-republic**

After merging:
- read the merge commit's `Vercel – georgia-republic` status;
- load https://georgia-republic.vercel.app plus one delegate page and its share image.
