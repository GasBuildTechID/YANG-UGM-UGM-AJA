import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildSummaryFromText } from '@/lib/intake';
import { findRelevantJournals, formatJournalsForPrompt } from '@/lib/journalKnowledge';

// Ringkasan kebutuhan berbasis bukti ilmiah (dokumen §1: AI merangkum, user mengoreksi).
// Grounding ilmiah: Dokumen jurnal (bahasa Inggris) diinjeksikan ke LLM,
// dan LLM menghasilkan tanggapan & saran dalam Bahasa Indonesia yang hangat dan empatik.
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

    // 1. Ambil jurnal ilmiah yang paling relevan dengan kondisi/kata-kata pengguna
    const relevantJournals = findRelevantJournals(text);
    const journalContext = formatJournalsForPrompt(relevantJournals);

    if (process.env.OPENAI_API_KEY) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // Batas aman 8 detik

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: `Kamu adalah asisten peer support mahasiswa "hearme" yang berbasis bukti ilmiah (evidence-based).
Tugasmu: Mendengarkan cerita pengguna, memahami emosinya, dan merangkum kebutuhannya berdasarkan literatur ilmiah peer support & kesehatan mental mahasiswa.

REFERENSI JURNAL ILMIAH (BAHASA INGGRIS):
"""
${journalContext}
"""

ATURAN KRUSIAL:
1. Pahami temuan ilmiah dari jurnal Bahasa Inggris di atas.
2. SELALU jawab dalam BAHASA INDONESIA yang santun, empatik, hangat, dan tidak menghakimi.
3. JANGAN PERNAH memberikan diagnosis klinis atau meresepkan penanganan medis (sesuai batasan etis pada jurnal).
4. Sediakan 'coping_suggestion': satu saran koping praktis mahasiswa (misal: grounding, ventilasi emosi, atau berbagi dengan rekan sebaya) yang didukung oleh jurnal di atas.
5. Sediakan 'evidence_note': satu kalimat ringkas dalam Bahasa Indonesia yang menjelaskan mengapa perasaan pengguna ini wajar menurut literatur ilmiah terkait.

FORMAT BALASAN HARUS VALID JSON:
{
  "summary": string (1-2 kalimat ringkasan kebutuhan pengguna dalam Bahasa Indonesia),
  "suggested_category": "didengarkan" | "berbagi_pengalaman" | "strategi_praktis" | "bantuan_profesional",
  "suggested_mode": "group" | "one_to_one" | null,
  "coping_suggestion": string (saran koping praktis mahasiswa dalam Bahasa Indonesia),
  "evidence_note": string (catatan ilmiah wajar dan empatik dalam Bahasa Indonesia),
  "cited_papers": [string (judul jurnal referensi yang digunakan)]
}`,
              },
              { role: 'user', content: text.slice(0, 2000) },
            ],
          }),
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
          if (parsed.summary) {
            return NextResponse.json({
              summary: parsed.summary,
              suggested_category: parsed.suggested_category || 'didengarkan',
              suggested_mode: parsed.suggested_mode || null,
              coping_suggestion: parsed.coping_suggestion || 'Luangkan waktu sejenak untuk menarik napas dalam dan bercerita dengan teman sebaya.',
              evidence_note: parsed.evidence_note || 'Penelitian menunjukkan bahwa berbagi beban emosional dengan sebaya secara signifikan meringankan stres mahasiswa.',
              cited_papers: parsed.cited_papers || relevantJournals.map((j) => j.title),
              language,
              engine: 'ai-journal-grounded',
            });
          }
        }
      } catch {
        // jatuh ke fallback berbasis aturan jika request AI gagal atau timeout
      }
    }

    // Fallback berbasis aturan + metadata jurnal
    const fallback = buildSummaryFromText(text, language);
    return NextResponse.json({
      ...fallback,
      coping_suggestion: 'Tarik napas dalam, istirahatkan pikiran sejenak, dan pilih teman bicara yang nyaman untukmu malam ini.',
      evidence_note: 'Berdasarkan studi kesehatan mental mahasiswa, mencari dukungan sejak dini mencegah penumpukan stres menjadi krisis.',
      cited_papers: relevantJournals.map((j) => j.title),
      engine: 'rule-journal-grounded',
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Gagal merangkum.' }, { status: 500 });
  }
}
