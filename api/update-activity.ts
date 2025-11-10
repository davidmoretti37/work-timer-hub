import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!supabase) {
    console.error('[update-activity] Supabase client not configured');
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }

  try {
    const { email, status, last_activity: lastActivityOverride, idle_seconds } = req.body ?? {};

    console.log('[update-activity] Incoming payload', req.body);

    if (!email || !status) {
      return res.status(400).json({ success: false, error: 'Missing email or status' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedStatus = String(status).toLowerCase().trim();

    if (!['active', 'idle'].includes(normalizedStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const lastActivityTimestamp = (() => {
      if (!lastActivityOverride) {
        return timestamp;
      }
      if (typeof lastActivityOverride !== 'string') {
        return timestamp;
      }
      const parsed = new Date(lastActivityOverride);
      if (Number.isNaN(parsed.getTime())) {
        console.warn('[update-activity] Invalid last_activity value, defaulting to now', lastActivityOverride);
        return timestamp;
      }
      return parsed.toISOString();
    })();

    // First, update employee_activity table
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

    // If idle_seconds provided and status is idle, update the today's clock_in_records
    if (idle_seconds && normalizedStatus === 'idle') {
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('email', normalizedEmail)
        .single();

      if (employee) {
        // Use UTC day boundaries to match other API behavior
        const now = new Date();
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        const tomorrow = new Date(today);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

        const { error: clockInError } = await supabase
          .from('clock_in_records')
          .update({ idle_seconds: idle_seconds })
          .eq('employee_id', employee.id)
          .eq('status', 'clocked_in')
          .gte('clock_in_time', today.toISOString())
          .lt('clock_in_time', tomorrow.toISOString());

        if (clockInError) {
          console.error('[update-activity] Failed to update idle_seconds:', clockInError);
        }
      }
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

