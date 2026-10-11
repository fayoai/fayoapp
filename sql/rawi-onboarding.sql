-- RAWI account protection. All identifiers are HMAC-like SHA256 digests generated on the server; never store passwords or raw IPs.
CREATE TABLE IF NOT EXISTS rawi_auth_rate_limits(
 client_key text NOT NULL,
 bucket text NOT NULL CHECK(bucket IN('registration','login')),
 hits integer NOT NULL DEFAULT 0 CHECK(hits>=0),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(client_key,bucket)
);
CREATE INDEX IF NOT EXISTS rawi_auth_rate_limits_expiry ON rawi_auth_rate_limits(expires_at);
