const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
// Prefer service role key for backend API operations to bypass RLS safely
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project-id')) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// In-memory mock store for local development before Supabase keys are configured
const mockStore = {
  users: new Map(), // phone -> { id, phone, stamp_count, total_stamps_earned, rewards: [] }
  payments: [],
};

module.exports = {
  supabase,
  mockStore,
  isConfigured: !!supabase,
};
