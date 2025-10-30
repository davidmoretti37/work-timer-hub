import { createWorker } from 'tesseract.js';
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
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Validate image format (base64 data URL)
    if (!image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image format. Expected base64 data URL' });
    }

    console.log('Starting OCR analysis...');

    // Initialize Tesseract worker
    const worker = await createWorker('eng');

    try {
      // Perform OCR on the image
      const { data } = await worker.recognize(image);

      console.log('OCR completed. Confidence:', data.confidence);
      console.log('Extracted text preview:', data.text.substring(0, 200));

      if (!data.text || data.text.trim().length === 0) {
        await worker.terminate();
        return res.status(400).json({
          error: 'No text detected in image',
          message: 'Please upload a clearer image of your receipt',
          success: false,
        });
      }

      // Parse the extracted text
      const parsed = parseReceiptText(data.text);
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
        await worker.terminate();
        return res.status(400).json({
          error: 'Could not extract required information',
          message: 'Unable to find the total amount. Please upload a clearer receipt or enter manually.',
          success: false,
          partialData: {
            text: data.text,
            parsed,
            ocrConfidence: data.confidence,
          },
        });
      }

      // Check confidence threshold
      if (overallConfidence < 40) {
        await worker.terminate();
        return res.status(400).json({
          error: 'Low confidence in extracted data',
          message: 'The image quality is too low. Please upload a clearer photo.',
          success: false,
          confidence: overallConfidence,
          partialData: {
            text: data.text,
            parsed,
          },
        });
      }

      await worker.terminate();

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
        rawText: data.text.substring(0, 500), // Include snippet for debugging
        ocrConfidence: data.confidence,
      });
    } catch (ocrError: any) {
      console.error('OCR error:', ocrError);
      await worker.terminate();
      throw ocrError;
    }
  } catch (error: any) {
    console.error('Receipt analysis error:', error);
    return res.status(500).json({
      error: 'Failed to analyze receipt',
      message: error.message || 'An unexpected error occurred',
      success: false,
    });
  }
}
