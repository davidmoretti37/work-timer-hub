import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import SessionCard from "@/components/SessionCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users } from "lucide-react";

const Admin = () => {
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      const adminStatus = await checkAdminStatus(session.user.id);
      
      if (!adminStatus) {
        navigate("/dashboard");
        return;
      }

      await fetchAllSessions();
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
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
    
    const admin = !!data;
    setIsAdmin(admin);
    return admin;
  };

  const fetchAllSessions = async () => {
    const { data: sessionsData } = await supabase
      .from("time_sessions")
      .select("*")
      .order("clock_in", { ascending: false });
    
    if (sessionsData) {
      setSessions(sessionsData);
      
      // Fetch profiles for all users
      const userIds = [...new Set(sessionsData.map(s => s.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);
      
      if (profilesData) {
        const profileMap = new Map(profilesData.map(p => [p.id, p]));
        setProfiles(profileMap);
      }
    }
  };

  const calculateUserStats = (userId: string) => {
    const userSessions = sessions.filter(s => s.user_id === userId);
    const totalHours = userSessions.reduce((sum, s) => sum + (s.hours_worked || 0), 0);
    return { sessions: userSessions.length, hours: totalHours };
  };

  if (!user || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const uniqueUserIds = [...new Set(sessions.map(s => s.user_id))];

  return (
    <div className="min-h-screen bg-background">
      <Navbar isAdmin={isAdmin} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Users className="h-8 w-8" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">Overview of all users and their work sessions</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{uniqueUserIds.length}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{sessions.length}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Total Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  {sessions.reduce((sum, s) => sum + (s.hours_worked || 0), 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">All Sessions</TabsTrigger>
              <TabsTrigger value="users">By User</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-4 mt-6">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  clockIn={session.clock_in}
                  clockOut={session.clock_out}
                  hoursWorked={session.hours_worked}
                  userName={profiles.get(session.user_id)?.full_name}
                />
              ))}
            </TabsContent>
            
            <TabsContent value="users" className="space-y-6 mt-6">
              {uniqueUserIds.map((userId) => {
                const profile = profiles.get(userId);
                const stats = calculateUserStats(userId);
                return (
                  <Card key={userId}>
                    <CardHeader>
                      <CardTitle>{profile?.full_name || "Unknown User"}</CardTitle>
                      <CardDescription>
                        {stats.sessions} sessions • {stats.hours.toFixed(2)} total hours
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {sessions
                        .filter(s => s.user_id === userId)
                        .map((session) => (
                          <SessionCard
                            key={session.id}
                            clockIn={session.clock_in}
                            clockOut={session.clock_out}
                            hoursWorked={session.hours_worked}
                          />
                        ))}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Admin;
