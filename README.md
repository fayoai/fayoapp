# MIF Smart 8.1 — Corporate SaaS + Two Independent RAWI Applications

**Two different brands and product surfaces.**

- **MIF Smart** is the company, its public website (`/mif`), its products catalogue and its owner SaaS console (`/mif/console`). The company identity uses its original orange logo.
- **RAWI | راوي** is an independent AI-powered ERP product, available at `/`. RAWI retains its approved original orange (#e35a0e) icon and product identity, including the installable PWA/native shells. RAWI is the first registered company product, not an MIF brand alias.

### RAWI features available in code

Tenant-scoped client management, sales/purchase documents, inventory and stock movements, accounting chart and journal, invoices, contacts, employees, projects, expenses, reports, calendar/tasks, integrations, conversations and CRM pipeline. Version 7 adds basic monthly payroll snapshots and incoming/outgoing payment records. Multiple workspaces are selectable in AI conversations and charged against the matching plan.

**Important:** These are implemented application components, **not** a certification of production-grade enterprise accounting, statutory payroll, fiscal compliance, payment reconciliation, enterprise procurement, or complete ERP industry coverage. They require further domain validation and live acceptance testing before real financial processing.

### MIF Smart features available in code

A corporate marketing website with editable identity, SEO, contact data, product pages and published content pages. Owner-only console includes product and website management, incoming enquiries, SaaS subscriptions, AI provider configuration (OpenAI/Anthropic/Gemini/Groq/OpenRouter/Workers AI), AI usage reports and Neon PostgreSQL health diagnostics. Only RAWI is seeded as a product.

### Deploy

- `npm install && npm run check` verifies unit tests and Vite build.
- `npm run db:migrate` requires the **dedicated MIF Smart Neon** database. Additive migrations include `sql/mif-website.sql`, `sql/rawi-advanced.sql` and `sql/rawi-chat-isolation.sql`.
- Configure Worker secrets: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_BOOTSTRAP_TOKEN`, `CONNECTOR_ENCRYPTION_KEY`, `PLATFORM_OWNER_EMAIL`. Model credentials are server-side.
- Public /mif pages are indexable; RAWI customer workspace and /mif/console must remain unindexed.
- Account registration and public AI chat are disabled until actively enabled. Preview access does not bypass protected tenant/API routes.

**Not yet integrated:** automatic recurring payment collection for SaaS, legal/privacy terms, production email verification, real tenant DB provisioning, full financial reconciliation and statutory localization. Do not market any of these as complete without a provider integration and live tests.

See `MIF_SMART_SETUP_AR.md`.

## RAWI 7.1: free model trials and cross-industry extensions

- Free/trial inference adapters are available for **GroqCloud**, **OpenRouter Free**, **Google Gemini Flash-Lite**, and **Cloudflare Workers AI** (Cloudflare `AI` binding is required). Existing OpenAI and Anthropic Claude adapters are retained. The company owner configures credentials and provider priorities in the existing MIF Smart SaaS console; real account quotas are controlled by external providers, not fabricated in MIF.
- Owner console now provides an explicit provider connection test and a dashboard of **locally recorded daily API calls**, which is not a statement of external credit balance.
- Customer ERP gained tenant-scoped **Intelligence** metrics and **Business activities** work orders for multiple industry types. This is a cross-sector workflow layer, not a claim of finished bespoke legal/financial features for each industry.
- AI context can include authorized **aggregate** data for ordinary configured services. Free trial providers never receive prior chat history or tenant database summaries by default; the new question itself is still sent to the selected provider.
- Additive migration: `sql/rawi-activities.sql`, plus provider CHECK-constraint updates in `sql/mif-saas.sql`. Apply migrations only after backups and validation.
- Public demo does not run paid workflows without real Worker secrets, database binding, an active subscription and genuine provider credentials/bindings.
- **Identity assets (RAWI icon and MIF company identity) are unchanged in 7.1.**

## Release 7.3 — completing operational onboarding and tenant management

- New Enterprise and Developers registrations create an owned workspace, profile, template and an **internal evaluation entitlement** atomically. Evaluation defaults to 7 days and 30 messages, configurable through `RAWI_TRIAL_DAYS` (1–30) and `RAWI_TRIAL_MESSAGE_LIMIT` (1–500). This does not create external AI provider credits. The owner can change or deactivate the evaluation plan in MIF Smart.
- Authentication attempts are throttled with database-atomic counters; no raw IP address or email is stored in those counters.
- RAWI account screen shows the actual per-workspace message balance and plan status. Registration UI reports when public registration is disabled.
- Owners can add **existing registered RAWI users** to an organization, assign Administrator or Read-only roles, change permissions or revoke access. The owner role cannot be assigned or revoked through that API. Email invitations and verification are not yet implemented.
- Odoo Developers can edit connection settings and rotate credentials, paginate module inventories and reassign or unlink implementations without corrupting related records. Connection deletion respects project links and cleans diagnostic history.
- MIF Smart owner console audits production configuration (DB, sessions, encryption, provider keys, registration, owner identity, plans and site origin) without revealing secrets.
- Configuration examples no longer include obsolete checkout integrations.

## Deployment blockers — do not confuse a preview with a production ERP

The GitHub workflow publishes a **temporary Cloudflare preview** when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are absent. A permanent hostname, persistent secure Worker bindings, real AI provider account credentials and a verified email sending service must be configured separately. Do not switch public registration on before implementing production email verification and abuse safeguards. No automated recurring payment collection has been implemented.

Advanced ERP vertical compliance, bank reconciliation, e-invoicing/ZATCA integration, full statutory payroll, country-specific legal requirements, on-server Odoo deployment, and real client acceptance testing are **not complete**. Their implementation depends on requirements, real access and domain validation, not just interface scaffolding.

## RAWI 8.0 — Separate Enterprise and Developer applications

Three independently routed software surfaces are now managed by **MIF Smart SaaS**:

| Surface | Route | Approved identity | Purpose |
| --- | --- | --- | --- |
| MIF Smart company and SaaS | `/mif`, `/mif/console` | Original MIF identity | Website, products, SaaS plans, tenants and AI providers |
| **RAWI Enterprise** | `/` (and `/enterprise`) | Original **orange** RAWI icon `public/rawi-mark.svg` | ERP company operations, business AI, customers, purchases/sales, inventory, projects, payroll foundation |
| **RAWI Developer** | `/developer/` | Same RAWI symbol, separate **black background / yellow foreground** `public/rawi-developer-mark.svg` | Odoo integrations, read-only verification, module scaffolding, diagnostics, implementation tracking and Odoo engineering AI |

Enterprise logo/style/manifest remain unchanged. Developer has its **own app JSX/CSS**, login/registration UI, independent PWA manifest ID/scope/start URL, scoped service worker, separate desktop Electron packaging config and independent product in the MIF website catalog. Sessions are served by the same securely authenticated platform, while client application type is enforced in authorization, trial-plan assignment and AI quota usage.

### Separate SaaS management
The `mif_subscription_plans.application` field binds pricing and usage quotas to either `enterprise` or `developer`. A tenant cannot be assigned a subscription for the wrong app. Developer signup receives a separately code-named **internal trial** `rawi-developer-evaluation`; Enterprise retains `rawi-evaluation`. Neither creates a credit balance with external model providers. AI model credentials and allocations remain managed by MIF Smart centrally; the Developer assistant uses a distinct Odoo-specialist policy, with tenant-scoped and credential-free integration diagnostics.

### Developer platform adapters
The supported platform registry lives in `api/rawi-platform-registry.js`; only Odoo is currently enabled. Future system types will require a separately reviewed adapter, authentication, validation, module deployment method and security tests before activation. Developer Studio also supports an AI-assisted natural-language **addon specification proposal**, validated with strict field/schema rules and charged against Developer quota, followed by an editable downloadable ZIP. Basic Odoo module ZIP generation is **not** automated remote installation; no server file-system access or customer code execution is claimed.

### Installable clients
- Independent **PWA** installs: `/manifest.webmanifest` for Enterprise; `/developer/manifest.webmanifest` for Developer. Browsers identify them as different apps.
- Independent desktop package configuration: `apps/desktop` for Enterprise and `apps/developer-desktop` for Developer, with separate product IDs. Desktop binaries need a verified permanent HTTPS endpoint; signing and platform-specific icon bundles are still required before public distribution.
- App-store native mobile binaries, developer OS-native icon formats and secure native cross-origin authentication are not finished. PWA installation is the browser-supported mobile/desktop option today.

### Production blockers
Temporary Cloudflare previews do **not** contain the production secret bindings by default. To use the SaaS and Developer AI/Odoo workflows live, configure the permanent Cloudflare account, dedicated Neon `DATABASE_URL`, session/encryption secrets, platform owner identity, provider credentials/AI binding and validated external Odoo API access. Self-registration remains disabled by default pending verification and abuse controls. Automated recurring billing, fiscal and payroll compliance, real Odoo server-side module deployment, and legally approved customer terms have not been verified or implemented as production-ready modules. The product must not be described as complete for regulated financial processing solely on the strength of UI or unit tests.

## 8.1 verified improvements — no brand or color changes

- Enterprise and Developer registration: fixed an account-type variable ordering defect that prevented new subscriptions from being assigned correctly. Live sign-up remains disabled until actual Cloudflare secrets, secure domain, and email verification are configured.
- MIF corporate owner SaaS: website inquiries now have internal notes, next follow-up date, chronological actor-stamped change history, and delivery status. Record creation remains durable even if optional transactional email sending fails.
- Resend mail notifications are **opt-in**: configure `RESEND_API_KEY`, a verified `MAIL_FROM`, and `MIF_INQUIRY_NOTIFY_EMAIL`. Unconfigured mail is never marked sent.
- MIF public website: both Enterprise and Developer product previews render even before Neon is connected. Production-only sitemap at `/sitemap.xml`, descriptive public product metadata, canonical links and OG fields require a real HTTPS `SITE_ORIGIN` matching the request origin. Temporary Cloudflare preview pages remain noindex.
- Android/iOS **debug build** workflows now target an explicitly supplied public HTTPS server where session cookies and APIs share an origin. Added separate Developer Android and Developer iOS simulator workflows, unique app identifiers, and generated raster launcher icons derived only from approved brand SVGs. These are test wrappers, not signed mobile-store releases, and remote-content loading requires a secured server.
- Database additive migration: `sql/mif-inquiry-workflow.sql`.
- Duplicate legacy Developer website card and a misclassified evaluation plan were archived/deactivated **without deleting their records** from the project database. Exactly one active canonical Developer product/plan remains.
- Original RAWI Enterprise orange, RAWI Developer black/yellow, and MIF Smart corporate identity sources are not changed.

**Not production complete yet:** permanent Cloudflare binding and domain, real AI provider credentials, verified email identity and signup flow, paid recurring subscription provider and webhook reconciliation, actual Odoo account for connector acceptance tests, complete industry-specific statutory accounting/HR/e-invoicing requirements, and signed store releases. Unit/build and preview deployment results cannot substitute for real account end-to-end tests.

## 8.2 — AI-first company website and requested Odoo Community product

- The `/mif` hero now contains a **real API-backed** AI interaction panel, using the existing rate-limited `/api/chat/public` route; it does not show simulated AI answers. Anonymous AI remains unavailable until `PUBLIC_CHAT_ENABLED=true`, `DATABASE_URL`, `SESSION_SECRET` and an enabled working provider are configured. Each visitor question is processed independently; users are warned not to submit sensitive data.
- The approved company/RAWI Enterprise/RAWI Developer identities and original colors are unchanged.
- `Odoo Community المطوّر` (Enhanced Odoo Community) is explicitly offered by its correct product name as a scoped implementation/customization service. No unsupported Enterprise licenses, prices, automatic deployments or fictitious capabilities are claimed. Its product page routes to a preselected inquiry, not into the RAWI application.
- Run `npm run db:migrate` to idempotently seed the new published product in the connected database. A preview or successful build does not mean production AI, email verification, checkout or legal compliance is live.

### Website AI attribution and accounting

The public `/mif` AI calls now use a company-specific, public-information-only system policy rather than the private RAWI Enterprise assistant persona. Successful replies are recorded in `mif_ai_usage` with null tenant and actor (no raw visitor IP), so owner analytics include real website model consumption. The deployment audit identifies whether the public assistant is actually configured and enabled.
