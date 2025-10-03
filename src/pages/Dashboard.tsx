import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import StatusBadge from "@/components/StatusBadge";
import TimeDisplay from "@/components/TimeDisplay";
import { Clock, PlayCircle, StopCircle, Users, Trash2, UserX, Edit2, Save, X } from "lucide-react";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
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
      const adminStatus = await checkAdminStatus(session.user.id);
      await fetchActiveSession(session.user.id);
      
      if (adminStatus) {
        await fetchAllUsers();
      }
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
    
    const isAdminUser = !!data;
    setIsAdmin(isAdminUser);
    return isAdminUser;
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

  const fetchAllUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select(`
        id, 
        full_name, 
        admin_display_name,
        created_at,
        user_roles(role)
      `)
      .order("created_at", { ascending: false });
    
    if (data) {
      setAllUsers(data);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This will also delete all their sessions and cannot be undone.`)) {
      return;
    }

    try {
      // First, delete from auth.users (this will cascade to profiles due to foreign key)
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      
      if (authError) {
        // If admin API doesn't work, try deleting profile directly
        const { error: profileError } = await supabase
          .from("profiles")
          .delete()
          .eq("id", userId);
          
        if (profileError) throw profileError;
      }

      toast({
        title: "User deleted",
        description: `${userName} and all their data have been removed.`,
      });

      // Refresh the users list
      await fetchAllUsers();
    } catch (error: any) {
      toast({
        title: "Error deleting user",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditDisplayName = (userId: string, currentDisplayName: string, originalName: string) => {
    setEditingUserId(userId);
    setEditDisplayName(currentDisplayName || originalName);
  };

  const handleSaveDisplayName = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ admin_display_name: editDisplayName })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Display name updated",
        description: "The admin display name has been changed.",
      });

      setEditingUserId(null);
      setEditDisplayName('');
      await fetchAllUsers();
    } catch (error: any) {
      toast({
        title: "Error updating display name",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditDisplayName('');
  };

  const getDisplayName = (userProfile: any) => {
    return userProfile.admin_display_name || userProfile.full_name;
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

          {/* Admin User Management Section */}
          {isAdmin && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>Manage all registered users</CardDescription>
              </CardHeader>
              <CardContent>
                {allUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserX className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No users found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allUsers.map((userProfile) => {
                      const isCurrentUser = userProfile.id === user?.id;
                      const userRole = userProfile.user_roles?.[0]?.role || 'user';
                      const isEditing = editingUserId === userProfile.id;
                      const displayName = getDisplayName(userProfile);
                      
                      return (
                        <div
                          key={userProfile.id}
                          className="flex items-center justify-between p-4 border rounded-lg bg-muted/20"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">
                                {displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1">
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="text"
                                    value={editDisplayName}
                                    onChange={(e) => setEditDisplayName(e.target.value)}
                                    className="flex-1"
                                    placeholder="Enter display name..."
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSaveDisplayName(userProfile.id)}
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <p className="font-medium">
                                    {displayName}
                                    {userProfile.admin_display_name && (
                                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                        Custom Name
                                      </span>
                                    )}
                                    {isCurrentUser && (
                                      <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                                        You
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {userProfile.admin_display_name && (
                                      <span className="text-xs text-muted-foreground mr-2">
                                        Real name: {userProfile.full_name} • 
                                      </span>
                                    )}
                                    {userRole === 'admin' ? '👑 Admin' : '👤 User'} • 
                                    Joined {new Date(userProfile.created_at).toLocaleDateString()}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {!isCurrentUser && !isEditing && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditDisplayName(
                                  userProfile.id, 
                                  userProfile.admin_display_name, 
                                  userProfile.full_name
                                )}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUser(userProfile.id, displayName)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
