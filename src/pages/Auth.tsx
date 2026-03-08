import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Shield, BarChart3, TrendingUp, Package, Users, Loader2, Mail, User, Building2, Phone, LockKeyhole } from "lucide-react";
import { getSafeAuthErrorMessage, logErrorInDev } from "@/lib/errorUtils";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Switch } from "@/components/ui/switch";
import authBgImage from "@/assets/auth-business-bg.jpg";

// Validation schemas
const signupSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters").max(100),
  companyName: z.string().min(2, "Company name must be at least 2 characters").max(100),
  mobile: z.string().min(10, "Mobile number must be at least 10 digits").max(15),
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  pin: z.string().length(6, "PIN must be exactly 6 digits").regex(/^\d{6}$/, "PIN must be 6 digits")
});

const signinSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100)
});

const pinSigninSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  pin: z.string().length(6, "PIN must be exactly 6 digits").regex(/^\d{6}$/, "PIN must be 6 digits")
});

type AuthMode = 'signin' | 'signup' | 'forgot-password' | 'forgot-pin' | 'reset-password' | 'setup-pin';

const Auth = () => {
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPin, setNewPin] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [usePinLogin, setUsePinLogin] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [otpSent, setOtpSent] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate("/dashboard");
      }
    });

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = signupSchema.safeParse({ fullName, companyName, mobile, email, password, pin });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: fullName, mobile }
        }
      });
      if (authError) throw authError;
      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          user_id: authData.user.id, full_name: fullName, company_name: companyName,
          mobile, email, pin_enabled: true
        });
        if (profileError) logErrorInDev('ProfileCreation', profileError);

        const { error: pinError } = await supabase.rpc('set_user_pin', {
          user_uuid: authData.user.id, new_pin: pin
        });
        if (pinError) logErrorInDev('PinSetup', pinError);

        const { error: companyError } = await supabase.from('company_profile').insert({
          user_id: authData.user.id, company_name: companyName, phone: mobile, email
        });
        if (companyError) logErrorInDev('CompanyProfileCreation', companyError);

        const { error: settingsError } = await supabase.from('user_settings').insert({
          user_id: authData.user.id
        });
        if (settingsError) logErrorInDev('SettingsCreation', settingsError);

        toast.success("Account created successfully!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      logErrorInDev('SignUp', error);
      toast.error(getSafeAuthErrorMessage(error));
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usePinLogin) await handlePinSignIn();
    else await handlePasswordSignIn();
  };

  const handlePasswordSignIn = async () => {
    const validation = signinSchema.safeParse({ email, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        logErrorInDev('SignIn', error);
        toast.error(getSafeAuthErrorMessage(error));
      } else {
        toast.success("Signed in successfully!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      logErrorInDev('SignIn', error);
      toast.error(getSafeAuthErrorMessage(error));
    }
    setLoading(false);
  };

  const handlePinSignIn = async () => {
    const validation = pinSigninSchema.safeParse({ email, pin });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('pin-auth', {
        body: { email, pin }
      });
      if (response.error || !response.data?.token_hash) {
        const errorMsg = response.data?.error || "Invalid PIN or email. Please try again.";
        toast.error(errorMsg);
        setLoading(false);
        return;
      }
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: response.data.token_hash,
        type: 'magiclink'
      });
      if (verifyError) {
        logErrorInDev('PinVerifyOtp', verifyError);
        toast.error("Authentication failed. Please try again.");
        setLoading(false);
        return;
      }
      toast.success("Signed in successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      logErrorInDev('PinSignIn', error);
      toast.error(getSafeAuthErrorMessage(error));
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Please enter your email address"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=reset-password`
    });
    if (error) {
      logErrorInDev('ForgotPassword', error);
      toast.error(getSafeAuthErrorMessage(error));
    } else {
      toast.success("Password reset link sent to your email!");
      setOtpSent(true);
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      logErrorInDev('ResetPassword', error);
      toast.error(getSafeAuthErrorMessage(error));
    } else {
      toast.success("Password updated successfully!");
      setAuthMode('signin');
      setNewPassword("");
    }
    setLoading(false);
  };

  const handleSetupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(newPin)) {
      toast.error("PIN must be exactly 6 digits");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in first to set up PIN");
        setAuthMode('signin');
        setLoading(false);
        return;
      }
      const { error: pinError } = await supabase.rpc('set_user_pin', {
        user_uuid: user.id, new_pin: newPin
      });
      if (pinError) throw pinError;
      await supabase.from('profiles').update({ pin_enabled: true }).eq('user_id', user.id);
      toast.success("PIN set up successfully! You can now use PIN to login.");
      navigate("/dashboard");
    } catch (error: any) {
      logErrorInDev('SetupPin', error);
      toast.error("Failed to set up PIN. Please try again.");
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFullName(""); setCompanyName(""); setMobile(""); setEmail("");
    setPassword(""); setPin(""); setNewPassword(""); setNewPin(""); setOtpSent(false);
  };

  const goBack = () => { setAuthMode('signin'); resetForm(); };

  const handleOAuth = async (provider: "google" | "apple") => {
    setOauthLoading(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider);
      if (result.error) {
        toast.error(`${provider === 'google' ? 'Google' : 'Apple'} sign-in failed. Please try again.`);
        setOauthLoading(null);
      }
    } catch (err: any) {
      toast.error(`${provider === 'google' ? 'Google' : 'Apple'} sign-in failed. Please try again.`);
      setOauthLoading(null);
    }
  };

  // ─── Forgot Password ───
  const renderForgotPassword = () => (
    <div className="space-y-6">
      <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Sign In
      </button>
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Forgot Password</h3>
        <p className="text-sm text-muted-foreground">Enter your email to receive a reset link</p>
      </div>
      {!otpSent ? (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="reset-email" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required className="pl-10" />
            </div>
          </div>
          <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</> : "Send Reset Link"}
          </Button>
        </form>
      ) : (
        <div className="text-center space-y-4">
          <div className="p-4 bg-muted rounded-xl border border-border">
            <p className="text-foreground text-sm font-medium">
              ✓ Reset link sent! Check your email inbox.
            </p>
          </div>
          <Button variant="outline" onClick={goBack} className="w-full">Back to Sign In</Button>
        </div>
      )}
    </div>
  );

  // ─── Forgot PIN ───
  const renderForgotPin = () => (
    <div className="space-y-6">
      <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Sign In
      </button>
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <KeyRound className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Forgot PIN</h3>
        <p className="text-sm text-muted-foreground">Sign in with password to reset your PIN</p>
      </div>
      <form onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { toast.error(getSafeAuthErrorMessage(error)); }
        else { setAuthMode('setup-pin'); toast.info("Now set your new PIN"); }
        setLoading(false);
      }} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pin-reset-email">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="pin-reset-email" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required className="pl-10" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pin-reset-password">Password</Label>
          <div className="relative">
            <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="pin-reset-password" type={showPassword ? "text" : "password"} value={password}
              onChange={(e) => setPassword(e.target.value)} required className="pl-10 pr-10" />
            <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
        </div>
        <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Verifying...</> : "Verify & Reset PIN"}
        </Button>
      </form>
    </div>
  );

  // ─── Setup PIN ───
  const renderSetupPin = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Set Up Your PIN</h3>
        <p className="text-sm text-muted-foreground">Create a 6-digit PIN for quick login</p>
      </div>
      <form onSubmit={handleSetupPin} className="space-y-6">
        <div className="flex flex-col items-center space-y-3">
          <Label className="text-sm font-medium">Enter 6-digit PIN</Label>
          <div className="relative">
            <InputOTP maxLength={6} value={newPin} onChange={setNewPin}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot key={index} index={index}
                    className={`w-11 h-12 text-lg border-border ${!showPin ? 'text-security-disc' : ''}`} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button type="button" variant="ghost" size="sm"
              className="absolute -right-10 top-1/2 -translate-y-1/2 hover:bg-transparent"
              onClick={() => setShowPin(!showPin)}>
              {showPin ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
        </div>
        <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || newPin.length !== 6}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Setting up...</> : "Set PIN"}
        </Button>
      </form>
    </div>
  );

  // ─── Reset Password ───
  const renderResetPassword = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Reset Password</h3>
        <p className="text-sm text-muted-foreground">Choose a strong new password</p>
      </div>
      <form onSubmit={handleResetPassword} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <div className="relative">
            <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="new-password" type={showPassword ? "text" : "password"} value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} required minLength={6}
              placeholder="Min 6 characters" className="pl-10 pr-10" />
            <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
        </div>
        <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating...</> : "Update Password"}
        </Button>
      </form>
    </div>
  );

  // ─── Sign In ───
  const renderSignIn = () => (
    <div className="space-y-5">
      <form onSubmit={handleSignIn} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signin-email">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="signin-email" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required className="pl-10" />
          </div>
        </div>

        {/* Login method toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/60 border border-border/50">
          <div className="flex items-center gap-2">
            {usePinLogin ? <KeyRound className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-primary" />}
            <span className="text-sm font-medium text-foreground">
              {usePinLogin ? "PIN Login" : "Password Login"}
            </span>
          </div>
          <Switch checked={usePinLogin} onCheckedChange={setUsePinLogin} />
        </div>

        {usePinLogin ? (
          <div className="space-y-3">
            <Label>Enter 6-digit PIN</Label>
            <div className="flex justify-center relative">
              <InputOTP maxLength={6} value={pin} onChange={setPin}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index}
                      className={`w-11 h-12 text-lg border-border ${!showPin ? 'text-security-disc' : ''}`} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <Button type="button" variant="ghost" size="sm"
                className="absolute -right-10 top-1/2 -translate-y-1/2 hover:bg-transparent"
                onClick={() => setShowPin(!showPin)}>
                {showPin ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
            <button type="button" className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              onClick={() => setAuthMode('forgot-pin')}>
              Forgot PIN?
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="signin-password">Password</Label>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="signin-password" type={showPassword ? "text" : "password"} value={password}
                onChange={(e) => setPassword(e.target.value)} required className="pl-10 pr-10" />
              <Button type="button" variant="ghost" size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
            <button type="button" className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              onClick={() => setAuthMode('forgot-password')}>
              Forgot Password?
            </button>
          </div>
        )}

        <Button type="submit" className="w-full h-11 font-semibold text-base" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signing in...</> : "Sign In"}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground font-medium">or continue with</span>
        </div>
      </div>

      {/* Social buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" className="h-11 gap-2 font-medium"
          disabled={loading || !!oauthLoading} onClick={() => handleOAuth("google")}>
          {oauthLoading === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Google
        </Button>
        <Button type="button" variant="outline" className="h-11 gap-2 font-medium"
          disabled={loading || !!oauthLoading} onClick={() => handleOAuth("apple")}>
          {oauthLoading === "apple" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
          )}
          Apple
        </Button>
      </div>

      {/* Switch to signup */}
      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <button type="button" className="text-primary hover:text-primary/80 font-semibold transition-colors"
          onClick={() => { setAuthMode('signup'); resetForm(); }}>
          Create Account
        </button>
      </p>
    </div>
  );

  // ─── Sign Up ───
  const renderSignUp = () => (
    <div className="space-y-5">
      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="signup-name">Full Name *</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="signup-name" type="text" placeholder="John Doe" value={fullName}
                onChange={(e) => setFullName(e.target.value)} required className="pl-10" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-company">Company Name *</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="signup-company" type="text" placeholder="Acme Corp" value={companyName}
                onChange={(e) => setCompanyName(e.target.value)} required className="pl-10" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="signup-mobile">Mobile Number *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="signup-mobile" type="tel" placeholder="+91 9876543210" value={mobile}
                onChange={(e) => setMobile(e.target.value)} required className="pl-10" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="signup-email" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required className="pl-10" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password">Password *</Label>
          <div className="relative">
            <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="signup-password" type={showPassword ? "text" : "password"} placeholder="Min 6 characters"
              value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-10 pr-10" />
            <Button type="button" variant="ghost" size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <Label>Create 6-digit PIN (for quick login) *</Label>
          <div className="flex justify-center relative">
            <InputOTP maxLength={6} value={pin} onChange={setPin}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot key={index} index={index}
                    className={`w-11 h-12 text-lg border-border ${!showPin ? 'text-security-disc' : ''}`} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button type="button" variant="ghost" size="sm"
              className="absolute -right-10 top-1/2 -translate-y-1/2 hover:bg-transparent"
              onClick={() => setShowPin(!showPin)}>
              {showPin ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">This PIN will be used for quick sign-in</p>
        </div>

        <Button type="submit" className="w-full h-11 font-semibold text-base" disabled={loading}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating account...</> : "Create Account"}
        </Button>
      </form>

      {/* Switch to signin */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <button type="button" className="text-primary hover:text-primary/80 font-semibold transition-colors"
          onClick={() => { setAuthMode('signin'); resetForm(); }}>
          Sign In
        </button>
      </p>
    </div>
  );

  const renderContent = () => {
    switch (authMode) {
      case 'forgot-password': return renderForgotPassword();
      case 'forgot-pin': return renderForgotPin();
      case 'setup-pin': return renderSetupPin();
      case 'reset-password': return renderResetPassword();
      case 'signup': return renderSignUp();
      default: return renderSignIn();
    }
  };

  const getTitle = () => {
    switch (authMode) {
      case 'signup': return 'Create Account';
      case 'forgot-password': return 'Reset Password';
      case 'forgot-pin': return 'Reset PIN';
      case 'setup-pin': return 'Set Up PIN';
      case 'reset-password': return 'New Password';
      default: return 'Welcome Back';
    }
  };

  const getSubtitle = () => {
    switch (authMode) {
      case 'signup': return 'Start managing your business today';
      case 'forgot-password': return "We'll send you a reset link";
      case 'forgot-pin': return 'Verify your identity first';
      case 'setup-pin': return 'Create a quick-access PIN';
      case 'reset-password': return 'Choose a strong password';
      default: return 'Sign in to manage your business';
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Side - Branding Panel */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${authBgImage})` }} />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/85 to-accent/70" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />

        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 text-white w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">DC Finance</h1>
              <p className="text-white/60 text-[11px] font-semibold tracking-[0.2em] uppercase">Business Suite</p>
            </div>
          </div>

          {/* Hero */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl xl:text-5xl font-extrabold leading-[1.1] tracking-tight">
                Manage Your<br />Business
                <span className="block bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">Smarter</span>
              </h2>
              <p className="text-white/65 text-base max-w-sm leading-relaxed">
                Invoicing, inventory, analytics & client management — everything in one powerful platform.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { icon: <Package className="w-3.5 h-3.5" />, label: "Inventory" },
                { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Analytics" },
                { icon: <BarChart3 className="w-3.5 h-3.5" />, label: "Balance Sheet" },
                { icon: <Users className="w-3.5 h-3.5" />, label: "Clients" }
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/15 text-xs font-medium">
                  {f.icon}
                  {f.label}
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-8">
            {[
              { value: "1K+", label: "Businesses" },
              { value: "50K+", label: "Invoices" },
              { value: "99.9%", label: "Uptime" }
            ].map((stat, i) => (
              <div key={stat.label} className="flex items-center gap-8">
                {i > 0 && <div className="w-px h-10 bg-white/20 -ml-4" />}
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-white/50 text-xs font-medium">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-[55%] xl:w-1/2 flex items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="w-full max-w-[460px]">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: 'var(--gradient-primary)' }}>
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">DC Finance</h1>
              <p className="text-xs text-muted-foreground">Business Suite</p>
            </div>
          </div>

          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {getTitle()}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {getSubtitle()}
            </p>
          </div>

          {/* Auth Card */}
          <Card className="border border-border/60 shadow-2xl shadow-primary/5 bg-card">
            <CardContent className="p-5 sm:p-7">
              {renderContent()}
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground mt-6">
            Secured with end-to-end encryption • © {new Date().getFullYear()} DC Finance
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
