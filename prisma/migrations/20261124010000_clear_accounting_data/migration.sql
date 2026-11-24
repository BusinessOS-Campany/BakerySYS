-- Remove all posted journal entries and their lines. Forward-only.
-- The chart of accounts, cash accounts and fiscal periods are intentionally kept:
-- POS, sales, expenses and orders resolve accounts by code when posting new journals.
--
-- The bakery_guard_* triggers enforce journal immutability during normal operation.
-- Disable them only for this one-time cleanup, then re-enable them.

ALTER TABLE "journal_lines" DISABLE TRIGGER "journal_lines_immutable";
ALTER TABLE "journal_entries" DISABLE TRIGGER "journal_entries_immutable";

DELETE FROM "journal_lines";
DELETE FROM "journal_entries";

ALTER TABLE "journal_entries" ENABLE TRIGGER "journal_entries_immutable";
ALTER TABLE "journal_lines" ENABLE TRIGGER "journal_lines_immutable";
