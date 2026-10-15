import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from '@/lib/supabase/env';

export async function createClient() {
  const cookieStore = await cookies();

  if (!isSupabaseConfigured()) {
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      rpc: async () => ({ data: null, error: null }),
    };
  }

  return createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // dipanggil dari Server Component — aman diabaikan (middleware yang menangani refresh)
        }
      },
    },
  });
}

// Klien admin (service role) — HANYA untuk server-side / seed. Jangan diekspos ke browser.
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured() || !serviceKey || serviceKey.includes('your_') || serviceKey.includes('xxxxxxxxxxxx')) {
    throw new Error('Supabase URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi dengan benar di environment variables.');
  }

  const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
  return createSupabaseClient(
    supabaseUrl(),
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
