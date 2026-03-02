
CREATE TABLE IF NOT EXISTS public.pin_auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pin_attempts_email_time ON public.pin_auth_attempts(email, created_at);

ALTER TABLE public.pin_auth_attempts ENABLE ROW LEVEL SECURITY;
-- No public policies needed - only accessed via service role in edge function
