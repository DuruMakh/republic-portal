# Kronika (D3) — UX contract bundle

This folder is the UX contract for the v0.9.0 redesign
(spec: `docs/superpowers/specs/2026-07-23-kronika-redesign-design.md`).
It supersedes `prototype/index.html` as the design reference; the old
prototype is kept for history.

## Files

- `kronika-d3-standalone.html` — the original self-contained mock exactly as
  delivered by the owner (2026-07-23). Self-extracting bundle: open it in a
  browser to view all screens (S1 homepage, S2 delegate index, S3
  registration, S4 member cabinet, S5 admin, M mobile).
- `kronika-d3-template.html` — the decoded page extracted from the bundle.
  **This file is the byte-splice authority for all Georgian copy** taken from
  the mock (see spec §7.5): never retype Georgian text or quote glyphs —
  splice bytes from here and verify with escape-based codepoint gates.
  Decode provenance: the standalone file stores the page as a JSON string in
  its `__bundler/template` script tag; this file is `JSON.parse` of that
  line, byte-identical to what the browser renders.
- `brand/` — the owner's logo set (renamed; mapping in spec Appendix A).
  Every red asset samples to `#9F1D35`, which is the app's brand token.
  The in-app subset is copied to `public/brand/` during implementation;
  English variants are committed here but never rendered in-app
  (Georgian-only rule).
