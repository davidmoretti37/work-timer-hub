#!/usr/bin/env node

import http from 'node:http';
import { createClient } from '@supabase/supabase-js';

const port = Number(process.env.PORT || 4000);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables.');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY before running this script.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const server = http.createServer(async (req, res) => {
  const { method } = req;
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);

  // Basic CORS headers to mimic the deployed function
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(200).end();
    return;
  }

  if (url.pathname !== '/api/update-activity') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Not found' }));
    return;
  }

  if (method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
    return;
  }

  try {
    const body = await readRequestBody(req);
    const { email, status } = JSON.parse(body ?? '{}');

    if (!email || !status) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Missing email or status' }));
      return;
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const timestamp = new Date().toISOString();

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, name')
      .eq('email', normalizedEmail)
      .single();

    if (empError || !employee) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Employee not found' }));
      return;
    }

    const { error: updateError } = await supabase
      .from('employees')
      .update({
        status,
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
        status,
        timestamp,
      });

    if (logError) {
      console.error('Failed to log activity:', logError);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: `Status updated to ${status}`,
      employee_id: employee.id,
      employee_name: employee.name ?? null,
    }));
  } catch (error) {
    console.error('Error handling request:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Server error' }));
  }
});

server.listen(port, () => {
  console.log(`Local update-activity server running at http://localhost:${port}/api/update-activity`);
});

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', (err) => reject(err));
  });
}

