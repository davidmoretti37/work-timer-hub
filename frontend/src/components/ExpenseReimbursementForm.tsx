import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SignaturePad, { SignaturePadRef } from "@/components/SignaturePad";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Plus, Trash2, Upload, DollarSign, Scan, FileCheck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  SUPPORTED_CURRENCIES,
  convertToUSD,
  formatCurrency,
  getExchangeRate,
} from "@/utils/currencyUtils";
import ReceiptAnalyzer, { type AnalyzedReceiptData } from "./ReceiptAnalyzer";

export interface ExpenseItem {
  id: string;
  expenseDate: Date | undefined;
  vendorName: string;
  description: string;
  category: string;
  currency: string;
  amount: string;
  amountUSD: number;
  exchangeRate: number;
  receiptFile: File | null;
  receiptUrl: string;
  notes: string;
  paymentMethod: string;
  isAnalyzed: boolean;
  analyzedData?: AnalyzedReceiptData;
}

interface ExpenseReimbursementFormProps {
  user: any;
  profile: any;
  onSuccess?: () => void;
}

const EXPENSE_CATEGORIES = [
  "Airfare",
  "Hotel/Lodging",
  "Meals",
  "Ground Transportation",
  "Rental Car",
  "Fuel",
  "Parking",
  "Office Supplies",
  "Client Entertainment",
  "Training/Education",
  "Other",
];

