# CLAUDE.md — showctrl

This file gives Claude Code the context behind this repo. Read it, and `HANDOVER.md`, before making changes.

## What showctrl is

An operations platform for live events, built first for a large multi-stage music festival (5–12 stages, 200,000+ visitors) but usable for concerts, conferences, theatre and corporate events. The core idea:

- **Festival HQ** creates the event, adds stages and departments, and appoints a **stage manager** for each stage.
- **Each stage is its own workspace** — a "micro community" with its own team, artists, run sheet, clocks, message channel and on-stage display.
- **Stage managers are semi-admins** for their own stage only: they add artists, artist contacts, day sheets and crew, and give their crew access. They cannot touch other stages or festival settings.
- **Everyone shares one clock**, corrected to server time, so every department works to the same second.

Inspiration: prodsync.no (artist overview, run sheets from setup to teardown, on-stage clock per stage).

## Files

| Path | What it is |
| --- | --- |
| `public/showctrl.html` | The working prototype. One self-contained HTML file (vanilla JS, no build step). This is the reference implementation for behaviour, data model and UI. |
| `src/` | React + TypeScript + Vite: the port of the prototype (see "Port status" below). The September app was removed on 2026-10-19; its cues and riser-planning screens are in git history (commit `dafcb34`) if they come back as modules. |
| `src/types/model.ts` | Types for the data model below. |
| `src/domain/` | Constants, time zone helpers, and pure logic: run sheet operations (`shiftFrom`, `goLive`, `markDone` return changes rather than writing), clock values and timers, timeline layout, personnel lookups. |
| `src/data/` | `DataStore` interface, `LocalStore` (memory + localStorage, key `showctrl-react-v1`), the sample festival, React hooks. |
| `src/access/` | `createAccess(snapshot, viewer)`: `lv`, `canW`, `stageRole` and the other access rules, as pure functions. |
| `src/clock/` | Server-time sync and `now()` / `useNow()`. Use these, never `Date.now()`, for anything shown to people. |
| `src/session/` | Who is viewing. Demo mode only for now ("view as" any sample person). |
| `src/shell/` | Routes, top strip, context bar, side nav, access guard, `shell.css`. |
| `src/views/` | The workspace screens. `runsheetActions.ts` holds every run sheet operation the UI offers. |
| `src/ui/` | App-wide UI: the data-driven form dialog (`useForm`), toasts (`useToast`), wall mode. |
| `supabase/migrations/` | The backend schema: `orgs`, `events` (cfg + roles), one `docs` table for every collection, row-level security that mirrors `src/access/access.ts`, `src/domain/messages.ts` and `src/domain/admin.ts`, the `ros_audit` timing log, and RPCs (`server_now`, `doc_patch`, `create_event`, `event_name`). Applied to the Supabase project `showctrl` (ref `qlxvycobgxayogwxtrus`, eu-west-1). |
| `src/data/supabaseStore.ts`, `src/app/LiveApp.tsx` | Live mode: the Supabase `DataStore` (realtime, optimistic writes put back when refused), magic-link sign-in, event list / create, ask for access. |
| `HANDOVER.md` | Original product notes: stage execution first, department views, modules switchable per customer, multi-tenant later. |

**Live or demo:** with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` set (in `.env.local`, see `.env.example`) the app runs live on Supabase; without them it runs the demo on the sample festival.

Run `npm run dev`, then open `/` for the app and `/showctrl.html` for the prototype. `npm test` runs the tests (Vitest). Files ending `.test.tsx` that start with `// @vitest-environment jsdom` click through real screens with Testing Library.

## Two runtime modes in the prototype

The prototype was built and hosted as a claude.ai artifact.

- **Live mode (only on claude.ai):** shared real-time data and sign-in come from `window.claude.use('db')` and `window.claude.use('user')`. These APIs **do not exist outside claude.ai**.
- **Demo mode (everywhere else, including localhost and GitHub Pages):** the page detects the missing APIs and runs on an in-memory sample festival saved to `localStorage` (`showctrl-demo-v2`). A "view as" switcher in the top bar lets you try different people and roles.

When porting, replace the `put / patch / del / putCfg / putMany` functions and the `onSnapshot` subscriptions in `boot()` with a real backend (see "Backend" below). Everything else reads from the in-memory `S.col` object, so the swap is contained.

## Data model

All records live in collections keyed by id. Times are epoch milliseconds; dates are `YYYY-MM-DD` strings in the event time zone.

