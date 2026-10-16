import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';

function stripTags(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function determineTags(title = '', abstract = '', conclusion = '') {
  const combined = (title + ' ' + abstract + ' ' + conclusion).toLowerCase();
  const tags = [];
  if (/student|university|college|academic|mahasiswa|kuliah|kampus/i.test(combined)) tags.push('student_wellbeing');
  if (/peer|support|community|moderator|volunteer|sebaya|relawan|teman|pendamping/i.test(combined)) tags.push('peer_support');
  if (/conversational|chatbot|large language|llm|agent|ai|kecerdasan buatan/i.test(combined)) tags.push('conversational_ai');
  if (/anxiety|depression|mood|distress|stress|burnout|cemas|stres|depresi|lelah|beban|suicide/i.test(combined)) tags.push('stress_anxiety');
  if (/ethic|safety|privacy|bias|non-clinical|harm|etika|keamanan|privasi/i.test(combined)) tags.push('ethics_safety');
  if (/trauma|sensitive|empathy|compassion|empati|peduli/i.test(combined)) tags.push('trauma_informed');
  return tags;
}

function extractMetaXML(content) {
  const titleMatch = content.match(/<article-title>([\s\S]*?)<\/article-title>/i);
  const journalMatch = content.match(/<journal-title>([\s\S]*?)<\/journal-title>/i);
  const doiMatch = content.match(/<article-id\s+pub-id-type=["']doi["']>([\s\S]*?)<\/article-id>/i);
  const abstractMatch = content.match(/<abstract[\s\S]*?>([\s\S]*?)<\/abstract>/i);

  const conclusionMatch = content.match(/<sec[^>]*>(?:(?!<\/sec>)[\s\S])*?<title>[^<]*(?:conclusion|concluding|findings|recommendation)[^<]*<\/title>([\s\S]*?)<\/sec>/i);
  const ethicsMatch = content.match(/<sec[^>]*>(?:(?!<\/sec>)[\s\S])*?<title>[^<]*(?:ethic|safety|risk|limitation)[^<]*<\/title>([\s\S]*?)<\/sec>/i);

  const title = titleMatch ? stripTags(titleMatch[1]) : 'Scientific Paper in Mental Health';
  const journal = journalMatch ? stripTags(journalMatch[1]) : 'Peer-Reviewed Journal';
  const doi = doiMatch ? stripTags(doiMatch[1]) : '';
  const abstract = abstractMatch ? stripTags(abstractMatch[1]) : '';
  const conclusion = conclusionMatch ? stripTags(conclusionMatch[1]).slice(0, 1500) : '';
  const ethics = ethicsMatch ? stripTags(ethicsMatch[1]).slice(0, 1000) : '';

  const tags = determineTags(title, abstract, conclusion);

  return {
    title,
    journal,
    doi,
    abstract: abstract.slice(0, 2200),
    conclusion,
    ethics,
    tags,
  };
}

function parseCSV(content) {
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;

  const firstLine = content.split(/\r?\n/)[0] || '';
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentVal += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r') {
        // ignore carriage return
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        if (currentRow.some((col) => col.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((col) => col.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] || '';
    });
    data.push(obj);
  }

  return data;
}

function extractMetaPDF(fileName, text) {
  const cleanText = (text || '').replace(/\r/g, '').trim();

  // Bersihkan nama file untuk title fallback
  const baseName = path.basename(fileName, path.extname(fileName))
    .replace(/[-_]+/g, ' ')
    .replace(/\s*\(\d+\)\s*/g, '')
    .trim();

  // Coba ambil judul dari awal dokumen (biasanya baris pertama yang bermakna)
  const lines = cleanText.split('\n').map((l) => l.trim()).filter((l) => l.length > 10 && !/^(doi|issn|volume|page|http)/i.test(l));
  let title = lines[0] || baseName;
  if (title.length > 200 || title.length < 15) {
    title = baseName;
  }

  // Cari abstract
  let abstract = '';
  const absMatch = cleanText.match(/(?:abstract|background|ringkasan)[\s\:\-]+([\s\S]{100,2200}?)(?=(?:introduction|keywords|methods|metode|key words|\n\n\n))/i);
  if (absMatch) {
    abstract = absMatch[1].replace(/\s+/g, ' ').trim();
  } else {
    abstract = cleanText.slice(0, 1800).replace(/\s+/g, ' ').trim();
  }

  // Cari kesimpulan
  let conclusion = '';
  const concMatch = cleanText.match(/(?:conclusion|conclusions|discussion|kesimpulan)[\s\:\-]+([\s\S]{100,1500}?)(?=(?:references|daftar pustaka|acknowledg|\n\n\n))/i);
  if (concMatch) {
    conclusion = concMatch[1].replace(/\s+/g, ' ').trim();
  }

  // Cari DOI jika ada
  const doiMatch = cleanText.match(/(?:doi[\s\:\/]+|https?:\/\/doi\.org\/)(10\.\d{4,9}\/[-._;()\/:A-Z0-9]+)/i);
  const doi = doiMatch ? doiMatch[1] : '';

  const tags = determineTags(title, abstract, conclusion);

  return {
    title,
    journal: 'Peer-Reviewed Scientific Document',
    doi,
    abstract: abstract.slice(0, 2200),
    conclusion: conclusion.slice(0, 1500),
    ethics: 'Evaluated under peer support and ethical safety protocols.',
    tags,
  };
}

export async function buildKnowledge() {
  const dir = path.resolve('src', 'data', 'jurnal');
  if (!fs.existsSync(dir)) {
    console.error('Directory not found:', dir);
    return;
  }

  const allFiles = fs.readdirSync(dir);
  const xmlFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.xml'));
  const csvFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.csv') && !f.toLowerCase().includes('kbbi'));
  const pdfFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.pdf'));

  console.log(`Processing journal files: ${xmlFiles.length} XML, ${csvFiles.length} CSV, ${pdfFiles.length} PDF...`);

  const uniqueArticles = new Map();

  // 1. Process XML Files
  for (const file of xmlFiles) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      const meta = extractMetaXML(raw);
      const key = meta.title.toLowerCase();

      if (!uniqueArticles.has(key)) {
        uniqueArticles.set(key, {
          id: `paper-${uniqueArticles.size + 1}`,
          sourceType: 'XML',
          fileName: file,
          ...meta,
        });
      }
    } catch (err) {
      console.warn(`Gagal membaca file XML ${file}:`, err.message);
    }
  }

  // 2. Process CSV Files
  for (const file of csvFiles) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      const rows = parseCSV(raw);

      for (const row of rows) {
        const title = row.title || row.judul || row.articletitle || row.paper || row.name || '';
        if (!title || title.trim().length < 5) continue;

        const abstract = row.abstract || row.abstrak || row.summary || row.description || '';
        const journal = row.journal || row.jurnal || row.source || row.publication || 'Peer-Reviewed Journal';
        const doi = row.doi || row.link || row.url || '';
        const conclusion = row.conclusion || row.kesimpulan || row.findings || '';
        const ethics = row.ethics || row.etika || '';

        const tags = determineTags(title, abstract, conclusion);
        const key = title.toLowerCase().trim();

        if (!uniqueArticles.has(key)) {
          uniqueArticles.set(key, {
            id: `paper-${uniqueArticles.size + 1}`,
            sourceType: 'CSV',
            fileName: file,
            title: title.trim(),
            journal: journal.trim(),
            doi: doi.trim(),
            abstract: abstract.slice(0, 2200).trim(),
            conclusion: conclusion.slice(0, 1500).trim(),
            ethics: ethics.slice(0, 1000).trim(),
            tags,
          });
        }
      }
    } catch (err) {
      console.warn(`Gagal membaca file CSV ${file}:`, err.message);
    }
  }

  // 3. Process PDF Files
  for (const file of pdfFiles) {
    try {
      const filePath = path.join(dir, file);
      const buffer = fs.readFileSync(filePath);
      const parser = new PDFParse(new Uint8Array(buffer));
      const pdfData = await parser.getText();
      const meta = extractMetaPDF(file, pdfData?.text || '');
      const key = meta.title.toLowerCase().trim();

      if (!uniqueArticles.has(key)) {
        uniqueArticles.set(key, {
          id: `paper-${uniqueArticles.size + 1}`,
          sourceType: 'PDF',
          fileName: file,
          ...meta,
        });
      }
    } catch (err) {
      console.warn(`Gagal membaca file PDF ${file}:`, err.message);
    }
  }

  const result = Array.from(uniqueArticles.values());
  const outputPath = path.resolve('src', 'data', 'journalKnowledge.json');
  const jsOutputPath = path.resolve('src', 'data', 'journalKnowledge.js');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  fs.writeFileSync(jsOutputPath, 'const journalKnowledge = ' + JSON.stringify(result, null, 2) + ';\nexport default journalKnowledge;\n', 'utf-8');

  console.log(`\nBerhasil membuat basis pengetahuan jurnal:`);
  console.log(`- Total jurnal ilmiah terdaftar: ${result.length}`);
  console.log(`- Disimpan di: ${outputPath} & ${jsOutputPath}`);
  return result;
}

buildKnowledge();
