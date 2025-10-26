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
import { CalendarIcon, FileText, Plane, Send } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

interface TravelFormData {
  employeeName: string;
  confirmationEmail: string;
  travelPurpose: "client_visit" | "training" | "conference" | "aircraft_delivery" | "other" | "";
  travelPurposeOther: string;
  destination: string;
  departureDate: Date | undefined;
  returnDate: Date | undefined;
  transportationMode: "flight" | "personal_vehicle" | "rental_car" | "other" | "";
  transportationDetails: string;
  lodgingRequired: boolean;
  lodgingDetails: string;
  estimatedCost: string;
  additionalNotes: string;
  employeeSignature: string;
  submissionDate: Date;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const travelPurposeOptions = [
  { value: "client_visit" as const, label: "Client Meeting / Visit" },
  { value: "training" as const, label: "Training" },
  { value: "conference" as const, label: "Conference / Seminar" },
  { value: "aircraft_delivery" as const, label: "Aircraft Delivery / Pickup" },
  { value: "other" as const, label: "Other" },
];

const transportationOptions = [
  { value: "flight" as const, label: "Commercial Flight" },
  { value: "personal_vehicle" as const, label: "Personal Vehicle" },
  { value: "rental_car" as const, label: "Rental Car" },
  { value: "other" as const, label: "Other" },
];

const PTO = () => {
  const [activeForm, setActiveForm] = useState<"pto" | "travel">("pto");
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
  const [travelFormData, setTravelFormData] = useState<TravelFormData>({
    employeeName: "",
    confirmationEmail: "",
    travelPurpose: "",
    travelPurposeOther: "",
    destination: "",
    departureDate: undefined,
    returnDate: undefined,
    transportationMode: "",
    transportationDetails: "",
    lodgingRequired: false,
    lodgingDetails: "",
    estimatedCost: "",
    additionalNotes: "",
    employeeSignature: "",
    submissionDate: new Date(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTravelSubmitting, setIsTravelSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const signaturePadRef = useRef<SignaturePadRef>(null);
  const travelSignaturePadRef = useRef<SignaturePadRef>(null);

  const getOptionLabel = (options: { value: string; label: string }[], value: string) =>
    options.find((option) => option.value === value)?.label ?? value;

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
      setTravelFormData(prev => ({
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

  const handleTravelSignatureChange = (signature: string) => {
    setTravelFormData(prev => ({
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

  const validateTravelForm = (): boolean => {
    if (!travelFormData.employeeName.trim()) {
      toast({
        title: "Validation Error",
        description: "Employee name is required",
        variant: "destructive",
      });
      return false;
    }

    if (!travelFormData.confirmationEmail.trim()) {
      toast({
        title: "Validation Error",
        description: "Confirmation email is required",
        variant: "destructive",
      });
      return false;
    }

    if (!emailRegex.test(travelFormData.confirmationEmail)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return false;
    }

    if (!travelFormData.travelPurpose) {
      toast({
        title: "Validation Error",
        description: "Please select the purpose of travel",
        variant: "destructive",
      });
      return false;
    }

    if (travelFormData.travelPurpose === "other" && !travelFormData.travelPurposeOther.trim()) {
      toast({
        title: "Validation Error",
        description: "Please describe the travel purpose",
        variant: "destructive",
      });
      return false;
    }

    if (!travelFormData.destination.trim()) {
      toast({
        title: "Validation Error",
        description: "Destination is required",
        variant: "destructive",
      });
      return false;
    }

    if (!travelFormData.departureDate) {
      toast({
        title: "Validation Error",
        description: "Departure date is required",
        variant: "destructive",
      });
      return false;
    }

    if (!travelFormData.returnDate) {
      toast({
        title: "Validation Error",
        description: "Return date is required",
        variant: "destructive",
      });
      return false;
    }

    if (
      travelFormData.departureDate &&
      travelFormData.returnDate &&
      travelFormData.returnDate < travelFormData.departureDate
    ) {
      toast({
        title: "Validation Error",
        description: "Return date cannot be before the departure date",
        variant: "destructive",
      });
      return false;
    }

    if (!travelFormData.transportationMode) {
      toast({
        title: "Validation Error",
        description: "Please select how you plan to travel",
        variant: "destructive",
      });
      return false;
    }

    if (travelFormData.transportationMode === "other" && !travelFormData.transportationDetails.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide transportation details",
        variant: "destructive",
      });
      return false;
    }

    if (travelFormData.lodgingRequired && !travelFormData.lodgingDetails.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide lodging details",
        variant: "destructive",
      });
      return false;
    }

    if (travelFormData.estimatedCost && isNaN(parseFloat(travelFormData.estimatedCost))) {
      toast({
        title: "Validation Error",
        description: "Estimated cost must be a number",
        variant: "destructive",
      });
      return false;
    }

    if (!travelFormData.employeeSignature) {
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

  const submitTravelRequest = async () => {
    if (!validateTravelForm()) return;

    setIsTravelSubmitting(true);

    const purposeLabel =
      travelFormData.travelPurpose === "other"
        ? travelFormData.travelPurposeOther.trim()
        : getOptionLabel(travelPurposeOptions, travelFormData.travelPurpose);

    const transportationLabel =
      travelFormData.transportationMode === "other"
        ? "Other"
        : getOptionLabel(transportationOptions, travelFormData.transportationMode);

    try {
      const { data, error } = await supabase
        .from("travel_requests")
        .insert({
          user_id: user.id,
          employee_name: travelFormData.employeeName,
          confirmation_email: travelFormData.confirmationEmail,
          travel_purpose: purposeLabel,
          destination: travelFormData.destination,
          departure_date: travelFormData.departureDate?.toISOString(),
          return_date: travelFormData.returnDate?.toISOString(),
          transportation_mode: transportationLabel,
          transportation_details: travelFormData.transportationDetails || null,
          lodging_required: travelFormData.lodgingRequired,
          lodging_details: travelFormData.lodgingRequired ? travelFormData.lodgingDetails : null,
          estimated_cost: travelFormData.estimatedCost ? parseFloat(travelFormData.estimatedCost) : null,
          additional_notes: travelFormData.additionalNotes || null,
          employee_signature: travelFormData.employeeSignature,
          status: "pending",
          submission_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("Failed to create travel request");
      }

      openTravelEmail(data);

      toast({
        title: "Travel Request Submitted",
        description: `Please review the email that opened to complete your request. Confirmation will be sent to ${travelFormData.confirmationEmail}`,
      });

      const defaultName = profile?.full_name || user?.email || "";
      const defaultEmail = user?.email || travelFormData.confirmationEmail;

      setTravelFormData({
        employeeName: defaultName,
        confirmationEmail: defaultEmail,
        travelPurpose: "",
        travelPurposeOther: "",
        destination: "",
        departureDate: undefined,
        returnDate: undefined,
        transportationMode: "",
        transportationDetails: "",
        lodgingRequired: false,
        lodgingDetails: "",
        estimatedCost: "",
        additionalNotes: "",
        employeeSignature: "",
        submissionDate: new Date(),
      });

      travelSignaturePadRef.current?.clear();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit travel request",
        variant: "destructive",
      });
    } finally {
      setIsTravelSubmitting(false);
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

  const openTravelEmail = (travelData: any) => {
    const subject = `Travel Request - ${travelData.employee_name}`;
    const body = `
New Travel Request Submitted:

Employee: ${travelData.employee_name}
Confirmation Email: ${travelData.confirmation_email}
Travel Purpose: ${travelData.travel_purpose}
Destination: ${travelData.destination}
Departure Date: ${new Date(travelData.departure_date).toLocaleDateString()}
Return Date: ${new Date(travelData.return_date).toLocaleDateString()}
Transportation: ${travelData.transportation_mode}
Transportation Details: ${travelData.transportation_details ?? 'N/A'}
Lodging Required: ${travelData.lodging_required ? 'Yes' : 'No'}
${travelData.lodging_required ? `Lodging Details: ${travelData.lodging_details ?? 'N/A'}` : ''}
Estimated Cost: ${travelData.estimated_cost !== null ? `$${Number(travelData.estimated_cost).toFixed(2)}` : 'Not provided'}
Additional Notes: ${travelData.additional_notes ?? 'None'}

Submitted: ${new Date(travelData.submission_date).toLocaleString()}

Please review this travel request and confirm with the employee.
    `.trim();

    const emailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=fbayma@baycoaviation.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(emailUrl, '_blank');
  };

  if (!user || !profile) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen">
      <Navbar isAdmin={isAdmin} />
      
      <main className="container mx-auto px-4 py-8 pt-32 max-w-4xl">
        <Tabs value={activeForm} onValueChange={(value) => setActiveForm(value as "pto" | "travel")}
          className="w-full">
          <TabsList className="grid grid-cols-2 max-w-md mx-auto bg-muted/40">
            <TabsTrigger value="pto" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              PTO Request
            </TabsTrigger>
            <TabsTrigger value="travel" className="flex items-center gap-2">
              <Plane className="h-4 w-4" />
              Travel Request
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

          <TabsContent value="travel" className="mt-6">
            <Card className="container-shadow">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                  <Plane className="h-6 w-6" />
                  Employee Travel Request Form
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Today's Date</Label>
                    <Input
                      value={format(travelFormData.submissionDate, "PPP")}
                      readOnly
                      className="bg-gray-50 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="travelEmployeeName">Employee's Name</Label>
                  <Input
                    id="travelEmployeeName"
                    value={travelFormData.employeeName}
                    onChange={(e) => setTravelFormData(prev => ({ ...prev, employeeName: e.target.value }))}
                    placeholder="Enter your full name"
                    className="dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  />
                </div>

                <div>
                  <Label htmlFor="travelConfirmationEmail">
                    Confirmation Email
                    <span className="text-sm text-muted-foreground ml-1">
                      (We will send confirmation once reviewed)
                    </span>
                  </Label>
                  <Input
                    id="travelConfirmationEmail"
                    type="email"
                    value={travelFormData.confirmationEmail}
                    onChange={(e) => setTravelFormData(prev => ({ ...prev, confirmationEmail: e.target.value }))}
                    placeholder="Enter email for confirmation notifications"
                    className="dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  />
                </div>

                <div>
                  <Label className="text-base font-semibold">Purpose of Travel</Label>
                  <RadioGroup
                    value={travelFormData.travelPurpose}
                    onValueChange={(value: TravelFormData["travelPurpose"]) =>
                      setTravelFormData(prev => ({
                        ...prev,
                        travelPurpose: value,
                        travelPurposeOther: value === "other" ? prev.travelPurposeOther : "",
                      }))
                    }
                    className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3"
                  >
                    {travelPurposeOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={`travel-purpose-${option.value}`} />
                        <Label htmlFor={`travel-purpose-${option.value}`}>{option.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {travelFormData.travelPurpose === "other" && (
                    <div className="mt-3">
                      <Label htmlFor="travelPurposeOther">Describe Travel Purpose</Label>
                      <Input
                        id="travelPurposeOther"
                        value={travelFormData.travelPurposeOther}
                        onChange={(e) => setTravelFormData(prev => ({ ...prev, travelPurposeOther: e.target.value }))}
                        placeholder="Provide details about the travel purpose"
                        className="dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="travelDestination">Destination (City / Airport)</Label>
                  <Input
                    id="travelDestination"
                    value={travelFormData.destination}
                    onChange={(e) => setTravelFormData(prev => ({ ...prev, destination: e.target.value }))}
                    placeholder="e.g., Orlando, FL / MCO"
                    className="dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Departure Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal dark:bg-gray-800 dark:text-white dark:border-gray-600",
                            !travelFormData.departureDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {travelFormData.departureDate ? format(travelFormData.departureDate, "PPP") : "Pick departure date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={travelFormData.departureDate}
                          onSelect={(date) => setTravelFormData(prev => ({ ...prev, departureDate: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label>Return Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal dark:bg-gray-800 dark:text-white dark:border-gray-600",
                            !travelFormData.returnDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {travelFormData.returnDate ? format(travelFormData.returnDate, "PPP") : "Pick return date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={travelFormData.returnDate}
                          onSelect={(date) => setTravelFormData(prev => ({ ...prev, returnDate: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <Label className="text-base font-semibold">Transportation Plan</Label>
                  <RadioGroup
                    value={travelFormData.transportationMode}
                    onValueChange={(value: TravelFormData["transportationMode"]) =>
                      setTravelFormData(prev => ({
                        ...prev,
                        transportationMode: value,
                      }))
                    }
                    className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3"
                  >
                    {transportationOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={`transportation-${option.value}`} />
                        <Label htmlFor={`transportation-${option.value}`}>{option.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <div className="mt-3">
                    <Label htmlFor="transportationDetails">Transportation Details (flight number, carrier, etc.)</Label>
                    <Textarea
                      id="transportationDetails"
                      value={travelFormData.transportationDetails}
                      onChange={(e) => setTravelFormData(prev => ({ ...prev, transportationDetails: e.target.value }))}
                      placeholder="Share important logistics about your travel"
                      className="mt-1 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-base font-semibold">Lodging</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Checkbox
                      id="lodging-required"
                      checked={travelFormData.lodgingRequired}
                      onCheckedChange={(checked) =>
                        setTravelFormData(prev => ({
                          ...prev,
                          lodgingRequired: !!checked,
                          lodgingDetails: checked ? prev.lodgingDetails : "",
                        }))
                      }
                    />
                    <Label htmlFor="lodging-required">Lodging required</Label>
                  </div>
                  {travelFormData.lodgingRequired && (
                    <div className="mt-3">
                      <Label htmlFor="lodgingDetails">Lodging Details</Label>
                      <Textarea
                        id="lodgingDetails"
                        value={travelFormData.lodgingDetails}
                        onChange={(e) => setTravelFormData(prev => ({ ...prev, lodgingDetails: e.target.value }))}
                        placeholder="Hotel preferences, check-in needs, etc."
                        className="mt-1 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="estimatedCost">Estimated Total Cost (optional)</Label>
                    <Input
                      id="estimatedCost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={travelFormData.estimatedCost}
                      onChange={(e) => setTravelFormData(prev => ({ ...prev, estimatedCost: e.target.value }))}
                      placeholder="e.g., 850.00"
                      className="dark:bg-gray-800 dark:text-white dark:border-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="additionalNotes">Additional Notes (Optional)</Label>
                  <Textarea
                    id="additionalNotes"
                    value={travelFormData.additionalNotes}
                    onChange={(e) => setTravelFormData(prev => ({ ...prev, additionalNotes: e.target.value }))}
                    placeholder="Share any other context your manager should know."
                    className="mt-1 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                  />
                </div>

                <div>
                  <Label className="text-base font-semibold">Employee's Signature</Label>
                  <div className="mt-2 flex justify-center">
                    <SignaturePad
                      ref={travelSignaturePadRef}
                      width={500}
                      height={150}
                      onSignatureChange={handleTravelSignatureChange}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={submitTravelRequest}
                    disabled={isTravelSubmitting}
                    size="lg"
                    className="px-8"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isTravelSubmitting ? "Submitting..." : "Submit Travel Request"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default PTO;
