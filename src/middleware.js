import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from '@/lib/supabase/env';

export async function middleware(request) {
  // Tanpa env Supabase (mis. saat `next build` atau setup awal), biarkan lewat
  // supaya halaman tetap dirender (klien memakai stub) alih-alih error.
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        } catch {
          // Request cookies may be immutable in edge runtime
        }
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            response.cookies.set(name, value, options);
          } catch {
            // Prevent uncaught proxy TypeError in edge runtime
          }
        });
      },
    },
  });

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user || null;
  } catch {
    user = null;
  }

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isPublic = isAuthRoute || pathname === '/' || pathname.startsWith('/api') || pathname.startsWith('/_next');

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    const redirectResponse = NextResponse.redirect(url);
    try {
      response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c.name, c.value, c));
    } catch {
      // Abaikan jika penyalinan cookie gagal
    }
    return redirectResponse;
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/app/voice';
    const redirectResponse = NextResponse.redirect(url);
    try {
      response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c.name, c.value, c));
    } catch {
      // Abaikan jika penyalinan cookie gagal
    }
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
