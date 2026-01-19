-- Add CHECK constraints for server-side input validation

-- Products table: ensure non-negative values
ALTER TABLE public.products 
  ADD CONSTRAINT products_positive_quantity CHECK (quantity >= 0),
  ADD CONSTRAINT products_positive_unit_price CHECK (unit_price >= 0),
  ADD CONSTRAINT products_positive_purchase_price CHECK (purchase_price >= 0),
  ADD CONSTRAINT products_positive_low_stock_threshold CHECK (low_stock_threshold >= 0);

-- Invoice items: ensure positive quantities and non-negative prices/amounts
ALTER TABLE public.invoice_items 
  ADD CONSTRAINT invoice_items_positive_quantity CHECK (quantity > 0),
  ADD CONSTRAINT invoice_items_positive_unit_price CHECK (unit_price >= 0),
  ADD CONSTRAINT invoice_items_positive_amount CHECK (amount >= 0);

-- Bill items: ensure positive quantities and non-negative prices/amounts
ALTER TABLE public.bill_items 
  ADD CONSTRAINT bill_items_positive_quantity CHECK (quantity > 0),
  ADD CONSTRAINT bill_items_positive_unit_price CHECK (unit_price >= 0),
  ADD CONSTRAINT bill_items_positive_amount CHECK (amount >= 0);

-- Invoices: ensure non-negative totals
ALTER TABLE public.invoices 
  ADD CONSTRAINT invoices_positive_subtotal CHECK (subtotal >= 0),
  ADD CONSTRAINT invoices_positive_tax CHECK (tax >= 0),
  ADD CONSTRAINT invoices_positive_total CHECK (total >= 0);

-- Bills: ensure non-negative totals
ALTER TABLE public.bills 
  ADD CONSTRAINT bills_positive_subtotal CHECK (subtotal >= 0),
  ADD CONSTRAINT bills_positive_tax CHECK (tax >= 0),
  ADD CONSTRAINT bills_positive_total CHECK (total >= 0);

-- Transactions: ensure positive amounts
ALTER TABLE public.transactions 
  ADD CONSTRAINT transactions_positive_amount CHECK (amount >= 0);

-- User settings: ensure valid ranges
ALTER TABLE public.user_settings 
  ADD CONSTRAINT settings_valid_tax_rate CHECK (default_tax_rate >= 0 AND default_tax_rate <= 100),
  ADD CONSTRAINT settings_valid_payment_terms CHECK (default_payment_terms >= 0),
  ADD CONSTRAINT settings_valid_items_per_page CHECK (items_per_page > 0 AND items_per_page <= 100);