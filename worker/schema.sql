-- Schema for Azera Trash Mail database
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  inbox TEXT NOT NULL,
  sender TEXT NOT NULL,
  sender_name TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at INTEGER NOT NULL
);

-- Indices to speed up queries
CREATE INDEX IF NOT EXISTS idx_emails_inbox ON emails(inbox);
CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at);
