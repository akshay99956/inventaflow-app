import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CompanyProfile {
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  gst_number: string | null;
  website: string | null;
}

interface CompanyBrandingProps {
  className?: string;
}

export const CompanyBranding = ({ className = "" }: CompanyBrandingProps) => {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("company_profile")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
    }
  };

  if (!profile) {
    return (
      <div className={`mb-4 pb-4 border-b ${className}`}>
        <h2 className="text-2xl font-bold text-foreground">Your Company Name</h2>
        <p className="text-sm text-muted-foreground">Set up your company profile in Settings</p>
      </div>
    );
  }

  return (
    <div className={`mb-4 pb-4 border-b ${className}`}>
      <div className="flex items-start gap-4">
        {profile.logo_url && (
          <img
            src={profile.logo_url}
            alt="Company Logo"
            className="h-16 w-16 rounded-lg object-cover border border-border print:h-12 print:w-12"
          />
        )}
        <div>
          <h2 className="text-2xl font-bold text-foreground print:text-xl">
            {profile.company_name || "Your Company Name"}
          </h2>
          {profile.address && (
            <p className="text-sm text-muted-foreground print:text-xs">{profile.address}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground print:text-xs print:gap-2">
            {profile.phone && <span>Phone: {profile.phone}</span>}
            {profile.email && <span>Email: {profile.email}</span>}
          </div>
          {profile.gst_number && (
            <p className="text-sm text-muted-foreground print:text-xs">
              GST: {profile.gst_number}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
