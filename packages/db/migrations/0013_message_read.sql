-- P17: inbox read state (precise unread) + operator manual replies (human-authored messages).
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS messages_unread_idx ON messages (customer_id) WHERE direction = 'in' AND read_at IS NULL;
