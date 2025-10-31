import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  const allowedHeaders =
    typeof req.headers['access-control-request-headers'] === 'string'
      ? req.headers['access-control-request-headers']
      : 'Content-Type, Cache-Control';
  res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!supabase) {
    console.error('[get-active-session] Supabase client not configured');
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }

  const emailParam = req.query?.email;
  const email = typeof emailParam === 'string' ? emailParam.toLowerCase().trim() : '';

  if (!email) {
    return res.status(400).json({ success: false, error: 'Missing email' });
  }

  try {
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('email', email)
      .single();

    if (employeeError) {
      if (employeeError.code === 'PGRST116' || employeeError.code === 'PGRST204') {
        return res.status(200).json({ success: true, session: null });
      }
      console.error('[get-active-session] Failed to fetch employee:', employeeError);
      return res.status(500).json({ success: false, error: employeeError.message });
    }

    // Use UTC to calculate today's boundaries to avoid timezone issues
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const { data: record, error: recordError } = await supabase
      .from('clock_in_records')
      .select('id, employee_id, clock_in_time, status, clock_out_time')
      .eq('employee_id', employee.id)
      .eq('status', 'clocked_in')
      .gte('clock_in_time', today.toISOString())
      .lt('clock_in_time', tomorrow.toISOString())
      .limit(1)
      .maybeSingle();

    if (recordError) {
      console.error('[get-active-session] Failed to fetch clock-in record:', recordError);
      return res.status(500).json({ success: false, error: recordError.message });
    }

    if (record) {
      console.log('[get-active-session] Found active record:', { record, email });
      return res.status(200).json({ success: true, session: { ...record, source: 'clock_in_records' } });
    }

    // Fallback: return the latest record for today even if already clocked out
    const { data: latestToday, error: latestError } = await supabase
      .from('clock_in_records')
      .select('id, employee_id, clock_in_time, status, clock_out_time')
      .eq('employee_id', employee.id)
      .gte('clock_in_time', today.toISOString())
      .lt('clock_in_time', tomorrow.toISOString())
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error('[get-active-session] Failed to fetch latest record for fallback:', latestError);
      return res.status(500).json({ success: false, error: latestError.message });
    }

    // If we found a Salesforce record, return it
    if (latestToday) {
      console.log('[get-active-session] Fallback latest record:', { latestToday, email });
      return res.status(200).json({ success: true, session: { ...latestToday, source: 'clock_in_records' } });
    }

    // Final fallback: Check time_sessions for manual clock-ins
    console.log('[get-active-session] No Salesforce record found, checking time_sessions for manual clock-ins');

    try {
      // Look up user by email
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) {
        console.error('[get-active-session] Failed to list auth users:', authError);
        return res.status(200).json({ success: true, session: null });
      }

      const user = authData?.users?.find(u => u.email?.toLowerCase() === email);

      if (!user) {
        console.log('[get-active-session] No auth user found for email:', email);
        return res.status(200).json({ success: true, session: null });
      }

      // Check for active manual session (clock_out is null)
      const { data: timeSession, error: timeSessionError } = await supabase
        .from('time_sessions')
        .select('*')
        .eq('user_id', user.id)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (timeSessionError) {
        console.error('[get-active-session] Failed to fetch time_sessions:', timeSessionError);
        return res.status(200).json({ success: true, session: null });
      }

      if (timeSession) {
        console.log('[get-active-session] Found manual session:', { timeSession, email });
        return res.status(200).json({ success: true, session: { ...timeSession, source: 'time_sessions' } });
      }

      console.log('[get-active-session] No active session found in any table');
      return res.status(200).json({ success: true, session: null });
    } catch (manualCheckError: any) {
      console.error('[get-active-session] Error checking manual sessions:', manualCheckError);
      return res.status(200).json({ success: true, session: null });
    }
  } catch (error: any) {
    console.error('[get-active-session] Unexpected error:', error);
    return res.status(500).json({ success: false, error: error?.message ?? 'Server error' });
  }
}
