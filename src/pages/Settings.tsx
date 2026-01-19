import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, Phone, Mail, MapPin, Globe, FileText, Save, Loader2, Upload, Image, X,
  Bell, DollarSign, Navigation, Receipt, Settings2, Smartphone
} from "lucide-react";
import { z } from "zod";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings } from "@/contexts/SettingsContext";

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

const currencies = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SAR", symbol: "ر.س", name: "Saudi Riyal" },
];

const dateFormats = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2024)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2024)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2024-12-31)" },
];

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings, updateSettings, loading: settingsLoading } = useSettings();
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
        let logoUrl = data.logo_url || "";
        
        // Generate signed URL for the logo if it exists
        if (data.logo_url) {
          const urlParts = data.logo_url.split("/company-logos/");
          if (urlParts.length > 1) {
            const filePath = urlParts[1].split("?")[0];
            const { data: signedUrlData } = await supabase.storage
              .from("company-logos")
              .createSignedUrl(filePath, 3600);
            
            if (signedUrlData?.signedUrl) {
              logoUrl = signedUrlData.signedUrl;
            }
          }
        }
        
        setProfile({
          id: data.id,
          company_name: data.company_name || "",
          address: data.address || "",
          phone: data.phone || "",
          email: data.email || "",
          logo_url: logoUrl,
          gst_number: data.gst_number || "",
          website: data.website || "",
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching profile:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Please select an image file", variant: "destructive" });
      return;
    }

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

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;

      if (profile.logo_url) {
        const oldPath = profile.logo_url.split("/").slice(-2).join("/");
        await supabase.storage.from("company-logos").remove([oldPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      // Use signed URL for private bucket (24 hour expiration)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("company-logos")
        .createSignedUrl(fileName, 86400); // 24 hours

      if (signedUrlError) throw signedUrlError;

      setProfile((prev) => ({ ...prev, logo_url: signedUrlData.signedUrl }));
      toast({ title: "Success", description: "Logo uploaded successfully!" });
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error uploading logo:", error);
      }
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
      if (import.meta.env.DEV) {
        console.error("Error removing logo:", error);
      }
      toast({ title: "Error", description: "Failed to remove logo", variant: "destructive" });
    }
  };

  const handleSaveProfile = async () => {
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

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateSettings(settings);
      toast({ title: "Success", description: "Settings saved successfully!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleProfileChange = (field: keyof CompanyProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSettingsChange = async (field: string, value: any) => {
    try {
      await updateSettings({ [field]: value });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error updating setting:", error);
      }
    }
  };

  const handleCurrencyChange = async (currencyCode: string) => {
    const currency = currencies.find(c => c.code === currencyCode);
    if (currency) {
      try {
        await updateSettings({ 
          currency_code: currency.code, 
          currency_symbol: currency.symbol 
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Error updating currency:", error);
        }
      }
    }
  };

  if (loading || settingsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gradient">Settings</h1>
        <p className="text-sm md:text-base text-muted-foreground">Manage your app preferences and company profile</p>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 mb-6 h-auto">
          <TabsTrigger value="company" className="text-xs md:text-sm py-2">
            <Building2 className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Company</span>
          </TabsTrigger>
          <TabsTrigger value="tax" className="text-xs md:text-sm py-2">
            <Receipt className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Tax</span>
          </TabsTrigger>
          <TabsTrigger value="currency" className="text-xs md:text-sm py-2">
            <DollarSign className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Currency</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs md:text-sm py-2">
            <Bell className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="navigation" className="text-xs md:text-sm py-2">
            <Smartphone className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Nav Bar</span>
          </TabsTrigger>
          <TabsTrigger value="invoicing" className="text-xs md:text-sm py-2">
            <Settings2 className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Invoicing</span>
          </TabsTrigger>
        </TabsList>

        {/* Company Tab */}
        <TabsContent value="company" className="space-y-4">
          {/* Logo Upload Card */}
          <Card>
            <CardHeader className="px-4 md:px-6 py-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Image className="h-5 w-5 text-primary" />
                Company Logo
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">Upload your company logo (max 2MB)</CardDescription>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative">
                  {profile.logo_url ? (
                    <div className="relative">
                      <img
                        src={profile.logo_url}
                        alt="Company Logo"
                        className="h-20 w-20 rounded-lg object-cover border-2 border-primary/20"
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
                    <div className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/20">
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
                    size="sm"
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
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Info Card */}
          <Card>
            <CardHeader className="px-4 md:px-6 py-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-primary" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 md:px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={profile.company_name}
                    onChange={(e) => handleProfileChange("company_name", e.target.value)}
                    placeholder="Your Company Name"
                    className={formErrors.company_name ? "border-destructive" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gst_number">GST Number</Label>
                  <Input
                    id="gst_number"
                    value={profile.gst_number}
                    onChange={(e) => handleProfileChange("gst_number", e.target.value)}
                    placeholder="GST123456789"
                    className={formErrors.gst_number ? "border-destructive" : ""}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={profile.address}
                  onChange={(e) => handleProfileChange("address", e.target.value)}
                  placeholder="123 Business Street, City, State, PIN"
                  className={formErrors.address ? "border-destructive" : ""}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => handleProfileChange("phone", e.target.value)}
                    placeholder="+91 9876543210"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => handleProfileChange("email", e.target.value)}
                    placeholder="contact@company.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={profile.website}
                  onChange={(e) => handleProfileChange("website", e.target.value)}
                  placeholder="https://www.company.com"
                />
              </div>
              <Button onClick={handleSaveProfile} disabled={saving} className="w-full md:w-auto">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Company Profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Tab */}
        <TabsContent value="tax" className="space-y-4">
          <Card>
            <CardHeader className="px-4 md:px-6 py-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="h-5 w-5 text-primary" />
                Tax Settings
              </CardTitle>
              <CardDescription>Configure default tax rates for invoices and bills</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 md:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Tax</Label>
                  <p className="text-xs text-muted-foreground">Apply tax to invoices and bills</p>
                </div>
                <Switch
                  checked={settings.tax_enabled}
                  onCheckedChange={(checked) => handleSettingsChange("tax_enabled", checked)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tax Name</Label>
                  <Input
                    value={settings.tax_name}
                    onChange={(e) => handleSettingsChange("tax_name", e.target.value)}
                    placeholder="GST"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Tax Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.default_tax_rate}
                    onChange={(e) => handleSettingsChange("default_tax_rate", Number(e.target.value))}
                    placeholder="18"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Currency Tab */}
        <TabsContent value="currency" className="space-y-4">
          <Card>
            <CardHeader className="px-4 md:px-6 py-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-primary" />
                Currency Settings
              </CardTitle>
              <CardDescription>Set your default currency for all transactions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 md:px-6">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={settings.currency_code} onValueChange={handleCurrencyChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.symbol} - {currency.name} ({currency.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm">
                  Current: <span className="font-semibold">{settings.currency_symbol}</span> ({settings.currency_code})
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This will be used for all monetary displays
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4 md:px-6 py-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" />
                Date Format
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 md:px-6">
              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select 
                  value={settings.date_format} 
                  onValueChange={(value) => handleSettingsChange("date_format", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select date format" />
                  </SelectTrigger>
                  <SelectContent>
                    {dateFormats.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader className="px-4 md:px-6 py-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-primary" />
                Notification Settings
              </CardTitle>
              <CardDescription>Manage your alert preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 md:px-6">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">Receive email updates</p>
                </div>
                <Switch
                  checked={settings.email_notifications}
                  onCheckedChange={(checked) => handleSettingsChange("email_notifications", checked)}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Low Stock Alerts</Label>
                  <p className="text-xs text-muted-foreground">Alert when inventory is low</p>
                </div>
                <Switch
                  checked={settings.low_stock_alerts}
                  onCheckedChange={(checked) => handleSettingsChange("low_stock_alerts", checked)}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Invoice Reminders</Label>
                  <p className="text-xs text-muted-foreground">Remind about unpaid invoices</p>
                </div>
                <Switch
                  checked={settings.invoice_reminders}
                  onCheckedChange={(checked) => handleSettingsChange("invoice_reminders", checked)}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Bill Due Alerts</Label>
                  <p className="text-xs text-muted-foreground">Alert before bills are due</p>
                </div>
                <Switch
                  checked={settings.bill_due_alerts}
                  onCheckedChange={(checked) => handleSettingsChange("bill_due_alerts", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Navigation Tab */}
        <TabsContent value="navigation" className="space-y-4">
          <Card>
            <CardHeader className="px-4 md:px-6 py-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Smartphone className="h-5 w-5 text-primary" />
                Bottom Navigation Bar
              </CardTitle>
              <CardDescription>Choose which items appear in the mobile bottom navigation (minimum 2 required)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 md:px-6">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Dashboard</Label>
                  <p className="text-xs text-muted-foreground">Home and overview</p>
                </div>
                <Switch
                  checked={settings.show_dashboard}
                  onCheckedChange={(checked) => handleSettingsChange("show_dashboard", checked)}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Sales</Label>
                  <p className="text-xs text-muted-foreground">Invoices and sales</p>
                </div>
                <Switch
                  checked={settings.show_sales}
                  onCheckedChange={(checked) => handleSettingsChange("show_sales", checked)}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Inventory</Label>
                  <p className="text-xs text-muted-foreground">Products and stock</p>
                </div>
                <Switch
                  checked={settings.show_inventory}
                  onCheckedChange={(checked) => handleSettingsChange("show_inventory", checked)}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Clients</Label>
                  <p className="text-xs text-muted-foreground">Customer management</p>
                </div>
                <Switch
                  checked={settings.show_clients}
                  onCheckedChange={(checked) => handleSettingsChange("show_clients", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoicing Tab */}
        <TabsContent value="invoicing" className="space-y-4">
          <Card>
            <CardHeader className="px-4 md:px-6 py-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings2 className="h-5 w-5 text-primary" />
                Invoice & Bill Settings
              </CardTitle>
              <CardDescription>Configure invoice and bill defaults</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 md:px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Prefix</Label>
                  <Input
                    value={settings.invoice_prefix}
                    onChange={(e) => handleSettingsChange("invoice_prefix", e.target.value)}
                    placeholder="INV-"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bill Prefix</Label>
                  <Input
                    value={settings.bill_prefix}
                    onChange={(e) => handleSettingsChange("bill_prefix", e.target.value)}
                    placeholder="BILL-"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Payment Terms (days)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={settings.default_payment_terms}
                    onChange={(e) => handleSettingsChange("default_payment_terms", Number(e.target.value))}
                    placeholder="30"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Items Per Page</Label>
                  <Select 
                    value={String(settings.items_per_page)} 
                    onValueChange={(value) => handleSettingsChange("items_per_page", Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
