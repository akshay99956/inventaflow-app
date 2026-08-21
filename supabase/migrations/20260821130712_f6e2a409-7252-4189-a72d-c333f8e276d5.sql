CREATE TABLE public.otp_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event text NOT NULL,
  mobile_masked text,
  success boolean NOT NULL DEFAULT false,
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.otp_audit_logs TO authenticated;
GRANT ALL ON public.otp_audit_logs TO service_role;

ALTER TABLE public.otp_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own OTP audit logs"
ON public.otp_audit_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_otp_audit_logs_user_created ON public.otp_audit_logs (user_id, created_at DESC);