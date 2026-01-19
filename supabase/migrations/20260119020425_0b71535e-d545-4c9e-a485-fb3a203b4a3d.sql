-- Remove the public SELECT policy that allows anyone to view logos
DROP POLICY IF EXISTS "Public can view logos" ON storage.objects;

-- Ensure bucket is private
UPDATE storage.buckets SET public = false WHERE id = 'company-logos';

-- Add authenticated user policy for viewing their own logos
CREATE POLICY "Authenticated users can view their own logos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);