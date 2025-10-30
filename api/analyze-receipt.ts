import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseReceiptText, isValidParsedReceipt, getOverallConfidence } from './utils/receiptParser';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Allow up to 10MB for receipt images
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔵 [API] Receipt analysis request received');
    const startTime = Date.now();

    const { image } = req.body;

    if (!image) {
      console.log('❌ [API] No image provided');
      return res.status(400).json({ error: 'No image provided' });
    }

    // Validate image format (base64 data URL)
    if (!image.startsWith('data:image/')) {
      console.log('❌ [API] Invalid image format');
      return res.status(400).json({ error: 'Invalid image format. Expected base64 data URL' });
    }

    const imageSize = (image.length * 0.75 / 1024).toFixed(2); // Approximate KB
    console.log(`📊 [API] Image size: ~${imageSize} KB`);

    // Use OCR.space API (free tier, faster than Tesseract)
    console.log('🔍 [API] Calling OCR.space API...');
    const ocrStartTime = Date.now();

    // OCR.space free API key (no signup required for testing)
    const OCR_API_KEY = process.env.OCR_SPACE_API_KEY || 'K87899142388957';

    const formData = new URLSearchParams();
    formData.append('base64Image', image);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // Engine 2 is faster

    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'apikey': OCR_API_KEY,
      },
      body: formData,
    });

    const ocrResult = await ocrResponse.json();
    const ocrDuration = ((Date.now() - ocrStartTime) / 1000).toFixed(2);
    console.log(`✅ [API] OCR completed in ${ocrDuration}s`);

    if (!ocrResult.ParsedResults || ocrResult.ParsedResults.length === 0) {
      console.log('❌ [API] No text detected');
      return res.status(400).json({
        error: 'No text detected in image',
        message: 'Please upload a clearer image of your receipt',
        success: false,
      });
    }

    const extractedText = ocrResult.ParsedResults[0].ParsedText;
    console.log(`📝 [API] Extracted text preview: ${extractedText.substring(0, 200)}`);

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({
        error: 'No text detected in image',
        message: 'Please upload a clearer image of your receipt',
        success: false,
      });
    }

    // Parse the extracted text
    const parsed = parseReceiptText(extractedText);
    const overallConfidence = getOverallConfidence(parsed);

    console.log('Parsed data:', {
      amount: parsed.amount,
      currency: parsed.currency,
      vendor: parsed.vendorName,
      date: parsed.date,
      confidence: overallConfidence,
    });

    // Validate the parsed data
    if (!isValidParsedReceipt(parsed)) {
      return res.status(400).json({
        error: 'Could not extract required information',
        message: 'Unable to find the total amount. Please upload a clearer receipt or enter manually.',
        success: false,
        partialData: {
          text: extractedText,
          parsed,
        },
      });
    }

    // Check confidence threshold
    if (overallConfidence < 40) {
      return res.status(400).json({
        error: 'Low confidence in extracted data',
        message: 'The image quality is too low. Please upload a clearer photo.',
        success: false,
        confidence: overallConfidence,
        partialData: {
          text: extractedText,
          parsed,
        },
      });
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [API] Total processing time: ${totalDuration}s`);

    // Return successfully parsed data
    return res.status(200).json({
      success: true,
      data: {
        amount: parsed.amount,
        currency: parsed.currency,
        date: parsed.date,
        vendorName: parsed.vendorName,
        paymentMethod: parsed.paymentMethod,
      },
      confidence: {
        overall: overallConfidence,
        amount: parsed.confidence.amount,
        date: parsed.confidence.date,
        vendor: parsed.confidence.vendor,
        payment: parsed.confidence.payment,
      },
      rawText: extractedText.substring(0, 500), // Include snippet for debugging
    });
  } catch (error: any) {
    console.error('❌ [API] Receipt analysis error:', error);
    console.error('❌ [API] Error stack:', error.stack);
    return res.status(500).json({
      error: 'Failed to analyze receipt',
      message: error.message || 'An unexpected error occurred',
      errorType: error.name,
      success: false,
    });
  }
}
