import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { User, Building2, Phone, Mail, KeyRound, Shield, Loader2, Save, Camera, Lock, Eye, EyeOff, CheckCircle2, Settings, Smartphone, Edit3 } from "lucide-react";
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
} from "@/components/ui/dialog";

const profileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(100),
  companyName: z.string().min(2, "Company name must be at least 2 characters").max(100),
});

const mobileSchema = z.string()
  .min(10, "Mobile number must be at least 10 digits")
  .max(15, "Mobile number must be at most 15 digits")
  .regex(/^[0-9]+$/, "Mobile number must contain only digits");

const emailChangeSchema = z.object({
  newEmail: z.string().email("Invalid email address").max(255),
  password: z.string().min(6, "Password is required to change email"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, "Password must be at least 6 characters"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

interface ProfileData {
  id: string;
  full_name: string;
  company_name: string;
  mobile: string;
  email: string;
  pin_enabled: boolean;
  avatar_url: string | null;
}

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // PIN management state
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinStep, setPinStep] = useState<"current" | "new" | "confirm">("current");
  const [pinLoading, setPinLoading] = useState(false);

  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Mobile change state
  const [mobileDialogOpen, setMobileDialogOpen] = useState(false);
  const [mobileLoading, setMobileLoading] = useState(false);
  const [newMobile, setNewMobile] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [mobileStep, setMobileStep] = useState<"enter" | "verify">("enter");
  const [mobileError, setMobileError] = useState("");

  // Email change state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailStep, setEmailStep] = useState<"enter" | "sent">("enter");
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});

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
          avatar_url: data.avatar_url,
        });

        if (data.avatar_url) {
          const { data: signedData } = await supabase.storage
            .from("avatars")
            .createSignedUrl(data.avatar_url, 3600);
          if (signedData?.signedUrl) {
            setAvatarUrl(signedData.signedUrl);
          }
        }
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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image must be less than 2MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      if (profile.avatar_url) {
        await supabase.storage.from("avatars").remove([profile.avatar_url]);
      }

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: filePath })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      const { data: signedData } = await supabase.storage
        .from("avatars")
        .createSignedUrl(filePath, 3600);

      if (signedData?.signedUrl) {
        setAvatarUrl(signedData.signedUrl);
      }

      setProfile({ ...profile, avatar_url: filePath });
      toast({
        title: "Success",
        description: "Profile picture updated",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Error",
        description: "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setErrors({});
    
    const validation = profileSchema.safeParse({
      fullName: profile.full_name,
      companyName: profile.company_name,
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

  const handleMobileChange = async () => {
    if (!profile) return;
    setMobileError("");

    if (mobileStep === "enter") {
      const validation = mobileSchema.safeParse(newMobile);
      if (!validation.success) {
        setMobileError(validation.error.errors[0].message);
        return;
      }

      if (newMobile === profile.mobile) {
        setMobileError("New mobile number must be different");
        return;
      }

      setMobileLoading(true);
      // Simulate OTP send - In production, integrate with SMS service
      setTimeout(() => {
        setMobileStep("verify");
        setMobileLoading(false);
        toast({
          title: "OTP Sent",
          description: `Verification code sent to ${newMobile}`,
        });
      }, 1000);
    } else if (mobileStep === "verify") {
      if (mobileOtp.length !== 6) {
        setMobileError("Please enter the 6-digit OTP");
        return;
      }

      setMobileLoading(true);
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ mobile: newMobile })
          .eq("id", profile.id);

        if (error) throw error;

        setProfile({ ...profile, mobile: newMobile });
        setMobileDialogOpen(false);
        resetMobileDialog();
        toast({
          title: "Success",
          description: "Mobile number updated successfully",
        });
      } catch (error) {
        console.error("Error updating mobile:", error);
        toast({
          title: "Error",
          description: "Failed to update mobile number",
          variant: "destructive",
        });
      } finally {
        setMobileLoading(false);
      }
    }
  };

  const resetMobileDialog = () => {
    setNewMobile("");
    setMobileOtp("");
    setMobileStep("enter");
    setMobileError("");
  };

  const handleChangeEmail = async () => {
    if (!profile) return;
    setEmailErrors({});

    if (emailStep === "enter") {
      const validation = emailChangeSchema.safeParse({
        newEmail,
        password: emailPassword,
      });

      if (!validation.success) {
        const fieldErrors: Record<string, string> = {};
        validation.error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setEmailErrors(fieldErrors);
        return;
      }

      if (newEmail === profile.email) {
        setEmailErrors({ newEmail: "New email must be different from current email" });
        return;
      }

      setEmailLoading(true);
      try {
        // Verify password first
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) throw new Error("No user found");

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: emailPassword,
        });

        if (signInError) {
          setEmailErrors({ password: "Incorrect password" });
          setEmailLoading(false);
          return;
        }

        // Request email change via Supabase Auth
        const { error: updateError } = await supabase.auth.updateUser({
          email: newEmail,
        });

        if (updateError) throw updateError;

        setEmailStep("sent");
        toast({
          title: "Verification Email Sent",
          description: "Please check both your old and new email inbox to confirm the change.",
        });
      } catch (error: any) {
        console.error("Error changing email:", error);
        toast({
          title: "Error",
          description: error?.message || "Failed to change email",
          variant: "destructive",
        });
      } finally {
        setEmailLoading(false);
      }
    }
  };

  const resetEmailDialog = () => {
    setNewEmail("");
    setEmailPassword("");
    setShowEmailPassword(false);
    setEmailStep("enter");
    setEmailErrors({});
  };

  const handleChangePassword = async () => {
    setPasswordErrors({});

    const validation = passwordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setPasswordErrors(fieldErrors);
      return;
    }

    setPasswordLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("No user email found");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordErrors({ currentPassword: "Current password is incorrect" });
        setPasswordLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Password changed successfully",
      });
      setPasswordDialogOpen(false);
      resetPasswordDialog();
    } catch (error) {
      console.error("Error changing password:", error);
      toast({
        title: "Error",
        description: "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const resetPasswordDialog = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordErrors({});
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handlePinToggle = async (enabled: boolean) => {
    if (!profile) return;

    if (enabled && !profile.pin_enabled) {
      setPinStep("new");
      setPinDialogOpen(true);
    } else if (!enabled && profile.pin_enabled) {
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

        if (!profile.pin_enabled) {
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Profile not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Compact Hero Header */}
      <div className="gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.06%22%3E%3Cpath%20d%3D%22M20%2018v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-40" />
        <div className="container max-w-5xl py-6 px-4 sm:px-6 relative">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-[3px] border-primary-foreground/20 shadow-xl ring-2 ring-primary-foreground/10">
                <AvatarImage src={avatarUrl || undefined} alt={profile.full_name} className="object-cover" />
                <AvatarFallback className="text-xl font-bold bg-primary-foreground/15 text-primary-foreground">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center bg-foreground/40 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer backdrop-blur-sm"
              >
                {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" /> : <Camera className="h-5 w-5 text-primary-foreground" />}
              </button>
            </div>
            {/* User Info */}
            <div className="min-w-0 text-primary-foreground">
              <h1 className="text-xl sm:text-2xl font-bold truncate">{profile.full_name}</h1>
              <p className="text-primary-foreground/70 text-sm truncate mt-0.5">{profile.email}</p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                <Badge variant="secondary" className="bg-primary-foreground/15 text-primary-foreground border-0 text-xs font-medium hover:bg-primary-foreground/20">
                  <Building2 className="h-3 w-3 mr-1" />
                  {profile.company_name}
                </Badge>
                {profile.pin_enabled && (
                  <Badge variant="secondary" className="bg-primary-foreground/15 text-primary-foreground border-0 text-xs font-medium hover:bg-primary-foreground/20">
                    <Shield className="h-3 w-3 mr-1" />
                    PIN Active
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-5xl px-4 sm:px-6 -mt-4 relative z-10 space-y-5">
        {/* Two-column: Personal + Company */}
        <div className="grid md:grid-cols-2 gap-5">
          {/* Personal Information */}
          <Card className="shadow-md border-border/50">
            <CardHeader className="pb-3 pt-5 px-5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
                <CardTitle className="text-base">Personal Info</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-medium text-muted-foreground">Full Name</Label>
                <Input
                  id="fullName"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Your full name"
                  className="h-10"
                />
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email
                </Label>
                <div className="relative">
                  <Input id="email" value={profile.email} disabled className="h-10 bg-muted/50 pr-16 text-sm" />
                  <Button variant="ghost" size="sm" className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 text-xs px-2 text-primary" onClick={() => setEmailDialogOpen(true)}>
                    <Edit3 className="h-3 w-3 mr-1" /> Change
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mobile" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Mobile
                </Label>
                <div className="relative">
                  <Input id="mobile" value={profile.mobile} disabled className="h-10 bg-muted/50 pr-16 text-sm" />
                  <Button variant="ghost" size="sm" className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 text-xs px-2 text-primary" onClick={() => setMobileDialogOpen(true)}>
                    <Edit3 className="h-3 w-3 mr-1" /> Change
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Company Information */}
          <Card className="shadow-md border-border/50">
            <CardHeader className="pb-3 pt-5 px-5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg gradient-secondary flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-primary-foreground" />
                </div>
                <CardTitle className="text-base">Company Info</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="companyName" className="text-xs font-medium text-muted-foreground">Company Name</Label>
                <Input
                  id="companyName"
                  value={profile.company_name}
                  onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                  placeholder="Your company name"
                  className="h-10"
                />
                {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
              </div>

              {/* Save Button inside company card */}
              <div className="pt-2">
                <Button onClick={handleSaveProfile} disabled={saving} className="w-full h-10">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security Settings — Full Width */}
        <Card className="shadow-md border-border/50">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg gradient-warm flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Security</CardTitle>
                <CardDescription className="text-xs">Manage passwords, PIN & account access</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Password */}
              <button
                onClick={() => setPasswordDialogOpen(true)}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border/60 hover:border-primary/30 hover:bg-muted/40 transition-all duration-200 text-left group"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                  <Lock className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Password</p>
                  <p className="text-xs text-muted-foreground">Change account password</p>
                </div>
                <Edit3 className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Email */}
              <button
                onClick={() => setEmailDialogOpen(true)}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border/60 hover:border-secondary/30 hover:bg-muted/40 transition-all duration-200 text-left group"
              >
                <div className="h-9 w-9 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0 group-hover:bg-secondary/15 transition-colors">
                  <Mail className="h-4 w-4 text-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Email</p>
                  <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                </div>
                <Edit3 className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Mobile */}
              <button
                onClick={() => setMobileDialogOpen(true)}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-border/60 hover:border-accent/30 hover:bg-muted/40 transition-all duration-200 text-left group"
              >
                <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/15 transition-colors">
                  <Smartphone className="h-4 w-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Mobile</p>
                  <p className="text-xs text-muted-foreground">{profile.mobile}</p>
                </div>
                <Edit3 className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* PIN */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border/60">
                <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                  <KeyRound className="h-4 w-4 text-warning" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">PIN Login</p>
                  <p className="text-xs text-muted-foreground">Quick 4-digit access</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {profile.pin_enabled && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={handleChangePIN}>
                      Change
                    </Button>
                  )}
                  <Switch checked={profile.pin_enabled} onCheckedChange={handlePinToggle} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Change Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={(open) => {
        if (!open) resetEmailDialog();
        setEmailDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full gradient-cool flex items-center justify-center">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle>
                  {emailStep === "enter" ? "Change Email Address" : "Verification Sent"}
                </DialogTitle>
                <DialogDescription>
                  {emailStep === "enter" 
                    ? "Enter your new email and verify with your password" 
                    : "Check your inbox to confirm the change"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {emailStep === "enter" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="newEmail">New Email Address</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter new email address"
                    className="h-11"
                  />
                  {emailErrors.newEmail && (
                    <p className="text-sm text-destructive">{emailErrors.newEmail}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Current: {profile.email}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="emailPassword"
                      type={showEmailPassword ? "text" : "password"}
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      placeholder="Enter your password to confirm"
                      className="h-11 pr-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowEmailPassword(!showEmailPassword)}
                    >
                      {showEmailPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  {emailErrors.password && (
                    <p className="text-sm text-destructive">{emailErrors.password}</p>
                  )}
                </div>

                <Button
                  onClick={handleChangeEmail}
                  disabled={emailLoading || !newEmail || !emailPassword}
                  className="w-full h-11"
                >
                  {emailLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Send Verification Email"
                  )}
                </Button>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="h-16 w-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Verification email sent!</p>
                  <p className="text-sm text-muted-foreground">
                    We've sent a confirmation link to <strong>{newEmail}</strong>. Please check both your old and new email inbox to complete the change.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEmailDialogOpen(false);
                    resetEmailDialog();
                  }}
                  className="w-full h-11"
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={(open) => {
        if (!open) resetPasswordDialog();
        setPasswordDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center">
                <Lock className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle>Change Password</DialogTitle>
                <DialogDescription>
                  Enter your current password and choose a new one
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="h-11 pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              {passwordErrors.currentPassword && (
                <p className="text-sm text-destructive">{passwordErrors.currentPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="h-11 pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              {passwordErrors.newPassword && (
                <p className="text-sm text-destructive">{passwordErrors.newPassword}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="h-11 pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              {passwordErrors.confirmPassword && (
                <p className="text-sm text-destructive">{passwordErrors.confirmPassword}</p>
              )}
            </div>

            <Button
              onClick={handleChangePassword}
              disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
              className="w-full h-11"
            >
              {passwordLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Update Password"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={(open) => {
        if (!open) resetPinDialog();
        setPinDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full gradient-warm flex items-center justify-center">
                <KeyRound className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle>
                  {pinStep === "current" && "Enter Current PIN"}
                  {pinStep === "new" && "Create New PIN"}
                  {pinStep === "confirm" && "Confirm Your PIN"}
                </DialogTitle>
                <DialogDescription>
                  {pinStep === "current" && "Enter your current 4-digit PIN to continue"}
                  {pinStep === "new" && "Create a new 4-digit PIN"}
                  {pinStep === "confirm" && "Re-enter your new PIN to confirm"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-6">
            {pinStep === "current" && (
              <InputOTP
                maxLength={4}
                value={currentPin}
                onChange={setCurrentPin}
                className="gap-3"
              >
                <InputOTPGroup className="gap-3">
                  <InputOTPSlot index={0} className="h-14 w-14 text-lg text-security-disc" />
                  <InputOTPSlot index={1} className="h-14 w-14 text-lg text-security-disc" />
                  <InputOTPSlot index={2} className="h-14 w-14 text-lg text-security-disc" />
                  <InputOTPSlot index={3} className="h-14 w-14 text-lg text-security-disc" />
                </InputOTPGroup>
              </InputOTP>
            )}

            {pinStep === "new" && (
              <InputOTP
                maxLength={4}
                value={newPin}
                onChange={setNewPin}
                className="gap-3"
              >
                <InputOTPGroup className="gap-3">
                  <InputOTPSlot index={0} className="h-14 w-14 text-lg text-security-disc" />
                  <InputOTPSlot index={1} className="h-14 w-14 text-lg text-security-disc" />
                  <InputOTPSlot index={2} className="h-14 w-14 text-lg text-security-disc" />
                  <InputOTPSlot index={3} className="h-14 w-14 text-lg text-security-disc" />
                </InputOTPGroup>
              </InputOTP>
            )}

            {pinStep === "confirm" && (
              <InputOTP
                maxLength={4}
                value={confirmPin}
                onChange={setConfirmPin}
                className="gap-3"
              >
                <InputOTPGroup className="gap-3">
                  <InputOTPSlot index={0} className="h-14 w-14 text-lg text-security-disc" />
                  <InputOTPSlot index={1} className="h-14 w-14 text-lg text-security-disc" />
                  <InputOTPSlot index={2} className="h-14 w-14 text-lg text-security-disc" />
                  <InputOTPSlot index={3} className="h-14 w-14 text-lg text-security-disc" />
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
              className="w-full h-11"
            >
              {pinLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                pinStep === "confirm" ? "Confirm PIN" : "Continue"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Change Dialog */}
      <Dialog open={mobileDialogOpen} onOpenChange={(open) => {
        if (!open) resetMobileDialog();
        setMobileDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full gradient-secondary flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle>
                  {mobileStep === "enter" ? "Change Mobile Number" : "Verify OTP"}
                </DialogTitle>
                <DialogDescription>
                  {mobileStep === "enter" 
                    ? "Enter your new mobile number" 
                    : `Enter the 6-digit code sent to ${newMobile}`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {mobileStep === "enter" ? (
              <div className="space-y-2">
                <Label htmlFor="newMobile">New Mobile Number</Label>
                <Input
                  id="newMobile"
                  type="tel"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter new mobile number"
                  className="h-11"
                  maxLength={15}
                />
                {mobileError && (
                  <p className="text-sm text-destructive">{mobileError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Current: {profile.mobile}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <InputOTP
                  maxLength={6}
                  value={mobileOtp}
                  onChange={setMobileOtp}
                  className="gap-2"
                >
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={0} className="h-12 w-10 text-lg" />
                    <InputOTPSlot index={1} className="h-12 w-10 text-lg" />
                    <InputOTPSlot index={2} className="h-12 w-10 text-lg" />
                    <InputOTPSlot index={3} className="h-12 w-10 text-lg" />
                    <InputOTPSlot index={4} className="h-12 w-10 text-lg" />
                    <InputOTPSlot index={5} className="h-12 w-10 text-lg" />
                  </InputOTPGroup>
                </InputOTP>
                {mobileError && (
                  <p className="text-sm text-destructive">{mobileError}</p>
                )}
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setMobileStep("enter");
                    setMobileOtp("");
                  }}
                >
                  Change number
                </Button>
              </div>
            )}

            <Button
              onClick={handleMobileChange}
              disabled={mobileLoading || (mobileStep === "enter" ? !newMobile : mobileOtp.length !== 6)}
              className="w-full h-11"
            >
              {mobileLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                mobileStep === "enter" ? "Send OTP" : "Verify & Update"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
