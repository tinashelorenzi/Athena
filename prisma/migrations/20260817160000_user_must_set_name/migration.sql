-- Bulk-created accounts must set their name (+ optional password) on first login.
ALTER TABLE "users" ADD COLUMN "mustSetName" BOOLEAN NOT NULL DEFAULT false;
