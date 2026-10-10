# MIF Smart | إم آي إف سمارت

A bilingual (Arabic RTL / English LTR) company platform with a chat-first React website, service catalog, quotation-request shop and a secure SaaS-style admin control panel. Built with React 19, Vite, Node.js, Hono, Neon PostgreSQL and Cloudflare Workers Static Assets.

## Application map

| Area | Route | Behaviour |
| --- | --- | --- |
| Conversational home | `/` | Typewriter-driven guided assistant, service discovery, smart suggestions |
| Solutions | `/services` | Category filtering, service details and contact links |
| Quote-request store | `/store` | Search/filter items, persistent cart, quotation checkout (not payment) |
| Company | `/about` | Vision, specialties and company story |
| Contact | `/contact` | Lead capture with input validation and persisted submissions |
| Insights | `/journal` | Public published content; editor inside console |
| Admin console | `/admin` | Admin sign-in, dashboard, catalog, lead pipeline, orders, content, settings |

**Important:** The on-page smart concierge is a guided rules-based experience with animated text — it is not currently connected to a generative AI model. The storefront is for quotation requests, with no payment gateway, logistics, invoicing, or provisioning workflow wired yet. No lead or order is falsely accepted if the database is unconfigured.

## Requirements

- Node.js 22+
- npm 10+
- Cloudflare account (Workers) and credentials for deployment
- A **new independent** Neon PostgreSQL project; do not reuse Aseel/Fayo databases

## Local development

```bash
npm install
cp .env.example .dev.vars
# Set DATABASE_URL, SESSION_SECRET (>=32 chars), ADMIN_BOOTSTRAP_TOKEN (>=24 chars)
npm run db:migrate
npm run dev
```

- Website: http://localhost:5173
- Local API: http://localhost:8788
- Health: http://localhost:8788/api/health
- Open `/admin` and select **First-time platform setup**, enter the admin email, a strong password (>=12 characters) and the `ADMIN_BOOTSTRAP_TOKEN` value.
- After creating your first admin, remove or rotate `ADMIN_BOOTSTRAP_TOKEN` from the deployment; the endpoint rejects setup if an administrator already exists.

To browse without a database, leave `DATABASE_URL` unset and run `npm run dev`: the website, guided chat and sample catalog render in preview mode. Forms, checkout and admin login are intentionally disabled rather than claiming successful persistence.

## Cloudflare Workers deployment

```bash
npm run check
npx wrangler login
npm run deploy
# configure secrets after the worker exists:
npx wrangler secret put DATABASE_URL
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_BOOTSTRAP_TOKEN
npx wrangler secret put SITE_ORIGIN
npm run db:migrate # with DATABASE_URL set in local environment
```

Ensure the database is migrated before real traffic. Worker serves Vite static assets and `/api/*` through Hono using a single Worker deployment. When deploying with GitHub Actions, add GitHub secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and repository variable `CF_DEPLOY_ENABLED=true`. CI and deploy workflows are in `.github/workflows/`; deployment is guarded to prevent accidental publication before your account is configured.

> Cloudflare Workers do not run a long-lived Node HTTP server. `api/dev-server.mjs` is for local Node development. `worker/index.js` exports the same Hono Fetch handler, deployed at the edge. PostgreSQL connection strings, session secrets and bootstrap tokens are server-only, never Vite `VITE_` variables.

## Environment

| Name | Where | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | Neon/Cloudflare Worker secret | For live mode | Full PostgreSQL TLS connection string |
| `SESSION_SECRET` | Cloudflare Worker secret | For admin access | Cryptographically strong secret (32+ chars) |
| `ADMIN_BOOTSTRAP_TOKEN` | Worker secret | Once | Initial admin authorization (24+ chars), rotate after onboarding |
| `SITE_ORIGIN` | Worker secret | Recommended | Public HTTPS origin (origin validation) |
| `PORT` | Local Node | Optional | Local API port, defaults to 8788 |

## Security characteristics

- PBKDF2-SHA256 password hashing (220,000 iterations, random salts), signed JWTs in HttpOnly SameSite=Strict cookies; 8-hour expiration.
- Origin validation for write requests; no wildcard cross-origin access.
- Parameterized SQL queries, Zod validation, a honeypot field, public catalog filtering, and a strict allowlist of admin tables and editable settings.
- Admin tokens, passwords and database URL remain server-side.
- Reverse proxy/CDN should enable WAF rate limits on `/api/admin/login`, `/api/admin/bootstrap`, `/api/leads` and `/api/orders` **before production launch**.
- Real payments, subscription provisioning, email delivery and CRM integrations are outside the current build.

## Status and verification

This source package contains the complete front-end and back-end implementation for the listed capabilities and the SQL migration; its deployment still requires live credentials and a linked database. In restricted environments where package registry access is unavailable, automated tests/build cannot run until dependencies are installed in CI or a normal Node environment.

## Repository safety

The `fayoapp` repo's `Desktop` default branch contains pre-existing FAYO Desktop binaries. Do not overwrite or rename it. Use a separate `mif-smart-platform` branch, or preferably a new independent repository named `mif-smart-platform`, for the contents of this directory.
