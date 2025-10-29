import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const Calendar = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [ptoRequests, setPtoRequests] = useState<any[]>([]);
  const [isDayOpen, setIsDayOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventNotes, setNewEventNotes] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);
  const [monthEventsByDate, setMonthEventsByDate] = useState<Record<string, any[]>>({});
  const [newEventFiles, setNewEventFiles] = useState<File[]>([]);
  const [birthdays, setBirthdays] = useState<any[]>([]);
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

  // Fetch PTO requests once the user session is ready
  useEffect(() => {
    if (user) {
      fetchPTORequests();
      fetchBirthdays();
    }
  }, [user]);

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
          fetchPTORequests();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Fetch all events for the currently visible month (for grid rendering)
  useEffect(() => {
    if (user) {
      fetchMonthEvents();
    }
  }, [currentDate, user]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    
    if (!data) {
      try { // logout if profile missing
        // @ts-expect-error runtime supports scope
        await supabase.auth.signOut({ scope: 'local' });
      } catch (_) {}
      try { await supabase.auth.signOut(); } catch (_) {}
      navigate('/auth', { replace: true });
      return;
    }
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
      console.log("🔄 Fetching PTO requests... user:", user?.id);
      
      const { data, error } = await supabase
        .from("pto_requests")
        .select("*")
        .eq("status", "approved");
      
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

  const fetchBirthdays = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, date_of_birth")
        .not("date_of_birth", "is", null)
        .neq("date_of_birth", "9999-12-31"); // Exclude users who skipped

      if (error) throw error;

      setBirthdays(data || []);
    } catch (error) {
      console.error("Error fetching birthdays:", error);
    }
  };

  const getBirthdaysForDate = (date: Date) => {
    return birthdays.filter(person => {
      if (!person.date_of_birth) return false;
      const birthDate = new Date(person.date_of_birth);
      // Match month and day, ignoring year
      return birthDate.getMonth() === date.getMonth() &&
             birthDate.getDate() === date.getDate();
    });
  };

  const openDay = async (date: Date) => {
    setSelectedDate(date);
    setIsDayOpen(true);
    await fetchEventsForDate(date);
  };

  const fetchMonthEvents = async () => {
    try {
      // Compute the visible calendar range (full weeks around the month)
      const monthStartDate = startOfMonth(currentDate);
      const monthEndDate = endOfMonth(monthStartDate);
      const rangeStart = startOfWeek(monthStartDate);
      const rangeEnd = endOfWeek(monthEndDate);

      const startIso = new Date(Date.UTC(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate())).toISOString().slice(0,10);
      const endIso = new Date(Date.UTC(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate())).toISOString().slice(0,10);

      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("event_date", startIso)
        .lte("event_date", endIso);
      if (error) throw error;

      const map: Record<string, any[]> = {};
      (data || []).forEach((evt: any) => {
        const key = typeof evt.event_date === 'string' ? evt.event_date : new Date(evt.event_date).toISOString().slice(0,10);
        if (!map[key]) map[key] = [];
        map[key].push(evt);
      });
      setMonthEventsByDate(map);
    } catch (e) {
      console.error("Error fetching month events:", e);
    }
  };

  const fetchEventsForDate = async (date: Date) => {
    try {
      const iso = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0,10);
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("event_date", iso);
      if (error) throw error;
      setEvents(data || []);
    } catch (e) {
      console.error("Error fetching events:", e);
    }
  };

  const saveEvent = async () => {
    if (!user || !selectedDate || !newEventTitle.trim()) return;
    setSavingEvent(true);
    try {
      const iso = new Date(Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())).toISOString().slice(0,10);
      // Upload files (images/PDFs) to Supabase Storage
      const attachments: any[] = [];
      for (const file of newEventFiles) {
        try {
          const uniqueName = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const filePath = `${user.id}/${iso}/${uniqueName}_${file.name}`;
          const uploadRes = await supabase.storage
            .from('event-attachments')
            .upload(filePath, file, { upsert: true, contentType: file.type });
          if (uploadRes.error) throw uploadRes.error;
          const { data: pub } = supabase.storage.from('event-attachments').getPublicUrl(filePath);
          attachments.push({ name: file.name, url: pub.publicUrl, type: file.type, size: file.size });
        } catch (uploadErr:any) {
          console.error('Attachment upload failed:', uploadErr);
          throw uploadErr;
        }
      }
      const { error } = await supabase
        .from("calendar_events")
        .insert({
          user_id: user.id,
          event_date: iso,
          title: newEventTitle.trim(),
          notes: newEventNotes.trim() || null,
          attachments: attachments,
        });
      if (error) throw error;
      setNewEventTitle("");
      setNewEventNotes("");
      setNewEventFiles([]);
      await fetchEventsForDate(selectedDate);
      await fetchMonthEvents();
      toast({ title: 'Event saved', description: 'Your event was added to this day.' });
      setIsDayOpen(false);
    } catch (e:any) {
      console.error("Failed to save event:", e);
      toast({
        title: 'Failed to save event',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingEvent(false);
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId);
      if (error) throw error;
      toast({ title: 'Event deleted', description: 'Your event was removed.' });
      if (selectedDate) await fetchEventsForDate(selectedDate);
      await fetchMonthEvents();
    } catch (e:any) {
      console.error('Failed to delete event:', e);
      toast({
        title: 'Failed to delete event',
        description: e?.message || 'An unknown error occurred while deleting.',
        variant: 'destructive',
      });
    }
  };

  const downloadPtoPdf = async (pto: any) => {
    const mod = await import("jspdf");
    const doc = new mod.jsPDF();
    doc.setFontSize(16);
    doc.text("PTO Request", 14, 20);
    doc.setFontSize(12);
    const y = 30;
    const lines = [
      `Employee: ${pto.employee_name}`,
      `Request Type: ${pto.request_type}`,
      `Start: ${new Date(pto.start_date).toLocaleDateString()}`,
      `End: ${new Date(pto.end_date).toLocaleDateString()}`,
      `Reason: ${pto.reason_type}`,
      pto.custom_reason ? `Details: ${pto.custom_reason}` : "",
      `Submitted: ${new Date(pto.submission_date).toLocaleString()}`,
      pto.employer_name ? `Approved By: ${pto.employer_name}` : "",
    ].filter(Boolean);
    let cursor = y;
    lines.forEach((line) => { doc.text(line, 14, cursor); cursor += 8; });
    try {
      if (pto.employee_signature) {
        doc.text("Employee Signature:", 14, cursor);
        cursor += 6;
        doc.addImage(pto.employee_signature, "PNG", 14, cursor, 60, 20);
        cursor += 26;
      }
      if (pto.employer_signature) {
        doc.text("Employer Signature:", 14, cursor);
        cursor += 6;
        doc.addImage(pto.employer_signature, "PNG", 14, cursor, 60, 20);
        cursor += 26;
      }
    } catch (_) {}
    doc.save(`${(pto.employee_name || 'employee').replace(/\s+/g,'_')}_PTO_${new Date(pto.start_date).toISOString().slice(0,10)}.pdf`);
  };

  const deletePto = async (ptoId: string) => {
    try {
      if (!confirm('Delete this PTO request? This cannot be undone.')) return;
      const { error } = await supabase
        .from('pto_requests')
        .delete()
        .eq('id', ptoId);
      if (error) throw error;
      toast({ title: 'PTO deleted', description: 'The PTO request was removed.' });
      await fetchPTORequests();
    } catch (e:any) {
      console.error('Failed to delete PTO:', e);
      toast({
        title: 'Failed to delete PTO',
        description: e?.message || 'An unknown error occurred while deleting.',
        variant: 'destructive',
      });
    }
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
    <div className="min-h-screen">
      <Navbar isAdmin={isAdmin} />
      
      <main className="container mx-auto px-4 py-8 pt-32">
        <Card className="container-shadow">
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
                const iso = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0,10);
                const eventsForDay = monthEventsByDate[iso] || [];
                const birthdaysForDay = getBirthdaysForDate(date);
                
                return (
                  <div
                    key={date.toISOString()}
                    className={`
                      min-h-[120px] p-2 border rounded-lg transition-colors hover:bg-accent/50
                      ${isCurrentMonth ? "bg-card" : "bg-muted/30"}
                      ${isCurrentDay ? "bg-primary/10 border-primary" : "border-border"}
                    `}
                    onClick={() => openDay(date)}
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
                          title={`PTO - ${pto.employee_name} (${pto.reason_type})`}
                        >
                          <div className="font-medium">
                            PTO
                          </div>
                          <div className="text-xs opacity-75 capitalize">
                            {pto.reason_type}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Custom Events */}
                    <div className="space-y-1 mt-1">
                      {eventsForDay.slice(0, 2).map((evt: any) => (
                        <div
                          key={evt.id}
                          className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded truncate border border-emerald-200"
                          title={evt.notes ? `${evt.title} — ${evt.notes}` : evt.title}
                        >
                          {evt.title}
                        </div>
                      ))}
                      {eventsForDay.length > 2 && (
                        <div className="text-[10px] text-muted-foreground">+{eventsForDay.length - 2} more</div>
                      )}
                    </div>

                    {/* Birthdays */}
                    <div className="space-y-1 mt-1">
                      {birthdaysForDay.map((person: any) => (
                        <div
                          key={person.id}
                          className="text-xs bg-gradient-to-r from-pink-100 to-purple-100 text-purple-800 px-2 py-1 rounded truncate border border-purple-200 font-medium"
                          title={`${person.full_name}'s Birthday`}
                        >
                          <span className="mr-1">🎈</span>
                          {person.full_name}
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
      {/* Day Modal */}
      <Dialog open={isDayOpen} onOpenChange={setIsDayOpen}>
        <DialogContent className="max-w-2xl container-shadow">
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? format(selectedDate, "PPP") : "Selected Day"}
            </DialogTitle>
          </DialogHeader>

          {/* Birthdays */}
          {selectedDate && getBirthdaysForDate(selectedDate).length > 0 && (
            <div className="space-y-2 mb-4">
              <h4 className="font-semibold flex items-center gap-2">
                <span>🎈</span>
                Birthdays
              </h4>
              <div className="space-y-2">
                {getBirthdaysForDate(selectedDate).map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 border rounded-lg p-3 bg-gradient-to-r from-pink-50 to-purple-50 border-purple-200"
                  >
                    <div className="text-2xl">🎂</div>
                    <div className="text-sm">
                      <div className="font-semibold text-purple-900">{person.full_name}</div>
                      <div className="text-xs text-purple-700">Happy Birthday!</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PTO list */}
          <div className="space-y-2">
            <h4 className="font-semibold">PTO Requests</h4>
            {selectedDate && getPTOForDate(selectedDate).length === 0 && (
              <div className="text-sm text-muted-foreground">No PTO for this date.</div>
            )}
            <div className="space-y-2">
              {selectedDate && getPTOForDate(selectedDate).map((pto) => (
                <div key={pto.id} className="flex items-center justify-between border rounded p-2 bg-card">
                  <div className="text-sm">
                    <div className="font-medium">{pto.employee_name}</div>
                    <div className="opacity-75 capitalize">{pto.reason_type}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <Button variant="outline" size="sm" onClick={() => deletePto(pto.id)} className="border-destructive text-destructive">
                        Delete
                      </Button>
                    )}
                    <Button size="sm" onClick={() => downloadPtoPdf(pto)}>Download PDF</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Events list */}
          <div className="mt-4 space-y-2">
            <h4 className="font-semibold">Events</h4>
            {events.length === 0 && (
              <div className="text-sm text-muted-foreground">No events for this date.</div>
            )}
            <div className="space-y-2">
              {events.map((evt) => (
                <div key={evt.id} className="flex items-center justify-between border rounded p-2 bg-card">
                  <div className="text-sm">
                    <div className="font-medium">{evt.title}</div>
                    {evt.notes && <div className="opacity-75">{evt.notes}</div>}
                    {Array.isArray(evt.attachments) && evt.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {evt.attachments.map((att: any, idx: number) => (
                          <div key={idx} className="text-xs">
                            {att.type?.startsWith('image/') ? (
                              <a href={att.url} target="_blank" rel="noreferrer" className="underline">Image: {att.name}</a>
                            ) : (
                              <a href={att.url} target="_blank" rel="noreferrer" className="underline">File: {att.name}</a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {(isAdmin || evt.user_id === user?.id) && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteEvent(evt.id)}
                        className="border-destructive text-destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add Event */}
          <div className="mt-4 space-y-2">
            <h4 className="font-semibold">Add Event</h4>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <Label htmlFor="eventTitle">Title</Label>
                <Input id="eventTitle" value={newEventTitle} onChange={(e)=>setNewEventTitle(e.target.value)} placeholder="Event title" />
              </div>
              <div>
                <Label htmlFor="eventNotes">Notes</Label>
                <Textarea id="eventNotes" value={newEventNotes} onChange={(e)=>setNewEventNotes(e.target.value)} placeholder="Optional notes" />
              </div>
              <div>
                <Label htmlFor="eventFiles">Attachments</Label>
                <Input id="eventFiles" type="file" accept="image/*,application/pdf" multiple onChange={(e)=>setNewEventFiles(Array.from(e.target.files || []))} />
                {newEventFiles.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">{newEventFiles.length} file(s) selected</div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDayOpen(false)}>Close</Button>
            <Button onClick={saveEvent} disabled={savingEvent || !newEventTitle.trim()}>
              {savingEvent ? 'Saving...' : 'Save Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Calendar;
