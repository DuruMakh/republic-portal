# Auth Entry Flow Design QA

- Reference visual truth: `C:\Users\Mylaptop\.codex\generated_images\019fec9a-f183-7152-8403-5da9abc17830\exec-ec98c101-3aad-49aa-bd1a-0703a43a4ef7.png`
- Local implementation: `http://127.0.0.1:4173`
- Desktop CSS viewport: `1440 x 1024`, device pixel ratio `1.25`
- Mobile CSS viewport: `390 x 844`, device pixel ratio `1.25`
- Reference pixels: `1487 x 1058`
- Browser capture pixels: `1425 x 1013` desktop and `375 x 831` mobile viewport content
- Density normalization: reference and implementation were each resized to 720 pixels wide and placed together in one `1440 x 512` comparison image.

## Evidence

- Final combined comparison: `C:\Users\Mylaptop\.codex\visualizations\2026\08\10\019fec9a-f183-7152-8403-5da9abc17830\auth-join-comparison-final.png`
- Desktop registration: `C:\Users\Mylaptop\.codex\visualizations\2026\08\10\019fec9a-f183-7152-8403-5da9abc17830\auth-join-desktop-1440x1024-final.png`
- Desktop login: `C:\Users\Mylaptop\.codex\visualizations\2026\08\10\019fec9a-f183-7152-8403-5da9abc17830\auth-login-desktop-1440x1024-final.png`
- Mobile registration: `C:\Users\Mylaptop\.codex\visualizations\2026\08\10\019fec9a-f183-7152-8403-5da9abc17830\auth-join-mobile-390x844-final.png`
- Mobile login: `C:\Users\Mylaptop\.codex\visualizations\2026\08\10\019fec9a-f183-7152-8403-5da9abc17830\auth-login-mobile-390x844-final.png`

## Compared states

- `/join`, signed out, Google current: passed at desktop and mobile.
- `/login`, signed out: passed at desktop and mobile; no registration progress is shown.
- `/join`, personal details and OTP/retry states: behavior and presentation contracts passed in the complete automated suite; a browser screenshot was not accepted as evidence because the in-app browser does not expose a safe supported test-session installation surface.
- Successful registration still routes directly to `/me`; no completion page was introduced.

## Full-view comparison

The implementation preserves the reference hierarchy: a full-width printed progress row, wide primary task area, narrow explanatory rail, large serif heading, and one clear Google action. It intentionally retains the real Republic masthead, footer, Georgian product copy, and existing paper/ink/red tokens. It intentionally omits the generated reference's invented logo, malformed copy, and decorative drawings.

## Focused comparison

The Google action and progress row were inspected separately because their details are too small in the full comparison. The rendered control uses the official local Google image asset at `20 x 20`, a white background, `#747775` border, accessible name, `aria-busy`, and a 48-pixel target. The final mobile progress labels have equal client and scroll widths, so Google, ტელეფონი, and კაბინეტი are not clipped.

## Required fidelity surfaces

- Fonts and typography: passed. Existing Kronika serif and body fonts remain in use; heading hierarchy and Georgian wrapping are readable at both viewports.
- Spacing and layout rhythm: passed. No giant card, rounded floating surface, decorative shadow, overlap, or horizontal overflow remains; the rail stacks below the action on mobile.
- Colors and visual tokens: passed. Existing paper, ink, muted ink, hairline, and civic-red tokens are preserved.
- Image quality and asset fidelity: passed. The only new visible image is the sharp official Google mark; no fake SVG, emoji, CSS art, or placeholder image is used.
- Copy and content: passed. User-facing text is Georgian except the provider name Google; login does not falsely imply a three-step requirement for returning members.
- Accessibility and interaction: passed for browser-visible entry states and automated state coverage. The provider control is semantic, keyboard reachable, 48 pixels high, exposes pending state, and the progress list uses `aria-current`. Browser console errors and warnings: none.

## Comparison history

### Pass 1

- P2: the mobile progress component used truncation, so long Georgian labels could be clipped.
- Fix: removed truncation, tightened mobile spacing and tracking, and added a regression test.

### Pass 2

- Post-fix evidence: at `390 x 844`, all three labels have `clientWidth === scrollWidth`; the page has no horizontal overflow and the Google control remains 48 pixels high.
- No actionable P0, P1, or P2 findings remain.

## Automated verification

- Complete Vitest suite: 114 files, 977 tests passed.
- Focused post-fix auth suite: 5 files, 34 tests passed.
- TypeScript, lint, repository formatting, Georgian mixed-script scan, and `git diff --check`: passed.
- A production-style build compiled and type-checked, then stopped during page-data collection because the linked Vercel Preview environment currently exposes no Supabase values. This is an environment boundary, not a UI compile failure.

## Residual boundary

The final user-facing handoff should request owner inspection of the live local entry screens. A real first-time Google session remains the correct way to visually inspect the details and OTP screens; the complete automated suite protects their current-step, validation, resend, change-number, retry, and `/me` redirect behavior until that owner walkthrough.

final result: passed
