import journalKnowledge from '../data/journalKnowledge.js';

/**
 * Mencari jurnal yang relevan berdasarkan teks input atau kategori kebutuhan pengguna.
 * @param {string} text - Teks ucapan atau curhatan pengguna
 * @param {string} category - Kategori kebutuhan ('didengarkan' | 'berbagi_pengalaman' | 'strategi_praktis' | 'bantuan_profesional')
 * @returns {Array} Daftar jurnal yang paling relevan (1-3 jurnal)
 */
export function findRelevantJournals(text = '', category = '') {
  const query = (text + ' ' + category).toLowerCase();

  const scored = journalKnowledge.map((paper) => {
    let score = 0;

    // Kecocokan dengan topik mahasiswa
    if (/kuliah|tugas|ujian|skripsi|kampus|akademik|stres|deadline|student|university/i.test(query)) {
      if (paper.tags.includes('student_wellbeing')) score += 5;
    }

    // Kecocokan dengan empati, kesedihan, trauma, butuh didengarkan
    if (/sedih|trauma|kehilangan|patah|sepi|dengar|cerita|lelah|capek/i.test(query)) {
      if (paper.tags.includes('trauma_informed')) score += 4;
      if (paper.tags.includes('peer_support')) score += 3;
    }

    // Kecocokan dengan etika & non-diagnosis (larangan AI membuat diagnosis)
    if (/diagnosis|obat|penyakit|gangguan|bipolar|depresi berat|profesional/i.test(query)) {
      if (paper.tags.includes('ethics_safety')) score += 4;
    }

    // Kecocokan kata kunci judul dan abstrak
    const paperText = (paper.title + ' ' + paper.abstract).toLowerCase();
    const keywords = ['student', 'peer', 'support', 'conversational', 'anxiety', 'stress', 'wellbeing', 'safety'];
    for (const kw of keywords) {
      if (query.includes(kw) && paperText.includes(kw)) score += 2;
    }

    // Baseline relevansi umum
    if (paper.tags.includes('peer_support')) score += 1;

    return { ...paper, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Ambil 2 jurnal terbaik
  return scored.slice(0, 2);
}

/**
 * Memformat konteks jurnal (Bahasa Inggris) untuk diinjeksikan ke System Prompt LLM.
 * @param {Array} journals - Array objek jurnal hasil pencarian
 * @returns {string} String konteks referensi ilmiah
 */
export function formatJournalsForPrompt(journals) {
  if (!journals || !journals.length) return '';

  return journals
    .map(
      (j, idx) => `
[JOURNAL REFERENCE #${idx + 1}]
Title: ${j.title}
Journal: ${j.journal} (DOI: ${j.doi || 'N/A'})
Key Findings / Abstract:
${j.abstract.slice(0, 1000)}
Clinical & Ethical Guidance:
${j.conclusion || j.ethics || 'Non-clinical peer support tool only; no automated diagnosis.'}
`
    )
    .join('\n');
}

/**
 * Mengambil seluruh daftar jurnal ilmiah untuk referensi pengguna / modal kredibilitas.
 */
export function getAllJournals() {
  return journalKnowledge.map((j) => ({
    id: j.id,
    title: j.title,
    journal: j.journal,
    doi: j.doi,
    tags: j.tags,
  }));
}

