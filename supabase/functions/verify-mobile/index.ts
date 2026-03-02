import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

      // Generate 6-digit OTP
      const otpCode = String(Math.floor(100000 + Math.random() * 900000));

      // Store OTP in the locked-down table (no public SELECT - service role only)
      // Plaintext storage is standard for OTP tables with strict access control
      await adminClient.from("otp_verifications").insert({
        user_id: user.id,
        mobile,
        otp_code: otpCode,
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

      // Constant-time comparison to prevent timing attacks
      if (record.otp_code.length !== otp.length) {
        return new Response(JSON.stringify({ error: "Invalid OTP" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let match = true;
      for (let i = 0; i < otp.length; i++) {
        if (record.otp_code[i] !== otp[i]) match = false;
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
