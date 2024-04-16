import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Create a single supabase client
export const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_KEY ?? '',
);
