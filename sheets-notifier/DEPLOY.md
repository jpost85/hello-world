# Deployment guide

> **Read this first.** This tool is a **Node.js server**, not a static website.
> Uploading the files to plain/static file hosting **will not work** — there's
> no process to poll Google or send texts, and your secrets would have nowhere
> safe to live. You need hosting that can **run a Node.js process**.
>
> Quick test for any host: *"Can it run `npm start` and keep it running?"*
> If yes, it works. If it only serves files you upload, it won't.

The three realistic options, easiest first:

---

## Option A — A managed Node host (recommended): Render, Railway, Fly.io

These run your app always-on and let you point your own domain at it. Render
is used as the example; Railway/Fly are similar.

1. Push this repo to GitHub (already done).
2. Create a **Web Service** on [Render](https://render.com) from the repo.
   - **Root Directory:** `sheets-notifier`
   - **Build Command:** `npm ci`
   - **Start Command:** `npm start`
   - (Render also auto-detects the included `Dockerfile` if you prefer.)
3. Add **Environment Variables** (this is where your secrets go — *not* a
   `.env` file): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_FROM_NUMBER`, and for Google use **`GOOGLE_CREDENTIALS_JSON`**
   (paste the whole service-account JSON as the value). Add `SMTP_*` if you
   want email fallback.
4. Add a **persistent disk** mounted at `/app/data` (or
   `sheets-notifier/data`) so your watched-sheet list survives restarts.
5. Deploy, then under the service's **Custom Domains** add your domain and
   create the **CNAME** record your host shows you at your domain registrar.

Your domain now points at the running app. ✅

---

## Option B — Your own server / VPS with Docker (DigitalOcean, EC2, Linode…)

If you have (or can get) a VPS, this is the most portable:

```bash
git clone <your-repo-url>
cd hello-world/sheets-notifier

# Put your real secrets in .env (copy from .env.example)
cp .env.example .env && nano .env

# Build and run, persisting data and loading the .env
docker build -t sheets-notifier .
docker run -d --name sheets-notifier \
  --env-file .env \
  -v "$PWD/data:/app/data" \
  -p 3000:3000 \
  --restart unless-stopped \
  sheets-notifier
```

Then put a reverse proxy (Nginx/Caddy) in front to serve your domain over
HTTPS. With **Caddy** it's two lines in a `Caddyfile`:

```
notifier.yourdomain.com {
    reverse_proxy localhost:3000
}
```

Caddy fetches a TLS certificate automatically. Point your domain's DNS
**A record** at the server's IP first.

---

## Option C — Shared hosting with a Node.js app feature (cPanel / Passenger)

Many shared hosts (the kind where you "host files on a web domain") include a
**"Setup Node.js App"** tool (Phusion Passenger). If yours does:

1. Upload the `sheets-notifier` folder to the host (e.g. via the file manager
   or SFTP), **excluding** `node_modules`.
2. In **Setup Node.js App**, create an app:
   - **Application root:** the uploaded `sheets-notifier` folder
   - **Application startup file:** `src/server.js`
   - **Node version:** 18 or newer
3. Use the tool's UI to set the **environment variables** (same list as
   Option A — `TWILIO_*`, `GOOGLE_CREDENTIALS_JSON`, optional `SMTP_*`).
4. Click **Run NPM Install**, then **Start/Restart** the app.
5. Map it to your domain or a subdomain as the tool directs.

If your host has **no** Node.js app feature (it only serves static files /
PHP), this app can't run there — use Option A instead; it's free to start
and you can still point your domain at it.

---

## After deploying — checklist

- Open the site; the **Status** card should show *Google access: configured*
  and your recipient counts.
- Share each Google Sheet with the service account's `client_email`.
- Add recipient phone numbers in the UI and click **Send test notification**.
- Confirm the **data** directory/volume is persistent so your settings
  survive restarts.

## Security notes

- Never commit `.env` or the service-account JSON (both are git-ignored).
- The dashboard has **no login**. If it's on a public domain, restrict access
  (HTTP basic auth at the reverse proxy, an allowlist, or your host's access
  controls) so strangers can't add sheets or read your recipient list.
