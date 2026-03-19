import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Create Supabase client singleton for database operations
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default supabase;
