ALTER TABLE orders
  ADD COLUMN midtrans_checkout_url text,
  ADD COLUMN midtrans_transaction_id text,
  ADD COLUMN midtrans_status text;

CREATE UNIQUE INDEX idx_order_payments_midtrans_order
  ON order_payments(order_id) WHERE provider = 'midtrans';

-- Preserve manual payments already submitted for review and historical sales.
UPDATE orders o SET payment_provider = 'midtrans'
 WHERE learning_mode = 'self_learning' AND payment_provider = 'manual_transfer'
   AND status = 'pending_payment'
   AND NOT EXISTS (SELECT 1 FROM order_payments p WHERE p.order_id = o.id);