**`config/event`** (single doc): `schema: 2`, `name`, `type` (festival | concert | conference | theatre | corporate | sport), `tz` (IANA, default `Europe/Oslo`), `start`, `end`, `visitors`, `terms` {performer, performers, stage, stages}, `modules` {accommodation, riders: bool}, `depts` [{id, name, tape}].

**`config/roles`** (single doc): `roles` map of festival-wide roles → {label, perms {key: 0|1|2}, contacts: bool, locked?}.

**`stages`**: `name`, `tape` (colour key), `order`, `location`, `radio` (radio channel), `capacity`, `template` (day sheet offsets, see below).

**`artists`**: `name`, `stage`, `status` (confirmed | travelling | arrived | backstage | ready | on stage | done | cancelled), `genre`, `party`, `home` (time zone), `vehicles`, `notes`, `contacts` [{id, role, name, phone, email, note}].

**`ros`** (run sheet items): `stage`, `artist?`, `kind`, `title`, `start`, `end`, `status` (pending | live | done), `delay` (ms, added to start and end), `delayNote`, `notes`, `actual?`, `actualEnd?`.
- `kind` is one of: arrival, getin, loadin, access, soundcheck, linecheck, changeover, show, loadout, departure, doors, curfew, meeting, other.
- Each kind belongs to a track: **On stage** (access, soundcheck, linecheck, changeover, show, doors, curfew, other) or **Dock & backstage** (arrival, getin, loadin, loadout, departure, meeting).

**`people`** (personnel / contact list, separate from app users): `name`, `title`, `company`, `dept`, `stages` [ids; empty = HQ], `phone`, `email`, `accred` (AAA | Production | Stage | Backstage | Artist | Site | Day pass), `lead` (key contact), `notes`.

**`members`** (app users, keyed by user id): `role` (festival role key), `stages` {stageId: 'manager'}, `person` (linked `people` id), `depts` [ids].

**`stageteam`** (one doc per stage): `crew` {userId: true}. Written by that stage's managers.

**`requests`** (keyed by user id): `at`, `note`, `stage?`. A person without access asks to join.

**`clocks`**: `label`, `kind` (tod | countdown | timer | stage), `scope` (stage id, or null for festival-wide), plus kind-specific fields `tz`, `target`, `stage`, `duration`, `accum`, `runningSince`, `warn`, `order`.

**`msgs`**: `from` (user id), `to` {t: all | stage | dept | user, id}, `text`, `pri` (normal | urgent), `at`, `acks` {userId: ms}.

**`hotels`**: `name`, `address`, `contact`, `phone`, `block` (rooms held per night), `notes`.

**`bookings`**: `artist?` or `guest` + `guestRole`, `hotel`, `checkIn`, `checkOut`, `rooms`, `roomType`, `status`, `conf`, `notes`.

**`riders`** (id = `${artistId}_${kind}`): `artist`, `kind` (tech | hosp), `items` [{id, text, dept, status: requested | agreed | sourced | declined}], `updated`.

## Access model

Two layers, combined by taking the highest level (`lv(key, stageId)` in the prototype):

1. **Festival role** (from `members.role`, applies everywhere). Permission keys: show, schedule, artists, personnel, clocks, messages, accommodation, riders_tech, riders_hosp, admin. Levels: 0 none, 1 view, 2 edit. Defaults: Festival admin, Production manager, Artist liaison, Hospitality, Technical production, Site & security, and "Stage access only" (no festival-wide access).
2. **Stage role** (applies to one stage only):
   - **Stage manager** — edit schedule, artists, personnel, clocks, messages and riders for that stage; view accommodation; can open Stage setup and add crew.
   - **Stage crew** — view the stage's schedule, artists, personnel, clocks and riders; send messages.

Artist contact details are shown only to roles with `contacts: true`, admins, and that artist's stage manager. The workspace owner is always Festival admin.

People see the Festival HQ tab only if their festival role grants overview, admin, accommodation or personnel access. They see a stage tab if they hold a stage role there or have festival-wide schedule or overview access.

**Important:** in the prototype only `config/*` and `members` are protected at the data level, and all other permissions are enforced in the UI only. In live mode, Supabase row-level security enforces them (see "Backend"), apart from artist contact details.

## Day sheet template

Each stage has a template (`stage.template`, defaults in `DEFAULT_TPL`). `buildDaySheet(stage, artist, showStart, showEnd, soundcheck?)` generates eight items, plus a soundcheck if one is given:

