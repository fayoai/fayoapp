-- MIF Smart AI ERP authentication and authorization base
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS admins(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL UNIQUE,
 password_hash text NOT NULL,
 salt text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
