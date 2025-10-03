import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import SessionCard from "@/components/SessionCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, CalendarIcon } from "lucide-react";
import { formatHoursDetailed } from "@/utils/timeUtils";
import { format, subWeeks, subMonths, startOfDay, endOfDay, isWithinInterval, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const Admin = () => {
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileCreationAttempted, setProfileCreationAttempted] = useState<Set<string>>(new Set());
  const [userFilters, setUserFilters] = useState<Map<string, { period: string; customStart?: Date; customEnd?: Date }>>(new Map());
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
        console.log("Profiles loaded:", profileMap);
        console.log("Sessions:", sessionsData);
        
        // Debug missing profiles
        const sessionsWithoutProfiles = sessionsData.filter(s => !profileMap.has(s.user_id));
        if (sessionsWithoutProfiles.length > 0) {
          console.warn("Sessions without profiles:", sessionsWithoutProfiles);
          console.warn("Missing profile user IDs:", sessionsWithoutProfiles.map(s => s.user_id));
          
          // Only try to create missing profiles if we haven't attempted for these users already
          const newMissingUserIds = sessionsWithoutProfiles
            .map(s => s.user_id)
            .filter(userId => !profileCreationAttempted.has(userId));
          
          if (newMissingUserIds.length > 0) {
            console.log("Will attempt to create profiles for new missing users:", newMissingUserIds);
            await createMissingProfiles(newMissingUserIds);
          } else {
            console.log("Already attempted profile creation for all missing users");
          }
        }
      }
    }
  };

  const createMissingProfiles = async (userIds: string[]) => {
    console.log("Attempting to create missing profiles for:", userIds);
    
    // Mark these users as attempted to prevent infinite retry
    const newAttempted = new Set([...profileCreationAttempted, ...userIds]);
    setProfileCreationAttempted(newAttempted);
    
    for (const userId of userIds) {
      try {
        const { error } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            full_name: "Unknown User"
          });
          
        if (error) {
          if (error.code === '42501') {
            console.error(`RLS Policy Error: Admin cannot create profiles for other users. Need to add INSERT policy for admins.`);
            console.error(`This profile needs to be created manually or via database trigger for user: ${userId}`);
          } else if (error.code === '23505') {
            console.warn(`Profile already exists for user ${userId}, but not visible to admin due to RLS SELECT policy`);
            console.warn(`This suggests the SELECT policy for profiles needs to include admin access`);
          } else {
            console.error(`Failed to create profile for ${userId}:`, error);
          }
        } else {
          console.log(`Successfully created profile for user ${userId}`);
        }
      } catch (error) {
        console.error(`Error creating profile for user ${userId}:`, error);
      }
    }
    
    // Don't automatically retry - this causes infinite loops
    console.log("Profile creation attempt completed. Manual refresh may be needed.");
  };

  const calculateUserStats = (userId: string) => {
    const userSessions = sessions.filter(s => s.user_id === userId);
    const totalHours = userSessions.reduce((sum, s) => sum + (s.hours_worked || 0), 0);
    return { sessions: userSessions.length, hours: totalHours };
  };

  const getFilteredSessions = (userId: string) => {
    const userSessions = sessions.filter(s => s.user_id === userId);
    const filter = userFilters.get(userId);
    
    if (!filter || filter.period === 'all') {
      return userSessions;
    }

    const now = new Date();
    let startDate: Date;
    let endDate: Date = endOfDay(now);

    switch (filter.period) {
      case 'week':
        startDate = startOfDay(subWeeks(now, 1));
        break;
      case 'biweekly':
        startDate = startOfDay(subWeeks(now, 2));
        break;
      case 'month':
        startDate = startOfDay(subMonths(now, 1));
        break;
      case 'custom':
        if (filter.customStart && filter.customEnd) {
          startDate = startOfDay(filter.customStart);
          endDate = endOfDay(filter.customEnd);
        } else {
          return userSessions;
        }
        break;
      default:
        return userSessions;
    }

    return userSessions.filter(session => {
      const sessionDate = new Date(session.clock_in);
      return isWithinInterval(sessionDate, { start: startDate, end: endDate });
    });
  };

  const calculateFilteredUserStats = (userId: string) => {
    const filteredSessions = getFilteredSessions(userId);
    const totalHours = filteredSessions.reduce((sum, s) => sum + (s.hours_worked || 0), 0);
    return { sessions: filteredSessions.length, hours: totalHours, filteredSessions };
  };

  const groupSessionsByDay = (sessions: any[], filter: { period: string; customStart?: Date; customEnd?: Date } | undefined) => {
    if (!filter || filter.period === 'all') {
      return { grouped: false, sessions };
    }

    // Get the date range for the filter
    const now = new Date();
    let startDate: Date;
    let endDate: Date = endOfDay(now);

    switch (filter.period) {
      case 'week':
        startDate = startOfDay(subWeeks(now, 1));
        endDate = endOfDay(now);
        break;
      case 'biweekly':
        startDate = startOfDay(subWeeks(now, 2));
        endDate = endOfDay(now);
        break;
      case 'month':
        startDate = startOfDay(subMonths(now, 1));
        endDate = endOfDay(now);
        break;
      case 'custom':
        if (filter.customStart && filter.customEnd) {
          startDate = startOfDay(filter.customStart);
          endDate = endOfDay(filter.customEnd);
        } else {
          return { grouped: false, sessions };
        }
        break;
      default:
        return { grouped: false, sessions };
    }

    // Get all days in the range
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Group sessions by day
    const sessionsByDay = allDays.map(day => {
      const daySessions = sessions.filter(session => 
        isSameDay(new Date(session.clock_in), day)
      );
      const dayHours = daySessions.reduce((sum, s) => sum + (s.hours_worked || 0), 0);
      
      return {
        date: day,
        sessions: daySessions,
        hours: dayHours,
        hasData: daySessions.length > 0
      };
    });

    return { grouped: true, sessionsByDay };
  };

  const handleFilterChange = (userId: string, period: string) => {
    const newFilters = new Map(userFilters);
    newFilters.set(userId, { period });
    setUserFilters(newFilters);
  };

  const handleCustomDateChange = (userId: string, type: 'start' | 'end', date: Date | undefined) => {
    if (!date) return;
    
    const newFilters = new Map(userFilters);
    const currentFilter = newFilters.get(userId) || { period: 'custom' };
    
    if (type === 'start') {
      currentFilter.customStart = date;
    } else {
      currentFilter.customEnd = date;
    }
    
    currentFilter.period = 'custom';
    newFilters.set(userId, currentFilter);
    setUserFilters(newFilters);
  };

  const handleUpdateSession = async (sessionId: string, clockIn: string, clockOut: string | null) => {
    try {
      const { error } = await supabase
        .from("time_sessions")
        .update({
          clock_in: clockIn,
          clock_out: clockOut,
        })
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "Session updated",
        description: "Session times have been updated and hours recalculated.",
      });

      // Refresh sessions to get updated hours_worked
      await fetchAllSessions();
    } catch (error: any) {
      toast({
        title: "Error updating session",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("time_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "Session deleted",
        description: "The session has been removed.",
      });

      // Refresh sessions
      await fetchAllSessions();
    } catch (error: any) {
      toast({
        title: "Error deleting session",
        description: error.message,
        variant: "destructive",
      });
    }
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
                  {formatHoursDetailed(sessions.reduce((sum, s) => sum + (s.hours_worked || 0), 0))}
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
                  sessionId={session.id}
                  isAdmin={true}
                  onUpdate={handleUpdateSession}
                  onDelete={handleDeleteSession}
                />
              ))}
            </TabsContent>
            
            <TabsContent value="users" className="space-y-6 mt-6">
              {uniqueUserIds.map((userId) => {
                const profile = profiles.get(userId);
                const stats = calculateFilteredUserStats(userId);
                const currentFilter = userFilters.get(userId);
                
                return (
                  <Card key={userId}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="flex items-center justify-between">
                            <span>{profile?.full_name || "Unknown User"}</span>
                            <div className="text-lg font-semibold text-primary bg-primary/10 px-3 py-1 rounded-lg">
                              {formatHoursDetailed(stats.hours)}
                            </div>
                          </CardTitle>
                          <CardDescription>
                            {stats.sessions} sessions
                            {currentFilter?.period && currentFilter.period !== 'all' && (
                              <span className="ml-2 px-2 py-1 bg-primary/10 text-primary rounded-sm text-xs">
                                {currentFilter.period === 'week' && 'Last Week'}
                                {currentFilter.period === 'biweekly' && 'Last 2 Weeks'} 
                                {currentFilter.period === 'month' && 'Last Month'}
                                {currentFilter.period === 'custom' && 'Custom Range'}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <Select
                            value={currentFilter?.period || 'all'}
                            onValueChange={(value) => handleFilterChange(userId, value)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="Filter period" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Time</SelectItem>
                              <SelectItem value="week">Last Week</SelectItem>
                              <SelectItem value="biweekly">Last 2 Weeks</SelectItem>
                              <SelectItem value="month">Last Month</SelectItem>
                              <SelectItem value="custom">Custom Range</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {currentFilter?.period === 'custom' && (
                            <div className="flex gap-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="w-[110px] justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {currentFilter?.customStart ? format(currentFilter.customStart, "MMM dd") : "Start"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={currentFilter?.customStart}
                                    onSelect={(date) => handleCustomDateChange(userId, 'start', date)}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="w-[110px] justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {currentFilter?.customEnd ? format(currentFilter.customEnd, "MMM dd") : "End"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={currentFilter?.customEnd}
                                    onSelect={(date) => handleCustomDateChange(userId, 'end', date)}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(() => {
                        const currentFilter = userFilters.get(userId);
                        const groupedData = groupSessionsByDay(stats.filteredSessions, currentFilter);
                        
                        if (stats.filteredSessions.length === 0) {
                          return (
                            <div className="text-center py-8 text-muted-foreground">
                              No sessions found for the selected period
                            </div>
                          );
                        }
                        
                        if (!groupedData.grouped) {
                          // Show regular session list for "All Time"
                          return stats.filteredSessions.map((session) => (
                            <SessionCard
                              key={session.id}
                              clockIn={session.clock_in}
                              clockOut={session.clock_out}
                              hoursWorked={session.hours_worked}
                              userName={profiles.get(session.user_id)?.full_name}
                              sessionId={session.id}
                              isAdmin={true}
                              onUpdate={handleUpdateSession}
                              onDelete={handleDeleteSession}
                            />
                          ));
                        }
                        
                        // Show day-by-day breakdown for filtered periods
                        return groupedData.sessionsByDay.map((dayData) => (
                          <div key={dayData.date.toISOString()} className="border rounded-lg p-4 bg-muted/20">
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="font-semibold text-lg">
                                {format(dayData.date, "EEEE, MMM d, yyyy")}
                              </h4>
                              <div className="text-sm font-medium text-primary">
                                {dayData.hasData ? formatHoursDetailed(dayData.hours) : "No sessions"}
                              </div>
                            </div>
                            
                            {dayData.hasData ? (
                              <div className="space-y-3">
                                {dayData.sessions.map((session) => (
                                  <SessionCard
                                    key={session.id}
                                    clockIn={session.clock_in}
                                    clockOut={session.clock_out}
                                    hoursWorked={session.hours_worked}
                                    userName={profiles.get(session.user_id)?.full_name}
                                    sessionId={session.id}
                                    isAdmin={true}
                                    onUpdate={handleUpdateSession}
                                    onDelete={handleDeleteSession}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-muted-foreground text-sm">
                                No work sessions on this day
                              </div>
                            )}
                          </div>
                        ));
                      })()}
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
