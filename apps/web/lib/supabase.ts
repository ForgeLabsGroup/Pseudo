'use client';
import { createClient } from '@supabase/supabase-js';

/** Browser client: used ONLY for auth (anon key). All data goes through the API. */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'missing-anon-key',
);
