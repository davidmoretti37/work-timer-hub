import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  const allowedHeaders = typeof req.headers['access-control-request-headers'] === 'string'
    ? req.headers['access-control-request-headers']
    : 'Content-Type';
  res.setHeader('Access-Control-Allow-Headers', allowedHeaders);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  if (!supabase) return res.status(500).json({ success: false, error: 'Server configuration error' });

  try {
    const { email, clock_in: clockInRaw } = req.body ?? {};
    if (!email) return res.status(400).json({ success: false, error: 'Missing email' });

    const normalizedEmail = email.toLowerCase().trim();
    const clockInIso = clockInRaw ? new Date(clockInRaw).toISOString() : new Date().toISOString();

    // Find or create employee record
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (employeeError) {
      return res.status(500).json({ success: false, error: `Employee lookup failed: ${employeeError.message}` });
    }

    let employeeId: string;

    if (!employee) {
      // Create employee record for manual clock-ins
      const { data: newEmployee, error: createError } = await supabase
        .from('employees')
        .insert({ email: normalizedEmail, name: email.split('@')[0] })
        .select('id')
        .single();

      if (createError) {
        return res.status(500).json({ success: false, error: `Failed to create employee: ${createError.message}` });
      }

      employeeId = newEmployee.id;
    } else {
      employeeId = employee.id;
    }

    // Check for existing active session today
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // First check for ANY active session (could be from yesterday if it failed to clock out)
    const { data: activeSession, error: activeError } = await supabase
      .from('clock_in_records')
      .select('id, clock_in_time, status')
      .eq('employee_id', employeeId)
      .eq('status', 'clocked_in')
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeError) {
      console.error('[manual-clock-in] Error checking active session:', activeError);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify active session'
      });
    }

    // If there's an active session, return it instead of creating a new one
    if (activeSession) {
      console.log('[manual-clock-in] Active session already exists:', normalizedEmail);
      return res.status(200).json({
        success: true,
        message: 'Already clocked in',
        session: activeSession
      });
    }

    // Check if user already clocked out today - prevent re-clocking in same day
    const { data: endedToday } = await supabase
      .from('clock_in_records')
      .select('id, clock_in_time, clock_out_time, status')
      .eq('employee_id', employeeId)
      .gte('clock_in_time', today.toISOString())
      .lt('clock_in_time', tomorrow.toISOString())
      .order('clock_in_time', { ascending: false })
      .limit(1);

    if (endedToday && endedToday.length > 0 && endedToday[0].status === 'clocked_out') {
      return res.status(400).json({
        success: false,
        error: 'ALREADY_CLOCKED_OUT',
        message: 'You have already clocked out for today. If you need to adjust your time, please contact your administrator.',
        session: endedToday[0]
      });
    }

    // Atomic insert: Let the database unique index prevent duplicates
    // If duplicate, catch the error and return the existing record
    const { data, error } = await supabase
      .from('clock_in_records')
      .insert({
        employee_id: employeeId,
        clock_in_time: clockInIso,
        status: 'clocked_in'
      })
      .select()
      .single();

    // Handle unique constraint violation (duplicate clock-in)
    if (error) {
      // PostgreSQL error code 23505 = unique_violation
      if (error.code === '23505' || error.message?.includes('unique_active_clock_in_per_employee_per_day')) {
        console.log('[manual-clock-in] Duplicate clock-in prevented by database constraint:', normalizedEmail);

        // Fetch ANY existing active record (could be from previous day if stuck)
        const { data: existing } = await supabase
          .from('clock_in_records')
          .select('*')
          .eq('employee_id', employeeId)
          .eq('status', 'clocked_in')
          .order('clock_in_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          return res.status(200).json({ success: true, message: 'Already clocked in', session: existing });
        }
      }

      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, session: data });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message ?? 'Server error' });
  }
}


