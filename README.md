```
     _                _
  __| | ___  __ _  __| |_ __ ___  _ __
 / _` |/ _ \/ _` |/ _` | '__/ _ \| '_ \
| (_| |  __/ (_| | (_| | | | (_) | |_) |
 \__,_|\___|\__,_|\__,_|_|  \___/| .__/
                                  |_|
```

**Share it once. Then it's gone.**

[![MIT License](https://img.shields.io/badge/license-MIT-red.svg)](LICENSE)
[![Cloudflare](https://img.shields.io/badge/runs%20on-Cloudflare-F38020.svg)](https://pages.cloudflare.com)
[![Zero Knowledge](https://img.shields.io/badge/encryption-zero--knowledge-green.svg)](#how-it-works)

---

## What is Deadrop?

Every day, people paste passwords into Slack messages, email API keys to teammates, and text credit card numbers to family members. Those messages sit in server logs, search indexes, and backup tapes forever.

**Deadrop** creates one-time, self-destructing links for sensitive data. The secret is encrypted in your browser before it ever leaves your device. The server stores only ciphertext it cannot read. The recipient opens the link, the secret decrypts in their browser, and the server-side record is permanently deleted.

No accounts. No logins. No tracking. One link, one view, then gone.

---

## How It Works

Deadrop uses **client-side AES-256-GCM encryption** with the key stored exclusively in the URL fragment (`#`), which browsers never send to servers.

```
[Your Browser]                    [Cloudflare KV]
     |                                  |
     |-- Generate AES-256 key           |
     |-- Encrypt secret in-browser      |
     |-- POST { ciphertext, iv } -----> |-- Store encrypted blob
     |<- Receive { id }                 |
     |                                  |
     |-- Build link:                    |
     |   deadrop.dev/s/{id}#{key}       |
     |   (key NEVER sent to server)     |
     |                                  |
[Recipient Browser]                     |
     |-- Open link                      |
     |-- Extract key from #fragment     |
     |-- GET /api/secret/{id} --------> |-- Return ciphertext
     |                                  |-- DELETE entry (burned)
     |-- Decrypt locally                |
     |-- Display secret                 |
```

### The security model in plain English

1. **You type a secret.** Your browser generates a random AES-256-GCM encryption key and encrypts the secret entirely client-side.
2. **Only ciphertext hits the server.** The encrypted blob and initialization vector are sent to a Cloudflare Worker, which stores them in KV with a random ID and a TTL.
3. **The key lives in the link fragment.** The shareable link is `deadrop.dev/s/{id}#{key}`. The `#key` portion (the fragment) is never sent to the server by any browser -- this is part of the HTTP specification, not a Deadrop feature.
4. **One view, then burned.** When the recipient opens the link, the Worker returns the ciphertext and immediately deletes it from KV. The browser extracts the key from the fragment, decrypts the secret, and displays it.
5. **Even Cloudflare can't read it.** The server never sees the key. The ciphertext without the key is computationally useless. If someone compromises the KV store, they get random noise.

---

## Features

- **Zero-knowledge encryption** -- the server never sees plaintext or the decryption key
- **One-time links** -- burned permanently after first view
- **Time-based expiry** -- auto-deletes after 1 hour to 30 days (your choice)
- **No accounts or tracking** -- no cookies, no analytics, no user data
- **White-label ready** -- one config file controls brand, colors, and limits
- **Free to run** -- deploys on Cloudflare's free tier (~$0/month)
- **MIT licensed** -- fork it, brand it, sell it, whatever you want

---

## Deploy Your Own

Total time: about 5 minutes.

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)

### Step 1: Clone and install

```bash
git clone https://github.com/realjbmangum/deadrop
cd deadrop
npm install
```

### Step 2: Create KV namespaces

```bash
wrangler kv:namespace create DEADROP_SECRETS
wrangler kv:namespace create DEADROP_SECRETS --preview
```

Copy the namespace IDs from the output and paste them into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "DEADROP_SECRETS"
id = "paste-your-production-id-here"
preview_id = "paste-your-preview-id-here"
```

### Step 3: Deploy

```bash
npm run deploy
```

That's it. Your instance is live on `deadrop.pages.dev`.

### Step 4 (optional): Custom domain

In the Cloudflare dashboard, go to Pages > your project > Custom Domains and add your domain.

---

## Local Development

```bash
npm run dev
```

Starts the Astro dev server at `http://localhost:4321`. KV is simulated locally via Wrangler's platform proxy.

---

## White-Labeling

Deadrop is designed to be rebranded with a single file. Edit `deadrop.config.json`:

```jsonc
{
  "brand": {
    "name": "Deadrop",         // App name shown in UI and page titles
    "tagline": "Share it once. Then it's gone.",  // Shown on the home page
    "logo": null,              // Path to a logo image, or null for text-only
    "primaryColor": "#ef4444", // Accent color used throughout the UI
    "domain": "deadrop.dev",   // Your domain (used in generated links)
    "supportEmail": "hello@deadrop.dev"  // Shown in footer
  },
  "limits": {
    "maxSecretBytes": 10000,   // Max secret size in bytes (~10KB)
    "maxTtlDays": 30,          // Maximum expiry time
    "defaultTtlSeconds": 86400 // Default expiry (24 hours)
  }
}
```

Change the name, colors, and domain. Rebuild and deploy. You now have your own branded secret-sharing tool.

---

## Project Structure

```
app-deadrop/
  deadrop.config.json    # Brand and limits config
  astro.config.mjs       # Astro + Cloudflare adapter
  wrangler.toml          # Cloudflare KV bindings
  src/
    env.d.ts             # TypeScript env types
    lib/
      crypto.ts          # AES-256-GCM encrypt/decrypt (browser-side)
    pages/
      index.astro        # Create secret form
      s/[id].astro       # Receive/reveal secret page
      api/
        secret/
          create.ts      # POST endpoint — store encrypted secret
          [id].ts        # GET endpoint — return + burn secret
  public/
    favicon.svg          # Red droplet favicon
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | [Astro](https://astro.build) + Tailwind CSS |
| Encryption | Web Crypto API (AES-256-GCM) |
| Backend | Astro API routes on Cloudflare Pages |
| Storage | Cloudflare KV (with native TTL expiry) |
| Hosting | Cloudflare Pages (free tier) |

---

## FAQ

**Is this actually secure?**
The encryption is AES-256-GCM via the Web Crypto API -- the same primitives used by Signal and 1Password. The key never leaves the browser or touches the server. The main attack surface is the link itself: if someone intercepts the full URL, they can read the secret (but only once, since it self-destructs on first view).

**What happens if nobody opens the link?**
The secret auto-deletes from Cloudflare KV when the TTL expires. Default is 24 hours, configurable up to 30 days.

**Can I recover a burned secret?**
No. Once viewed, the ciphertext is permanently deleted from KV. There is no undo, no recycle bin, no backup. That's the point.

**How much does it cost to run?**
Cloudflare's free tier includes 100,000 KV reads/day, 1,000 writes/day, and unlimited Pages requests. For most use cases, the cost is $0/month.

**Can I use this at my company?**
Yes. MIT license. Deploy your own instance, put it on your domain, brand it however you want.

---

## License

[MIT](LICENSE) -- LIGHTHOUSE 27 LLC
