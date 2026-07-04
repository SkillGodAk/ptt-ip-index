CREATE TABLE IF NOT EXISTS index_requests (
  user_id TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  indexed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_index_requests_status_requested
ON index_requests(status, last_requested_at);
