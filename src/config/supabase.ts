import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Create Supabase admin client with service key (for server-side operations)
const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Create Supabase client with anon key (for user-authenticated operations)
const supabaseClient = createClient(env.supabaseUrl, env.supabaseAnonKey);

export { supabaseAdmin, supabaseClient };
export default supabaseAdmin;
