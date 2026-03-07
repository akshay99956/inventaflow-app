CREATE POLICY "No direct SELECT access to PIN hashes"
ON public.user_pins
FOR SELECT
TO authenticated
USING (false);