# Events hidden — plan (2026-10-08)

Owner direction, in chat on 2026-10-08: remove ღონისძიებები from everything. Asked to choose
between hiding (one switch, nothing deleted) and deleting for good (code, tables, data), the
owner chose **hide**, the same shape as ADR-034 (finances) and ADR-037 (dues). Recorded as
ADR-038. No migration: the events tables, views and RPCs stay as they are.

## Decisions

1. **Switch `SHOW_EVENTS`** (server-only, the word `true` shows; default hidden),
   `lib/events-switch.ts`: `showEvents()` plus `filterEventLinks()`, which drops `/events`,
   `/me/events` and `/admin/content/events` from any link list.
2. **Public.** No header link; no homepage events section and no `fetchPublicEvents` call;
   `/events` and `/events/[slug]` answer not-found with the generic not-found title (and build
   no static event pages).
3. **Member cabinet.** No ღონისძიებები item in the desktop nav or the mobile bar; no events
   card on `/me`; `/me/events` answers not-found before any read; `rsvpAction` refuses with the
   generic error before calling `member_rsvp`.
4. **Mobile bar.** `TAB_HREFS` becomes a per-role priority list and the bar takes the first
   four present. Member: profile, polls, events, news, then my-delegate (short label
   „დელეგატი“). Delegate: panel, polls, events, news, then profile. Registered: home, events,
   news, profile — three tabs while events are hidden. With events on, every bar is unchanged.
5. **Delegate panel.** No team-RSVP card and no `delegate_team_rsvps` call.
6. **Admin.** No ღონისძიებები tab in the content nav; the three admin event pages answer
   not-found; the four event actions refuse before any read or RPC; the editor role's duty line
   drops ღონისძიებები while hidden. Audit-log labels for `event.*` stay, so old entries still
   read in Georgian.
7. **Out of scope.** The database; the internal style guide's EventRow sample; the
   `rsvp_closed` error copy (reachable only through the refused action).

## Steps (TDD: failing test first in each)

1. `lib/events-switch.ts` + test.
2. `lib/mobile-nav.ts` priority list + label; `lib/admin.ts` editor duty helper; tests.
3. Public: layout nav, homepage section, `/events` pages; tests.
4. Member: layout nav, `/me` card, `/me/events` page, `rsvpAction`; tests.
5. Delegate panel card; admin content nav, pages, actions, roles page duty line; tests.
6. e2e: `community-events.spec.ts` runs only with the switch on; hidden-mode checks in
   `public.spec.ts`; registration nav labels. `.env.example` documents `SHOW_EVENTS`.
7. All five gates + ka gates, ADR-038, PR with preview evidence for owner sign-off.
