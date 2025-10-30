import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import Navbar from "@/components/Navbar";
import SignaturePad, { SignaturePadRef } from "@/components/SignaturePad";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, FileText, Receipt, Send } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import ExpenseReimbursementForm from "@/components/ExpenseReimbursementForm";

interface PTOFormData {
  employeeName: string;
  confirmationEmail: string;
  requestType: "days" | "hours";
  startDate: Date | undefined;
  endDate: Date | undefined;
  reasonType: "vacation" | "pto" | "sick" | "jury" | "";
  customReason: string;
  employeeSignature: string;
  submissionDate: Date;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PTO = () => {
  const [activeForm, setActiveForm] = useState<"pto" | "expense">("pto");
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formData, setFormData] = useState<PTOFormData>({
    employeeName: "",
    confirmationEmail: "",
    requestType: "days",
    startDate: undefined,
    endDate: undefined,
    reasonType: "",
    customReason: "",
    employeeSignature: "",
    submissionDate: new Date(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const signaturePadRef = useRef<SignaturePadRef>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      await fetchProfile(session.user.id, session.user);
      await checkAdminStatus(session.user.id);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchProfile(session.user.id, session.user);
        checkAdminStatus(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string, sessionUser?: any) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    
    if (data) {
      setProfile(data);
      const fallbackEmail = sessionUser?.email || user?.email || "";
      const fallbackName = data.full_name || fallbackEmail;
      setFormData(prev => ({
        ...prev,
        employeeName: fallbackName,
        confirmationEmail: fallbackEmail,
        submissionDate: new Date()
      }));
    } else {
      // logout and redirect if no profile exists
      try {
        await supabase.auth.signOut();
      } catch (_) {}
      navigate('/auth', { replace: true });
      return;
    }
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

  const handleSignatureChange = (signature: string) => {
    setFormData(prev => ({
      ...prev,
      employeeSignature: signature
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.employeeName.trim()) {
      toast({
        title: "Validation Error",
        description: "Employee name is required",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.confirmationEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Confirmation email is required",
        variant: "destructive",
      });
      return false;
    }

    if (!emailRegex.test(formData.confirmationEmail)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.startDate) {
      toast({
        title: "Validation Error", 
        description: "Start date is required",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.endDate) {
      toast({
        title: "Validation Error",
        description: "End date is required", 
        variant: "destructive",
      });
      return false;
    }

    if (!formData.reasonType) {
      toast({
        title: "Validation Error",
        description: "Please select a reason for your request",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.employeeSignature) {
      toast({
        title: "Validation Error",
        description: "Employee signature is required",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const submitPTORequest = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Save PTO request to database
      const { data, error } = await supabase
        .from("pto_requests")
        .insert({
          user_id: user.id,
          employee_name: formData.employeeName,
          confirmation_email: formData.confirmationEmail,
          request_type: formData.requestType,
          start_date: formData.startDate?.toISOString(),
          end_date: formData.endDate?.toISOString(),
          reason_type: formData.reasonType,
          custom_reason: formData.customReason,
          employee_signature: formData.employeeSignature,
          status: "pending",
          submission_date: new Date().toISOString(),
        })
        .select('*, approval_token')
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('Failed to create PTO request');
      }

      console.log('PTO request created with token:', data.approval_token);

      // Open Outlook to manually send email
      openEmailClient(data);

      toast({
        title: "PTO Request Submitted",
        description: `Please send the email that just opened to complete your request. Confirmation will be sent to ${formData.confirmationEmail}`,
      });

      // Reset form
      setFormData({
        employeeName: profile?.full_name || user?.email || "",
        confirmationEmail: user?.email || "",
        requestType: "days",
        startDate: undefined,
        endDate: undefined,
        reasonType: "",
        customReason: "",
        employeeSignature: "",
        submissionDate: new Date(),
      });

      signaturePadRef.current?.clear();

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit PTO request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEmailClient = (ptoData: any) => {
    // Use the current domain (works for both localhost dev and production)
    const baseUrl = window.location.origin;
    const subject = `PTO Request - ${ptoData.employee_name}`;
    const body = `
New PTO Request Submitted:

Employee: ${ptoData.employee_name}
Confirmation Email: ${ptoData.confirmation_email}
Request Type: ${ptoData.request_type}
Start Date: ${new Date(ptoData.start_date).toLocaleDateString()}
End Date: ${new Date(ptoData.end_date).toLocaleDateString()}
Reason: ${ptoData.reason_type}
${ptoData.custom_reason ? `Additional Details: ${ptoData.custom_reason}` : ''}

Submitted: ${new Date(ptoData.submission_date).toLocaleString()}

APPROVE this request: ${baseUrl}/approve-pto?action=approve&token=${ptoData.approval_token}&plain=1

REJECT this request: ${baseUrl}/approve-pto?action=reject&token=${ptoData.approval_token}&plain=1

Click one of the links above to approve or reject this request.
    `.trim();
    
    // ALWAYS use Gmail (it works better than Outlook web)
    // Users can add their Outlook email to Gmail and send from any address
    const emailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=fbayma@baycoaviation.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.open(emailUrl, '_blank');
  };

  if (!user || !profile) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen">
      <Navbar isAdmin={isAdmin} />
      
      <main className="container mx-auto px-4 py-8 pt-32 max-w-6xl">
        <Tabs value={activeForm} onValueChange={(value) => setActiveForm(value as "pto" | "expense")}
          className="w-full">
          <TabsList className="grid grid-cols-2 max-w-md mx-auto bg-muted/40">
            <TabsTrigger value="pto" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              PTO Request
            </TabsTrigger>
            <TabsTrigger value="expense" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Expense Reimbursement
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pto" className="mt-6">
            <Card className="container-shadow">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                  <FileText className="h-6 w-6" />
                  Employee Time-Off Request Form
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Today's Date</Label>
                    <Input
                      value={format(formData.submissionDate, "PPP")}
                      readOnly
                      className="bg-gray-50 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="employeeName">Employee's Name</Label>
                  <Input
                    id="employeeName"
                    value={formData.employeeName}
                    onChange={(e) => setFormData(prev => ({ ...prev, employeeName: e.target.value }))}
                    placeholder="Enter your full name"
                    className="dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmationEmail">
                    Confirmation Email
                    <span className="text-sm text-muted-foreground ml-1">
                      (We'll send approval/rejection notifications to this email)
                    </span>
                  </Label>
                  <Input
                    id="confirmationEmail"
                    type="email"
                    value={formData.confirmationEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmationEmail: e.target.value }))}
                    placeholder="Enter email for confirmation notifications"
                    className="dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  />
                </div>

                <div>
                  <Label>Time-Off Request</Label>
                  <RadioGroup
                    value={formData.requestType}
                    onValueChange={(value: "days" | "hours") =>
                      setFormData(prev => ({ ...prev, requestType: value }))
                    }
                    className="flex gap-6 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="days" id="days" />
                      <Label htmlFor="days">Days</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="hours" id="hours" />
                      <Label htmlFor="hours">Hours</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Beginning on</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal dark:bg-gray-800 dark:text-white dark:border-gray-600",
                            !formData.startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.startDate ? format(formData.startDate, "PPP") : "Pick start date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.startDate}
                          onSelect={(date) => setFormData(prev => ({ ...prev, startDate: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label>Ending on</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal dark:bg-gray-800 dark:text-white dark:border-gray-600",
                            !formData.endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.endDate ? format(formData.endDate, "PPP") : "Pick end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.endDate}
                          onSelect={(date) => setFormData(prev => ({ ...prev, endDate: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <Label className="text-base font-semibold">Reason for Request</Label>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    {[
                      { id: "vacation", label: "Vacation" },
                      { id: "pto", label: "PTO" },
                      { id: "sick", label: "Sick / Personal Day" },
                      { id: "jury", label: "Jury Duty" },
                    ].map((reason) => (
                      <div key={reason.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={reason.id}
                          checked={formData.reasonType === reason.id}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData(prev => ({ ...prev, reasonType: reason.id as any }));
                            } else {
                              setFormData(prev => ({ ...prev, reasonType: "" }));
                            }
                          }}
                        />
                        <Label htmlFor={reason.id}>{reason.label}</Label>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <Label htmlFor="customReason">Additional Details (Optional)</Label>
                    <Textarea
                      id="customReason"
                      value={formData.customReason}
                      onChange={(e) => setFormData(prev => ({ ...prev, customReason: e.target.value }))}
                      placeholder="Please provide any additional details about your request..."
                      className="mt-1 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <p className="font-semibold text-sm dark:text-white">
                    I understand that this request is subject to approval by my employer.
                  </p>
                </div>

                <div>
                  <Label className="text-base font-semibold">Employee's Signature</Label>
                  <div className="mt-2 flex justify-center">
                    <SignaturePad
                      ref={signaturePadRef}
                      width={500}
                      height={150}
                      onSignatureChange={handleSignatureChange}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={submitPTORequest}
                    disabled={isSubmitting}
                    size="lg"
                    className="px-8"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Submitting..." : "Submit PTO Request"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expense" className="mt-6">
            <Card className="container-shadow">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                  <Receipt className="h-6 w-6" />
                  Employee Expense Reimbursement Form
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExpenseReimbursementForm
                  user={user}
                  profile={profile}
                  onSuccess={() => {
                    toast({
                      title: "Success",
                      description: "Your expense reimbursement has been submitted",
                    });
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default PTO;
