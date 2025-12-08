import { useState, useEffect, useRef } from "react";
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
import { Building2, Phone, Mail, MapPin, Globe, FileText, Save, Loader2, Upload, Image, X } from "lucide-react";

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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Please select an image file", variant: "destructive" });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Error", description: "Image size should be less than 2MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "User not authenticated", variant: "destructive" });
        return;
      }

      // Create a unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;

      // Delete old logo if exists
      if (profile.logo_url) {
        const oldPath = profile.logo_url.split("/").slice(-2).join("/");
        await supabase.storage.from("company-logos").remove([oldPath]);
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("company-logos")
        .getPublicUrl(fileName);

      setProfile((prev) => ({ ...prev, logo_url: publicUrl }));
      toast({ title: "Success", description: "Logo uploaded successfully!" });
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast({ title: "Error", description: error.message || "Failed to upload logo", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!profile.logo_url) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const oldPath = profile.logo_url.split("/").slice(-2).join("/");
      await supabase.storage.from("company-logos").remove([oldPath]);

      setProfile((prev) => ({ ...prev, logo_url: "" }));
      toast({ title: "Success", description: "Logo removed" });
    } catch (error: any) {
      console.error("Error removing logo:", error);
      toast({ title: "Error", description: "Failed to remove logo", variant: "destructive" });
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
              {/* Logo Upload Card */}
              <Card className="shadow-colorful border-2 border-accent/20 bg-gradient-to-br from-card to-accent/5">
                <CardHeader className="bg-gradient-to-r from-accent/10 to-primary/10 rounded-t-lg">
                  <CardTitle className="flex items-center gap-2 text-gradient">
                    <Image className="h-5 w-5 text-accent" />
                    Company Logo
                  </CardTitle>
                  <CardDescription>Upload your company logo (max 2MB, JPG/PNG)</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      {profile.logo_url ? (
                        <div className="relative">
                          <img
                            src={profile.logo_url}
                            alt="Company Logo"
                            className="h-24 w-24 rounded-lg object-cover border-2 border-primary/20 shadow-colorful"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                            onClick={handleRemoveLogo}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="h-24 w-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/20">
                          <Image className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="border-primary/30 hover:bg-primary/10"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Logo
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        This logo will appear on invoices and bills
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

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