| Item | Timing (default) |
| --- | --- |
| Arrival | 240 min before show, 15 min |
| Get in | 180 min before show, 15 min |
| Load in | 120 min before show, 45 min |
| Stage access | 45 min before show (point in time) |
| Changeover | stage's changeover length (default 30) ending at show start |
| Show | showStart → showEnd |
| Load out | 15 min after show, 45 min |
| Departure | 150 min after show, 15 min |
| Soundcheck | at a chosen time, 45 min |

## Time keeping

- **Festival day:** a show day runs until 06:00, so `festDay(ms) = dayKey(ms − 6 h)`.
- **Time zones:** all display and input conversion uses the event time zone via `Intl.DateTimeFormat` (`P`, `fromLocal`, `toLocal`), never the device's zone.
- **Clock sync:** the client reads the `Date` header from a HEAD request every 10 minutes. If the device is more than 1.5 s off, it applies the offset and shows "Corrected"; otherwise "Synced".
- **Delays:** "Delay" adds minutes to an item and everything after it on that stage and day. A checkbox decides whether dock items move too. "On stage" and "Done" record actual times and offer to shift the rest of the day when an act starts late or overruns.
- **Now and next:** a stage's "now" is the live on-stage item. Its "next" is the next show not yet done. The stage display, stage clocks and overview cards all use these.

## UI conventions

- **Fonts:** Barlow Condensed for clocks and headings; Atkinson Hyperlegible for body text (legible under pressure, backstage at night).
- **Top strip:** dark "prompt desk" with the master clock, always visible.
- **Context bar:** Festival HQ plus one tab per stage, each marked with its colour.
- **Colours:** stage and department colours are spike-tape colours (`TAPE`: red, blue, yellow, green, orange, purple, pink, teal, brown, grey, white).
- **Status colours:** go is green, standby amber, stop or late red.
- **Theming:** light and dark mode via CSS custom properties on `:root`.
- **Vocabulary:** labels come from `terms()`, so a conference shows "Speakers / Rooms" instead of "Artists / Stages". Never hard-code "Artist" or "Stage" in UI text.
- **Mobile:** the side nav becomes a bottom bar under 860 px, and the run sheet table stacks.

## Where the prototype's parts live in `src/`

| Prototype | React app |
| --- | --- |
| `S.col`, `put / patch / del / putMany` | `DataStore` in `data/store.ts`; `LocalStore` for demo mode |
| `lv`, `canW`, `stageRole`, `visibleStages` | `createAccess` in `access/access.ts` |
| `syncClock`, `now()` | `clock/clock.ts` (`now`, `useNow`, `startClockSync`) |
| `nowNext`, `shiftFrom`, `buildDaySheet`, item actions | `domain/runsheet.ts`; UI in `views/runsheetActions.ts` |
| `clockValue`, timers | `domain/clocks.ts` |
| `visibleMsgs`, `myUrgent`, `unreadCount` | `domain/messages.ts` |
| `accessForm`, `setCrew`, roles, departments | `domain/admin.ts`; UI in `views/adminActions.ts` |
| `HQ_NAV`, `STAGE_NAV`, `route()`, `renderMain` | `shell/nav.ts`, `shell/AppRoutes.tsx`, `shell/pages.tsx` |
| `VIEWS.*` | `views/*.tsx` |
| `openForm`, `toast` | `ui/FormProvider.tsx`, `ui/ToastProvider.tsx` (`useForm`, `useToast`) |

## Port status

Porting order (done items are on branch `port/foundations`):

1. ✅ Types for the data model above, in `src/types/`.
2. ✅ A data layer behind one interface with get, subscribe, set, update and delete.
3. ✅ Access helpers (`lv`, `canW`, `stageRole`).
4. ✅ Festival HQ and stage workspace routing (`/hq/...`, `/s/:stageId/...`). Real paths instead of the prototype's `#/` hashes. Not yet ported: "Ask for access" (needs real sign-in).
5. ✅ Run sheet, day sheet generator and clocks. HQ overview and running order; stage Today, run sheet (lanes + table, delays, on stage / done with the offer to shift the day, back on planned times, add / edit / delete items, day sheet generator), clocks (all four kinds, timers, wall mode) and the stage display.
6. ✅ Artists and personnel. Artists list (HQ and per stage, search, inline status, contacts hidden from roles without contact access), artist page (day sheet across days with add item / create / regenerate, contacts, production, bookings), add / edit / delete artist (a new one can get a tour manager and a day sheet in one step; deleting removes their run sheet items), and personnel (filters, add / edit, paste a crew list, "App" chip for people with access).
7. ✅ Messages. Channels (everything for you, everyone, stage teams, departments, direct, urgent), compose with Ctrl/⌘+Enter, urgent flag, mark seen / acknowledge, delete (sender or admin), the red urgent banner on every screen until acknowledged (also over wall mode), the unread badge on the Messages nav item (last-read is per browser, as in the prototype), and message panels on Overview and Today. Visibility rules are in `src/domain/messages.ts`; like the prototype they are UI-only, so direct messages are not private until the backend enforces them.
8. ✅ Accommodation and riders. Hotels (add / edit), rooms used per night against each block (red when over), the rooming list with a night grid and a stage filter, add / edit bookings for an artist or a named guest (also from the artist page). Hotel contacts and booking refs show only to roles with contact access. Riders in HQ and per stage, as technical / hospitality tabs shown per permission: paste items line by line, set department and status, remove, progress per rider; also on the artist page. Fixed from the prototype: pasting "24 × water" no longer drops the leading quantity.
9. ✅ Admin and stage setup (not in the original list). Admin: stages and managers (add / edit; delete only when a stage is empty), people with access (festival role, stages managed, crew places, departments, personnel link; your own access can't be removed), roles matrix with custom roles and "Preview the app as", event (type sets the vocabulary), modules, departments, and demo resets. Stage setup: details, day sheet template (entered as plain minutes), stage team (managers shown, crew added / removed by the stage's managers, requests to join approved). Access rules live in `src/domain/admin.ts`.

