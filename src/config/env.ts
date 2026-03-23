import { config } from 'dotenv';

// Load environment variables from .env file
config();

export const env = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',

  // Storage
  storageBucket: process.env.STORAGE_BUCKET || 'uploads',

  // Gemini AI (for future use)
  geminiApiKey: process.env.GEMINI_API_KEY || '',
};

// Validate required environment variables
export function validateEnv(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(
      `Warning: Missing environment variables: ${missing.join(', ')}`,
    );
  }
}
