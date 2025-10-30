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
    const { user_id: userId, clock_in: clockInRaw } = req.body ?? {};
    if (!userId) return res.status(400).json({ success: false, error: 'Missing user_id' });

    const clockInIso = clockInRaw ? new Date(clockInRaw).toISOString() : new Date().toISOString();

    // Do not create if an active local session already exists
    const { data: existing } = await supabase
      .from('time_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(200).json({ success: true, message: 'Already clocked in (local)' });
    }

    const { data, error } = await supabase
      .from('time_sessions')
      .insert({ user_id: userId, clock_in: clockInIso })
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, error: error.message });

    return res.status(200).json({ success: true, session: data });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message ?? 'Server error' });
  }
}