**Every screen from the prototype is ported.**

10. ✅ Supabase backend (2026-10-19). Schema and row-level security in `supabase/migrations/`, `SupabaseStore`, magic-link sign-in (`LiveApp`, `LiveSessionProvider`), create an event (blank or from the sample), invite links (`?event=<id>&stage=<id>`) that lead to "Ask for access", server time from `server_now()`, and the `ros_audit` log written by a trigger.

What's left:

- **Supabase auth settings** (dashboard, not in migrations): Site URL and redirect URLs for each place the app is served, and custom SMTP before real use (the built-in email sender is rate-limited).
- **Artist contacts** are inside the artist doc, so RLS can't hide them from people who can see the artist; move them to their own collection to enforce `canSeeContacts` server-side.
- **Visibility changes:** realtime only sends rows as they change, so the store reloads when members, stage teams or roles change. A record moved out of someone's view (an artist moved to another stage) stays on their screen until the next reload.
- **Run sheet changes aren't one transaction** yet: `applyChanges` sends each change separately (each still audited).
- An organisation user picker (the live Admin uses invite links instead of the demo "add person" forms), a screen for the timing audit log, and the backlog ideas below.

## Backend

Built on Supabase (see "Port status", step 10). How it fits the data model:

- **`events`** holds `config/event` (`cfg`) and `config/roles` (`roles`). The creator is `owner` and always Festival admin.
- **`docs` (event_id, col, id, doc)** holds every collection record; `doc` is the record without its id. Access rules read fields (`stage`, `artist`, `kind`, `scope`, `to`, `from`) from the jsonb.
- **RLS helpers** live in the `private` schema (not exposed by the API): `perm`, `stage_role`, `lv`, `can_read`, `can_write`. `private.stage_lv` must be kept in step with `STAGE_LV` in `src/domain/constants.ts`.
- **Updates** go through `doc_patch` (server-side deep merge), so two people acknowledging a message don't overwrite each other. A trigger lets non-senders change only their own ack.
- **Test the rules** by running a `do` block as simulated users (`set local role authenticated` plus `request.jwt.claims`) that ends in `raise exception`, so nothing is kept.

Requirements for production at festival scale:

- **Real-time subscriptions**, so clocks, run sheets and messages update everywhere within a second.
- **Server-side permissions** per stage (row-level security).
- **Multi-tenant:** one organisation, many events.
- **Thousands of personnel records and a few thousand run sheet items per event.**
- **Audit history** of who changed timings.

Supabase (Postgres + row-level security + realtime) fits well, and Firebase is an alternative. Server time should come from the backend for clock sync.

## Known limitations of the prototype

- **Storage and permissions:** the claude.ai storage is sized for hundreds to low thousands of records, and permissions are mostly UI-enforced.
- **Direct messages:** these aren't private in the shared store.
- **Message history:** only the latest 300 messages load.
- **Concurrent edits:** rider items are stored as one array per rider, so simultaneous edits are last-write-wins.
- **Offline use:** there is no offline mode.

## Backlog ideas

- Crew call sheets and shifts
- A transport and runner module (pickups tied to arrivals and departures)
- Guest lists and accreditation printing
- An incident log
- Riser and stage plots
- Weather alerts
- CSV and PDF export of day sheets
- Push notifications for urgent messages
- An offline-tolerant stage display
