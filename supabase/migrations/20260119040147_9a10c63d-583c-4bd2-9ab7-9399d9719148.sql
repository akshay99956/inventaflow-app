-- Make the company-logos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'company-logos';

-- Drop any existing public SELECT policy on company-logos
DROP POLICY IF EXISTS "Public can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view company logos" ON storage.objects;

-- Create restrictive SELECT policy - only authenticated users can view their own logos
CREATE POLICY "Authenticated users can view their own company logos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'company-logos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);