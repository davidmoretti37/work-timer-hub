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
import { Users, CalendarIcon, Download, FileSpreadsheet } from "lucide-react";
import { formatHoursDetailed, formatBreakTime } from "@/utils/timeUtils";
import { format, subWeeks, subMonths, startOfDay, endOfDay, isWithinInterval, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

const Admin = () => {
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileCreationAttempted, setProfileCreationAttempted] = useState<Set<string>>(new Set());
  const [userFilters, setUserFilters] = useState<Map<string, { period: string; customStart?: Date; customEnd?: Date }>>(new Map());
  const [activityRecords, setActivityRecords] = useState<Array<{ email: string; status: string; last_activity: string | null; updated_at: string; created_at: string }>>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let isMounted = true;

    const load = async () => {
      if (!isMounted) return;
      await fetchEmployeeActivity();
    };

    load();

    const interval = setInterval(load, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAdmin]);

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
      .select("*, break_end")
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

    await fetchEmployeeActivity();
  };

  // Keep selected users in sync with available users; default to all
  useEffect(() => {
    const allUserIds = new Set(sessions.map(s => s.user_id));
    // If nothing selected yet, or new users appeared, include them
    if (selectedUserIds.size === 0) {
      setSelectedUserIds(allUserIds);
      return;
    }
    let changed = false;
    const next = new Set(selectedUserIds);
    for (const id of allUserIds) {
      if (!next.has(id)) {
        next.add(id);
        changed = true;
      }
    }
    if (changed) setSelectedUserIds(next);
  }, [sessions]);

  const fetchEmployeeActivity = async () => {
    try {
      setActivityLoading(true);
      setActivityError(null);

      const { data, error } = await supabase
        .from('employee_activity')
        .select('email, status, last_activity, updated_at, created_at')
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      setActivityRecords(data ?? []);
    } catch (error: any) {
      console.error('Failed to fetch employee activity:', error);
      setActivityError('Unable to load employee activity data');
    } finally {
      setActivityLoading(false);
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

  const handleUpdateSession = async (sessionId: string, clockIn: string, clockOut: string | null, breakStart?: string | null, breakEnd?: string | null) => {
    try {
      const updateData: any = {
        clock_in: clockIn,
        clock_out: clockOut,
      };

      // Update break start and end times if provided
      if (breakStart !== undefined) {
        updateData.paused_at = breakStart;
      }
      if (breakEnd !== undefined) {
        updateData.break_end = breakEnd;
      }

      const { error } = await supabase
        .from("time_sessions")
        .update(updateData)
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "Session updated",
        description: "Session times and break periods have been updated and hours recalculated.",
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

  const exportUserData = (userId: string, filter: { period: string; customStart?: Date; customEnd?: Date } | undefined) => {
    const profile = profiles.get(userId);
    const userName = profile?.admin_display_name || profile?.full_name || 'Unknown User';
    
    try {
      // Get filtered sessions for this user
      const userSessions = getFilteredSessions(userId);
      
      if (userSessions.length === 0) {
        toast({
          title: "No data to export",
          description: `No sessions found for ${userName} in the selected period.`,
          variant: "destructive",
        });
        return;
      }

      // Get period label
      let periodLabel = 'All Time';
      if (filter) {
        switch (filter.period) {
          case 'week':
            periodLabel = 'Last Week';
            break;
          case 'biweekly':
            periodLabel = 'Last 2 Weeks';
            break;
          case 'month':
            periodLabel = 'Last Month';
            break;
          case 'custom':
            if (filter.customStart && filter.customEnd) {
              periodLabel = `${format(filter.customStart, 'MMM d')} - ${format(filter.customEnd, 'MMM d, yyyy')}`;
            }
            break;
        }
      }

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // User Summary Sheet
      const summaryData = [];
      summaryData.push([`${userName} - Timesheet Report`]);
      summaryData.push(['Period:', periodLabel]);
      summaryData.push(['Export Date:', format(new Date(), 'MMM d, yyyy h:mm a')]);
      summaryData.push(['']); // Empty row

      const totalHours = userSessions.reduce((sum, s) => sum + (s.hours_worked || 0), 0);
      summaryData.push(['Summary']);
      summaryData.push(['Total Sessions:', userSessions.length]);
      summaryData.push(['Total Hours:', totalHours.toFixed(2)]);
      summaryData.push(['']); // Empty row

      // Sessions detail
      summaryData.push(['Session Details']);
      summaryData.push(['Date', 'Clock In', 'Clock Out', 'Break Time', 'Hours Worked', 'Status']);

      userSessions.forEach(session => {
        const date = format(new Date(session.clock_in), 'MMM d, yyyy');
        const clockIn = format(new Date(session.clock_in), 'h:mm a');
        const clockOut = session.clock_out ? format(new Date(session.clock_out), 'h:mm a') : 'Active';
        const breakTime = formatBreakTime(session.break_seconds);
        const hours = session.hours_worked ? session.hours_worked.toFixed(2) : '0.00';
        const status = session.clock_out ? 'Completed' : 'In Progress';

        summaryData.push([date, clockIn, clockOut, breakTime, hours, status]);
      });

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, ws, 'Timesheet');

      // Generate filename
      const filename = `${userName.replace(/\s+/g, '_')}_${periodLabel.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

      // Write and download file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export successful",
        description: `${userName}'s timesheet exported as ${filename}`,
      });

    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const exportToExcel = (period: string, customStart?: Date, customEnd?: Date) => {
    try {
      // Get date range
      const now = new Date();
      let startDate: Date;
      let endDate: Date = endOfDay(now);
      let periodLabel = '';

      switch (period) {
        case 'week':
          startDate = startOfDay(subWeeks(now, 1));
          periodLabel = 'Last Week';
          break;
        case 'biweekly':
          startDate = startOfDay(subWeeks(now, 2));
          periodLabel = 'Last 2 Weeks';
          break;
        case 'month':
          startDate = startOfDay(subMonths(now, 1));
          periodLabel = 'Last Month';
          break;
        case 'custom':
          if (customStart && customEnd) {
            startDate = startOfDay(customStart);
            endDate = endOfDay(customEnd);
            periodLabel = `${format(customStart, 'MMM d')} - ${format(customEnd, 'MMM d, yyyy')}`;
          } else {
            startDate = startOfDay(subWeeks(now, 1));
            periodLabel = 'Custom Range';
          }
          break;
        default:
          startDate = startOfDay(subWeeks(now, 1));
          periodLabel = 'All Time';
      }

      // Filter sessions by date range
      const filteredSessions = sessions.filter(session => {
        const sessionDate = new Date(session.clock_in);
        return isWithinInterval(sessionDate, { start: startDate, end: endDate });
      });

      if (filteredSessions.length === 0) {
        toast({
          title: "No data to export",
          description: "No sessions found for the selected period.",
          variant: "destructive",
        });
        return;
      }

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Summary Sheet
      const summaryData = [];
      summaryData.push(['TimeTracker Export Report']);
      summaryData.push(['Period:', periodLabel]);
      summaryData.push(['Export Date:', format(new Date(), 'MMM d, yyyy h:mm a')]);
      summaryData.push(['']); // Empty row

      // User summaries
      summaryData.push(['User Summary']);
      summaryData.push(['User Name', 'Total Sessions', 'Total Hours']);
      
      const uniqueUserIds = [...new Set(filteredSessions.map(s => s.user_id))];
      let grandTotalHours = 0;
      
      uniqueUserIds.forEach(userId => {
        const userSessions = filteredSessions.filter(s => s.user_id === userId);
        const totalHours = userSessions.reduce((sum, s) => sum + (s.hours_worked || 0), 0);
        const profile = profiles.get(userId);
        const userName = profile?.admin_display_name || profile?.full_name || 'Unknown User';
        
        summaryData.push([userName, userSessions.length, totalHours.toFixed(2)]);
        grandTotalHours += totalHours;
      });
      
      summaryData.push(['']); // Empty row
      summaryData.push(['TOTAL', filteredSessions.length, grandTotalHours.toFixed(2)]);

      // Create summary worksheet
      const summaryWS = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWS, 'Summary');

      // Detailed Sessions Sheet
      const detailedData = [];
      detailedData.push(['Detailed Time Sessions']);
      detailedData.push(['User Name', 'Date', 'Clock In', 'Clock Out', 'Break Time', 'Hours Worked', 'Status']);

      filteredSessions.forEach(session => {
        const profile = profiles.get(session.user_id);
        const userName = profile?.admin_display_name || profile?.full_name || 'Unknown User';
        const date = format(new Date(session.clock_in), 'MMM d, yyyy');
        const clockIn = format(new Date(session.clock_in), 'h:mm a');
        const clockOut = session.clock_out ? format(new Date(session.clock_out), 'h:mm a') : 'Active';
        const breakTime = formatBreakTime(session.break_seconds);
        const hours = session.hours_worked ? session.hours_worked.toFixed(2) : '0.00';
        const status = session.clock_out ? 'Completed' : 'In Progress';

        detailedData.push([userName, date, clockIn, clockOut, breakTime, hours, status]);
      });

      // Create detailed worksheet
      const detailedWS = XLSX.utils.aoa_to_sheet(detailedData);
      XLSX.utils.book_append_sheet(workbook, detailedWS, 'Detailed Sessions');

      // Daily Breakdown Sheet (if period is not 'all')
      if (period !== 'all') {
        const dailyData = [];
        dailyData.push(['Daily Breakdown']);
        dailyData.push(['Date', 'User Name', 'Total Hours', 'Sessions']);

        const allDays = eachDayOfInterval({ start: startDate, end: endDate });
        
        allDays.forEach(day => {
          const daySessions = filteredSessions.filter(session => 
            isSameDay(new Date(session.clock_in), day)
          );
          
          if (daySessions.length > 0) {
            const dayLabel = format(day, 'EEEE, MMM d, yyyy');
            
            // Group by user for this day
            const userSessionsByDay = uniqueUserIds.filter(userId => 
              daySessions.some(s => s.user_id === userId)
            );
            
            userSessionsByDay.forEach(userId => {
              const userDaySessions = daySessions.filter(s => s.user_id === userId);
              const dayHours = userDaySessions.reduce((sum, s) => sum + (s.hours_worked || 0), 0);
              const profile = profiles.get(userId);
              const userName = profile?.admin_display_name || profile?.full_name || 'Unknown User';
              
              dailyData.push([dayLabel, userName, dayHours.toFixed(2), userDaySessions.length]);
            });
          }
        });

        const dailyWS = XLSX.utils.aoa_to_sheet(dailyData);
        XLSX.utils.book_append_sheet(workbook, dailyWS, 'Daily Breakdown');
      }

      // Generate filename
      const filename = `TimeTracker_${periodLabel.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

      // Write and download file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export successful",
        description: `Timesheet exported as ${filename}`,
      });

    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!user || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const uniqueUserIds = [...new Set(sessions.map(s => s.user_id))];
  const filteredUserIds = uniqueUserIds.filter(id => selectedUserIds.has(id));

  return (
    <div className="min-h-screen">
      <Navbar isAdmin={isAdmin} />
      
      <main className="container mx-auto px-4 py-8 pt-32">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Users className="h-8 w-8" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">Overview of all users and their work sessions</p>
          </div>


          <div className="space-y-6 mt-6">
              {/* User visibility selector */}
              <Card className="container-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Visible Users</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedUserIds(new Set(uniqueUserIds))}
                    >
                      Select All
                    </Button>
                  </CardTitle>
                  <CardDescription>Toggle which users to display below. New employees appear automatically.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {uniqueUserIds.map((id) => {
                      const profile = profiles.get(id);
                      const name = profile?.admin_display_name || profile?.full_name || 'Unknown User';
                      const checked = selectedUserIds.has(id);
                      return (
                        <label key={id} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(selectedUserIds);
                              if (e.target.checked) next.add(id); else next.delete(id);
                              setSelectedUserIds(next);
                            }}
                          />
                          <span className="text-sm">{name}</span>
                        </label>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="container-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Salesforce Activity</span>
                    <span className="text-sm text-muted-foreground">Updates every 30 seconds</span>
                  </CardTitle>
                  <CardDescription>Latest status reported by the Salesforce activity tracker extension</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activityLoading ? (
                    <div className="text-sm text-muted-foreground">Loading activity...</div>
                  ) : activityError ? (
                    <div className="text-sm text-destructive">{activityError}</div>
                  ) : activityRecords.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No activity updates yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {activityRecords.map((record) => {
                        const lastActivity = record.last_activity ? new Date(record.last_activity) : null;
                        const relative = lastActivity ? formatDistanceToNow(lastActivity, { addSuffix: true }) : 'Unknown';
                        const idleDuration = record.status === 'idle' && lastActivity
                          ? formatDistanceToNow(lastActivity, { addSuffix: false })
                          : null;

                        return (
                          <div
                            key={record.email}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md border p-3 bg-muted/40"
                          >
                            <div>
                              <p className="font-medium">{record.email}</p>
                              <p className="text-xs text-muted-foreground">Last activity {relative}</p>
                            </div>
                            <div className="flex flex-col items-start sm:items-end gap-1">
                              <span
                                className={`flex items-center gap-2 text-sm font-medium ${record.status === 'active' ? 'text-green-600' : 'text-red-600'}`}
                              >
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${record.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}
                                ></span>
                                {record.status === 'active' ? 'Active' : 'Idle'}
                              </span>
                              {record.status === 'idle' && idleDuration && (
                                <span className="text-xs text-muted-foreground">Inactive for {idleDuration}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
              {filteredUserIds.map((userId) => {
                const profile = profiles.get(userId);
                const stats = calculateFilteredUserStats(userId);
                const currentFilter = userFilters.get(userId);
                
                return (
                  <Card key={userId} className="container-shadow">
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
                          <div className="flex gap-2">
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
                            
                            <Button
                              variant="default"
                              size="sm" 
                              onClick={() => exportUserData(userId, currentFilter)}
                              className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Download className="h-3 w-3" />
                              Export Excel
                            </Button>
                          </div>
                          
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
                              pausedAt={session.paused_at}
                              breakSeconds={session.break_seconds}
                              breakEnd={session.break_end}
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
                                    pausedAt={session.paused_at}
                                    breakSeconds={session.break_seconds}
                                    breakEnd={session.break_end}
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
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;
