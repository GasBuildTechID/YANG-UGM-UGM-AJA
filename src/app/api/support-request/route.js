import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildSummaryFromText } from '@/lib/intake';

// Ringkasan kebutuhan (dokumen §1: AI merangkum, user mengoreksi).
// Tanpa OPENAI_API_KEY -> fallback berbasis aturan. Tidak pernah menyimpan percakapan.
export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Harus login.' }, { status: 401 });
    }

    const { text, language = 'id' } = await request.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Teks kosong.' }, { status: 400 });
    }

    if (process.env.OPENAI_API_KEY) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content:
                  'Kamu asisten yang merangkum kebutuhan dukungan mahasiswa. JANGAN memberi diagnosis. Balas JSON: {"summary": string (1-2 kalimat, netral, bahasa Indonesia), "suggested_category": salah satu dari didengarkan|berbagi_pengalaman|strategi_praktis|bantuan_profesional, "suggested_mode": "group"|"one_to_one"|null}.',
              },
              { role: 'user', content: text.slice(0, 2000) },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
          if (parsed.summary) {
            return NextResponse.json({
              summary: parsed.summary,
              suggested_category: parsed.suggested_category || 'didengarkan',
              suggested_mode: parsed.suggested_mode || null,
              language,
              engine: 'ai',
            });
          }
        }
      } catch {
        // jatuh ke fallback
      }
    }

    return NextResponse.json({ ...buildSummaryFromText(text, language), engine: 'rule' });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Gagal merangkum.' }, { status: 500 });
  }
}
