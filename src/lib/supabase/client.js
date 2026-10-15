import { createBrowserClient } from '@supabase/ssr';
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from '@/lib/supabase/env';

let cached = null;

// Stub callable+awaitable: dipakai ketika env Supabase belum diisi supaya
// halaman tetap merender (dan banner konfigurasi tampil) alih-alih crash.
function makeStub() {
  const result = { data: null, error: null, count: null };
  const stub = new Proxy(function stub() {}, {
    get(_target, prop) {
      if (prop === 'then') return (resolve) => resolve(result);
      if (prop === 'catch' || prop === 'finally') return () => Promise.resolve(result);
      if (prop === Symbol.toPrimitive || prop === 'toString') return () => '';
      return stub;
    },
    apply() {
      return stub;
    },
  });
  return stub;
}

export { isSupabaseConfigured };

export function createClient() {
  if (cached) return cached;
  if (!isSupabaseConfigured()) return makeStub();

  cached = createBrowserClient(supabaseUrl(), supabaseKey());
  return cached;
}
