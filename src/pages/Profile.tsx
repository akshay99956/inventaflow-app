import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { User, Building2, Phone, Mail, KeyRound, Shield, Loader2, Save } from "lucide-react";
import { z } from "zod";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const profileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(100),
  companyName: z.string().min(2, "Company name must be at least 2 characters").max(100),
  mobile: z.string().min(10, "Mobile number must be at least 10 digits").max(15),
});

interface ProfileData {
  id: string;
  full_name: string;
  company_name: string;
  mobile: string;
  email: string;
  pin_enabled: boolean;
}

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // PIN management state
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinStep, setPinStep] = useState<"current" | "new" | "confirm">("current");
  const [pinLoading, setPinLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile({
          id: data.id,
          full_name: data.full_name,
          company_name: data.company_name,
          mobile: data.mobile,
          email: data.email,
          pin_enabled: data.pin_enabled,
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setErrors({});
    
    const validation = profileSchema.safeParse({
      fullName: profile.full_name,
      companyName: profile.company_name,
      mobile: profile.mobile,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          company_name: profile.company_name,
          mobile: profile.mobile,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePinToggle = async (enabled: boolean) => {
    if (!profile) return;

    if (enabled && !profile.pin_enabled) {
      // Opening dialog to set new PIN
      setPinStep("new");
      setPinDialogOpen(true);
    } else if (!enabled && profile.pin_enabled) {
      // Disable PIN - verify current PIN first
      setPinStep("current");
      setPinDialogOpen(true);
    }
  };

  const handleChangePIN = () => {
    setPinStep("current");
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setPinDialogOpen(true);
  };

  const handlePinSubmit = async () => {
    if (!profile) return;

    setPinLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (pinStep === "current") {
        // Verify current PIN
        const { data: isValid } = await supabase.rpc("verify_pin", {
          user_uuid: user.id,
          input_pin: currentPin,
        });

        if (!isValid) {
          toast({
            title: "Error",
            description: "Current PIN is incorrect",
            variant: "destructive",
          });
          setCurrentPin("");
          setPinLoading(false);
          return;
        }

        // If disabling PIN
        if (!profile.pin_enabled) {
          // Actually we're in the process of disabling
          await supabase
            .from("profiles")
            .update({ pin_enabled: false })
            .eq("id", profile.id);

          setProfile({ ...profile, pin_enabled: false });
          setPinDialogOpen(false);
          toast({
            title: "Success",
            description: "PIN disabled successfully",
          });
        } else {
          // Move to new PIN step for changing
          setPinStep("new");
          setCurrentPin("");
        }
      } else if (pinStep === "new") {
        if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
          toast({
            title: "Error",
            description: "PIN must be exactly 4 digits",
            variant: "destructive",
          });
          setPinLoading(false);
          return;
        }
        setPinStep("confirm");
      } else if (pinStep === "confirm") {
        if (newPin !== confirmPin) {
          toast({
            title: "Error",
            description: "PINs do not match",
            variant: "destructive",
          });
          setConfirmPin("");
          setPinLoading(false);
          return;
        }

        // Set new PIN
        await supabase.rpc("set_user_pin", {
          user_uuid: user.id,
          new_pin: newPin,
        });

        await supabase
          .from("profiles")
          .update({ pin_enabled: true })
          .eq("id", profile.id);

        setProfile({ ...profile, pin_enabled: true });
        setPinDialogOpen(false);
        setNewPin("");
        setConfirmPin("");
        toast({
          title: "Success",
          description: profile.pin_enabled ? "PIN changed successfully" : "PIN enabled successfully",
        });
      }
    } catch (error) {
      console.error("Error managing PIN:", error);
      toast({
        title: "Error",
        description: "Failed to update PIN settings",
        variant: "destructive",
      });
    } finally {
      setPinLoading(false);
    }
  };

  const resetPinDialog = () => {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setPinStep("current");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-6 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your personal information and security</p>
      </div>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              placeholder="Enter your full name"
            />
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <Input
              id="email"
              value={profile.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mobile" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Mobile Number
            </Label>
            <Input
              id="mobile"
              value={profile.mobile}
              onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
              placeholder="Enter your mobile number"
            />
            {errors.mobile && (
              <p className="text-sm text-destructive">{errors.mobile}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </CardTitle>
          <CardDescription>Your business details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={profile.company_name}
              onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
              placeholder="Enter your company name"
            />
            {errors.companyName && (
              <p className="text-sm text-destructive">{errors.companyName}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Settings
          </CardTitle>
          <CardDescription>Manage your PIN and security preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                PIN Login
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable quick login with a 4-digit PIN
              </p>
            </div>
            <Switch
              checked={profile.pin_enabled}
              onCheckedChange={handlePinToggle}
            />
          </div>

          {profile.pin_enabled && (
            <>
              <Separator />
              <Button variant="outline" onClick={handleChangePIN}>
                <KeyRound className="h-4 w-4 mr-2" />
                Change PIN
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveProfile} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {/* PIN Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={(open) => {
        if (!open) resetPinDialog();
        setPinDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {pinStep === "current" && "Enter Current PIN"}
              {pinStep === "new" && "Enter New PIN"}
              {pinStep === "confirm" && "Confirm New PIN"}
            </DialogTitle>
            <DialogDescription>
              {pinStep === "current" && "Enter your current 4-digit PIN to continue"}
              {pinStep === "new" && "Create a new 4-digit PIN"}
              {pinStep === "confirm" && "Re-enter your new PIN to confirm"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            {pinStep === "current" && (
              <InputOTP
                maxLength={4}
                value={currentPin}
                onChange={setCurrentPin}
                className="gap-2"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="text-security-disc" />
                  <InputOTPSlot index={1} className="text-security-disc" />
                  <InputOTPSlot index={2} className="text-security-disc" />
                  <InputOTPSlot index={3} className="text-security-disc" />
                </InputOTPGroup>
              </InputOTP>
            )}

            {pinStep === "new" && (
              <InputOTP
                maxLength={4}
                value={newPin}
                onChange={setNewPin}
                className="gap-2"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="text-security-disc" />
                  <InputOTPSlot index={1} className="text-security-disc" />
                  <InputOTPSlot index={2} className="text-security-disc" />
                  <InputOTPSlot index={3} className="text-security-disc" />
                </InputOTPGroup>
              </InputOTP>
            )}

            {pinStep === "confirm" && (
              <InputOTP
                maxLength={4}
                value={confirmPin}
                onChange={setConfirmPin}
                className="gap-2"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="text-security-disc" />
                  <InputOTPSlot index={1} className="text-security-disc" />
                  <InputOTPSlot index={2} className="text-security-disc" />
                  <InputOTPSlot index={3} className="text-security-disc" />
                </InputOTPGroup>
              </InputOTP>
            )}

            <Button
              onClick={handlePinSubmit}
              disabled={pinLoading || (
                (pinStep === "current" && currentPin.length !== 4) ||
                (pinStep === "new" && newPin.length !== 4) ||
                (pinStep === "confirm" && confirmPin.length !== 4)
              )}
              className="w-full"
            >
              {pinLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                pinStep === "confirm" ? "Confirm" : "Continue"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
