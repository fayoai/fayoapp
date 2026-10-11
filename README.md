# MIF Smart AI ERP | v4.0

A bilingual AI-first business workspace combining contacts, invoices, invoice design, scheduling, stored business knowledge and optional OpenAI with approved Odoo, ERPNext, Zoho and email integrations. The existing storefront is retained. MIF Smart AI ERP is the flagship product.

**Important distinction:** the ERP application and API are implemented in source; real customer access and external integration require a persistent Cloudflare deployment with secrets, active Neon connection, admin setup and valid provider credentials. Generic knowledge must not be mistaken for verified live data. This project is not claimed to be the first AI ERP in the world.

For details, see [AI_ERP_SETUP_AR.md](AI_ERP_SETUP_AR.md).

---

# MIF Smart AI ERP — إم آي إف سمارت | v4.0

**Commerce-first ERP/SaaS platform and installable cross-device experience.**

Modern, bilingual (Arabic RTL / English LTR) React 19 front-end, Node.js/Hono REST API for Cloudflare Workers, PostgreSQL on Neon, a guided animated chat website, secure checkout integration (credentials required), hosting configurator, Odoo module marketplace, customer order centre and authenticated admin console.

## Products in scope

- **Odoo Community المطوّر (Enhanced Odoo Community)** — extended Odoo Community, scoped modules and services (not bundled Enterprise source code).
- **MIF Odoo Control** — Odoo server/instance/backup/release management product.
- **Partner Cloud** — SaaS control plane and CRM for Odoo partners.
- **MIF Marketing** — marketing website and CRM/content/chats SaaS.
- **Odoo add-ons** — module listings, compatibility, R2 private ZIP uploads, delivery after paid order.
- **Hosting & server configuration** — region, CPU, memory, disk, OS, backups, operations and quote workflow.
- Business email is an optional infrastructure product. Smart home and contracting are intentionally excluded from the current platform.

## Routes

`/` chat-first home | `/services` | `/store` | `/store/:slug` | `/payment-result` | `/orders` protected per-order lookup | `/apps` installation centre | `/about` | `/contact` | `/journal` | `/admin`.

## Local development and tests

```bash
npm install
npm run test
npm run build
npm run dev
```

`npm run db:migrate` requires an independent Neon `DATABASE_URL` and applies `sql/schema.sql`, `sql/commerce.sql` and `sql/focus-v3.sql` idempotently. Initial admins require `SESSION_SECRET` and `ADMIN_BOOTSTRAP_TOKEN`. Do not use Aseel/FAYO client databases.

Without database configuration the site displays **preview mode** and does not accept paid purchases or requests as if they were persisted. Public items show published price if configured, otherwise quote workflow. Prices and 15% VAT are calculated server-side; the UI cannot set a payable amount. Moyasar secret is server-side only. Transfer payments must be verified manually. Recurring billing periods are recorded, but **automatic card renewals are not implemented**. Provisioning Odoo tenants/SaaS after payment is not implemented until a validated backend provisioner is integrated.

## Deploy

Cloudflare Worker assets + Hono API are defined in `wrangler.jsonc`. The private secrets: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_BOOTSTRAP_TOKEN`, `MOYASAR_SECRET_KEY`, `SITE_ORIGIN`. Optional `MODULE_FILES` R2 binding for module files. When hosting local native assets with Capacitor, configure an exact-origin `ALLOWED_APP_ORIGINS` list for public APIs, never a wildcard. Use a separate database/project and verified HTTPS domain.

GitHub Actions `.github/workflows/ci.yml` tests & builds; `deploy.yml` deploys **only if explicitly enabled** using `CF_DEPLOY_ENABLED=true`, Cloudflare credentials and a database. No tokens or payment secrets are stored in the source repository.

See [MOBILE_DESKTOP_AR.md](MOBILE_DESKTOP_AR.md) for PWA/Electron/Capacitor, signing and release workflow, and [COMMERCE_README_AR.md](COMMERCE_README_AR.md) for checkout details.

## Release completeness

- PWA includes 192/512 icons, install instructions and limited offline public shell. API/payment/admin calls are **not** cached.
- Electron wrapper code and manual unsigned builds for Windows/macOS/Linux are prepared; the deployed HTTPS site URL must be configured before packaging.
- Capacitor Android/iOS templates and CI workflows for unsigned Android debug APK and iOS simulator builds are prepared; release signing and store submission are separate.
- Checkout and admin are not production-live until Neon, Moyasar and Cloudflare deployment are configured and their real integration tests succeed.

**GitHub safety:** this code is committed to `fayoai/fayoapp` branch `mif-smart-platform`. `Desktop` remains unchanged. Do not merge it into the FAYO Desktop binary branch.

## Launch readiness (production)

The Commerce console opens on **Launch readiness**, showing verified settings without exposing credentials. Products and quote flows are scoped; published prices and module releases are not generated from demo values. AI product guidance is deterministic and transparent until a separately secured model integration is configured.

Cloudflare deploys should be run from the dedicated `mif-smart-platform` branch. Permanent production operation requires ownership of a Cloudflare account, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, Cloudflare Worker secrets `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_BOOTSTRAP_TOKEN`, `SITE_ORIGIN`, the approved payment provider key and an R2 `MODULE_FILES` binding for paid ZIP downloads. A `--temporary` preview is not production and has a time-limited claim window. Never commit secrets or Neon connection strings. Automated SaaS/Odoo provisioning and recurring card billing remain out of scope until real backends are integrated and tested.
