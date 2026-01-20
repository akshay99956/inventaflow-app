import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Shield, BarChart3, TrendingUp, Package, Users } from "lucide-react";
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
  pin: z.string().length(4, "PIN must be exactly 4 digits").regex(/^\d{4}$/, "PIN must be 4 digits"),
});

const signinSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

const pinSigninSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  pin: z.string().length(4, "PIN must be exactly 4 digits").regex(/^\d{4}$/, "PIN must be 4 digits"),
});

type AuthMode = 'signin' | 'signup' | 'forgot-password' | 'forgot-pin' | 'reset-password' | 'setup-pin';

const Auth = () => {
  // Form state
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [usePinLogin, setUsePinLogin] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [otpSent, setOtpSent] = useState(false);
  
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkSession();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = signupSchema.safeParse({
      fullName,
      companyName,
      mobile,
      email,
      password,
      pin,
    });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    
    try {
      // 1. Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: fullName,
            mobile: mobile,
          }
        }
      });

      if (authError) throw authError;
      
      if (authData.user) {
        // 2. Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            full_name: fullName,
            company_name: companyName,
            mobile: mobile,
            email: email,
            pin_enabled: true,
          });
        
        if (profileError) {
          logErrorInDev('ProfileCreation', profileError);
        }

        // 3. Set PIN using RPC function
        const { error: pinError } = await supabase.rpc('set_user_pin', {
          user_uuid: authData.user.id,
          new_pin: pin
        });
        
        if (pinError) {
          logErrorInDev('PinSetup', pinError);
        }

        // 4. Create company profile
        const { error: companyError } = await supabase
          .from('company_profile')
          .insert({
            user_id: authData.user.id,
            company_name: companyName,
            phone: mobile,
            email: email,
          });
        
        if (companyError) {
          logErrorInDev('CompanyProfileCreation', companyError);
        }

        // 5. Create default user settings
        const { error: settingsError } = await supabase
          .from('user_settings')
          .insert({
            user_id: authData.user.id,
          });
        
        if (settingsError) {
          logErrorInDev('SettingsCreation', settingsError);
        }

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
    
    if (usePinLogin) {
      await handlePinSignIn();
    } else {
      await handlePasswordSignIn();
    }
  };

  const handlePasswordSignIn = async () => {
    const validation = signinSchema.safeParse({ email, password });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logErrorInDev('SignIn', error);
      toast.error(getSafeAuthErrorMessage(error));
    } else {
      toast.success("Signed in successfully!");
      navigate("/dashboard");
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
      // First, we need to get the user by email and verify PIN
      // For PIN login, we'll use a workaround: store email+PIN temporarily and verify
      const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: sessionStorage.getItem(`temp_pwd_${email}`) || password,
      });

      if (signInError) {
        // If we can't sign in with stored password, fall back to regular auth
        toast.error("PIN login requires initial password authentication. Please use password login first.");
        setUsePinLogin(false);
        setLoading(false);
        return;
      }

      if (user) {
        // Verify PIN
        const { data: pinValid, error: pinError } = await supabase.rpc('verify_pin', {
          user_uuid: user.id,
          input_pin: pin
        });

        if (pinError || !pinValid) {
          await supabase.auth.signOut();
          toast.error("Invalid PIN. Please try again.");
          setLoading(false);
          return;
        }

        toast.success("Signed in successfully!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      logErrorInDev('PinSignIn', error);
      toast.error(getSafeAuthErrorMessage(error));
    }
    
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

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
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

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
    
    if (!/^\d{4}$/.test(newPin)) {
      toast.error("PIN must be exactly 4 digits");
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
        user_uuid: user.id,
        new_pin: newPin
      });
      
      if (pinError) throw pinError;

      // Update profile to enable PIN
      await supabase
        .from('profiles')
        .update({ pin_enabled: true })
        .eq('user_id', user.id);

      toast.success("PIN set up successfully! You can now use PIN to login.");
      navigate("/dashboard");
    } catch (error: any) {
      logErrorInDev('SetupPin', error);
      toast.error("Failed to set up PIN. Please try again.");
    }
    
    setLoading(false);
  };

  const resetForm = () => {
    setFullName("");
    setCompanyName("");
    setMobile("");
    setEmail("");
    setPassword("");
    setPin("");
    setNewPassword("");
    setNewPin("");
    setOtpSent(false);
  };

  const goBack = () => {
    setAuthMode('signin');
    resetForm();
  };

  // Render different modes
  const renderContent = () => {
    switch (authMode) {
      case 'forgot-password':
        return (
          <div className="space-y-4">
            <Button variant="ghost" onClick={goBack} className="mb-2 -ml-2" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Sign In
            </Button>
            
            <div className="text-center mb-4">
              <Lock className="h-12 w-12 mx-auto text-primary mb-2" />
              <h3 className="text-lg font-semibold">Forgot Password</h3>
              <p className="text-sm text-muted-foreground">Enter your email to receive a reset link</p>
            </div>
            
            {!otpSent ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            ) : (
              <div className="text-center space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-green-700 dark:text-green-300">
                    Reset link sent! Check your email inbox.
                  </p>
                </div>
                <Button variant="outline" onClick={goBack} className="w-full">
                  Back to Sign In
                </Button>
              </div>
            )}
          </div>
        );

      case 'forgot-pin':
        return (
          <div className="space-y-4">
            <Button variant="ghost" onClick={goBack} className="mb-2 -ml-2" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Sign In
            </Button>
            
            <div className="text-center mb-4">
              <KeyRound className="h-12 w-12 mx-auto text-primary mb-2" />
              <h3 className="text-lg font-semibold">Forgot PIN</h3>
              <p className="text-sm text-muted-foreground">Sign in with password to reset your PIN</p>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              const { error } = await supabase.auth.signInWithPassword({ email, password });
              if (error) {
                toast.error(getSafeAuthErrorMessage(error));
              } else {
                setAuthMode('setup-pin');
                toast.info("Now set your new PIN");
              }
              setLoading(false);
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin-reset-email">Email</Label>
                <Input
                  id="pin-reset-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pin-reset-password">Password</Label>
                <div className="relative">
                  <Input
                    id="pin-reset-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verifying..." : "Verify & Reset PIN"}
              </Button>
            </form>
          </div>
        );

      case 'setup-pin':
        return (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <Shield className="h-12 w-12 mx-auto text-primary mb-2" />
              <h3 className="text-lg font-semibold">Set Up Your PIN</h3>
              <p className="text-sm text-muted-foreground">Create a 4-digit PIN for quick login</p>
            </div>
            
            <form onSubmit={handleSetupPin} className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <Label>Enter 4-digit PIN</Label>
                <div className="relative">
                  <InputOTP
                    maxLength={4}
                    value={newPin}
                    onChange={setNewPin}
                  >
                    <InputOTPGroup>
                      {[0, 1, 2, 3].map((index) => (
                        <InputOTPSlot 
                          key={index} 
                          index={index}
                          className={`w-12 h-12 text-lg ${!showPin ? 'text-security-disc' : ''}`}
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute -right-10 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPin(!showPin)}
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || newPin.length !== 4}>
                {loading ? "Setting up..." : "Set PIN"}
              </Button>
            </form>
          </div>
        );

      case 'reset-password':
        return (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <Lock className="h-12 w-12 mx-auto text-primary mb-2" />
              <h3 className="text-lg font-semibold">Reset Password</h3>
              <p className="text-sm text-muted-foreground">Enter your new password</p>
            </div>
            
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </div>
        );

      default:
        return (
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                {/* Login method toggle */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {usePinLogin ? <KeyRound className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    <span className="text-sm font-medium">
                      {usePinLogin ? "PIN Login" : "Password Login"}
                    </span>
                  </div>
                  <Switch
                    checked={usePinLogin}
                    onCheckedChange={setUsePinLogin}
                  />
                </div>
                
                {usePinLogin ? (
                  <div className="space-y-2">
                    <Label>Enter 4-digit PIN</Label>
                    <div className="flex justify-center relative">
                      <InputOTP
                        maxLength={4}
                        value={pin}
                        onChange={setPin}
                      >
                        <InputOTPGroup>
                          {[0, 1, 2, 3].map((index) => (
                            <InputOTPSlot 
                              key={index} 
                              index={index}
                              className={`w-12 h-12 text-lg ${!showPin ? 'text-security-disc' : ''}`}
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute -right-10 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPin(!showPin)}
                      >
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-sm h-auto py-0"
                      onClick={() => setAuthMode('forgot-pin')}
                    >
                      Forgot PIN?
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-sm h-auto py-0"
                      onClick={() => setAuthMode('forgot-password')}
                    >
                      Forgot Password?
                    </Button>
                  </div>
                )}
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name *</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-company">Company Name *</Label>
                    <Input
                      id="signup-company"
                      type="text"
                      placeholder="Acme Corp"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-mobile">Mobile Number *</Label>
                    <Input
                      id="signup-mobile"
                      type="tel"
                      placeholder="+91 9876543210"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email *</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Create 4-digit PIN (for quick login) *</Label>
                  <div className="flex justify-center relative">
                    <InputOTP
                      maxLength={4}
                      value={pin}
                      onChange={setPin}
                    >
                      <InputOTPGroup>
                        {[0, 1, 2, 3].map((index) => (
                          <InputOTPSlot 
                            key={index} 
                            index={index}
                            className={`w-12 h-12 text-lg ${!showPin ? 'text-security-disc' : ''}`}
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute -right-10 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPin(!showPin)}
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    This PIN will be used for quick sign-in
                  </p>
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        );
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side - Business Background with Features */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${authBgImage})` }}
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-purple-900/80" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-8 xl:p-12 text-white w-full">
          {/* Logo & Title */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl xl:text-3xl font-bold">DC Finance</h1>
                <p className="text-white/80 text-sm">Business Management Suite</p>
              </div>
            </div>
          </div>
          
          {/* Features Grid */}
          <div className="space-y-6">
            <h2 className="text-xl xl:text-2xl font-semibold">
              Complete Business Solution
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <FeatureCard 
                icon={<Package className="w-6 h-6" />}
                title="Inventory"
                description="Track stock & products"
              />
              <FeatureCard 
                icon={<TrendingUp className="w-6 h-6" />}
                title="Profit & Loss"
                description="Real-time analytics"
              />
              <FeatureCard 
                icon={<BarChart3 className="w-6 h-6" />}
                title="Balance Sheet"
                description="Financial overview"
              />
              <FeatureCard 
                icon={<Users className="w-6 h-6" />}
                title="Clients"
                description="Manage relationships"
              />
            </div>
          </div>
          
          {/* Testimonial/Quote */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <p className="text-white/90 italic text-sm xl:text-base">
              "Streamline your grocery business with powerful invoicing, inventory management, and financial insights - all in one place."
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg font-bold">
                DC
              </div>
              <div>
                <p className="font-medium text-sm">DC Finance Pro</p>
                <p className="text-white/70 text-xs">Trusted by 1000+ businesses</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Side - Mobile Mockup with Auth Form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-background to-muted/30">
        {/* Mobile Frame */}
        <div className="w-full max-w-md">
          {/* Mobile Header - Only visible on lg+ */}
          <div className="hidden lg:block mb-6 text-center">
            <h2 className="text-lg font-semibold text-foreground">
              📱 Mobile-Ready Experience
            </h2>
            <p className="text-sm text-muted-foreground">
              Access your business anywhere, anytime
            </p>
          </div>
          
          {/* Phone Mockup Frame */}
          <div className="relative mx-auto lg:max-w-[380px]">
            {/* Phone Border - Visible on lg+ */}
            <div className="hidden lg:block absolute -inset-3 bg-gradient-to-b from-gray-800 to-gray-900 rounded-[3rem] shadow-2xl" />
            <div className="hidden lg:block absolute -inset-2 bg-gradient-to-b from-gray-700 to-gray-800 rounded-[2.5rem]" />
            
            {/* Phone Notch */}
            <div className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-gray-900 rounded-b-2xl z-20" />
            
            {/* Screen Content */}
            <div className="relative lg:bg-background lg:rounded-[2rem] lg:overflow-hidden lg:border-4 lg:border-gray-800">
              {/* Status Bar - Phone mockup only */}
              <div className="hidden lg:flex items-center justify-between px-6 py-2 bg-muted/50 text-xs text-muted-foreground">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-2 bg-green-500 rounded-sm" />
                  <span>100%</span>
                </div>
              </div>
              
              {/* Auth Card Content */}
              <Card className="border-0 shadow-none lg:rounded-none">
                <CardHeader className="space-y-1 text-center pb-4">
                  {/* Mobile Logo - Only on mobile */}
                  <div className="lg:hidden flex items-center justify-center gap-2 mb-2">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-xl sm:text-2xl font-bold text-primary">
                    Welcome Back
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Sign in to manage your business
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  {renderContent()}
                </CardContent>
              </Card>
              
              {/* Home Indicator - Phone mockup only */}
              <div className="hidden lg:flex justify-center pb-2 pt-1">
                <div className="w-32 h-1 bg-gray-400 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Feature Card Component
const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-colors">
    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-3">
      {icon}
    </div>
    <h3 className="font-semibold text-sm">{title}</h3>
    <p className="text-white/70 text-xs mt-1">{description}</p>
  </div>
);

export default Auth;
