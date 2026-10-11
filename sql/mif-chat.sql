-- MIF Smart customer conversations and signup controls
CREATE TABLE IF NOT EXISTS mif_chat_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
 title text NOT NULL DEFAULT 'محادثة جديدة',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mif_chat_threads_owner ON mif_chat_threads(owner_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS mif_chat_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 thread_id uuid NOT NULL REFERENCES mif_chat_threads(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('user','assistant')),
 content text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mif_chat_messages_thread ON mif_chat_messages(thread_id,created_at,id);
CREATE TABLE IF NOT EXISTS mif_registration_attempts (
 id bigserial PRIMARY KEY,
 client_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mif_registration_attempts_key_time ON mif_registration_attempts(client_key,created_at DESC);
