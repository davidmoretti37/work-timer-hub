import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * API endpoint to check which users already have clock-in records for today
 * Used by DailyClockInBackfill to avoid creating duplicate entries
 */
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
    const { users } = req.body ?? {};

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing or invalid users array' });
    }

    // Use UTC to calculate today's boundaries to avoid timezone issues
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const existingEmails: string[] = [];

    // Process users in batches to avoid query size limits
    const batchSize = 50;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);

      // Extract emails from batch
      const emails = batch
        .filter((u: any) => u && u.email)
        .map((u: any) => String(u.email).toLowerCase().trim());

      if (emails.length === 0) {
        continue;
      }

      // Look up employee IDs for these emails
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, email')
        .in('email', emails);

      if (empError) {
        console.error('[check-clock-ins] Error fetching employees:', empError);
        continue;
      }

      if (!employees || employees.length === 0) {
        continue;
      }

      // Check for clock-in records for these employees today
      const employeeIds = employees.map(e => e.id);

      const { data: clockIns, error: clockInError } = await supabase
        .from('clock_in_records')
        .select('employee_id, clock_in_time')
        .in('employee_id', employeeIds)
        .gte('clock_in_time', today.toISOString())
        .lt('clock_in_time', tomorrow.toISOString());

      if (clockInError) {
        console.error('[check-clock-ins] Error fetching clock-in records:', clockInError);
        continue;
      }

      if (clockIns && clockIns.length > 0) {
        // Map employee IDs back to emails
        const employeeIdToEmail = new Map(employees.map(e => [e.id, e.email]));
        const clockedInEmployeeIds = new Set(clockIns.map(c => c.employee_id));

        for (const empId of clockedInEmployeeIds) {
          const email = employeeIdToEmail.get(empId);
          if (email && !existingEmails.includes(email)) {
            existingEmails.push(email);
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      existing_emails: existingEmails,
      total_checked: users.length,
      total_existing: existingEmails.length
    });

  } catch (error: any) {
    console.error('[check-clock-ins] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error',
      message: error?.message
    });
  }
}
