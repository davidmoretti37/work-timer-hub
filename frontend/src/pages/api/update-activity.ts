import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

type SuccessResponse = {
  success: true;
  message: string;
  email: string;
  activity: {
    email: string;
    status: string;
    last_activity: string | null;
    updated_at: string;
    created_at: string;
  };
};

type ErrorResponse = {
  success: false;
  error: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, status, last_activity: lastActivityOverride } = req.body as {
      email?: string;
      status?: string;
      last_activity?: string;
    };

    console.log('[update-activity] Incoming payload', req.body);

    if (!email || !status) {
      return res.status(400).json({ success: false, error: 'Missing email or status' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedStatus = status.toLowerCase().trim();

    if (!['active', 'idle'].includes(normalizedStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const lastActivityTimestamp = (() => {
      if (!lastActivityOverride) {
        return timestamp;
      }
      const parsed = new Date(lastActivityOverride);
      if (Number.isNaN(parsed.getTime())) {
        console.warn('[update-activity] Invalid last_activity value, defaulting to now', lastActivityOverride);
        return timestamp;
      }
      return parsed.toISOString();
    })();

    const upsertPayload = {
      email: normalizedEmail,
      status: normalizedStatus,
      last_activity: lastActivityTimestamp,
      updated_at: timestamp,
    };

    const { data: activityRecord, error: activityError } = await supabase
      .from('employee_activity')
      .upsert(upsertPayload, { onConflict: 'email' })
      .select()
      .single();

    if (activityError) {
      console.error('[update-activity] Failed to upsert employee_activity record:', activityError);
      return res.status(500).json({ success: false, error: activityError.message ?? 'Failed to persist activity status' });
    }

    return res.status(200).json({
      success: true,
      message: `Status updated to ${normalizedStatus}`,
      email: normalizedEmail,
      activity: activityRecord,
    });
  } catch (error: any) {
    console.error('[update-activity] Error updating activity:', error);
    return res.status(500).json({ success: false, error: error?.message ?? 'Server error' });
  }
}

