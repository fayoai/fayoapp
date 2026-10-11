# MIF Smart 6.1 — RAWI

**MIF Smart** is the company and application identity. **RAWI (راوي)** is the AI assistant.

The customer application is chat-first, with accessible guest previews for **Operations**, **Calendar** and **Account**. Previews never reveal or mutate actual customer records. Registered customers have secured, workspace-scoped operational data and private conversations.

An **owner-only SaaS console** manages organizations, subscription plans, entitlement periods, message quotas, approved AI providers and token usage. The current supported model-provider adapters are OpenAI, Anthropic Claude and Google Gemini. API keys are stored only server-side; keys saved from the console are encrypted.

No legacy storefront, Odoo sales catalog or marketing site is part of this interface. There is no automatic subscription charging yet.

Run `npm install && npm run check` to test/build the source. Run `npm run db:migrate` using the dedicated MIF Smart Neon database for complete schema provisioning. Deployment also requires real server-side secrets and verified connectivity. See `MIF_SMART_SETUP_AR.md`.
