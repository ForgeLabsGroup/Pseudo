import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

/**
 * Server-only admin client (bypasses RLS). Use for storage uploads, background jobs,
 * and token tables. NEVER import this into apps/web.
 */
let admin: SupabaseClient | null = null;
export function getAdminClient(): SupabaseClient {
  admin ??= createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** Per-request client that carries the user's JWT, so every query is subject to RLS. */
export function getUserClient(accessToken: string): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export const MEDIA_BUCKET = 'media';
export type { SupabaseClient };
