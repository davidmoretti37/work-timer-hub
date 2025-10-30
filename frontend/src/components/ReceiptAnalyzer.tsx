import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileCheck, AlertCircle, Loader2, CheckCircle, XCircle } from "lucide-react";
import { convertToUSD, formatCurrency } from "@/utils/currencyUtils";

export interface AnalyzedReceiptData {
  amount: number;
  currency: string;
  amountUSD: number;
  date: Date | null;
  vendorName: string;
  paymentMethod: string;
  confidence: {
    overall: number;
    amount: number;
    date: number;
    vendor: number;
    payment: number;
  };
  receiptFile: File;
}

interface ReceiptAnalyzerProps {
  onAnalysisComplete: (data: AnalyzedReceiptData) => void;
  existingData?: AnalyzedReceiptData | null;
}

export default function ReceiptAnalyzer({
  onAnalysisComplete,
  existingData,
}: ReceiptAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzedReceiptData | null>(
    existingData || null
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas with max dimensions
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;

          let width = img.width;
          let height = img.height;

          // Scale down if needed
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx!.drawImage(img, 0, 0, width, height);

          // Compress to JPEG at 0.8 quality
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (file: File) => {
    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a JPG, PNG, or WEBP image",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setProgress(10);

    try {
      // Compress image for faster upload/processing
      setProgress(20);
      const base64Image = await compressImage(file);
      setProgress(40);

      // Call the analyze-receipt API with timeout
      setProgress(60);
      console.log('📤 Calling /api/analyze-receipt...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('⏰ Request timed out after 45 seconds');
        controller.abort();
      }, 45000); // 45 second timeout

      console.log('🚀 Sending request to API...');
      const startTime = Date.now();

      const response = await fetch("/api/analyze-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: base64Image }),
        signal: controller.signal,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Response received in ${elapsed}s, status: ${response.status}`);

      clearTimeout(timeoutId);
      setProgress(80);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      console.log('📥 Parsing JSON response...');
      const result = await response.json();
      console.log('✅ Parsed result:', result);
      setProgress(90);

      if (!result.success) {
        setError(result.message || result.error || "Failed to analyze receipt");
        toast({
          title: "Analysis Failed",
          description: result.message || "Could not extract data from receipt",
          variant: "destructive",
        });
        setIsAnalyzing(false);
        return;
      }

      // Convert amount to USD if needed
      const amountUSD =
        result.data.currency === "USD"
          ? result.data.amount
          : await convertToUSD(result.data.amount, result.data.currency);

      const analyzedData: AnalyzedReceiptData = {
        amount: result.data.amount,
        currency: result.data.currency,
        amountUSD,
        date: result.data.date ? new Date(result.data.date) : null,
        vendorName: result.data.vendorName || "",
        paymentMethod: result.data.paymentMethod || "Unknown",
        confidence: result.confidence,
        receiptFile: file,
      };

      setAnalysisResult(analyzedData);
      onAnalysisComplete(analyzedData);
      setProgress(100);

      toast({
        title: "Receipt Analyzed Successfully",
        description: `Extracted ${formatCurrency(
          analyzedData.amount,
          analyzedData.currency
        )} from ${analyzedData.vendorName || "receipt"}`,
      });
    } catch (err: any) {
      console.error("Receipt analysis error:", err);

      if (err.name === 'AbortError') {
        setError("Analysis is taking too long. Please try a clearer image or try again.");
        toast({
          title: "Timeout",
          description: "Receipt analysis took too long. Please try a clearer photo.",
          variant: "destructive",
        });
      } else {
        setError(err.message || "An unexpected error occurred");
        toast({
          title: "Analysis Error",
          description: "Failed to analyze receipt. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsAnalyzing(false);
      setProgress(0);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setError(null);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 75) return "text-green-600";
    if (confidence >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 75) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (confidence >= 50) return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isAnalyzing) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset so same file can be selected again
    e.target.value = '';
  };

  const triggerFileInput = () => {
    const input = document.getElementById('receipt-upload-input') as HTMLInputElement;
    if (input) {
      input.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!analysisResult && (
        <div
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-primary hover:bg-muted/20 transition-all cursor-pointer"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={triggerFileInput}
        >
          <input
            type="file"
            id="receipt-upload-input"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
            disabled={isAnalyzing}
          />

          {!isAnalyzing ? (
            <div>
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">Upload Receipt for Auto-Fill</p>
              <p className="text-sm text-muted-foreground mb-4">
                Click to browse or drag and drop an image here
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerFileInput();
                }}
              >
                Choose Image
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Supports: JPG, PNG, WEBP (max 10MB)
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium">Analyzing Receipt...</p>
              <p className="text-sm text-muted-foreground">
                {progress < 40 && "Compressing image..."}
                {progress >= 40 && progress < 60 && "Uploading..."}
                {progress >= 60 && progress < 90 && "Extracting text with OCR..."}
                {progress >= 90 && "Almost done..."}
              </p>
              <div className="w-full max-w-xs bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This may take 10-30 seconds
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && !analysisResult && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="link"
              className="ml-2 p-0 h-auto"
              onClick={() => setError(null)}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <Card className="p-6 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-green-900 dark:text-green-100">
                Receipt Analyzed Successfully
              </h3>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Re-analyze
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                Amount
                {getConfidenceIcon(analysisResult.confidence.amount)}
              </Label>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {formatCurrency(analysisResult.amount, analysisResult.currency)}
              </div>
              {analysisResult.currency !== "USD" && (
                <div className="text-sm text-green-700 dark:text-green-300">
                  ≈ {formatCurrency(analysisResult.amountUSD, "USD")}
                </div>
              )}
              <div
                className={`text-xs ${getConfidenceColor(
                  analysisResult.confidence.amount
                )}`}
              >
                {analysisResult.confidence.amount}% confidence
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                Vendor
                {getConfidenceIcon(analysisResult.confidence.vendor)}
              </Label>
              <div className="text-lg font-medium text-green-900 dark:text-green-100">
                {analysisResult.vendorName || "Not detected"}
              </div>
              <div
                className={`text-xs ${getConfidenceColor(
                  analysisResult.confidence.vendor
                )}`}
              >
                {analysisResult.confidence.vendor}% confidence
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                Date
                {getConfidenceIcon(analysisResult.confidence.date)}
              </Label>
              <div className="text-lg font-medium text-green-900 dark:text-green-100">
                {analysisResult.date
                  ? analysisResult.date.toLocaleDateString()
                  : "Not detected"}
              </div>
              <div
                className={`text-xs ${getConfidenceColor(
                  analysisResult.confidence.date
                )}`}
              >
                {analysisResult.confidence.date}% confidence
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                Payment Method
                {getConfidenceIcon(analysisResult.confidence.payment)}
              </Label>
              <div className="text-lg font-medium text-green-900 dark:text-green-100">
                {analysisResult.paymentMethod}
              </div>
              <div
                className={`text-xs ${getConfidenceColor(
                  analysisResult.confidence.payment
                )}`}
              >
                {analysisResult.confidence.payment}% confidence
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-800 dark:text-green-200">
                Overall Confidence
              </span>
              <span
                className={`text-sm font-semibold ${getConfidenceColor(
                  analysisResult.confidence.overall
                )}`}
              >
                {analysisResult.confidence.overall}%
              </span>
            </div>
          </div>

          <Alert className="mt-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
              You can edit any of these values in the form below if they're incorrect.
            </AlertDescription>
          </Alert>
        </Card>
      )}
    </div>
  );
}