export default function ExpenseReimbursementForm({
  user,
  profile,
  onSuccess,
}: ExpenseReimbursementFormProps) {
  const [employeeName, setEmployeeName] = useState("");
  const [department, setDepartment] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"payroll" | "bank_transfer">("payroll");
  const [employeeCertified, setEmployeeCertified] = useState(false);
  const [employeeSignature, setEmployeeSignature] = useState("");
  const [managerSignature, setManagerSignature] = useState("");
  const [managerName, setManagerName] = useState("");
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentExpenseId, setCurrentExpenseId] = useState<string | null>(null);

  const employeeSignaturePadRef = useRef<SignaturePadRef>(null);
  const managerSignaturePadRef = useRef<SignaturePadRef>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user && profile) {
      setEmployeeName(profile.full_name || user.email || "");
      setConfirmationEmail(user.email || "");
    }
  }, [user, profile]);

  // Add initial empty expense row
  useEffect(() => {
    if (expenses.length === 0) {
      addExpenseRow();
    }
  }, []);

  const addExpenseRow = () => {
    const newExpense: ExpenseItem = {
      id: crypto.randomUUID(),
      expenseDate: undefined,
      vendorName: "",
      description: "",
      category: "",
      currency: "USD",
      amount: "",
      amountUSD: 0,
      exchangeRate: 1.0,
      receiptFile: null,
      receiptUrl: "",
      notes: "",
      paymentMethod: "",
      isAnalyzed: false,
    };
    setExpenses(prev => [...prev, newExpense]);
    setCurrentExpenseId(newExpense.id);
  };

  const handleReceiptAnalysis = (expenseId: string, data: AnalyzedReceiptData) => {
    setExpenses(expenses.map(exp => {
      if (exp.id === expenseId) {
        return {
          ...exp,
          expenseDate: data.date || exp.expenseDate,
          vendorName: data.vendorName || exp.vendorName,
          amount: data.amount.toString(),
          currency: data.currency,
          amountUSD: data.amountUSD,
          exchangeRate: data.currency === "USD" ? 1.0 : data.amount / data.amountUSD,
          receiptFile: data.receiptFile,
          paymentMethod: data.paymentMethod,
          isAnalyzed: true,
          analyzedData: data,
        };
      }
      return exp;
    }));
    setCurrentExpenseId(null);
  };

  const removeExpenseRow = (id: string) => {
    if (expenses.length === 1) {
      toast({
        title: "Cannot Remove",
        description: "At least one expense item is required",
        variant: "destructive",
      });
      return;
    }
    setExpenses(expenses.filter((exp) => exp.id !== id));
  };

  const updateExpense = async (
    id: string,
    field: keyof ExpenseItem,
    value: any
  ) => {
    const updatedExpenses = await Promise.all(
      expenses.map(async (exp) => {
        if (exp.id !== id) return exp;

        const updated = { ...exp, [field]: value };

        // Recalculate USD amount when amount or currency changes
        if (field === "amount" || field === "currency") {
          const amount = parseFloat(field === "amount" ? value : exp.amount);
          const currency = field === "currency" ? value : exp.currency;

          if (!isNaN(amount) && amount > 0) {
            try {
              const exchangeRate = await getExchangeRate(currency);
              const amountUSD = await convertToUSD(amount, currency);

              updated.amountUSD = amountUSD;
              updated.exchangeRate = exchangeRate;
            } catch (error) {
              console.error("Failed to convert currency:", error);
            }
          } else {
            updated.amountUSD = 0;
            updated.exchangeRate = 1.0;
          }
        }

        return updated;
      })
    );

    setExpenses(updatedExpenses);
  };

  const handleReceiptUpload = async (id: string, file: File | null) => {
    if (!file) {
      updateExpense(id, "receiptFile", null);
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a JPG, PNG, or PDF file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    updateExpense(id, "receiptFile", file);
  };

  const uploadReceiptToStorage = async (
    file: File,
    expenseItemId: string
  ): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${expenseItemId}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("expense-receipts")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("expense-receipts")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Failed to upload receipt:", error);
      return null;
    }
  };

  const calculateGrandTotal = (): number => {
    return expenses.reduce((total, exp) => total + exp.amountUSD, 0);
  };

  const validateForm = (): boolean => {
    if (!employeeName.trim()) {
      toast({
        title: "Validation Error",
        description: "Employee name is required",
        variant: "destructive",
      });
      return false;
    }

    if (!confirmationEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(confirmationEmail)) {
      toast({
        title: "Validation Error",
        description: "Valid confirmation email is required",
        variant: "destructive",
      });
      return false;
    }

    if (!supervisorName.trim()) {
      toast({
        title: "Validation Error",
        description: "Supervisor/Manager name is required",
        variant: "destructive",
      });
      return false;
    }

    if (expenses.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one expense item is required",
        variant: "destructive",
      });
      return false;
    }

    // Validate each expense item
    for (let i = 0; i < expenses.length; i++) {
      const exp = expenses[i];

      if (!exp.expenseDate) {
        toast({
          title: "Validation Error",
          description: `Expense date is required for item ${i + 1}`,
          variant: "destructive",
        });
        return false;
      }

      if (!exp.vendorName.trim()) {
        toast({
          title: "Validation Error",
          description: `Vendor name is required for item ${i + 1}`,
          variant: "destructive",
        });
        return false;
      }

      if (!exp.description.trim()) {
        toast({
          title: "Validation Error",
          description: `Description is required for item ${i + 1}`,
          variant: "destructive",
        });
        return false;
      }

      if (!exp.amount || parseFloat(exp.amount) <= 0) {
        toast({
          title: "Validation Error",
          description: `Valid amount is required for item ${i + 1}`,
          variant: "destructive",
        });
        return false;
      }

      if (!exp.isAnalyzed) {
        toast({
          title: "Validation Error",
          description: `Please upload and analyze receipt for expense ${i + 1}`,
          variant: "destructive",
        });
        return false;
      }

      if (!exp.receiptFile && !exp.receiptUrl) {
        toast({
          title: "Validation Error",
          description: `Receipt is required for item ${i + 1}`,
          variant: "destructive",
        });
        return false;
      }
    }

    if (!employeeCertified) {
      toast({
        title: "Validation Error",
        description: "You must certify the accuracy of your expenses",
        variant: "destructive",
      });
      return false;
    }

    if (!employeeSignature) {
      toast({
        title: "Validation Error",
        description: "Employee signature is required",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const submitExpenseReimbursement = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setIsUploading(true);

    try {
      // Create the reimbursement record first
      const { data: reimbursement, error: reimbursementError } = await supabase
        .from("expense_reimbursements")
        .insert({
          user_id: user.id,
          employee_name: employeeName,
          department: department || null,
          supervisor_name: supervisorName,
          confirmation_email: confirmationEmail,
          payment_method: paymentMethod,
          total_amount_usd: calculateGrandTotal(),
          employee_signature: employeeSignature,
          employee_certified: employeeCertified,
          status: "pending",
        })
        .select()
        .single();

      if (reimbursementError) throw reimbursementError;
      if (!reimbursement) throw new Error("Failed to create reimbursement");

      // Upload receipts and create expense items
      for (const expense of expenses) {
        let receiptUrl = expense.receiptUrl;

        if (expense.receiptFile) {
          const uploadedUrl = await uploadReceiptToStorage(
            expense.receiptFile,
            expense.id
          );
          if (uploadedUrl) {
            receiptUrl = uploadedUrl;
          }
        }

        const { error: itemError } = await supabase.from("expense_items").insert({
          reimbursement_id: reimbursement.id,
          expense_date: expense.expenseDate?.toISOString().split("T")[0],
          vendor_name: expense.vendorName,
          description: expense.description,
          category: expense.category || null,
          currency: expense.currency,
          amount: parseFloat(expense.amount),
          exchange_rate: expense.exchangeRate,
          amount_usd: expense.amountUSD,
          receipt_url: receiptUrl || null,
          notes: expense.notes || null,
        });

        if (itemError) throw itemError;
      }

      setIsUploading(false);

      toast({
        title: "Expense Reimbursement Submitted",
        description: `Your request for ${formatCurrency(
          calculateGrandTotal(),
          "USD"
        )} has been submitted successfully. Confirmation will be sent to ${confirmationEmail}`,
      });

      // Reset form
      resetForm();

      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Error submitting expense reimbursement:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit expense reimbursement",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setDepartment("");
    setSupervisorName("");
    setPaymentMethod("payroll");
    setEmployeeCertified(false);
    setEmployeeSignature("");
    setManagerSignature("");
    setManagerName("");
    setExpenses([]);
    employeeSignaturePadRef.current?.clear();
    managerSignaturePadRef.current?.clear();
    addExpenseRow();
  };

  const grandTotal = calculateGrandTotal();

  return (
    <div className="space-y-6">
      {/* Employee Information */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Employee Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="employeeName">Employee Name</Label>
            <Input
              id="employeeName"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Full name"
              className="dark:bg-gray-800 dark:text-white dark:border-gray-600"
            />
          </div>
          <div>
            <Label htmlFor="department">Department (Optional)</Label>
            <Input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Your department"
              className="dark:bg-gray-800 dark:text-white dark:border-gray-600"
            />
          </div>
          <div>
            <Label htmlFor="confirmationEmail">Confirmation Email</Label>
            <Input
              id="confirmationEmail"
              type="email"
              value={confirmationEmail}
              onChange={(e) => setConfirmationEmail(e.target.value)}
              placeholder="email@example.com"
              className="dark:bg-gray-800 dark:text-white dark:border-gray-600"
            />
          </div>
          <div>
            <Label htmlFor="supervisorName">Supervisor/Manager Name</Label>
            <Input
              id="supervisorName"
              value={supervisorName}
              onChange={(e) => setSupervisorName(e.target.value)}
              placeholder="Manager's full name"
              className="dark:bg-gray-800 dark:text-white dark:border-gray-600"
            />
          </div>
        </div>
      </Card>

      {/* Expense Items */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Expense Details</h3>
          {expenses.filter(e => e.isAnalyzed).length > 0 && !currentExpenseId && (
            <Button onClick={addExpenseRow} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Another Expense
            </Button>
          )}
        </div>

        {/* Receipt Analyzer for New Expense */}
        {currentExpenseId && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Scan className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Upload Receipt to Auto-Extract Data</h4>
            </div>
            <ReceiptAnalyzer
              onAnalysisComplete={(data) => handleReceiptAnalysis(currentExpenseId, data)}
              existingData={expenses.find(e => e.id === currentExpenseId)?.analyzedData}
            />
          </div>
        )}

        {/* List of Analyzed Expenses */}
        {expenses.filter(e => e.isAnalyzed).length > 0 && (
          <div className="space-y-4 mt-6">
            <h4 className="font-medium text-sm text-muted-foreground">
              Analyzed Expenses ({expenses.filter(e => e.isAnalyzed).length})
            </h4>
            {expenses.filter(e => e.isAnalyzed).map((expense, index) => (
              <Card key={expense.id} className="p-4 bg-muted/30">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <Input
                        value={expense.vendorName || ""}
                        onChange={(e) =>
                          updateExpense(expense.id, "vendorName", e.target.value)
                        }
                        placeholder="Vendor name"
                        className="font-semibold h-8 mb-1"
                      />
                      <Input
                        type="date"
                        value={expense.expenseDate ? format(expense.expenseDate, "yyyy-MM-dd") : ""}
                        onChange={(e) =>
                          updateExpense(expense.id, "expenseDate", e.target.value ? new Date(e.target.value) : null)
                        }
                        className="text-sm h-7"
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeExpenseRow(expense.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Amount</Label>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold">
                        {formatCurrency(parseFloat(expense.amount) || 0, expense.currency)}
                      </span>
                      {expense.currency !== "USD" && (
                        <span className="text-sm text-muted-foreground">
                          ≈ {formatCurrency(expense.amountUSD, "USD")}
                        </span>
                      )}
                    </div>
                    {expense.currency !== "USD" && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Exchange Rate: {expense.exchangeRate.toFixed(4)}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor={`payment-${expense.id}`} className="text-xs">Payment Method</Label>
                    <Input
                      id={`payment-${expense.id}`}
                      value={expense.paymentMethod || ""}
                      onChange={(e) =>
                        updateExpense(expense.id, "paymentMethod", e.target.value)
                      }
                      placeholder="Payment method"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`category-${expense.id}`} className="text-xs">
                      Category <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={expense.category}
                      onValueChange={(value) =>
                        updateExpense(expense.id, "category", value)
                      }
                    >
                      <SelectTrigger id={`category-${expense.id}`} className="mt-1">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-1">
                    <Label htmlFor={`description-${expense.id}`} className="text-xs">
                      Description <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`description-${expense.id}`}
                      value={expense.description}
                      onChange={(e) =>
                        updateExpense(expense.id, "description", e.target.value)
                      }
                      placeholder="What was this expense for?"
                      className="mt-1"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor={`notes-${expense.id}`} className="text-xs">
                      Additional Notes (Optional)
                    </Label>
                    <Textarea
                      id={`notes-${expense.id}`}
                      value={expense.notes}
                      onChange={(e) =>
                        updateExpense(expense.id, "notes", e.target.value)
                      }
                      placeholder="Any additional context..."
                      className="mt-1 min-h-[60px]"
                      rows={2}
                    />
                  </div>
                </div>

                {expense.receiptFile && (
                  <button
                    type="button"
                    onClick={() => {
                      const url = URL.createObjectURL(expense.receiptFile!);
                      window.open(url, '_blank');
                    }}
                    className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center gap-2 hover:text-green-600 hover:underline cursor-pointer w-full text-left"
                  >
                    <FileCheck className="h-3 w-3" />
                    Receipt: {expense.receiptFile.name}
                  </button>
                )}
              </Card>
            ))}
          </div>
        )}

        {expenses.filter(e => e.isAnalyzed).length === 0 && !currentExpenseId && (
          <div className="text-center py-8 text-muted-foreground">
            <Scan className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No expenses added yet. Click "Add Expense" to get started.</p>
          </div>
        )}

        {/* Old table structure removed */}
        <div className="overflow-x-auto" style={{ display: 'none' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead className="w-[150px]">Vendor</TableHead>
                <TableHead className="w-[180px]">Description</TableHead>
                <TableHead className="w-[120px]">Category</TableHead>
                <TableHead className="w-[100px]">Currency</TableHead>
                <TableHead className="w-[120px]">Amount</TableHead>
                <TableHead className="w-[120px]">USD Amount</TableHead>
                <TableHead className="w-[120px]">Receipt</TableHead>
                <TableHead className="w-[150px]">Notes</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense, index) => (
                <TableRow key={expense.id}>
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !expense.expenseDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {expense.expenseDate
                            ? format(expense.expenseDate, "MM/dd/yy")
                            : "Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={expense.expenseDate}
                          onSelect={(date) =>
                            updateExpense(expense.id, "expenseDate", date)
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={expense.vendorName}
                      onChange={(e) =>
                        updateExpense(expense.id, "vendorName", e.target.value)
                      }
                      placeholder="Vendor"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={expense.description}
                      onChange={(e) =>
                        updateExpense(expense.id, "description", e.target.value)
                      }
                      placeholder="Description"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={expense.category}
                      onValueChange={(value) =>
                        updateExpense(expense.id, "category", value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={expense.currency}
                      onValueChange={(value) =>
                        updateExpense(expense.id, "currency", value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_CURRENCIES.map((curr) => (
                          <SelectItem key={curr.code} value={curr.code}>
                            {curr.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={expense.amount}
                      onChange={(e) =>
                        updateExpense(expense.id, "amount", e.target.value)
                      }
                      placeholder="0.00"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <DollarSign className="h-3 w-3" />
                      {expense.amountUSD.toFixed(2)}
                    </div>
                    {expense.currency !== "USD" && expense.exchangeRate !== 1.0 && (
                      <div className="text-xs text-muted-foreground">
                        Rate: {expense.exchangeRate.toFixed(4)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <label htmlFor={`receipt-${expense.id}`}>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() =>
                            document.getElementById(`receipt-${expense.id}`)?.click()
                          }
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          {expense.receiptFile ? "Change" : "Upload"}
                        </Button>
                      </label>
                      <input
                        id={`receipt-${expense.id}`}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,application/pdf"
                        onChange={(e) =>
                          handleReceiptUpload(
                            expense.id,
                            e.target.files?.[0] || null
                          )
                        }
                        className="hidden"
                      />
                      {expense.receiptFile && (
                        <button
                          type="button"
                          onClick={() => {
                            const url = URL.createObjectURL(expense.receiptFile!);
                            window.open(url, '_blank');
                          }}
                          className="text-xs text-green-600 truncate hover:underline cursor-pointer text-left"
                        >
                          {expense.receiptFile.name}
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Textarea
                      value={expense.notes}
                      onChange={(e) =>
                        updateExpense(expense.id, "notes", e.target.value)
                      }
                      placeholder="Optional notes"
                      className="w-full min-h-[60px]"
                      rows={2}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeExpenseRow(expense.id)}
                      disabled={expenses.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Grand Total */}
        {expenses.filter(e => e.isAnalyzed).length > 0 && (
          <div className="mt-6 pt-6 border-t flex justify-end">
            <div className="bg-primary/10 px-8 py-4 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Total Reimbursement</div>
              <div className="text-3xl font-bold text-primary">{formatCurrency(grandTotal, "USD")}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {expenses.filter(e => e.isAnalyzed).length} expense{expenses.filter(e => e.isAnalyzed).length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Payment Method */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Payment Method</h3>
        <RadioGroup value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="payroll" id="payroll" />
            <Label htmlFor="payroll">Add to next payroll</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="bank_transfer" id="bank_transfer" />
            <Label htmlFor="bank_transfer">Direct bank transfer</Label>
          </div>
        </RadioGroup>
      </Card>

      {/* Employee Certification & Signature */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Employee Certification</h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="certify"
              checked={employeeCertified}
              onCheckedChange={(checked) => setEmployeeCertified(!!checked)}
            />
            <Label htmlFor="certify" className="text-sm leading-relaxed">
              I certify that the above expenses were incurred by me in the performance of
              my duties and that all information provided is accurate and complete. I
              understand that any false statements may result in disciplinary action.
            </Label>
          </div>

          <div>
            <Label className="text-base font-semibold">Employee Signature</Label>
            <div className="mt-2 flex justify-center">
              <SignaturePad
                ref={employeeSignaturePadRef}
                width={500}
                height={150}
                onSignatureChange={setEmployeeSignature}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>
          Reset Form
        </Button>
        <Button
          onClick={submitExpenseReimbursement}
          disabled={isSubmitting}
          size="lg"
          className="px-8"
        >
          {isUploading
            ? "Uploading Receipts..."
            : isSubmitting
            ? "Submitting..."
            : "Submit Reimbursement Request"}
        </Button>
      </div>
    </div>
  );
}
