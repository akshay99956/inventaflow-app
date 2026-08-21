-- Explicit deny-all policies documenting that OTP records are never client-accessible
CREATE POLICY "No direct client access to OTP records (authenticated)"
ON public.otp_verifications
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "No direct client access to OTP records (anon)"
ON public.otp_verifications
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.hash_pin(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_user_pin(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_pin(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_user_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hash_pin(text) TO service_role;