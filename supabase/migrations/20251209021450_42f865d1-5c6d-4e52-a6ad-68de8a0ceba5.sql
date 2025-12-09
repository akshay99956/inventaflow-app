-- Add status column to bills table
ALTER TABLE public.bills 
ADD COLUMN status text NOT NULL DEFAULT 'active';

-- Add check constraint for valid status values
ALTER TABLE public.bills 
ADD CONSTRAINT bills_status_check CHECK (status IN ('active', 'cancelled'));