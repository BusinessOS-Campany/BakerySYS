-- Remove all purchasing documents and their balances. Forward-only.
-- Ingredient stock/lots/movements and posted accounting journals are kept:
-- they are inventory and accounting history, not purchasing documents.

DELETE FROM "purchase_request_items";
DELETE FROM "purchase_requests";
DELETE FROM "purchase_order_items";
DELETE FROM "purchase_orders";
DELETE FROM "goods_receipt_items";
DELETE FROM "goods_receipts";
DELETE FROM "supplier_payments";
DELETE FROM "supplier_invoices";
DELETE FROM "supplier_payables";
DELETE FROM "purchase_return_items";
DELETE FROM "purchase_returns";

-- Notifications pointing at the removed /purchases page would be dead links.
DELETE FROM "notifications" WHERE "kind" = 'PURCHASING';
