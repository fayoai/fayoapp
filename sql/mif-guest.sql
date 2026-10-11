CREATE TABLE IF NOT EXISTS mif_guest_usage(
 client_key text NOT NULL,
 bucket text NOT NULL CHECK(bucket IN('minute','day')),
 hits integer NOT NULL DEFAULT 0,
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(client_key,bucket)
);
CREATE INDEX IF NOT EXISTS mif_guest_usage_expires ON mif_guest_usage(expires_at);
