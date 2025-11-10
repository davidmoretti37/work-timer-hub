import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  const allowedHeaders =
    typeof req.headers['access-control-request-headers'] === 'string'
      ? req.headers['access-control-request-headers']
      : 'Content-Type';
  res.setHeader('Access-Control-Allow-Headers', allowedHeaders);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }

  try {
    const { email } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ success: false, error: 'Missing email' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    // Find ANY active clock-in record for this employee (not restricted by date)
    // This handles users in negative UTC timezones who clock in one UTC day and clock out the next
    const { data: record, error: recErr } = await supabase
      .from('clock_in_records')
      .select('id, status, clock_in_time')
      .eq('employee_id', employee.id)
      .eq('status', 'clocked_in')
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recErr) {
      return res.status(500).json({ success: false, error: recErr.message });
    }

    if (!record) {
      return res.status(200).json({ success: true, message: 'No active clock-in for today' });
    }

    const clockOutTimeIso = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('clock_in_records')
      .update({ status: 'clocked_out', clock_out_time: clockOutTimeIso })
      .eq('id', record.id);

    if (updErr) {
      return res.status(500).json({ success: false, error: updErr.message });
    }

    return res.status(200).json({ success: true, message: 'Clocked out successfully', clock_out_time: clockOutTimeIso });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message ?? 'Server error' });
  }
}


