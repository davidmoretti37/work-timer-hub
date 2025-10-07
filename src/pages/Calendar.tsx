import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from "date-fns";

const Calendar = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [ptoRequests, setPtoRequests] = useState<any[]>([]);
  const navigate = useNavigate();

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
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchProfile(session.user.id);
        checkAdminStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Separate useEffect for fetching PTO requests that depends on user and isAdmin
  useEffect(() => {
    if (user) {
      fetchPTORequests();
    }
  }, [user, isAdmin]); // This will refetch when user or isAdmin changes

  // Realtime updates: listen for PTO request changes and refresh when approved
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('pto_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pto_requests' }, (payload: any) => {
        const newRow = payload.new;
        const oldRow = payload.old;

        // Refresh on any transition that results in approved status
        const becameApproved = newRow?.status === 'approved' && oldRow?.status !== 'approved';
        const wasDeleted = payload.eventType === 'DELETE';

        if (becameApproved || wasDeleted) {
          // Only update if current user should see it (non-admin sees only their own)
          if (isAdmin || newRow?.user_id === user.id) {
            fetchPTORequests();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin]);

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

  const fetchPTORequests = async () => {
    try {
      console.log("🔄 Fetching PTO requests... isAdmin:", isAdmin, "user:", user?.id);
      
      let query = supabase
        .from("pto_requests")
        .select(`
          *,
          profiles:user_id(display_name, email)
        `)
        .eq("status", "approved");

      // If not admin, only fetch current user's PTO
      if (!isAdmin && user) {
        query = query.eq("user_id", user.id);
        console.log("📋 Fetching PTO for user:", user.id, "(non-admin)");
      } else {
        console.log("📋 Fetching PTO for all users (admin or no user filter)");
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      console.log("✅ PTO requests fetched:", data?.length || 0, "records");
      console.log("📊 PTO data:", data);
      
      setPtoRequests(data || []);
    } catch (error) {
      console.error("❌ Error fetching PTO requests:", error);
    }
  };

  const getPTOForDate = (date: Date) => {
    return ptoRequests.filter(pto => {
      const startDate = new Date(pto.start_date);
      const endDate = new Date(pto.end_date);
      return date >= startDate && date <= endDate;
    });
  };

  // Calendar logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  const navigateToPrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const navigateToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  if (!user || !profile) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar isAdmin={isAdmin} />
      
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
            <CardTitle className="text-2xl font-bold">
              {format(currentDate, "MMMM yyyy")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={navigateToPrevMonth}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
                className="px-3"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={navigateToNextMonth}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="p-2 text-center text-sm font-medium text-muted-foreground border-b"
                >
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {dateRange.map((date) => {
                const isCurrentMonth = isSameMonth(date, currentDate);
                const isCurrentDay = isToday(date);
                const ptoForDate = getPTOForDate(date);
                
                return (
                  <div
                    key={date.toISOString()}
                    className={`
                      min-h-[120px] p-2 border rounded-lg transition-colors hover:bg-accent/50
                      ${isCurrentMonth ? "bg-card" : "bg-muted/30"}
                      ${isCurrentDay ? "bg-primary/10 border-primary" : "border-border"}
                    `}
                  >
                    <div className={`
                      text-sm font-medium mb-2
                      ${isCurrentMonth ? "text-foreground" : "text-muted-foreground"}
                      ${isCurrentDay ? "text-primary font-bold" : ""}
                    `}>
                      {format(date, "d")}
                    </div>
                    
                    {/* PTO Events */}
                    <div className="space-y-1">
                      {ptoForDate.map((pto, index) => (
                        <div
                          key={pto.id + index}
                          className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded truncate border border-blue-200"
                          title={`PTO - ${pto.profiles?.display_name || pto.employee_name} (${pto.reason_type})`}
                        >
                          <div className="font-medium">
                            {isAdmin 
                              ? `${pto.profiles?.display_name || pto.employee_name} - PTO`
                              : "PTO"
                            }
                          </div>
                          <div className="text-xs opacity-75 capitalize">
                            {pto.reason_type}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Calendar;
