# MIF Smart 7 — Corporate SaaS + RAWI AI ERP

**Two different brands and product surfaces.**

- **MIF Smart** is the company, its public website (`/mif`), its products catalogue and its owner SaaS console (`/mif/console`). The company identity uses its original orange logo.
- **RAWI | راوي** is an independent AI-powered ERP product, available at `/`. RAWI uses its own purple/teal emblem and name, including the installable PWA/native shells. RAWI is the first registered company product, not an MIF brand alias.

### RAWI features available in code

Tenant-scoped client management, sales/purchase documents, inventory and stock movements, accounting chart and journal, invoices, contacts, employees, projects, expenses, reports, calendar/tasks, integrations, conversations and CRM pipeline. Version 7 adds basic monthly payroll snapshots and incoming/outgoing payment records. Multiple workspaces are selectable in AI conversations and charged against the matching plan.

**Important:** These are implemented application components, **not** a certification of production-grade enterprise accounting, statutory payroll, fiscal compliance, payment reconciliation, enterprise procurement, or complete ERP industry coverage. They require further domain validation and live acceptance testing before real financial processing.

### MIF Smart features available in code

A corporate marketing website with editable identity, SEO, contact data, product pages and published content pages. Owner-only console includes product and website management, incoming enquiries, SaaS subscriptions, AI provider configuration (OpenAI/Anthropic/Gemini), AI usage reports and Neon PostgreSQL health diagnostics. Only RAWI is seeded as a product.

### Deploy

- `npm install && npm run check` verifies unit tests and Vite build.
- `npm run db:migrate` requires the **dedicated MIF Smart Neon** database. Additive migrations include `sql/mif-website.sql`, `sql/rawi-advanced.sql` and `sql/rawi-chat-isolation.sql`.
- Configure Worker secrets: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_BOOTSTRAP_TOKEN`, `CONNECTOR_ENCRYPTION_KEY`, `PLATFORM_OWNER_EMAIL`. Model credentials are server-side.
- Public /mif pages are indexable; RAWI customer workspace and /mif/console must remain unindexed.
- Account registration and public AI chat are disabled until actively enabled. Preview access does not bypass protected tenant/API routes.

**Not yet integrated:** automatic recurring payment collection for SaaS, legal/privacy terms, production email verification, real tenant DB provisioning, full financial reconciliation and statutory localization. Do not market any of these as complete without a provider integration and live tests.

See `MIF_SMART_SETUP_AR.md`.
