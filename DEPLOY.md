# Deploying showctrl to Cloudflare

showctrl runs as one Cloudflare Worker:

- **The app** (the Vite build) is served as static assets.
- **Each event** is a Durable Object. It holds the event's data in SQLite and pushes every change to connected browsers over WebSockets.
- **D1** (`showctrl`) lists the events and who belongs to which.
- **Sign-in** is showctrl's own: people type their email and get a 6-digit code (Cloudflare Email Service). The Worker checks the session on every API call and identifies people by email.

You need a Cloudflare account with Workers, plus Zero Trust for Access. Zero Trust's free plan covers up to 50 users.

## First deploy

1. Install and log in:
   ```sh
   npm install
   npx wrangler login
   ```
2. Create the database:
   ```sh
   npx wrangler d1 create showctrl-eu --jurisdiction eu
   ```
   Copy the `database_id` it prints into `wrangler.jsonc`, replacing the zeros.
3. Enable R2 in the dashboard, then create the buckets for uploaded documents and nightly backups (both EU-only), and uncomment `r2_buckets` in `wrangler.jsonc`:
   ```sh
   npx wrangler r2 bucket create showctrl-files --jurisdiction eu
   npx wrangler r2 bucket create showctrl-backups --jurisdiction eu
   ```
4. Create the tables:
   ```sh
   npm run db:init
   ```
5. Deploy:
   ```sh
   npm run deploy
   ```
   Note the URL it prints, e.g. `https://showctrl.<your-subdomain>.workers.dev`. To use your own domain instead, add a custom domain to the Worker in the Cloudflare dashboard. That domain's DNS must be on Cloudflare.

The app now refuses API calls with "Sign-in is not configured". The next section fixes that.

## Turn on sign-in

1. Let Cloudflare send email from your domain (it adds the SPF and DKIM records itself):
   ```sh
   npx wrangler email sending enable yourdomain.no
   ```
   Set `LOGIN_FROM` in `vars` if the sender isn't `login@showctrl.no`.
2. Create the sign-in tables, if the database is older than them: `npm run db:migrate:login`.
3. Set `SUPERADMINS` in `vars` (see below) and deploy.

Open the site, type your email, and enter the code from the email. Codes last 10 minutes and allow 5 tries; sending is rate-limited per address and per IP. Only addresses showctrl knows (superadmins, organisation admins, event members) get a code. Sessions last 30 days, or until **Log out**.

`SUPERADMINS` is who runs showctrl itself: a comma-separated list of emails. They add organisations (customers), act as admin of every organisation, and are Festival admin inside every event without being added to it.

**Cloudflare Access is optional.** If an Access application still sits in front of the site, people pass it first and then showctrl's own sign-in. To use only showctrl's sign-in, delete the Access application. With `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` set, the Worker also accepts Access tokens (handy for scripts using `cloudflared access token`).

## Who sees what

Everyone signs in at the same address.

- **Superadmins** (`SUPERADMINS`) run the whole portfolio. They add customers, create every event and name its admins, and are Festival admin inside every event without being added to it.
- **Event admins** are Festival admin in their own events only. Inside the event (Admin → People with access) they add everyone else. They can't create events or see other events.
- **Everyone else** sees only the events they've been added to.

Customers are folders that group events for superadmins; they give nobody access. Superadmins can delete an event (type its name to confirm; everything in it goes, including uploaded files) and a customer once it has no events.

**Backups** (superadmins): **Backup** next to each event downloads that event as JSON: settings, every record unredacted, the change history and the keys of stored files. **Download a full backup** on the Customers page adds the customer list, the event index and memberships, with every event in full. Uploaded files themselves stay in R2 and aren't in the download. Sign-in codes and sessions are never included. The server enforces all of this: someone who isn't in an event can't list it or connect to it.

**Databases created before organisations** need this once:
```sh
npm run db:migrate:orgs
```
Then put existing events in an organisation, e.g. with `npx wrangler d1 execute showctrl --remote --command "UPDATE events SET org_id = '<org id>' WHERE id = '<event id>'"`.

## Adding people

In the event, go to **Admin → People with access → Give someone access** and enter the email they sign in with. Choose their festival role, and any stages where they're stage manager or crew. The next time they open showctrl, the event shows up for them.

Someone who signs in before being added sees **Ask for access**. Their request then appears in **Admin → People with access**, and under that stage's **Stage setup**.

## Local development

- **Demo mode** (no backend): `npm run dev`, then open `http://localhost:5173/hq`.
- **Live mode against a local Worker:**
  ```sh
  printf 'DEV_USER_EMAIL=you@yourdomain.no\nACCESS_AUD=\nACCESS_TEAM_DOMAIN=\n' > .dev.vars   # blanks the production Access settings locally
  npm run db:init:local
  npm run dev:worker                                  # Worker on :8787
  SHOWCTRL_API=http://localhost:8787 npm run dev      # app on :5173, proxied
  ```
  Add `?as=someone@example.com` to the URL to act as another user in a second window. This only works while `ACCESS_AUD` is unset, so it never works in production.
- **A simulated show day:** with the local Worker running, `npm run simulate` creates a fresh sample event and works it in real time, as the sample festival's stage managers, production, hospitality and crew:
  - shows go on and off stage, sometimes late or overrunning
  - artists move through arrived, backstage and ready
  - incidents push running orders back and send urgent messages
  - messages get acknowledged, and hotel check-ins and riders progress

  Run it against an existing event with `npm run simulate -- --event <id>`, and stop it with Ctrl+C.

## Where data lives, and backups

- **EU only:** events are Durable Objects in Cloudflare's EU jurisdiction (`EVENT_JURISDICTION: "eu"`), the database is created with `--jurisdiction eu`, and so are both R2 buckets. Cloudflare has no Norway-only option. Events made before EU storage are copied across once with `POST /api/admin/move-to-eu` (superadmin), which checks record counts; `?purge=1` then removes the old copies.
- **Nightly backups:** a cron trigger (02:00 UTC) writes one full backup to `showctrl-backups`, keeps 30 nights, and superadmins download them from the Customers page. Without the bucket the run only logs.

## Good to know

- **Security:** permissions are enforced on the server (`src/server/core.ts` using `src/shared/writeRules.ts`). The browser only hides buttons. Other people's direct messages, other users' settings, and contact details a role may not see are never sent to that browser.
- **Change history:** every change is logged with who made it and when, in the event's own storage. Admins can read it through the data layer (`store.audit()`).
- **Sample events:** the sample festival's people (`demo-pm`, `demo-sm-main` and so on) aren't real sign-ins. Use it to look around, then create a blank event for real use.
- **Typecheck the Worker:** `npm run typecheck:worker`.
