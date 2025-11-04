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
    const { email, login_time: loginTimeRaw } = req.body ?? {};

    if (!email) {
      return res.status(400).json({ success: false, error: 'Missing email' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    let providedLoginTime: Date | null = null;
    if (loginTimeRaw) {
      const candidate = new Date(loginTimeRaw);
      if (Number.isNaN(candidate.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid login_time' });
      }
      providedLoginTime = candidate;
    }

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    // Use UTC to calculate today's boundaries to avoid timezone issues
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // Check if user is already clocked in today
    const { data: existing } = await supabase
      .from('clock_in_records')
      .select('id, clock_in_time')
      .eq('employee_id', employee.id)
      .gte('clock_in_time', today.toISOString())
      .lt('clock_in_time', tomorrow.toISOString())
      .eq('status', 'clocked_in')
      .limit(1);

    if (existing && existing.length > 0) {
      const existingRecord = existing[0];

      if (providedLoginTime && existingRecord.clock_in_time) {
        const existingTime = new Date(existingRecord.clock_in_time);
        if (!Number.isNaN(existingTime.getTime()) && existingTime > providedLoginTime) {
          const updatedTimeIso = providedLoginTime.toISOString();
          await supabase
            .from('clock_in_records')
            .update({ clock_in_time: updatedTimeIso })
            .eq('id', existingRecord.id);
          existingRecord.clock_in_time = updatedTimeIso;
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Already clocked in today',
        employee_id: employee.id,
        clock_in_time: existing[0].clock_in_time,
      });
    }

    // If user already clocked out today, do NOT auto clock them back in
    const { data: endedToday } = await supabase
      .from('clock_in_records')
      .select('id, clock_in_time, clock_out_time, status')
      .eq('employee_id', employee.id)
      .gte('clock_in_time', today.toISOString())
      .lt('clock_in_time', tomorrow.toISOString())
      .order('clock_in_time', { ascending: false })
      .limit(1);

    if (endedToday && endedToday.length > 0 && endedToday[0].status === 'clocked_out') {
      return res.status(200).json({
        success: true,
        message: 'Already clocked out today',
        employee_id: employee.id,
        clock_in_time: endedToday[0].clock_in_time,
      });
    }

    const clockInTimeIso = (providedLoginTime ?? new Date()).toISOString();

    // Get the auth user_id from the employee email
    const { data: authUser } = await supabase.auth.admin.listUsers();
    const user = authUser?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);

    const { data: clockIn, error: clockError } = await supabase
      .from('clock_in_records')
      .insert({
        employee_id: employee.id,
        user_id: user?.id || null,
        clock_in_time: clockInTimeIso,
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

