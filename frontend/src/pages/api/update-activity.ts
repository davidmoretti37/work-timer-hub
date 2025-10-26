import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, status } = req.body;

    if (!email || !status) {
      return res.status(400).json({ error: 'Email and status are required' });
    }

    // Find employee by email
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, name')
      .eq('email', email)
      .single();

    if (employeeError || !employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Update employee status and last_activity
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        status: status,
        last_activity: new Date().toISOString()
      })
      .eq('id', employee.id);

    if (updateError) {
      throw updateError;
    }

    // Log the activity change
    const { error: logError } = await supabase
      .from('activity_log')
      .insert({
        employee_id: employee.id,
        status: status,
        timestamp: new Date().toISOString()
      });

    if (logError) {
      console.error('Failed to log activity:', logError);
    }

    return res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      employee_id: employee.id,
      employee_name: employee.name
    });

  } catch (error: any) {
    console.error('Error updating activity:', error);
    return res.status(500).json({ error: error.message });
  }
}

