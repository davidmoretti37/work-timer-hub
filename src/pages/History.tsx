import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import SessionCard from "@/components/SessionCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { History as HistoryIcon } from "lucide-react";
import { formatHoursDetailed } from "@/utils/timeUtils";

const History = () => {
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [totalHours, setTotalHours] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      await checkAdminStatus(session.user.id);
      await fetchSessions(session.user.id);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        checkAdminStatus(session.user.id);
        fetchSessions(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    
    setIsAdmin(!!data);
  };

  const fetchSessions = async (userId: string) => {
    const { data } = await supabase
      .from("time_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("clock_in", { ascending: false });
    
    if (data) {
      setSessions(data);
      const total = data.reduce((sum, session) => sum + (session.hours_worked || 0), 0);
      setTotalHours(total);
    }
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar isAdmin={isAdmin} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <HistoryIcon className="h-8 w-8" />
              My Work History
            </h1>
            <p className="text-muted-foreground">View all your work sessions</p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>Your total hours worked</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {formatHoursDetailed(totalHours)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Across {sessions.length} sessions
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {sessions.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No sessions yet. Start by clocking in!</p>
              </Card>
            ) : (
              sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  clockIn={session.clock_in}
                  clockOut={session.clock_out}
                  hoursWorked={session.hours_worked}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default History;
