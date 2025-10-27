import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: existing } = await supabase
      .from('clock_in_records')
      .select('id')
      .eq('employee_id', employee.id)
      .gte('clock_in_time', today.toISOString())
      .lt('clock_in_time', tomorrow.toISOString())
      .eq('status', 'clocked_in')
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Already clocked in today',
        employee_id: employee.id,
      });
    }

    const { data: clockIn, error: clockError } = await supabase
      .from('clock_in_records')
      .insert({
        employee_id: employee.id,
        clock_in_time: new Date().toISOString(),
        status: 'clocked_in',
      })
      .select()
      .single();

    if (clockError || !clockIn) {
      return res.status(500).json({ success: false, error: 'Failed to create clock-in' });
    }

    return res.status(200).json({
      success: true,
      message: 'Clocked in successfully',
      employee_id: employee.id,
      clock_in_time: clockIn.clock_in_time,
    });
  } catch (error) {
    console.error('Clock-in error:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

