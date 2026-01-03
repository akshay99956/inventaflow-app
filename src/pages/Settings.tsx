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
import { z } from "zod";
import { useIsMobile } from "@/hooks/use-mobile";

const profileSchema = z.object({
  company_name: z.string().max(200, "Company name must be less than 200 characters").optional().or(z.literal("")),
  address: z.string().max(500, "Address must be less than 500 characters").optional().or(z.literal("")),
  phone: z.string().max(20, "Phone must be less than 20 characters").optional().or(z.literal("")),
  email: z.string().email("Invalid email format").max(255).optional().or(z.literal("")),
  logo_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  gst_number: z.string().max(20, "GST number must be less than 20 characters").optional().or(z.literal("")),
  website: z.string().url("Invalid website URL").max(255).optional().or(z.literal("")),
});

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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
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
    setFormErrors({});
    
    const validation = profileSchema.safeParse(profile);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      setFormErrors(errors);
      toast({ title: "Validation Error", description: validation.error.errors[0].message, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "User not authenticated", variant: "destructive" });
        return;
      }

      if (profile.id) {
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
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
            <SidebarTrigger />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gradient">Company Settings</h1>
              <p className="text-sm md:text-base text-muted-foreground">Manage your company profile and branding</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="max-w-3xl space-y-4 md:space-y-6">
              {/* Logo Upload Card */}
              <Card className="shadow-colorful border-2 border-accent/20 bg-gradient-to-br from-card to-accent/5">
                <CardHeader className="bg-gradient-to-r from-accent/10 to-primary/10 rounded-t-lg px-4 md:px-6 py-4">
                  <CardTitle className="flex items-center gap-2 text-gradient text-lg md:text-xl">
                    <Image className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                    Company Logo
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">Upload your company logo (max 2MB, JPG/PNG)</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 md:pt-6 px-4 md:px-6">
                  <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6">
                    <div className="relative">
                      {profile.logo_url ? (
                        <div className="relative">
                          <img
                            src={profile.logo_url}
                            alt="Company Logo"
                            className="h-20 w-20 md:h-24 md:w-24 rounded-lg object-cover border-2 border-primary/20 shadow-colorful"
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
                        <div className="h-20 w-20 md:h-24 md:w-24 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/20">
                          <Image className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 text-center sm:text-left">
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
                        size={isMobile ? "sm" : "default"}
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
                <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-t-lg px-4 md:px-6 py-4">
                  <CardTitle className="flex items-center gap-2 text-gradient text-lg md:text-xl">
                    <Building2 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    Company Information
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">Basic details about your business</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 md:pt-6 px-4 md:px-6">
                  <div className="space-y-2">
                    <Label htmlFor="company_name" className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-primary" />
                      Company Name
                    </Label>
                    <Input
                      id="company_name"
                      value={profile.company_name}
                      onChange={(e) => handleChange("company_name", e.target.value)}
                      placeholder="Your Company Name"
                      className={`border-primary/30 focus:border-primary ${formErrors.company_name ? "border-destructive" : ""}`}
                    />
                    {formErrors.company_name && <p className="text-xs text-destructive">{formErrors.company_name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gst_number" className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-secondary" />
                      GST Number
                    </Label>
                    <Input
                      id="gst_number"
                      value={profile.gst_number}
                      onChange={(e) => handleChange("gst_number", e.target.value)}
                      placeholder="GST123456789"
                      className={`border-secondary/30 focus:border-secondary ${formErrors.gst_number ? "border-destructive" : ""}`}
                    />
                    {formErrors.gst_number && <p className="text-xs text-destructive">{formErrors.gst_number}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-accent" />
                      Address
                    </Label>
                    <Textarea
                      id="address"
                      value={profile.address}
                      onChange={(e) => handleChange("address", e.target.value)}
                      placeholder="123 Business Street, City, State, PIN"
                      className={`border-accent/30 focus:border-accent min-h-[80px] ${formErrors.address ? "border-destructive" : ""}`}
                    />
                    {formErrors.address && <p className="text-xs text-destructive">{formErrors.address}</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Contact Info Card */}
              <Card className="shadow-colorful border-2 border-secondary/20 bg-gradient-to-br from-card to-secondary/5">
                <CardHeader className="bg-gradient-to-r from-secondary/10 to-success/10 rounded-t-lg px-4 md:px-6 py-4">
                  <CardTitle className="flex items-center gap-2 text-gradient text-lg md:text-xl">
                    <Phone className="h-4 w-4 md:h-5 md:w-5 text-secondary" />
                    Contact Information
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">How customers can reach you</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4 md:pt-6 px-4 md:px-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-success" />
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        value={profile.phone}
                        onChange={(e) => handleChange("phone", e.target.value)}
                        placeholder="+91 9876543210"
                        className={`border-success/30 focus:border-success ${formErrors.phone ? "border-destructive" : ""}`}
                      />
                      {formErrors.phone && <p className="text-xs text-destructive">{formErrors.phone}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-info" />
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder="contact@company.com"
                        className={`border-info/30 focus:border-info ${formErrors.email ? "border-destructive" : ""}`}
                      />
                      {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website" className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 text-primary" />
                      Website
                    </Label>
                    <Input
                      id="website"
                      value={profile.website}
                      onChange={(e) => handleChange("website", e.target.value)}
                      placeholder="https://www.yourcompany.com"
                      className={`border-primary/30 focus:border-primary ${formErrors.website ? "border-destructive" : ""}`}
                    />
                    {formErrors.website && <p className="text-xs text-destructive">{formErrors.website}</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="gradient-primary text-primary-foreground shadow-colorful w-full sm:w-auto"
                  size={isMobile ? "default" : "lg"}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
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