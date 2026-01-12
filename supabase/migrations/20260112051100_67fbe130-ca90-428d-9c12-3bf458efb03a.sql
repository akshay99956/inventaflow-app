-- Make company-logos bucket private and remove public view policy
UPDATE storage.buckets SET public = false WHERE id = 'company-logos';

-- Drop the public view policy
DROP POLICY IF EXISTS "Public can view logos" ON storage.objects;

-- Create a new policy that allows authenticated users to view logos in their own folder
CREATE POLICY "Users can view their own logos" ON storage.objects 
FOR SELECT TO authenticated
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);