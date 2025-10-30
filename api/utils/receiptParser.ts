// Receipt text parsing utilities for extracting structured data from OCR text

export interface ParsedReceipt {
  amount: number | null;
  currency: string;
  date: Date | null;
  vendorName: string;
  paymentMethod: string;
  confidence: {
    amount: number;
    date: number;
    vendor: number;
    payment: number;
  };
}

/**
 * Parses OCR text from a receipt and extracts structured data
 */
export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  return {
    amount: extractAmount(text),
    currency: detectCurrency(text),
    date: extractDate(text),
    vendorName: extractVendorName(lines),
    paymentMethod: extractPaymentMethod(text),
    confidence: calculateConfidence(text, lines),
  };
}

/**
 * Extracts the total amount from receipt text
 * Looks for keywords like TOTAL, AMOUNT, SUBTOTAL near numbers
 */
function extractAmount(text: string): number | null {
  // Normalize text
  const normalizedText = text.toUpperCase();

  // Patterns to find total amount
  const totalPatterns = [
    /(?:TOTAL|AMOUNT\s+DUE|BALANCE|GRAND\s+TOTAL|AMOUNT|SUBTOTAL)[:\s]*([£$€¥₹R\$]?\s*[\d,]+\.?\d{0,2})/i,
    /([£$€¥₹R\$]?\s*[\d,]+\.\d{2})\s*(?:TOTAL|AMOUNT\s+DUE)/i,
  ];

  for (const pattern of totalPatterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      const amountStr = match[1].replace(/[£$€¥₹R\$,\s]/g, '');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        return amount;
      }
    }
  }

  // Fallback: Find the largest number in the text (likely the total)
  const numbers = text.match(/[\d,]+\.\d{2}/g);
  if (numbers && numbers.length > 0) {
    const amounts = numbers
      .map(n => parseFloat(n.replace(/,/g, '')))
      .filter(n => !isNaN(n) && n > 0);

    if (amounts.length > 0) {
      return Math.max(...amounts);
    }
  }

  return null;
}

/**
 * Detects currency from receipt text
 */
function detectCurrency(text: string): string {
  const currencyPatterns = [
    { pattern: /\$|USD|US\s*DOLLAR/i, currency: 'USD' },
    { pattern: /€|EUR|EURO/i, currency: 'EUR' },
    { pattern: /£|GBP|POUND/i, currency: 'GBP' },
    { pattern: /R\$|BRL|REAL|REAIS/i, currency: 'BRL' },
    { pattern: /CA\$|CAD|CANADIAN\s*DOLLAR/i, currency: 'CAD' },
    { pattern: /MX\$|MXN|PESO/i, currency: 'MXN' },
    { pattern: /¥|JPY|YEN/i, currency: 'JPY' },
    { pattern: /CNY|YUAN|RMB/i, currency: 'CNY' },
    { pattern: /₹|INR|RUPEE/i, currency: 'INR' },
    { pattern: /A\$|AUD|AUSTRALIAN\s*DOLLAR/i, currency: 'AUD' },
  ];

  for (const { pattern, currency } of currencyPatterns) {
    if (pattern.test(text)) {
      return currency;
    }
  }

  // Default to USD if no currency detected
  return 'USD';
}

/**
 * Extracts date from receipt text
 */
function extractDate(text: string): Date | null {
  const datePatterns = [
    // MM/DD/YYYY or DD/MM/YYYY
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    // YYYY-MM-DD
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    // Month DD, YYYY (e.g., "Jan 15, 2024")
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i,
    // DD Month YYYY (e.g., "15 January 2024")
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        // Try to parse the matched date
        const dateStr = match[0];
        const date = new Date(dateStr);

        if (!isNaN(date.getTime())) {
          // Validate the date is reasonable (not in the future, not too old)
          const now = new Date();
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(now.getFullYear() - 1);

          if (date <= now && date >= oneYearAgo) {
            return date;
          }
        }
      } catch (e) {
        continue;
      }
    }
  }

  return null;
}

/**
 * Extracts vendor name from receipt (typically first few lines)
 */
function extractVendorName(lines: string[]): string {
  // Vendor name is usually in the first 1-3 lines
  // Filter out very short lines and lines with only numbers
  const candidateLines = lines
    .slice(0, 5)
    .filter(line => {
      const trimmed = line.trim();
      return (
        trimmed.length >= 3 &&
        !/^\d+$/.test(trimmed) && // Not just numbers
        !/^[\d\/\-:]+$/.test(trimmed) && // Not just date/time
        !trimmed.match(/^(receipt|invoice|bill)$/i) // Not generic words
      );
    });

  if (candidateLines.length > 0) {
    // Return the longest line from the first few (often the business name)
    return candidateLines.reduce((a, b) => (a.length > b.length ? a : b)).trim();
  }

  return '';
}

/**
 * Extracts payment method from receipt text
 */
function extractPaymentMethod(text: string): string {
  const normalizedText = text.toUpperCase();

  const paymentPatterns = [
    { pattern: /VISA/i, method: 'Visa' },
    { pattern: /MASTERCARD|M\/C/i, method: 'Mastercard' },
    { pattern: /AMEX|AMERICAN\s*EXPRESS/i, method: 'American Express' },
    { pattern: /DISCOVER/i, method: 'Discover' },
    { pattern: /DEBIT/i, method: 'Debit Card' },
    { pattern: /CREDIT/i, method: 'Credit Card' },
    { pattern: /CASH/i, method: 'Cash' },
    { pattern: /CHECK|CHEQUE/i, method: 'Check' },
  ];

  for (const { pattern, method } of paymentPatterns) {
    if (pattern.test(normalizedText)) {
      return method;
    }
  }

  return 'Unknown';
}

/**
 * Calculates confidence scores for extracted data
 */
function calculateConfidence(text: string, lines: string[]): {
  amount: number;
  date: number;
  vendor: number;
  payment: number;
} {
  const normalizedText = text.toUpperCase();

  // Amount confidence: High if "TOTAL" keyword is present
  const amountConfidence = /TOTAL|AMOUNT\s+DUE|BALANCE/i.test(normalizedText) ? 90 : 60;

  // Date confidence: High if standard date format is found
  const dateConfidence = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(text) ? 85 : 50;

  // Vendor confidence: High if first lines have text
  const vendorConfidence = lines.length > 0 && lines[0].trim().length > 3 ? 80 : 40;

  // Payment confidence: High if card brand is mentioned
  const paymentConfidence = /(VISA|MASTERCARD|AMEX|DEBIT|CREDIT|CASH)/i.test(normalizedText) ? 85 : 30;

  return {
    amount: amountConfidence,
    date: dateConfidence,
    vendor: vendorConfidence,
    payment: paymentConfidence,
  };
}

/**
 * Validates if the parsed receipt has minimum required data
 */
export function isValidParsedReceipt(parsed: ParsedReceipt): boolean {
  // At minimum, we need an amount
  return parsed.amount !== null && parsed.amount > 0;
}

/**
 * Calculates overall confidence score for the parsed receipt
 */
export function getOverallConfidence(parsed: ParsedReceipt): number {
  const { amount, date, vendor, payment } = parsed.confidence;
  // Weighted average (amount is most important)
  return Math.round((amount * 0.5 + date * 0.2 + vendor * 0.2 + payment * 0.1));
}
