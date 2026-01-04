-- Update bills table to support purchase order workflow with 'pending' and 'received' statuses
-- Change default status from 'active' to 'pending' for new purchase orders

ALTER TABLE public.bills 
ALTER COLUMN status SET DEFAULT 'pending';

-- Add a comment to clarify the status values
COMMENT ON COLUMN public.bills.status IS 'Purchase order status: pending (awaiting receipt), received (stock updated), cancelled';