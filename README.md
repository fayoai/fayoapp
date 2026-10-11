# MIF Smart AI ERP — v5.0

**One application. One purpose: AI ERP.** No public website, product storefront, marketing pages, checkout, lead forms, or catalog. The root URL launches the secured ERP experience; all former public website paths resolve to that application.

## Modules delivered in the codebase

- AI assistant, backed by OpenAI Responses API after explicit API-key setup; records remain workspace scoped, and sensitive credentials use server-side AES-GCM.
- Organization workspaces and membership permissions, customers, people and vendors.
- Sales and purchase documents with controlled status transitions and validated catalogued ERP inventory items.
- Stock items, warehouses, stock balances and immutable movement history, with atomic rejection of negative stock.
- Chart of accounts and validated balanced general journal entries.
- Business invoicing, invoice templates, seller identity, printing and payment status (not statutory e-invoicing certification).
- Employees, projects, expense claims with approvals, due tasks and scheduled task events.
- Reports for sales, purchases, payroll salary totals, stock, journal balances and expenses.
- Knowledge base, email sending and optional read-only import integrations for Odoo, ERPNext and Zoho.

This code is a substantial **ERP foundation**, not a claim that every possible industry workflow, statutory payroll requirement, POS fiscal device, manufacturing/MRP process, banking feed or country-specific e-invoicing certification is already implemented. Integration accounts and their permissions need testing against actual providers.

## Architecture

Frontend: React 19/Vite, responsive Arabic RTL and English LTR, installable PWA and Capacitor/Electron shells. Backend: Hono on Cloudflare Workers. Database: dedicated Neon PostgreSQL `mif_smart` (not the Aseel Tech or FAYO data plane). All operational APIs are authenticated and workspace-scoped.

The application requires **production Cloudflare ownership** and Worker secrets: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_BOOTSTRAP_TOKEN` and `CONNECTOR_ENCRYPTION_KEY`. Optional providers: `OPENAI_API_KEY`, `OPENAI_MODEL`, `RESEND_API_KEY`, `MAIL_FROM`. For the current database, schema changes were applied separately; on a fresh database run `npm run db:migrate`.

See [AI_ERP_SETUP_AR.md](AI_ERP_SETUP_AR.md) for setup instructions.

## Run and validate

```bash
npm install
npm run check
npm run dev
```

The store/marketing code is removed from this branch. Old commerce database records are disabled and retained only as historical data rather than being destructively deleted. The AI assistant may read limited authorized business context but does not silently execute financial or operational changes.

**Cloudflare temporary preview URLs are not a durable business deployment.** Use your own Cloudflare account, correctly configured GitHub Actions secrets and managed Neon URL.
