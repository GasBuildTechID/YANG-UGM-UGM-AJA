import { isSupabaseConfigured, supabaseUrl } from '../../../lib/supabase/env.js';

export const dynamic = 'force-dynamic';

/**
 * Health Check Endpoint
 * Digunakan oleh sistem monitoring (Vercel, UptimeRobot, CI/CD) untuk memeriksa
 * status kesiapan layanan frontend dan backend API Hearme.
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  const supabaseConfigured = isSupabaseConfigured();
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY);

  const healthData = {
    status: 'ok',
    service: 'hearme-api',
    timestamp,
    environment: process.env.NODE_ENV || 'production',
    uptime: Math.round(process.uptime()),
    integrations: {
      supabase: {
        status: supabaseConfigured ? 'connected' : 'unconfigured',
        url: supabaseUrl() ? supabaseUrl().replace(/^(https?:\/\/[^.]+).*/, '$1.***') : null,
      },
      openai: {
        status: openaiConfigured ? 'configured' : 'fallback-mode',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      },
    },
  };

  return Response.json(healthData, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
