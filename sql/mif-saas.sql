-- RAWI / MIF Smart management. No billing/provider keys are seeded.
CREATE TABLE IF NOT EXISTS mif_ai_providers(
 code text PRIMARY KEY CHECK(code IN ('openai','anthropic','gemini')),
 model text NOT NULL,
 encrypted_key text NOT NULL DEFAULT '',
 enabled boolean NOT NULL DEFAULT false,
 priority integer NOT NULL DEFAULT 100 CHECK(priority BETWEEN 1 AND 999),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mif_subscription_plans(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text UNIQUE NOT NULL CHECK(code ~ '^[a-z0-9-]{2,40}$'),
 title text NOT NULL,
 cycle text NOT NULL CHECK(cycle IN ('monthly','yearly')),
 price_halalas bigint NOT NULL CHECK(price_halalas>=0),
 message_limit integer NOT NULL CHECK(message_limit BETWEEN 1 AND 1000000),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mif_tenant_subscriptions(
 workspace_id uuid PRIMARY KEY REFERENCES erp_workspaces(id) ON DELETE CASCADE,
 plan_id uuid NOT NULL REFERENCES mif_subscription_plans(id),
 status text NOT NULL DEFAULT 'trial' CHECK(status IN ('trial','active','past_due','suspended','cancelled')),
 messages_used integer NOT NULL DEFAULT 0 CHECK(messages_used>=0),
 period_starts_at timestamptz NOT NULL DEFAULT now(),
 period_ends_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(period_ends_at>period_starts_at)
);
CREATE TABLE IF NOT EXISTS mif_ai_usage(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid REFERENCES erp_workspaces(id) ON DELETE SET NULL,
 actor_id uuid REFERENCES admins(id) ON DELETE SET NULL,
 provider text NOT NULL CHECK(provider IN ('openai','anthropic','gemini')),
 model text NOT NULL,
 input_tokens integer NOT NULL DEFAULT 0,
 output_tokens integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mif_ai_usage_tenant_date ON mif_ai_usage(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS mif_ai_usage_provider_date ON mif_ai_usage(provider,created_at DESC);

-- Add external and Cloudflare-hosted trial inference providers without losing existing settings.
ALTER TABLE mif_ai_providers DROP CONSTRAINT IF EXISTS mif_ai_providers_code_check;
ALTER TABLE mif_ai_providers ADD CONSTRAINT mif_ai_providers_code_check CHECK(code IN ('openai','anthropic','gemini','groq','openrouter','workers_ai'));
ALTER TABLE mif_ai_usage DROP CONSTRAINT IF EXISTS mif_ai_usage_provider_check;
ALTER TABLE mif_ai_usage ADD CONSTRAINT mif_ai_usage_provider_check CHECK(provider IN ('openai','anthropic','gemini','groq','openrouter','workers_ai'));
