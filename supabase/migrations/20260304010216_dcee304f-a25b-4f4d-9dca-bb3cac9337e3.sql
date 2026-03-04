ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS storage_location text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manufacturing_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expiry_date date DEFAULT NULL;