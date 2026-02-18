
-- =============================================
-- Document otp_verifications table in migrations
-- =============================================
-- Table already exists, ensure RLS is enabled
ALTER TABLE IF EXISTS public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policy - OTP operations should be server-side only
DROP POLICY IF EXISTS "Users can view their own OTP records" ON public.otp_verifications;

-- No client-side policies needed. Service role bypasses RLS for edge functions.

-- =============================================
-- Document user_pins table in migrations  
-- =============================================
-- Table already exists, ensure RLS is enabled
ALTER TABLE IF EXISTS public.user_pins ENABLE ROW LEVEL SECURITY;

-- Drop SELECT policy - users should never read pin_hash directly
-- All PIN operations go through SECURITY DEFINER RPC functions
DROP POLICY IF EXISTS "Users can view their own PIN record" ON public.user_pins;

-- Keep INSERT and UPDATE policies since they're used during signup
-- (RPC functions use SECURITY DEFINER and bypass RLS anyway)
