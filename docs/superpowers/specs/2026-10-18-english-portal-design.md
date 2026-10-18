# English portal

## Outcome and agreed scope

Add English alongside Georgian for public pages, registration, and member/delegate accounts. The owner selected this scope on 2026-10-18 and confirmed that published news, events, and uploaded documents stay in their original language, clearly labelled. The administration interface remains Georgian.

Georgian remains the default at its existing URLs. English uses `/en` and `/en/...`. A visible language switch preserves the current destination, query parameters, and section anchor. Browser language must not silently redirect visitors.

## Approach

Use one shared page/component tree under `app/[locale]` with `ka` and `en`. The proxy internally resolves unprefixed Georgian URLs to `ka`; external Georgian addresses remain unchanged. Use next-intl for request-scoped language and navigation, including server-rendered components. This avoids a second copy of every page and prevents cached English and Georgian pages from sharing an identity.

Keep the existing Georgian copy intact. English dictionaries map the existing copy to reviewed English translations; renderers explicitly translate interface copy. Personal names, authored posts, addresses, and uploaded historical documents are original content, not dictionary input. English labels identify original-language content. No database changes or automatic translation service are needed.

Preserve the current visual design, logos, illustrations, colours, and responsive behaviour. Use a Latin-capable display font for English; Georgian decorative numerals remain decorative, with accessible English numbering where needed. Translate labels, validation and failure messages, empty states, accessibility text, page titles and descriptions, consent and terms text, and account notifications rendered by the app.

## Navigation and account safety

Keep the selected language through registration, sign-in return, membership, delegate pages, account changes, sign-out, and account deletion. The same users, permissions, validation rules, and database calls serve both languages. Administrative links go to their existing Georgian destinations. A language parameter never grants access.

Hidden finance, event, and ratings sections remain hidden in both languages. The service worker must never cache English versions of private routes. Referral codes and allowed return paths survive language changes; unsafe external return paths remain rejected.

## Verification and delivery

1. Failing tests then working tests for URL mapping, language switching, hidden routes, sign-in return paths, and private-page cache protection.
2. English and Georgian component checks, plus scans for untranslated fixed interface copy.
3. All five repository checks, production build, and local database browser journeys. Check navigation and account flows in both languages, mobile layout, and original-content labels.
4. One review of each implementation area and a combined review; desktop/mobile screenshots from the local application. Prepare one branch and PR for owner review. Merge and production release require the owner's sign-off under CLAUDE.md.
