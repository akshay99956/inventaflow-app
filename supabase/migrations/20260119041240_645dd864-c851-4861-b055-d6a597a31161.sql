-- Enable pgcrypto for secure PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create user_pins table to store hashed PINs
CREATE TABLE public.user_pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_pins ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own PIN
CREATE POLICY "Users can view their own PIN record"
ON public.user_pins FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own PIN"
ON public.user_pins FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PIN"
ON public.user_pins FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create OTP verifications table for PIN recovery
CREATE TABLE public.otp_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mobile TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view their own OTP records
CREATE POLICY "Users can view their own OTP records"
ON public.otp_verifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Function to hash a PIN securely
CREATE OR REPLACE FUNCTION public.hash_pin(pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN crypt(pin, gen_salt('bf', 8));
END;
$$;

-- Function to verify a PIN
CREATE OR REPLACE FUNCTION public.verify_pin(user_uuid UUID, input_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT pin_hash INTO stored_hash FROM public.user_pins WHERE user_id = user_uuid;
  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN stored_hash = crypt(input_pin, stored_hash);
END;
$$;

-- Function to set/update a user's PIN
CREATE OR REPLACE FUNCTION public.set_user_pin(user_uuid UUID, new_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hashed TEXT;
BEGIN
  hashed := crypt(new_pin, gen_salt('bf', 8));
  INSERT INTO public.user_pins (user_id, pin_hash, updated_at)
  VALUES (user_uuid, hashed, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET pin_hash = hashed, updated_at = now();
  RETURN TRUE;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_user_pins_updated_at
BEFORE UPDATE ON public.user_pins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();