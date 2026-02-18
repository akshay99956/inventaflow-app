
-- Recreate PIN management RPC functions with proper auth checks and input validation

CREATE OR REPLACE FUNCTION public.hash_pin(pin text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate PIN format (6 digits)
  IF pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid PIN format: must be exactly 6 digits';
  END IF;
  RETURN crypt(pin, gen_salt('bf', 8));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_pin(user_uuid uuid, new_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  hashed TEXT;
BEGIN
  -- CRITICAL: Verify the caller owns this user_uuid
  IF auth.uid() IS NULL OR auth.uid() != user_uuid THEN
    RAISE EXCEPTION 'Unauthorized: cannot set PIN for another user';
  END IF;

  -- Validate PIN format (6 digits)
  IF new_pin !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Invalid PIN format: must be exactly 6 digits';
  END IF;

  hashed := crypt(new_pin, gen_salt('bf', 8));
  INSERT INTO public.user_pins (user_id, pin_hash, updated_at)
  VALUES (user_uuid, hashed, now())
  ON CONFLICT (user_id)
  DO UPDATE SET pin_hash = hashed, updated_at = now();
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_pin(user_uuid uuid, input_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  -- CRITICAL: Verify the caller owns this user_uuid
  IF auth.uid() IS NULL OR auth.uid() != user_uuid THEN
    RETURN FALSE;
  END IF;

  -- Validate PIN format
  IF input_pin !~ '^[0-9]{6}$' THEN
    RETURN FALSE;
  END IF;

  SELECT pin_hash INTO stored_hash FROM public.user_pins WHERE user_id = user_uuid;
  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN stored_hash = crypt(input_pin, stored_hash);
END;
$$;
