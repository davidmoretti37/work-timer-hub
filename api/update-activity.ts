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
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }

  try {
    const { email, status } = req.body ?? {};

    if (!email || !status) {
      return res.status(400).json({ success: false, error: 'Missing email or status' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedStatus = String(status).toLowerCase().trim();

    if (!['active', 'idle'].includes(normalizedStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }

    const timestamp = new Date().toISOString();

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, name')
      .eq('email', normalizedEmail)
      .single();

    if (empError || !employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    const { error: updateError } = await supabase
      .from('employees')
      .update({
        status: normalizedStatus,
        last_activity: timestamp,
      })
      .eq('id', employee.id);

    if (updateError) {
      throw updateError;
    }

    const { error: logError } = await supabase
      .from('activity_log')
      .insert({
        employee_id: employee.id,
        status: normalizedStatus,
        timestamp,
      });

    if (logError) {
      console.error('Failed to log activity:', logError);
    }

    const { data: activityRecord, error: activityError } = await supabase
      .from('employee_activity')
      .upsert({
        email: normalizedEmail,
        status: normalizedStatus,
        last_activity: timestamp,
        updated_at: timestamp,
        created_at: timestamp,
      }, { onConflict: 'email' })
      .select()
      .single();

    if (activityError) {
      console.error('Failed to upsert employee_activity record:', activityError);
      return res.status(500).json({ success: false, error: 'Failed to persist activity status' });
    }

    return res.status(200).json({
      success: true,
      message: `Status updated to ${normalizedStatus}`,
      employee_id: employee.id,
      employee_name: employee.name ?? null,
      activity: activityRecord,
    });
  } catch (error: any) {
    console.error('Error updating activity:', error);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

