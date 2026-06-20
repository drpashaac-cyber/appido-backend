-- P17: registry-driven payment gateways.
-- Make payment_credentials.method free-form text so adding a brand-new gateway needs only a
-- registry entry (no enum migration). Valid methods are now enforced by the payments registry.
ALTER TABLE payment_credentials ALTER COLUMN method TYPE text USING method::text;
