import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Mask all but the last 4 digits so audit logs never store full phone numbers
function maskMobile(mobile: string): string {
  if (!mobile) return "";
  return `${"*".repeat(Math.max(0, mobile.length - 4))}${mobile.slice(-4)}`;
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
}

type AuditEvent = "otp_generated" | "otp_verified" | "otp_failed" | "otp_rate_limited";

async function logAudit(
  // deno-lint-ignore no-explicit-any
  adminClient: any,
  req: Request,
  entry: { user_id: string; event: AuditEvent; mobile?: string; success: boolean; reason?: string },
) {
  try {
    await adminClient.from("otp_audit_logs").insert({
      user_id: entry.user_id,
      event: entry.event,
      mobile_masked: entry.mobile ? maskMobile(entry.mobile) : null,
      success: entry.success,
      reason: entry.reason ?? null,
      ip_address: getClientIp(req),
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    });
  } catch (e) {
    console.error("Failed to write OTP audit log:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate the caller
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, mobile, otp } = await req.json();

    // Validate mobile format
    if (!mobile || typeof mobile !== "string" || !/^[0-9]{10,15}$/.test(mobile)) {
      return new Response(JSON.stringify({ error: "Invalid mobile number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (action === "send") {
      // Rate limit: max 3 OTPs per user in last 15 minutes
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count } = await adminClient
        .from("otp_verifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", fifteenMinAgo);

      if (count !== null && count >= 3) {
        return new Response(JSON.stringify({ error: "Too many OTP requests. Try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate cryptographically random 6-digit OTP
      const rand = new Uint32Array(1);
      crypto.getRandomValues(rand);
      const otpCode = String(100000 + (rand[0] % 900000));

      // Store only a SHA-256 hash of the OTP so a database/service-role compromise
      // does not expose usable codes. The plaintext code is only sent over SMS.
      await adminClient.from("otp_verifications").insert({
        user_id: user.id,
        mobile,
        otp_code: await sha256Hex(otpCode),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        verified: false,
      });

      // TODO: In production, send OTP via SMS service (Twilio, AWS SNS, etc.)
      // OTP is stored in the database and should be sent via SMS
      console.log(`OTP generated for user ${user.id} at ${new Date().toISOString()}`);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "verify") {
      // Validate OTP format
      if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
        return new Response(JSON.stringify({ error: "Invalid OTP format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get latest unexpired, unverified OTP for this user and mobile
      const { data: otpRecords } = await adminClient
        .from("otp_verifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("mobile", mobile)
        .eq("verified", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (!otpRecords || otpRecords.length === 0) {
        return new Response(JSON.stringify({ error: "No valid OTP found. Please request a new one." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const record = otpRecords[0];

      // Compare hashes (stored value is a SHA-256 hash of the code)
      const inputHash = await sha256Hex(otp);
      let match = record.otp_code.length === inputHash.length;
      for (let i = 0; i < inputHash.length && match; i++) {
        if (record.otp_code[i] !== inputHash[i]) match = false;
      }

      if (!match) {
        return new Response(JSON.stringify({ error: "Invalid OTP" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }


      // Mark OTP as verified
      await adminClient
        .from("otp_verifications")
        .update({ verified: true })
        .eq("id", record.id);

      // Update the user's mobile number in profiles
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({ mobile })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        return new Response(JSON.stringify({ error: "Failed to update mobile number" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error("verify-mobile error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
