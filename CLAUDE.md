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
| `src/` | The original React + TypeScript + Vite app. Local state only (React contexts). To be brought in line with the prototype. |
| `src/types/` | The data model (`model.ts`) and constants ported from the prototype (`constants.ts`). Literal types are derived from the constants. |
| `src/data/` | The data layer: `DataStore` interface (`store.ts`), demo-mode `LocalStore`, the sample festival, and React hooks (`useCollection`, `useDoc`, `useConfig`). |
| `src/lib/` | Pure helpers shared by client and (later) the Worker: time zones, day sheet generator, ids. |
| `src/app/` | The new showctrl workspace UI: `ShowctrlRoot` (data + session + layout), `routes.tsx` (`/hq/...`, `/s/:stageId/...`), `session.ts` (`useAccess`, `useTerms`, `useNow`), styles scoped under `.sc`. Mounted from `src/main.tsx`; open `/hq` in `npm run dev`. |
| `worker/`, `src/server/` | The Cloudflare backend. See "Backend" below. |
| `scripts/simulate.mjs` | Local festival simulator (`npm run simulate`). Drives a sample event in real time through `wrangler dev` as the demo personas, using the normal permission checks. |
| `src/shared/` | Access rules shared by client and Worker: `createAccess()` (levels, visibility, messages), `views.ts` (which pages a user can open), `writeRules.ts` (`canWrite()`, which the Worker must call before every write). |

Run `npm test` for the Vitest suite. Component tests that click through the UI use happy-dom (`// @vitest-environment happy-dom` at the top of the file).

`src/App.css` (the older pages) has unscoped rules such as `.actions`; `src/app/showctrl.css` overrides them inside `.sc`. Watch for more leaks when porting pages.
| `HANDOVER.md` | Original product notes: stage execution first, department views, modules switchable per customer, multi-tenant later. |

Run `npm run dev` and open `/showctrl.html` to use the prototype locally.

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

**`prefs`** (keyed by user id, written only by that user): `lastRead` (ms). Per-user state that must follow the user across devices.

**`requests`** (keyed by user id): `at`, `note`, `stage?`. A person without access asks to join.

**`clocks`**: `label`, `kind` (tod | countdown | timer | stage), `scope` (stage id, or null for festival-wide), plus kind-specific fields `tz`, `target`, `stage`, `duration`, `accum`, `runningSince`, `warn`, `order`.

**`msgs`**: `from` (user id), `to` {t: all | stage | dept | user, id}, `text`, `pri` (normal | urgent), `at`, `acks` {userId: ms}.

**`hotels`**: `name`, `address`, `contact`, `phone`, `block` (rooms held per night), `notes`.

**`bookings`**: `artist?` or `guest` + `guestRole`, `hotel`, `checkIn`, `checkOut`, `rooms`, `roomType`, `status`, `conf`, `notes`.

**`riders`** (id = `${artistId}_${kind}`): `artist`, `kind` (tech | hosp), `items` {itemId: {id, text, dept, status: requested | agreed | sourced | declined, order}}, `updated`. Items are keyed by id (the prototype used an array) so parallel edits to different items don't overwrite each other.

## Access model

Two layers, combined by taking the highest level (`lv(key, stageId)` in the prototype):

1. **Festival role** (from `members.role`, applies everywhere). Permission keys: show, schedule, artists, personnel, clocks, messages, accommodation, riders_tech, riders_hosp, admin. Levels: 0 none, 1 view, 2 edit. Defaults: Festival admin, Production manager, Artist liaison, Hospitality, Technical production, Site & security, and "Stage access only" (no festival-wide access).
2. **Stage role** (applies to one stage only):
   - **Stage manager** — edit schedule, artists, personnel, clocks, messages and riders for that stage; view accommodation; can open Stage setup and add crew.
   - **Stage crew** — view the stage's schedule, artists, personnel, clocks and riders; send messages.

Artist contact details are shown only to roles with `contacts: true`, admins, and that artist's stage manager. The workspace owner is always Festival admin.

People see the Festival HQ tab only if their festival role grants overview, admin, accommodation or personnel access. They see a stage tab if they hold a stage role there or have festival-wide schedule or overview access.

**Important:** in the prototype only `config/*` and `members` are protected at the data level. All other permissions are enforced in the UI only. The real backend must enforce them server-side (for example with row-level security).

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

## Modules

showctrl is modular: each event switches optional sections on or off in **Admin → Modules**. The registry is `src/shared/modules.ts`.

