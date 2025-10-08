import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Clock } from "lucide-react";

const Auth = () => {
  const SITE_URL = (import.meta as any).env?.VITE_PUBLIC_SITE_URL || window.location.origin;
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmNotice, setConfirmNotice] = useState<string>("");
  const [canResend, setCanResend] = useState<boolean>(false);
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

    // Handle tokens in URL hash (from confirmation link or magic link)
    const hash = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      
      if (accessToken && refreshToken) {
        console.info("[Auth] Tokens in URL hash found. Setting session and navigating.", { type });
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(async ({ data, error }) => {
            if (error) {
              console.error("[Auth] setSession from hash failed", error);
              toast({
                title: "Authentication Error",
                description: "Failed to confirm your email. Please try again.",
                variant: "destructive",
              });
              return;
            }
            
            if (data.session?.user) {
              console.info("[Auth] Session set from hash. User authenticated.", { userId: data.session.user.id });
              toast({
                title: "Email Confirmed!",
                description: "Welcome! Redirecting to dashboard...",
              });
              
              // Ensure profile exists
              const { data: profile } = await supabase
                .from("profiles")
                .select("id")
                .eq("id", data.session.user.id)
                .maybeSingle();
              
              if (!profile) {
                const displayName = data.session.user.user_metadata?.full_name || data.session.user.email || "";
                await supabase
                  .from("profiles")
                  .insert({ 
                    id: data.session.user.id, 
                    full_name: displayName 
                  });
              }
              
              // Clear URL and navigate
              window.history.replaceState({}, '', '/auth');
              setTimeout(() => navigate('/dashboard'), 500);
            }
          })
          .catch((err) => {
            console.error("[Auth] setSession exception", err);
          });
        return; // Don't run the rest of the effect
      }
    }

    // If redirected back after email confirmation (fallback)
    const params = new URLSearchParams(window.location.search);
    if (params.get('confirmed') === '1') {
      console.info("[Auth] Confirmed=1 detected in URL. Switching to Sign In mode.");
      setIsLogin(true);
      setConfirmNotice("Email confirmed! You can sign in now.");
      setCanResend(false);
      // Clear the URL parameter
      window.history.replaceState({}, '', '/auth');
    }

    const verifyAndNavigate = async (sessionUser: any) => {
      console.info("[Auth] verifyAndNavigate", { userId: sessionUser?.id, email: sessionUser?.email, emailConfirmed: sessionUser?.email_confirmed_at });
      
      // CRITICAL: Check if email is confirmed
      if (!sessionUser?.email_confirmed_at) {
        console.warn("[Auth] Email not confirmed, signing out", { userId: sessionUser?.id });
        await supabase.auth.signOut();
        setConfirmNotice("Please confirm your email before signing in. Check your inbox for the confirmation link.");
        setCanResend(true);
        return;
      }
      
      // Check for profile; if missing, create it automatically on first confirmed login
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
          // If email not confirmed, auto-resend the confirmation email and prompt
          if (typeof error.message === 'string' && error.message.toLowerCase().includes('confirm')) {
            try { await triggerConfirmation(email); } catch (err) { console.error("[Auth] triggerConfirmation after sign-in error", err); }
            setConfirmNotice("Please confirm your email to sign in. We re-sent the confirmation email.");
            setCanResend(true);
            return;
          }
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
          // If user already exists (deleted/recreated or previously registered), direct to Sign In and resend confirmation
          const msg = (error.message || '').toLowerCase();
          if (msg.includes('already registered') || msg.includes('exists') || (msg.includes('email') && msg.includes('already'))) {
            try {
              await triggerConfirmation(email);
              setConfirmNotice("Account already exists. We re-sent the confirmation email. Please check your inbox.");
              setCanResend(true);
            } catch (_) {
              setConfirmNotice("Account already exists. Please sign in or use Resend confirmation email.");
              setCanResend(true);
            }
            setIsLogin(true);
            return;
          }
          throw error;
        }

        // Ensure confirmation email is sent (covers deleted/recreated or prior invites)
        try { await triggerConfirmation(email); } catch (err) { console.error("[Auth] triggerConfirmation after sign-up failed", err); }

        setConfirmNotice("We sent a confirmation link to your email. Please confirm to continue.");
        setCanResend(true);
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

  const triggerConfirmation = async (targetEmail: string) => {
    try {
      console.info("[Auth] triggerConfirmation invoked", { targetEmail });
      const redirectTo = `${window.location.origin}/auth?confirmed=1`;

      // Prefer sending via Edge Function (Resend) to guarantee delivery
      const { data, error } = await supabase.functions.invoke('send-signup-confirmation', {
        body: { email: targetEmail, redirectTo },
      });
      console.info("[Auth] triggerConfirmation response", { data, error });
      if (error) {
        let reqId: string | undefined;
        try {
          const parsed = typeof (error as any)?.context?.error === 'string'
            ? JSON.parse((error as any).context.error)
            : (error as any).context?.error;
          reqId = parsed?.reqId;
          console.error("[Auth] triggerConfirmation error payload", parsed);
        } catch {}
        // Fallback: directly call the function endpoint to retrieve JSON error body
        try {
          const fnUrl = `${(import.meta as any).env?.VITE_SUPABASE_URL || ''}/functions/v1/send-signup-confirmation`;
          const anon = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || '';
          if (fnUrl && anon) {
            const resp = await fetch(fnUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': anon,
                'Authorization': `Bearer ${anon}`,
              },
              body: JSON.stringify({ email: targetEmail, redirectTo }),
            });
            const txt = await resp.text();
            console.error("[Auth] triggerConfirmation fallback fetch", { status: resp.status, body: txt });
            try {
              const json = JSON.parse(txt);
              if (!reqId && json?.reqId) reqId = json.reqId;
            } catch {}
          }
        } catch {}
        throw Object.assign(new Error(error.message), { reqId, raw: error });
      }
      // If email provider is unavailable, function returns actionLink for direct confirmation
      if (data && typeof data === 'object' && 'actionLink' in data && (data as any).actionLink) {
        console.info("[Auth] actionLink returned by server. Redirecting browser.");
        window.location.href = (data as any).actionLink as string;
      }
    } catch (err: any) {
      const context = err?.context || {};
      console.error("[Auth] triggerConfirmation failed", {
        name: err?.name,
        message: err?.message,
        contextStatus: context?.status,
        contextError: context?.error,
        context: context,
      });
      let reqId: string | undefined;
      try {
        // Many function errors include JSON in context.error
        if (err?.reqId) {
          reqId = err.reqId;
        } else if (typeof context?.error === 'string') {
          const parsed = JSON.parse(context.error);
          reqId = parsed?.reqId;
          console.error("[Auth] triggerConfirmation server error JSON", parsed);
        }
      } catch {}
      // UI still shows notice; propagate minimal feedback via toast
      toast({ title: "Confirmation email", description: reqId ? `Attempt failed (reqId ${reqId}). Check inbox/spam, or try again.` : "We attempted to send a confirmation link. Check inbox/spam.", variant: "default" });
      throw err;
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await triggerConfirmation(email);
      setConfirmNotice("Confirmation email re-sent. Please check your inbox and spam folder.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
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
        {confirmNotice && (
          <div className="px-6 pb-6 space-y-2">
            <div className="text-sm text-muted-foreground text-center">
              {confirmNotice}
            </div>
            {canResend && (
              <div className="text-center">
                <Button type="button" variant="outline" size="sm" onClick={handleResend} disabled={loading}>
                  {loading ? 'Sending…' : 'Resend confirmation email'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Auth;
