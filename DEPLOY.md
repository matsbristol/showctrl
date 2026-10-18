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
3. Create the tables:
   ```sh
   npm run db:init
   ```
4. Deploy:
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
     "CREATORS": "you@yourdomain.no",
     "ACCESS_TEAM_DOMAIN": "https://yourteam.cloudflareaccess.com",
     "ACCESS_AUD": "the AUD tag"
   }
   ```
   `CREATORS` sets who may create new events: a comma-separated list of emails, or `*` for anyone who gets past Access.
8. Deploy again with `npm run deploy`.

Open the URL. Access asks for your email and sends you a code. Then showctrl shows **Your events**. Create one, or tick **Fill it with the sample festival** to try things out.

## Adding people

In the event, go to **Admin → People with access → Give someone access** and enter the email they sign in with. Choose their festival role, and any stages where they're stage manager or crew. The next time they open showctrl, the event shows up for them.

Someone who signs in before being added sees **Ask for access**. Their request then appears in **Admin → People with access**, and under that stage's **Stage setup**.

## Local development

- **Demo mode** (no backend): `npm run dev`, then open `http://localhost:5173/hq`.
- **Live mode against a local Worker:**
  ```sh
  echo "DEV_USER_EMAIL=you@yourdomain.no" > .dev.vars
  npm run db:init:local
  npm run dev:worker                                  # Worker on :8787
  SHOWCTRL_API=http://localhost:8787 npm run dev      # app on :5173, proxied
  ```
  Add `?as=someone@example.com` to the URL to act as another user in a second window. This only works while `ACCESS_AUD` is unset, so it never works in production.

## Good to know

- **Security:** permissions are enforced on the server (`src/server/core.ts` using `src/shared/writeRules.ts`). The browser only hides buttons. Other people's direct messages, other users' settings, and contact details a role may not see are never sent to that browser.
- **Change history:** every change is logged with who made it and when, in the event's own storage. Admins can read it through the data layer (`store.audit()`).
- **Sample events:** the sample festival's people (`demo-pm`, `demo-sm-main` and so on) aren't real sign-ins. Use it to look around, then create a blank event for real use.
- **Typecheck the Worker:** `npm run typecheck:worker`.
