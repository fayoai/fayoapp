# MIF Smart 8.0 — Corporate SaaS, RAWI Enterprise and RAWI Developers

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

## Version 8.0: two genuinely separate client applications

**The company MIF Smart is the owner SaaS and corporate website, not a client app.**

| Surface | URL | Identity | Purpose |
| --- | --- | --- | --- |
| MIF Smart | `/mif`, `/mif/console` | Existing original corporate logo | Product catalog, owner administration, SaaS subscriptions and AI provider configuration |
| RAWI Enterprise | `/` | **Original orange icon and UI unchanged** | Business ERP, invoices, CRM, accounting, inventory, HR, projects and AI assistance |
| RAWI Developers | `/developers/` | **Black background, approved RAWI glyph in yellow** | Standalone Odoo engineering app, Odoo API connectors, modules, implementations, diagnostics, AI engineering chat |

The two products have different PWA install identities, manifests, browser service-worker scopes, login/register screens, navigation, icon branding, route handling and server-side permissions. They share the authorized SaaS authentication/Neon infrastructure only; being logged into one product does **not** confer authorization to the other. A Developers account cannot access Enterprise ERP operation routes. Developer AI context includes only permitted Odoo and implementation aggregates.

- Original asset `public/rawi-mark.svg` was **not touched**. The Developers icon at `public/developers/rawi-dev-mark.svg` reuses exactly the same vector glyph with colors changed only in that new asset to `#ffd637` on `#080808`.
- Developer PWA: `public/developers/manifest.webmanifest`, start `/developers/`, scope `/developers/`, separate service worker that never caches authenticated customer/API data.
- Enterprise PWA `public/manifest.webmanifest` and the original `/` application are preserved.
- Optional independent unsigned desktop wrapper for Windows/macOS/Linux: `apps/desktop-developers` and `.github/workflows/apps-desktop-developers.yml`, with a dedicated Electron app identifier and generated icon. Requires verified, permanent HTTPS deployment; native binaries are not signed or published until corresponding certificates and workflow setup exist.
- MIF Smart catalog includes **two separately manageable products**. Enterprise and Developer SaaS plans are product-specific; their free internal evaluation quotas are separate. No external AI provider credit or paid customer price is invented.
- Developer application is **Odoo only at this stage**; future systems would need individually implemented, tested adapters and permissions, not just a UI menu.

**Deployment limitations:** Temporary Cloudflare Workers previews are not a permanent authenticated production deployment. Real interactive registration, chat AI and Odoo connections require production secrets, an active provider account and valid Odoo API credentials. Odoo module generator produces installable *basic scaffolds* for review and staging but does not remotely deploy production add-ons, execute repairs, or grant database/server privileges. Full statutory tax, payroll, e-invoicing, sophisticated accounting, SSO/MFA, electronic signature, verified email onboarding, production mobile store releases and recurring automated billing are **not complete**; they need additional implementation and outside integrations before commercial launch.