- **Core (always on):** Overview, Running order and run sheets, performers (Artists), Stage setup, Admin.
- **Modules:** Messages, Clocks, Stage display, Personnel, Accommodation, Riders. All are on by default. Choices are stored in `config/event.modules`, and a missing entry uses the module's `defaultOn`.

When a module is off:

- **Pages:** its pages and nav entries disappear (`views.ts` checks `moduleOfView`).
- **Panels:** blocks and panels elsewhere disappear. Each checks `moduleOn` (message blocks, the urgent banner, Today's contacts and display button, artist-page bookings and riders).
- **Roles:** its permission columns disappear from the roles matrix (`permHidden`).
- **Server:** stops sending the module's own collections and refuses writes to them (`EventCore`, `moduleOfCollection`). Changing event settings re-sends everyone a snapshot.
- **Data:** kept, and back as soon as the module is switched on again.

**Adding a module** (e.g. riser planning, transport, accreditation):

1. Add its id to `MODULE_IDS` in `src/types/constants.ts`, and describe it in `MODULES` (`src/shared/modules.ts`). Give it a label, description, `defaultOn`, permission keys, the collections only it uses, and its HQ and stage views.
2. **New data:** add the collection to `COLLECTIONS` and `Collections` (`src/types/`), and a case in `canWrite` (`src/shared/writeRules.ts`).
3. **New permission:** add it to `PERM_KEYS`, `DEFAULT_ROLES` and, if stage roles get it, `STAGE_LV`.
4. **Pages:** add the view names to `HQ_VIEWS`/`STAGE_VIEWS` and `canOpen*View` (`src/shared/views.ts`), nav entries in `src/app/nav.ts`, the page component, and a case in `src/app/pages/Workspace.tsx`.
5. **Panels elsewhere** (artist page, Today, Overview) check `moduleOn(cfg, '<id>')`.
6. Add tests next to the existing ones: `src/shared/modules.test.ts` already checks that every module is described and that its views exist.

## Browser independence

Nothing a user does may depend on which browser or device they use. Per-user state (read markers, preferences) goes in the `prefs` collection, never `localStorage`. The only browser storage is demo mode itself: the demo data file and the demo persona picker, both replaced by the backend and sign-in.

## UI conventions

- **Fonts:** Barlow Condensed for clocks and headings; Atkinson Hyperlegible for body text (legible under pressure, backstage at night).
- **Top strip:** dark "prompt desk" with the master clock, always visible.
- **Context bar:** Festival HQ plus one tab per stage, each marked with its colour.
- **Colours:** stage and department colours are spike-tape colours (`TAPE`: red, blue, yellow, green, orange, purple, pink, teal, brown, grey, white).
- **Status colours:** go is green, standby amber, stop or late red.
- **Theming:** light and dark mode via CSS custom properties on `:root`.
- **Vocabulary:** labels come from `terms()`, so a conference shows "Speakers / Rooms" instead of "Artists / Stages". Never hard-code "Artist" or "Stage" in UI text.
- **Mobile:** the side nav becomes a bottom bar under 860 px, and the run sheet table stacks.

## Mapping to the existing React app

| Existing context in `src/context/` | Prototype equivalent |
| --- | --- |
| `ClockContext` | `clocks`, `syncClock`, `clockValue`, stage display |
| `RunOfShowContext` | `ros` items, `nowNext`, `shiftFrom`, lanes timeline |
| `PerformerReadinessContext` | `artists.status` + day sheet item status |
| `CrewContext` | `people`, `members`, `stageteam` |
| `HospitalityContext` | `riders` (hosp) + `bookings`/`hotels` |
| `TravelContext` | arrival/departure items; transport is a candidate new module |
| `RiserPlanningContext` | not in prototype yet; fits under technical riders or stage setup |
| `ModulesContext` | `config/event.modules` + `navItems()` |

Suggested porting order:

1. ~~Types for the data model above, in `src/types/`.~~ Done.
2. ~~A data layer behind one interface with get, subscribe, set, update and delete.~~ Done (demo mode only; see "Backend").
3. ~~Access helpers (`lv`, `canW`, `stageRole`), as pure functions in `src/shared/` so the Worker can run the same checks.~~ Done: `createAccess()`, page rules in `views.ts`, and server write rules in `writeRules.ts`.
4. ~~Festival HQ and stage workspace routing (`/hq/...`, `/s/:stageId/...`).~~ Done: `src/app/` (layout, demo persona switcher, preview, route guards). Pages are placeholders until their step.
5. ~~Run sheet, day sheet generator and clocks.~~ Done: HQ overview and running order, stage Today, run sheet (lanes, on stage / done / delay, add item, add performer with day sheet), clocks with wall mode, stage display, server clock sync (`/time` JSON or the `Date` header).
6. ~~Artists and personnel.~~ Done: artist list (inline status) and artist page (day sheet, contacts, production, bookings), personnel with paste-list import, Stage setup (details, template, stage team, access requests). In demo mode a stage manager can create crew users; live mode needs sign-in (step 2b) and the server must allow it, since `canWrite` keeps `members` admin-only.
7. ~~Messages.~~ Done: channels, compose (Everyone needs festival-wide message rights), acknowledge / mark seen, delete, urgent banner on every page (also in wall mode), unread badge (last-read time lives in the user's `prefs` record, so it follows them across devices).
8. ~~Accommodation and riders.~~ Done: hotels, rooms used per night against each block, rooming list, bookings (also from the artist page); riders per kind with per-item status and department, paste-in items, progress.

Admin is done too: stages and stage managers, people with access (and access requests), the roles matrix with custom roles and preview, event settings and modules, departments, and in demo mode reload sample or start blank.

Step 2b (Cloudflare backend with Access sign-in) is done too. See "Backend" below and `DEPLOY.md`.

## Backend (Cloudflare)

Deploy and local-dev instructions are in `DEPLOY.md`. Shape:

| Path | What it is |
| --- | --- |
| `worker/index.ts` | The Worker. Serves `dist/` (single-page fallback); `/time` (server time); `/api/me`, `POST /api/events`, `POST /api/me/last-event`; `/api/events/:id/ws` (WebSocket to the event). |
| `worker/auth.ts` | Verifies the Cloudflare Access JWT (`Cf-Access-Jwt-Assertion` or the `CF_Authorization` cookie) against the team's certs. Users are identified by **lower-case email**, which is also their `members` key. `DEV_USER_EMAIL` (+ `?as=`) is for `wrangler dev` only and is ignored once `ACCESS_AUD` is set. |
| `worker/event.ts` | `EventObject`, one Durable Object per event. SQLite tables `docs`, `config`, `meta` (eventId, owner) and `audit`. WebSocket hibernation API. Mirrors members into D1 `memberships`. |
| `worker/schema.sql` | D1: `events`, `memberships`, `users` (last opened event). |
| `src/server/core.ts` | `EventCore`, the server's rules, with no Cloudflare APIs. Applies writes with `canWrite`, makes batches all-or-nothing, stamps message times, keeps locked roles, filters reads (others' direct messages, others' prefs, requests) and redacts fields (artist contacts, hotel details, booking refs). It also restores those fields if a writer who can't see them saves the record. |
| `src/server/hub.ts` | `EventHub`: per-connection snapshot, write handling, and a per-viewer broadcast. Access changes (members, stage teams, roles) re-send full snapshots. |
| `src/shared/protocol.ts` | The WebSocket messages. `undefined` in an update is sent as `{ $delete: true }`. |
| `src/data/cloudflareStore.ts` | `CloudflareStore`, the browser's `DataStore` over the socket, with reconnect and backoff. Writes resolve on the server's ack; refusals become `StoreError('denied')`. |
| `src/app/backend.ts` | Detects live mode (`/api/me` returns JSON), event list and creation, `eventStore(id)`. |

Things to keep in mind:

- **Testing:** `src/server/server.test.ts` runs real `CloudflareStore` clients against a real `EventHub` over a fake network. `@cloudflare/vitest-pool-workers` isn't used, because it needs Vitest 4 and this repo is on 5.
- **Reads by permission:** only the sensitive cases are filtered or redacted on the server. Someone with access to one stage still receives other stages' run sheets (the UI hides them). Tighten `EventCore.viewDoc` if that matters.
- **Sample events created live** keep the demo people (`demo-pm` and so on), which aren't real sign-ins.
- **`npm run deploy`** uses `vite build`, not `npm run build`, because `tsc -b` still fails on older files in `src/components` and `src/pages`.

## Known limitations of the prototype

- **Storage and permissions:** the claude.ai storage is sized for hundreds to low thousands of records, and permissions are mostly UI-enforced.
- **Direct messages:** these aren't private in the shared store.
- **Message history:** only the latest 300 messages load.
- **Concurrent edits:** rider items were one array per rider, so simultaneous edits were last-write-wins. Fixed in the React app (items keyed by id).
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
