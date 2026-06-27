# Mochron Design — Architecture & Concepts

This document explains how the Mochron Design portfolio site is built, hosted, and managed. It is written for developers and stakeholders who want to understand the system without reading every source file.

## The Big Idea

This is a **static website** — no database, no server application running 24/7. The live site is plain HTML, CSS, and a small amount of JavaScript, generated ahead of time and served from Cloudflare's edge network.

Project content lives as **files in GitHub**. A browser-based CMS lets the client edit those files without touching code. When content changes, the site is **rebuilt and redeployed**, and the live site updates.

```
Client edits in /admin
    → saves JSON + images to GitHub
    → npm run build (Astro generates static files)
    → wrangler deploy (upload to Cloudflare Worker)
    → visitors see updated site at mochrondesign.com
```

---

## Stack Overview

| Layer | Technology | Role |
|-------|------------|------|
| Site generator | [Astro 5](https://astro.build) | Builds pages from templates + content |
| Styling | Tailwind CSS | Utility-first CSS |
| Content | JSON files in `src/content/projects/` | Project data (title, images, etc.) |
| CMS | [Sveltia CMS](https://sveltiacms.app) | Browser UI for editing GitHub content |
| OAuth | Sveltia CMS Authenticator (Cloudflare Worker) | GitHub login for the CMS |
| Hosting | Cloudflare Workers (static assets) | Serves the built site worldwide |
| DNS & SSL | Cloudflare | Domain routing and HTTPS certificates |
| Source control | GitHub (`kelvinl961/mochrondesign`) | Version history and content storage |
| Domain registrar | Hostinger | Domain registration only (no hosting required) |

---

## Layer 1: Astro (The Website Engine)

Astro is a static site generator. You write pages in `.astro` files; Astro compiles them into plain files in `dist/`.

### Key directories

| Path | Purpose |
|------|---------|
| `src/pages/` | Each file becomes a URL (`index.astro` → `/`, `gallery/index.astro` → `/gallery`) |
| `src/components/` | Reusable UI pieces (nav, footer, gallery grid) |
| `src/layouts/` | Shared page wrappers |
| `src/content/projects/*.json` | Project data consumed at build time |
| `src/content/config.ts` | Zod schema — defines valid project fields |
| `src/data/site.ts` | Hardcoded site data (contact, awards, service steps) |
| `public/` | Static assets copied as-is (`images/`, `admin/config.yml`) |

### Build command

```bash
npm run build
```

Astro reads all project JSON files, generates HTML for every route (home, gallery, project detail pages, about, etc.), and outputs everything to `dist/`. There is no runtime server — the gallery page is pre-built HTML that already includes the project data.

---

## Layer 2: Sveltia CMS (The Editing Panel)

Sveltia CMS is a **Git-native** headless CMS. It runs entirely in the browser at `/admin` and talks directly to GitHub.

Configuration lives in `public/admin/config.yml`:

```yaml
backend:
  name: github
  repo: kelvinl961/mochrondesign
  branch: main
  base_url: https://mochrondesign-cms-auth.itsmochron.workers.dev

media_folder: public/images/projects
public_folder: /images/projects

collections:
  - name: projects
    folder: src/content/projects
    # ... field definitions
```

### What happens when the client saves a project

1. They change fields in the CMS form (title, images, description, etc.).
2. Sveltia writes a `.json` file to `src/content/projects/` on GitHub.
3. Uploaded images are saved to `public/images/projects/` on GitHub.
4. Changes are committed and pushed to the `main` branch.

The CMS updates GitHub immediately. The **live site** only updates after a rebuild and redeploy (see Deployment below).

---

## Layer 3: Admin Login Gate

`src/pages/admin/index.astro` adds a simple password screen before Sveltia CMS loads.

```
Visitor → /admin → login form → correct password? → Sveltia CMS loads
```

Default credentials (change before handover):

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `mochron2024` |

This is **casual protection** — it stops accidental access to the CMS UI. It is not strong security (credentials are embedded in the built page). Real write access is gated by **GitHub OAuth**: only GitHub users with write access to the repo can save changes.

---

## Layer 4: GitHub OAuth (The Auth Worker)

To write to GitHub from a browser, the user must authenticate. Sveltia CMS needs an OAuth flow for non-technical users.

### Why a separate Worker?

Older CMS setups (Netlify CMS / Decap) defaulted to Netlify's OAuth service. This site is hosted on Cloudflare, not Netlify — without a custom `base_url`, the CMS redirected to `api.netlify.com` and failed with 404.

**Solution:** deploy the [Sveltia CMS Authenticator](https://github.com/sveltia/sveltia-cms-auth) as a dedicated Cloudflare Worker in `cms-auth/`.

### OAuth flow

```
1. Client clicks "Login with GitHub" in /admin
2. Browser opens the auth Worker URL
3. Worker redirects to GitHub for authorization
4. GitHub sends an authorization code back to the Worker
5. Worker exchanges the code for an access token
6. Token is passed back to Sveltia CMS in the browser
7. CMS uses the token to read/write the GitHub repo
```

### Two Cloudflare Workers

| Worker | URL | Purpose |
|--------|-----|---------|
| `mochrondesign` | `mochrondesign.itsmochron.workers.dev` | Serves the public website (`dist/`) |
| `mochrondesign-cms-auth` | `mochrondesign-cms-auth.itsmochron.workers.dev` | Handles GitHub OAuth for `/admin` only |

Auth Worker secrets (set via `wrangler secret put`, never committed to git):

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `ALLOWED_DOMAINS` (e.g. `mochrondesign.com`)

GitHub OAuth app callback URL: `https://mochrondesign-cms-auth.itsmochron.workers.dev/callback`

---

## Layer 5: Cloudflare Workers (Hosting)

The site is not hosted on traditional shared hosting (cPanel, WordPress on Hostinger). It is served by a Cloudflare Worker with static assets.

```bash
npm run build
npx wrangler deploy --name mochrondesign --assets=./dist
```

Cloudflare serves files from edge locations worldwide. No PHP, MySQL, or WordPress runtime is required.

### Custom domain

1. Domain nameservers point to Cloudflare (not Hostinger DNS).
2. In Cloudflare: **Workers & Pages → mochrondesign → Domains → Add custom domain**.
3. Add `mochrondesign.com` (and optionally `www.mochrondesign.com`).
4. Cloudflare provisions SSL automatically.

Do **not** manually CNAME the domain to `*.workers.dev` without adding the custom domain on the Worker — that causes 522 or SSL errors.

---

## Layer 6: DNS & Domain

```
User types mochrondesign.com
    → DNS (Cloudflare) resolves to Cloudflare IPs
    → Cloudflare routes to Worker "mochrondesign"
    → Worker serves static files from dist/
    → HTTPS certificate served by Cloudflare
```

| Service | What you pay for |
|---------|------------------|
| **Hostinger** | Domain registration / renewal only |
| **Cloudflare** | Free account — Workers, DNS, SSL |
| **GitHub** | Free — repo and content storage |

**You do not need a Hostinger hosting plan** for this site. Cancel WordPress/shared hosting if it is no longer used. Keep domain registration at Hostinger (or transfer the domain elsewhere later).

---

## What the Client Can vs. Cannot Edit

### Editable via CMS (`/admin`)

- Project title, location, property type
- Gallery tab (Completed Project / Visualization)
- Cover image and gallery images
- Design concept, designer, description

### Hardcoded in source (requires a developer to change)

- Contact info, phone, email, address
- About page copy
- Service process steps
- Awards list
- Site layout, fonts, colors, navigation

Hardcoded content lives in `src/data/site.ts` and individual page files. Additional CMS collections can be added later for about/contact content.

---

## End-to-End: Client Adds a New Project

1. Client visits `https://mochrondesign.com/admin/`
2. Enters admin username and password
3. Clicks **Login with GitHub** and authorizes the OAuth app
4. Creates a new project, fills the form, uploads images
5. Sveltia commits `new-project.json` and images to GitHub (`main`)
6. Site is rebuilt and redeployed to Cloudflare
7. New project appears on `/gallery` and `/projects/new-project`

**Important:** Step 6 runs automatically via the `Deploy site` GitHub Action on every push to `main` (after CMS saves or watermark commits). Add `CF_API_TOKEN` and `CF_ACCOUNT_ID` repository secrets for it to work.

---

## Local Development

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # output to dist/
npm run preview    # preview production build locally
```

CMS locally: `http://localhost:4321/admin/` (login gate + Sveltia). GitHub OAuth works against the live auth Worker; local editing can also use Git commits directly.

---

## Deployment Checklist

### Main site

```bash
npm run build
npx wrangler deploy --name mochrondesign --assets=./dist --compatibility-date=2024-01-01
```

### Auth Worker (after OAuth app or secret changes)

```bash
cd cms-auth
npx wrangler deploy
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

Or run `./scripts/setup-cms-auth.sh` for guided setup.

---

## Cost Summary

| Service | Cost | Role |
|---------|------|------|
| GitHub | Free | Content storage and version history |
| Cloudflare Workers | Free tier | Website hosting + OAuth worker |
| Astro + Sveltia | Free / open source | Build tool and CMS |
| Hostinger | Domain renewal only | Own `mochrondesign.com` |

No WordPress plugins, CMS subscription, or database hosting fees.

---

## One-Sentence Summary

**Astro turns JSON project files into a fast static website; Sveltia CMS lets the client edit those files through a browser by saving to GitHub; a small Cloudflare Worker handles GitHub login; and another Cloudflare Worker serves the built site at the custom domain.**
