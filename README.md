# 🔐 Deadrop

> **Share it once. Then it's gone.**

Zero-knowledge, self-destructing secret sharing built natively on Cloudflare. No servers to manage, no Docker, no databases. Everything runs at the edge for ~$0/month.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-orange.svg)](https://pages.cloudflare.com)

---

## What is Deadrop?

Sending passwords and API keys over email or Slack leaves a permanent, searchable record. Deadrop creates a one-time link that self-destructs after the recipient opens it — leaving no trace.

- **Zero-knowledge** — secrets are encrypted in the sender's browser. Only ciphertext ever hits the server.
- **One-time links** — burned immediately on first view. The link stops working.
- **Time-based expiry** — secrets auto-delete even if the link is never opened.
- **White-label ready** — brand it as your own via `/admin` (no code changes, no redeploy).
- **Deploy in 10 minutes** — one command after a free Cloudflare account setup.

---

## How It Works

The key insight: the decryption key lives **only in the URL fragment** (`#...`). The HTTP spec guarantees fragments are never sent to the server. So even if someone gained access to the database, they couldn't read anything.

```
[Sender's Browser]                     [Cloudflare KV]
        |                                     |
        |── Generate AES-256 key              |
        |── Encrypt secret in browser         |
        |── POST { ciphertext, iv } ────────► |── Store encrypted blob
        |◄─ Receive { id }                    |   (TTL auto-expires it)
        |                                     |
        |── Build share link:                 |
        |   deadrop.dev/s/{id}#{key}          |
        |   ↑ key NEVER sent to server        |
        |                                     |
[Recipient's Browser]                         |
        |── Open link                         |
        |── Read key from #fragment           |
        |── GET /api/secret/{id} ───────────► |── Return ciphertext
        |                                     |── DELETE entry (burned)
        |── Decrypt locally with key          |
        |── Display secret                    |
```

---

## Architecture

Deadrop is a **single unified Cloudflare Pages deployment** — no separate Worker service, no extra configuration.

```
GitHub Repo
    │
    └─► Cloudflare Pages (hosts everything)
            │
            ├── Static pages (HTML/CSS/JS)
            │     ├── / .............. create page
            │     ├── /s/[id] ........ receive + burn page
            │     └── /admin ......... branding settings
            │
            ├── Pages Functions  ← these ARE the Workers
            │     ├── POST /api/secret ......... create + store
            │     ├── GET  /api/secret/[id] .... retrieve + burn
            │     └── PUT  /api/admin/settings .. update branding
            │
            └── KV Namespace (DEADROP_SECRETS)
                  ├── secret:{uuid} .... encrypted secret blobs
                  └── config:brand ..... branding settings
```

### "Is there a Worker?"

Yes — but you don't configure it separately. When Cloudflare Pages deploys, it automatically compiles the API routes into **Pages Functions**, which run as Cloudflare Workers under the hood. You'll see them in your Cloudflare dashboard under **Pages → Your Project → Functions**. No standalone Worker to create or manage.

---

## Deploy Your Own

### Prerequisites

- [Node.js 18+](https://nodejs.org)
- A free [Cloudflare account](https://cloudflare.com)
- Wrangler authenticated: `npx wrangler login`

---

### Step 1 — Clone and install

```bash
git clone https://github.com/realjbmangum/deadrop
cd deadrop
npm install
```

---

### Step 2 — Create the KV namespace

Run the setup script. It creates the KV namespace on Cloudflare and **automatically writes the IDs into `wrangler.toml`**:

```bash
npm run setup
```

No copy-pasting. The script handles everything.

> **What this does:**
> Runs `wrangler kv:namespace create DEADROP_SECRETS` for production and preview,
> parses the output, and updates `wrangler.toml` with the real namespace IDs.

---

### Step 3 — Set your admin password

In `wrangler.toml`, set a password for the `/admin` settings page:

```toml
[vars]
ADMIN_SECRET = "your-strong-password-here"
```

Generate a strong one: `openssl rand -hex 32`

---

### Step 4 — Deploy

```bash
npm run deploy
```

This builds the Astro project and deploys to Cloudflare Pages. Your site is live.

---

### Step 5 — Configure branding

Visit `/admin` on your deployed site, enter your `ADMIN_SECRET`, and set:

- Site name and tagline
- Accent color (color picker)
- Domain and support email

Changes take effect **immediately** — no redeploy needed. Settings are stored in KV.

---

## GitHub Integration (Auto-deploy on push)

If you fork and want Cloudflare to auto-deploy on every `git push`:

1. **Cloudflare Dashboard → Pages → Create a project → Connect to Git**
2. Select your fork
3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Settings → Functions → KV namespace bindings**:
   - Variable name: `DEADROP_SECRETS`
   - Select the KV namespace you created in Step 2
5. **Settings → Environment Variables**:
   - `ADMIN_SECRET` = your password
6. Save and deploy

Every push to `main` triggers an automatic rebuild and deploy.

---

## White-Labeling

### Via `/admin` UI (recommended)

Visit `/admin` on your live site. Enter your password and update name, tagline, colors, and domain through the settings form. Changes are instant — no redeploy, no code edits.

### Via `deadrop.config.json` (sets defaults)

Edit this file before deploying to set initial values:

```json
{
  "brand": {
    "name": "Acme Secrets",
    "tagline": "Secure client credential delivery.",
    "primaryColor": "#0ea5e9",
    "domain": "secrets.acme.com",
    "supportEmail": "support@acme.com"
  }
}
```

Settings saved via `/admin` always take precedence over this file.

---

## Local Development

```bash
npm run dev
```

Starts at `http://localhost:4321`. KV is simulated locally by wrangler's platform proxy — no Cloudflare account required for local dev.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Astro 4 (SSR mode) |
| Styling | Tailwind CSS + JetBrains Mono |
| API / Worker | Cloudflare Pages Functions (auto-compiled from Astro API routes) |
| Storage | Cloudflare KV |
| Encryption | Web Crypto API — AES-GCM-256, runs in browser |
| Hosting | Cloudflare Pages (free tier) |

---

## FAQ

**Does the server ever see my secret?**
No. Encryption happens in your browser before any network request. The server stores only ciphertext. The key is in the URL fragment, which is never sent to the server per the HTTP spec.

**What happens if no one opens the link?**
KV TTL auto-deletes it. Default: 7 days for 1-view links.

**How much does it cost to run?**
~$0. Cloudflare free tier: 100k KV reads/day, 1k writes/day, Pages deployments free.

**Can I set a passphrase on secrets?**
Not yet — v2 roadmap item.

---

## License

MIT © 2026 LIGHTHOUSE 27 LLC
