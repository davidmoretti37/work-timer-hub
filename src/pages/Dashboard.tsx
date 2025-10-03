import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import StatusBadge from "@/components/StatusBadge";
import TimeDisplay from "@/components/TimeDisplay";
import { Clock, PlayCircle, StopCircle } from "lucide-react";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      await fetchProfile(session.user.id);
      await checkAdminStatus(session.user.id);
      await fetchActiveSession(session.user.id);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchProfile(session.user.id);
        checkAdminStatus(session.user.id);
        fetchActiveSession(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    
    setProfile(data);
  };

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    
    setIsAdmin(!!data);
  };

  const fetchActiveSession = async (userId: string) => {
    const { data } = await supabase
      .from("time_sessions")
      .select("*")
      .eq("user_id", userId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    setActiveSession(data);
  };

  const handleClockIn = async () => {
    if (!user) return;
    
    setLoading(true);
    const { error } = await supabase
      .from("time_sessions")
      .insert({
        user_id: user.id,
        clock_in: new Date().toISOString(),
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to clock in",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Clocked In",
        description: "Your work session has started",
      });
      await fetchActiveSession(user.id);
    }
    setLoading(false);
  };

  const handleClockOut = async () => {
    if (!user || !activeSession) return;
    
    setLoading(true);
    const { error } = await supabase
      .from("time_sessions")
      .update({
        clock_out: new Date().toISOString(),
      })
      .eq("id", activeSession.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to clock out",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Clocked Out",
        description: "Your work session has ended",
      });
      setActiveSession(null);
    }
    setLoading(false);
  };

  if (!user || !profile) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar isAdmin={isAdmin} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome back, {profile.full_name}!</h1>
            <p className="text-muted-foreground">Track your work hours easily</p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Current Status
                  </CardTitle>
                  <CardDescription>Your active work session</CardDescription>
                </div>
                <StatusBadge isClockedIn={!!activeSession} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {activeSession ? (
                <>
                  <TimeDisplay time={activeSession.clock_in} label="Clocked in at" />
                  <Button
                    onClick={handleClockOut}
                    disabled={loading}
                    variant="destructive"
                    size="lg"
                    className="w-full"
                  >
                    <StopCircle className="mr-2 h-5 w-5" />
                    Clock Out
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleClockIn}
                  disabled={loading}
                  size="lg"
                  className="w-full"
                >
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Clock In
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
