-- Fix storage.objects policies to explicitly require authenticated role
-- The "Public can view logos" policy is intentional for invoice/bill sharing

-- Drop and recreate the upload/update/delete policies with explicit authenticated role
DROP POLICY IF EXISTS "Users can upload their own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own logo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own logo" ON storage.objects;

-- Recreate with explicit TO authenticated clause
CREATE POLICY "Authenticated users can upload their own logo" ON storage.objects 
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can update their own logo" ON storage.objects 
FOR UPDATE TO authenticated
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can delete their own logo" ON storage.objects 
FOR DELETE TO authenticated
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);