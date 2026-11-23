-- Follow-up to 20261123016000: remove remaining sale-related customer subledger
-- entries (including sale returns), which no longer have a source document.
-- Forward-only; earlier migrations are untouched.

DELETE FROM "customer_receivables" WHERE "sourceType" IN ('SALE', 'SALE_RETURN');
DELETE FROM "customer_transactions" WHERE "sourceType" IN ('SALE', 'SALE_RETURN');
