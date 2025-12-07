import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Building2, Phone, Mail, MapPin, Globe, FileText, Save, Loader2 } from "lucide-react";

interface CompanyProfile {
  id?: string;
  company_name: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  gst_number: string;
  website: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile>({
    company_name: "",
    address: "",
    phone: "",
    email: "",
    logo_url: "",
    gst_number: "",
    website: "",
  });

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    fetchProfile();
  };

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("company_profile")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile({
          id: data.id,
          company_name: data.company_name || "",
          address: data.address || "",
          phone: data.phone || "",
          email: data.email || "",
          logo_url: data.logo_url || "",
          gst_number: data.gst_number || "",
          website: data.website || "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "User not authenticated", variant: "destructive" });
        return;
      }

      if (profile.id) {
        // Update existing profile
        const { error } = await supabase
          .from("company_profile")
          .update({
            company_name: profile.company_name,
            address: profile.address,
            phone: profile.phone,
            email: profile.email,
            logo_url: profile.logo_url,
            gst_number: profile.gst_number,
            website: profile.website,
          })
          .eq("id", profile.id);

        if (error) throw error;
      } else {
        // Insert new profile
        const { error } = await supabase
          .from("company_profile")
          .insert({
            user_id: user.id,
            company_name: profile.company_name,
            address: profile.address,
            phone: profile.phone,
            email: profile.email,
            logo_url: profile.logo_url,
            gst_number: profile.gst_number,
            website: profile.website,
          });

        if (error) throw error;
      }

      toast({ title: "Success", description: "Company profile saved successfully!" });
      fetchProfile();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof CompanyProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-muted/20">
        <AppSidebar />
        <main className="flex-1 p-6">
          <div className="flex items-center gap-4 mb-8">
            <SidebarTrigger />
            <div>
              <h1 className="text-3xl font-bold text-gradient">Company Settings</h1>
              <p className="text-muted-foreground">Manage your company profile and branding</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="max-w-3xl space-y-6">
              {/* Company Info Card */}
              <Card className="shadow-colorful border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-t-lg">
                  <CardTitle className="flex items-center gap-2 text-gradient">
                    <Building2 className="h-5 w-5 text-primary" />
                    Company Information
                  </CardTitle>
                  <CardDescription>Basic details about your business</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="company_name" className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      Company Name
                    </Label>
                    <Input
                      id="company_name"
                      value={profile.company_name}
                      onChange={(e) => handleChange("company_name", e.target.value)}
                      placeholder="Your Company Name"
                      className="border-primary/30 focus:border-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gst_number" className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-secondary" />
                      GST Number
                    </Label>
                    <Input
                      id="gst_number"
                      value={profile.gst_number}
                      onChange={(e) => handleChange("gst_number", e.target.value)}
                      placeholder="GST123456789"
                      className="border-secondary/30 focus:border-secondary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-accent" />
                      Address
                    </Label>
                    <Textarea
                      id="address"
                      value={profile.address}
                      onChange={(e) => handleChange("address", e.target.value)}
                      placeholder="123 Business Street, City, State, PIN"
                      className="border-accent/30 focus:border-accent"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Contact Info Card */}
              <Card className="shadow-colorful border-2 border-secondary/20 bg-gradient-to-br from-card to-secondary/5">
                <CardHeader className="bg-gradient-to-r from-secondary/10 to-success/10 rounded-t-lg">
                  <CardTitle className="flex items-center gap-2 text-gradient">
                    <Phone className="h-5 w-5 text-secondary" />
                    Contact Information
                  </CardTitle>
                  <CardDescription>How customers can reach you</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-success" />
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        value={profile.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        placeholder="+91 9876543210"
                        className="border-success/30 focus:border-success"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-info" />
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder="contact@company.com"
                        className="border-info/30 focus:border-info"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website" className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      Website
                    </Label>
                    <Input
                      id="website"
                      value={profile.website}
                      onChange={(e) => handleChange("website", e.target.value)}
                      placeholder="https://www.yourcompany.com"
                      className="border-primary/30 focus:border-primary"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-gradient-primary text-primary-foreground shadow-colorful hover:shadow-glow-md px-8"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Settings;
