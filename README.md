# MIF Smart

Approved project scope: **MIF Smart corporate website / owner SaaS** plus **RAWI ERP** as the only active customer application. Do not add an active application without an explicit product approval.

## Approved product catalogue

| Family | Product | State |
| --- | --- | --- |
| RAWI AI | RAWI ERP | Active |
| RAWI AI | RAWI Dev (Odoo development) | Coming soon |
| RAWI AI | RAWI Copilot (Odoo, Gmail, Outlook) | Coming soon |
| Odoo | Developed Odoo Community | Coming soon |
| Odoo | Odoo SaaS for partners | Coming soon |
| Odoo | Odoo My SaaS | Coming soon |
| Marketing | Website creation, SEO, digital marketing, WhatsApp | Coming soon |

All six inactive products are **catalogue entries only**, with no active app, registration, deployment, navigation route or dedicated Worker.

## RAWI ERP

Approved blue icon with white mark (`public/rawi-erp-mark.svg`). Chat-first interface: RAWI opens by typing «كيف أقدر أساعدك اليوم؟» as an assistant message. Five fixed bottom actions: المحادثات / العمليات / جديد (prominent center action) / الجدولة / حسابي. Registration, login and app install are inside حسابي.

The application requires authorized company membership and a correctly initialized company-specific Neon database to access ERP data. Do not display fake operations or claim financial/legal compliance without verification.

## Deploy

Active Cloudflare Workers:
- MIF Smart website and SaaS: `mif-smart-platform` at `/mif`, `/mif/console`.
- RAWI ERP: `rawi-enterprise` (legacy Worker name only; commercial product is RAWI ERP).

Run `npm install && npm run check` for CI; the GitHub workflow deploys only these two Workers. `npm run db:migrate` applies central schema migrations to the configured Neon project. Tenant schemas are generated with `npm run db:tenant:schema`.

**Production gating:** Cloudflare HTML/route success is not sufficient. Real Neon, JWT session, AI providers, tenant schema and authorized read/write must be verified. Registration remains closed unless the owner enables it with verified secrets and invitations. Never commit secrets.

For exact product and UI rules consult [RAWI_ERP_APPROVED_DESIGN_AR.md](RAWI_ERP_APPROVED_DESIGN_AR.md) and [MIF_SMART_PRODUCTS_DESIGN_LOCK_AR.md](MIF_SMART_PRODUCTS_DESIGN_LOCK_AR.md).

## Rawi database isolation rollout (pending activation)

The same repository deploys `mif-smart-platform` and `rawi-enterprise` as **separate Cloudflare Workers**.
MIF continues using the `mif_smart` Neon control database. RAWI's target Neon project is
`withered-night-28458135` with the `rawi_control` database and one database per customer.

Before merging the isolation PR, configure the **GitHub Actions secret**
`MIF_RAWI_DATABASE_URL` with the new project's `rawi_control` connection URL.
The deployment sends this secret **only** to the RAWI Worker as `RAWI_DATABASE_URL`;
it must never appear in source files or the MIF Worker.

Tenant routing requires the registry's project and branch to match those configured
for the RAWI Worker, and switches to RAWI database credentials only for migrated tenants.
Legacy tenants stay on their existing databases until their entries are explicitly
cut over. Existing MIF subscription and login services remain central.

**Not production-ready:** the historical company schema generator still includes
some MIF tables; its migration path into the new RAWI project is blocked. Before
switching tenant registry rows, implement RAWI-only migrations and test account access,
company profiles, read/write, chat drafts, approvals, schedules and rollback.
Do not delete the old tenant databases before data and rollback validation.
