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
    // Get user's email to lookup employee_id
    const { data: authUser } = await supabase.auth.getUser();
    const userEmail = authUser?.user?.email;

    if (!userEmail) {
      console.error('No user email found');
      return;
    }

    // Get employee record
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("email", userEmail.toLowerCase().trim())
      .maybeSingle();

    if (!employee) {
      // No employee record yet, show empty state
      setSessions([]);
      setTotalHours(0);
      return;
    }

    // Fetch clock_in_records for this employee
    const { data } = await supabase
      .from("clock_in_records")
      .select("*")
      .eq("employee_id", employee.id)
      .order("clock_in_time", { ascending: false });

    if (data) {
      // Transform to match expected format for SessionCard
      const transformedSessions = data.map((record: any) => ({
        id: record.id,
        clock_in: record.clock_in_time,
        clock_out: record.clock_out_time,
        paused_at: record.paused_at,
        break_seconds: record.break_seconds,
        break_end: record.break_end,
        idle_seconds: record.idle_seconds,
        // Calculate hours_worked from clock_in_time and clock_out_time
        hours_worked: record.clock_out_time
          ? (new Date(record.clock_out_time).getTime() - new Date(record.clock_in_time).getTime()) / (1000 * 60 * 60) -
            (record.break_seconds || 0) / 3600
          : null
      }));

      setSessions(transformedSessions);
      const total = transformedSessions.reduce((sum, session) => sum + (session.hours_worked || 0), 0);
      setTotalHours(total);
    }
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen">
      <Navbar isAdmin={isAdmin} />
      
      <main className="container mx-auto px-4 py-8 pt-32">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <HistoryIcon className="h-8 w-8" />
              My Work History
            </h1>
            <p className="text-muted-foreground">View all your work sessions</p>
          </div>

          <Card className="mb-6 container-shadow">
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
              <Card className="p-8 text-center container-shadow">
                <p className="text-muted-foreground">No sessions yet. Start by clocking in!</p>
              </Card>
            ) : (
              sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  clockIn={session.clock_in}
                  clockOut={session.clock_out}
                  hoursWorked={session.hours_worked}
                  pausedAt={session.paused_at}
                  breakSeconds={session.break_seconds}
                  breakEnd={session.break_end}
                  idleSeconds={session.idle_seconds}
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
