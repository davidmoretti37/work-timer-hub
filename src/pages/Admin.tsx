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
import { format, subWeeks, subMonths, startOfDay, endOfDay, isWithinInterval } from "date-fns";

const Admin = () => {
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileCreationAttempted, setProfileCreationAttempted] = useState<Set<string>>(new Set());
  const [userFilters, setUserFilters] = useState<Map<string, { period: string; customStart?: Date; customEnd?: Date }>>(new Map());
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
                      {stats.filteredSessions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No sessions found for the selected period
                        </div>
                      ) : (
                        stats.filteredSessions.map((session) => (
                          <SessionCard
                            key={session.id}
                            clockIn={session.clock_in}
                            clockOut={session.clock_out}
                            hoursWorked={session.hours_worked}
                            userName={profiles.get(session.user_id)?.full_name}
                          />
                        ))
                      )}
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
