-- Invite-only onboarding to prevent unauthenticated Neon database resource abuse.
CREATE TABLE IF NOT EXISTS mif_tenant_invitations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL,
 application text NOT NULL CHECK(application IN ('enterprise','developer')),
 token_hash text NOT NULL UNIQUE,
 invited_by uuid NOT NULL REFERENCES admins(id),
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 used_by uuid REFERENCES admins(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(expires_at>created_at)
);
CREATE INDEX IF NOT EXISTS mif_tenant_invitations_email ON mif_tenant_invitations(lower(email),application,expires_at);
