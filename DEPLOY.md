# Deploying showctrl to Cloudflare

showctrl runs as one Cloudflare Worker:

- **The app** (the Vite build) is served as static assets.
- **Each event** is a Durable Object. It holds the event's data in SQLite and pushes every change to connected browsers over WebSockets.
- **D1** (`showctrl`) lists the events and who belongs to which.
- **Cloudflare Access** signs people in. The Worker checks the Access token on every API call and identifies people by email.

You need a Cloudflare account with Workers, plus Zero Trust for Access. Zero Trust's free plan covers up to 50 users.

## First deploy

1. Install and log in:
   ```sh
   npm install
   npx wrangler login
   ```
2. Create the database:
   ```sh
   npx wrangler d1 create showctrl
   ```
   Copy the `database_id` it prints into `wrangler.jsonc`, replacing the zeros.
3. Create the storage bucket for uploaded documents:
   ```sh
   npx wrangler r2 bucket create showctrl-files
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

## Turn on sign-in (Cloudflare Access)

1. In the Cloudflare dashboard, go to **Zero Trust → Access → Applications → Add an application → Self-hosted**.
2. **Application domain:** the hostname showctrl runs on, either the `workers.dev` URL or your custom domain. Protect the whole site, not just a path.
3. **Policy:** Allow, with the rule "Emails" set to the people who should be able to sign in. "Emails ending in" `@yourdomain.no` works too. Everyone allowed here can open showctrl, but they only see an event's contents after an event admin adds their email.
4. **Login method:** "One-time PIN" works without any other setup.
5. Save. On the application's **Overview**, copy the **Application Audience (AUD) Tag**.
6. Find your **team domain** under **Zero Trust → Settings → Custom pages** (it looks like `https://yourteam.cloudflareaccess.com`).
7. Add both to `vars` in `wrangler.jsonc`:
   ```jsonc
   "vars": {
     "SUPERADMINS": "you@yourdomain.no",
     "ACCESS_TEAM_DOMAIN": "https://yourteam.cloudflareaccess.com",
     "ACCESS_AUD": "the AUD tag"
   }
   ```
   `SUPERADMINS` is who runs showctrl itself: a comma-separated list of emails. They add organisations (customers).
8. Deploy again with `npm run deploy`.

Open the URL. Access asks for your email and sends you a code. As a superadmin you then see **Add an organisation**.

## Organisations (customers)

Everyone signs in at the same address. Each person only sees the organisations they belong to, and only those organisations' events. The server enforces this: someone outside an organisation can't list its events or connect to them.

- **Superadmins** (`SUPERADMINS`) add an organisation and its first admins, from the start page.
- **Organisation admins** create its events, rename it and add or remove its admins. They are Festival admin in every event of the organisation, including events created before they became admin. Removing an admin takes that access away again.
- **Everyone else** is added inside an event (below). Belonging to any event of an organisation puts them in it.

With organisations, the Access policy can allow any email (Include → Everyone, login method One-time PIN). showctrl then decides what each person sees, so you don't add every customer's people in Cloudflare. Someone who isn't in an organisation yet sees "Ask your organisation's showctrl admin to add you". Zero Trust Free counts up to 50 people who sign in.

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

## Good to know

- **Security:** permissions are enforced on the server (`src/server/core.ts` using `src/shared/writeRules.ts`). The browser only hides buttons. Other people's direct messages, other users' settings, and contact details a role may not see are never sent to that browser.
- **Change history:** every change is logged with who made it and when, in the event's own storage. Admins can read it through the data layer (`store.audit()`).
- **Sample events:** the sample festival's people (`demo-pm`, `demo-sm-main` and so on) aren't real sign-ins. Use it to look around, then create a blank event for real use.
- **Typecheck the Worker:** `npm run typecheck:worker`.
