import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Navbar from "@/components/Navbar";
import SignaturePad, { SignaturePadRef } from "@/components/SignaturePad";
import { useToast } from "@/hooks/use-toast";
import { FileText, CheckCircle, XCircle, User } from "lucide-react";
import { format } from "date-fns";

const ApprovePTO = () => {
  const [searchParams] = useSearchParams();
  const [ptoRequest, setPtoRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [ownerSignature, setOwnerSignature] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const signaturePadRef = useRef<SignaturePadRef>(null);

  const action = searchParams.get("action"); // 'approve' or 'reject'
  const token = searchParams.get("token");
  const isPlain = (searchParams.get("plain") === "1" || searchParams.get("plain") === "true");

  useEffect(() => {
    const fetchPTORequest = async () => {
      if (!token) {
        toast({
          title: "Invalid Request",
          description: "Approval token is missing",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      try {
        // Fetch PTO request by token (for display only; update happens via Edge Function)
        const { data, error } = await supabase
          .from("pto_requests")
          .select("*")
          .eq("approval_token", token)
          .single();

        if (error || !data) {
          throw new Error("PTO request not found or already processed");
        }

        setPtoRequest(data);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load PTO request",
          variant: "destructive",
        });
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    fetchPTORequest();
  }, [action, token, navigate, toast]);

  const handleSignatureChange = (signature: string) => {
    setOwnerSignature(signature);
  };

  const processApproval = async () => {
    if (!token) return;

    // Validate signature for approval
    if (action === "approve" && !ownerSignature) {
      toast({
        title: "Signature Required",
        description: "Please sign to approve this PTO request",
        variant: "destructive",
      });
      return;
    }

    if (!ownerName.trim()) {
      toast({
        title: "Name Required", 
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      console.log("🔄 Approving via Edge Function with token:", token);
      const { data, error } = await supabase.functions.invoke('approve-pto', {
        body: {
          token,
          action,
          ownerName,
          employerSignature: ownerSignature,
          adminNotes,
        },
      });
      if (error) throw error;
      console.log("✅ Edge approval success:", data);

      // Send confirmation email to employee
      await sendConfirmationEmail();

      toast({
        title: action === "approve" ? "PTO Approved!" : "PTO Rejected",
        description: `Confirmation email sent to ${ptoRequest.confirmation_email}`,
      });

      // Redirect after success
      setTimeout(() => navigate("/"), 2000);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process PTO request",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const sendConfirmationEmail = async () => {
    try {
      console.log("Sending confirmation email to:", ptoRequest.confirmation_email);
      
      const { data, error } = await supabase.functions.invoke('send-pto-confirmation', {
        body: {
          ptoData: ptoRequest,
          action: action === "approve" ? "approved" : "rejected",
          ownerName: ownerName,
          adminNotes: adminNotes
        }
      });

      if (error) {
        console.error("Confirmation email error:", error);
        // Don't throw - this is secondary to the main approval process
        toast({
          title: "PTO Processed Successfully",
          description: "Request processed but confirmation email failed. Employee will be notified manually.",
          variant: "default",
        });
      } else {
        console.log("✅ Confirmation email sent successfully:", data);
      }
    } catch (error) {
      console.error("Failed to send confirmation email:", error);
      // Don't fail the entire process if email fails
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-primary" />
          <p>Loading PTO request...</p>
        </div>
      </div>
    );
  }

  if (!ptoRequest) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md container-shadow">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2">Request Not Found</h3>
            <p className="text-muted-foreground">
              This PTO request could not be found or has already been processed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* No Navbar - this page should work without login */}
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="container-shadow">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              {action === "approve" ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  Approve PTO Request
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-red-600" />
                  Reject PTO Request
                </>
              )}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Employee Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <User className="h-5 w-5" />
                Employee Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium">Name</Label>
                  <p>{ptoRequest.employee_name}</p>
                </div>
                <div>
                  <Label className="font-medium">Confirmation Email</Label>
                  <p>{ptoRequest.confirmation_email}</p>
                </div>
              </div>
            </div>

            {/* Request Details */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-3">Request Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-medium">Type</Label>
                  <p className="capitalize">{ptoRequest.request_type}</p>
                </div>
                <div>
                  <Label className="font-medium">Reason</Label>
                  <p className="capitalize">{ptoRequest.reason_type}</p>
                </div>
                <div>
                  <Label className="font-medium">Start Date</Label>
                  <p>{format(new Date(ptoRequest.start_date), "PPP")}</p>
                </div>
                <div>
                  <Label className="font-medium">End Date</Label>
                  <p>{format(new Date(ptoRequest.end_date), "PPP")}</p>
                </div>
              </div>
              
              {ptoRequest.custom_reason && (
                <div className="mt-4">
                  <Label className="font-medium">Additional Details</Label>
                  <p className="mt-1">{ptoRequest.custom_reason}</p>
                </div>
              )}
            </div>

            {/* Employee Signature */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-3">Employee Signature</h3>
              {ptoRequest.employee_signature ? (
                <img 
                  src={ptoRequest.employee_signature} 
                  alt="Employee Signature" 
                  className="max-w-sm border border-gray-300 rounded p-2 bg-white"
                />
              ) : (
                <p className="text-muted-foreground">No signature provided</p>
              )}
            </div>

            {/* Owner Response Section */}
            <div className="bg-white border-2 border-primary/20 p-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-3">
                Owner Response - {action === "approve" ? "Approval" : "Rejection"}
              </h3>
              
              {/* Owner Name */}
              <div className="mb-4">
                <Label htmlFor="ownerName">Your Name</Label>
                <Input
                  id="ownerName"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>

              {/* Admin Notes */}
              <div className="mb-4">
                <Label htmlFor="adminNotes">
                  Notes (Optional)
                  <span className="text-sm text-muted-foreground ml-1">
                    - Add any comments about this decision
                  </span>
                </Label>
                <Textarea
                  id="adminNotes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Enter any additional notes or comments..."
                />
              </div>

              {/* Signature Section (only for approval) */}
              {action === "approve" && (
                <div className="mb-4">
                  <Label className="text-base font-semibold">
                    Owner Signature (Required for Approval)
                  </Label>
                  <div className="mt-2">
                    <SignaturePad
                      ref={signaturePadRef}
                      width={400}
                      height={150}
                      onSignatureChange={handleSignatureChange}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                disabled={submitting}
              >
                Cancel
              </Button>
              
              <Button
                onClick={processApproval}
                disabled={submitting}
                className={action === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                size="lg"
              >
                {submitting ? (
                  "Processing..."
                ) : (
                  action === "approve" ? "✅ Approve PTO Request" : "❌ Reject PTO Request"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ApprovePTO;
