import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user with their token
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to delete user data and auth account
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Delete user's data from all tables (cascade will handle some, but be explicit)
    const tables = [
      "bill_items", "bills", "invoice_items", "invoices", "products",
      "clients", "transactions", "user_settings", "user_pins",
      "otp_verifications", "company_profile", "profiles",
    ];

    // bill_items and invoice_items need special handling (they reference bills/invoices by bill_id/invoice_id, not user_id)
    // Delete bills/invoices first will cascade, but let's delete explicitly
    const { data: userBills } = await adminClient.from("bills").select("id").eq("user_id", user.id);
    if (userBills?.length) {
      await adminClient.from("bill_items").delete().in("bill_id", userBills.map(b => b.id));
    }
    const { data: userInvoices } = await adminClient.from("invoices").select("id").eq("user_id", user.id);
    if (userInvoices?.length) {
      await adminClient.from("invoice_items").delete().in("invoice_id", userInvoices.map(i => i.id));
    }

    // Delete from remaining tables
    for (const table of ["bills", "invoices", "products", "clients", "transactions", "user_settings", "user_pins", "otp_verifications", "company_profile", "profiles"]) {
      await adminClient.from(table).delete().eq("user_id", user.id);
    }

    // Delete storage files
    const { data: avatarFiles } = await adminClient.storage.from("avatars").list(user.id);
    if (avatarFiles?.length) {
      await adminClient.storage.from("avatars").remove(avatarFiles.map(f => `${user.id}/${f.name}`));
    }
    const { data: logoFiles } = await adminClient.storage.from("company-logos").list(user.id);
    if (logoFiles?.length) {
      await adminClient.storage.from("company-logos").remove(logoFiles.map(f => `${user.id}/${f.name}`));
    }

    // Finally delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return new Response(JSON.stringify({ error: "Failed to delete account" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
