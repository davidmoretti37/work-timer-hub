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

      const employeeId = newEmployee.id;

      // Create clock-in record
      const { data, error } = await supabase
        .from('clock_in_records')
        .insert({
          employee_id: employeeId,
          clock_in_time: clockInIso,
          status: 'clocked_in'
        })
        .select()
        .single();

      if (error) return res.status(500).json({ success: false, error: error.message });

      return res.status(200).json({ success: true, session: data });
    }

    // Check for existing active session today
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const { data: existing } = await supabase
      .from('clock_in_records')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('status', 'clocked_in')
      .gte('clock_in_time', today.toISOString())
      .lt('clock_in_time', tomorrow.toISOString())
      .order('clock_in_time', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(200).json({ success: true, message: 'Already clocked in', session: existing[0] });
    }

    // Create new clock-in record
    const { data, error } = await supabase
      .from('clock_in_records')
      .insert({
        employee_id: employee.id,
        clock_in_time: clockInIso,
        status: 'clocked_in'
      })
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.status(200).json({ success: true, session: data });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message ?? 'Server error' });
  }
}


