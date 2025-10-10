import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Clock } from "lucide-react";
import { MetalButton } from "@/components/ui/metal-button";
import LiquidEther from "@/components/LiquidEther";

const Auth = () => {
  const SITE_URL = (import.meta as any).env?.VITE_PUBLIC_SITE_URL || window.location.origin;
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    console.info("[Auth] Mount: starting auth init", {
      siteUrlEnv: (import.meta as any).env?.VITE_PUBLIC_SITE_URL,
      origin: window.location.origin,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    });

    const verifyAndNavigate = async (sessionUser: any) => {
      console.info("[Auth] verifyAndNavigate", { userId: sessionUser?.id, email: sessionUser?.email });
      
      // Check for profile; if missing, create it automatically on first login
      const { data: existingProfile, error: existingProfileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", sessionUser.id)
        .maybeSingle();
      if (existingProfileError) {
        console.error("[Auth] Error checking existing profile", existingProfileError);
      }

      if (!existingProfile) {
        const displayName = sessionUser.user_metadata?.full_name || sessionUser.email || "";
        const { error: insertProfileError } = await supabase
          .from("profiles")
          .insert({ id: sessionUser.id, full_name: displayName });
        if (insertProfileError) {
          console.error("[Auth] Error inserting profile", insertProfileError);
        } else {
          console.info("[Auth] Profile created for user", { userId: sessionUser.id });
        }
      }

      navigate("/dashboard");
    };

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error("[Auth] getSession error", error);
      }
      if (session?.user?.id) {
        console.info("[Auth] Existing session detected on mount", { userId: session.user.id });
        await verifyAndNavigate(session.user);
      } else {
        console.info("[Auth] No active session on mount");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.info("[Auth] onAuthStateChange", { event, hasSession: !!session, userId: session?.user?.id });
      if (session?.user?.id) {
        await verifyAndNavigate(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        console.info("[Auth] Sign In attempt", { email });
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error("[Auth] Sign In error", { message: error.message, name: error.name, status: (error as any)?.status });
          throw error;
        }
        // After login, the auth listener above will verify profile and route or show error
        toast({ title: "Welcome back!" });
        console.info("[Auth] Sign In success. Awaiting onAuthStateChange to navigate.");
      } else {
        console.info("[Auth] Sign Up attempt", { email, hasFullName: !!fullName });
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/auth?confirmed=1`,
          },
        });

        if (error) {
          console.error("[Auth] Sign Up error", { message: error.message, name: error.name, status: (error as any)?.status });
          // If user already exists, direct to Sign In
          const msg = (error.message || '').toLowerCase();
          if (msg.includes('already registered') || msg.includes('exists') || (msg.includes('email') && msg.includes('already'))) {
            toast({ title: "Account already exists. Please sign in." });
            setIsLogin(true);
            return;
          }
          throw error;
        }

        // Sign up successful - user can now sign in immediately
        toast({ title: "Account created! You can now sign in." });
        setIsLogin(true);
      }
    } catch (error: any) {
      console.error("[Auth] handleSubmit fatal error", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      <div className="absolute inset-0 -z-10">
        <LiquidEther
          colors={["#121212", "#1f1f1f", "#161616"]}
          autoDemo={true}
          autoSpeed={0.4}
          autoIntensity={2.0}
          takeoverDuration={0.25}
          autoResumeDelay={3000}
          autoRampDuration={0.6}
          resolution={0.6}
          cursorSize={120}
          mouseForce={18}
        />
      </div>
      <Card className="w-full max-w-md container-shadow">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <Clock className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">
            {isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Sign in to track your work hours"
              : "Sign up to start tracking your time"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  placeholder="John Doe"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <MetalButton
              type="submit"
              fullWidth
              variant="default"
              disabled={loading}
            >
              {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
            </MetalButton>
          </form>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
