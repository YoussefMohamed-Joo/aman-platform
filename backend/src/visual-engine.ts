import Jimp from 'jimp';
import * as db from './db.js';
import { MissingReport, SightingReport, VisualSearchResult, ProcessedImage } from './types.js';

// ─── Perceptual Hash ─────────────────────────────────────

export async function averageHash(buf: Buffer): Promise<string | null> {
  try {
    const image = await Jimp.read(buf);
    const small = image.resize(16, 16).greyscale();
    let total = 0;
    const pixels: number[] = [];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const brightness = Jimp.intToRGBA(small.getPixelColor(x, y)).r;
        pixels.push(brightness);
        total += brightness;
      }
    }
    const avg = total / pixels.length;
    return pixels.map(p => p >= avg ? '1' : '0').join('');
  } catch {
    return null;
  }
}

// ─── Color Extraction ────────────────────────────────────

export async function extractColors(buf: Buffer, count = 5): Promise<number[][]> {
  try {
    const image = await Jimp.read(buf);
    const small = image.resize(32, 32);
    const colorMap: Record<string, number> = {};
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const rgba = Jimp.intToRGBA(small.getPixelColor(x, y));
        const r = Math.round(rgba.r / 32) * 32;
        const g = Math.round(rgba.g / 32) * 32;
        const b = Math.round(rgba.b / 32) * 32;
        const key = `${r},${g},${b}`;
        colorMap[key] = (colorMap[key] || 0) + 1;
      }
    }
    const sorted = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, count).map(([key]) => key.split(',').map(Number));
  } catch {
    return [];
  }
}

// ─── Color Names ─────────────────────────────────────────

const COLOR_NAMES: Record<string, string> = {
  '0,0,0': 'أسود', '32,32,32': 'رمادي غامق', '64,64,64': 'رمادي',
  '128,128,128': 'رمادي', '192,192,192': 'رمادي فاتح', '255,255,255': 'أبيض',
  '255,0,0': 'أحمر', '192,0,0': 'أحمر غامق', '128,0,0': 'أحمر غامق',
  '0,0,255': 'أزرق', '0,0,192': 'أزرق غامق', '0,0,128': 'أزرق غامق',
  '0,255,0': 'أخضر', '0,192,0': 'أخضر', '0,128,0': 'أخضر غامق',
  '255,255,0': 'أصفر', '192,192,0': 'أصفر داكن',
  '255,192,0': 'برتقالي', '255,128,0': 'برتقالي غامق',
  '255,0,255': 'بنفسجي', '192,0,192': 'بنفسجي غامق', '128,0,128': 'بنفسجي داكن',
  '0,255,255': 'سماوي', '0,192,192': 'سماوي غامق',
  '192,128,64': 'بني', '128,64,0': 'بني غامق',
  '255,192,192': 'وردي', '255,128,128': 'وردي فاتح',
  '240,160,80': 'خوخي', '224,160,96': 'بيج', '192,192,160': 'بيج'
};

export function colorName(rgb: number[]): string {
  const key = rgb.join(',');
  return COLOR_NAMES[key] || `RGB(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

// ─── Hamming Distance ────────────────────────────────────

function hamming(h1: string | null, h2: string | null): number {
  if (!h1 || !h2) return 999;
  let dist = 0;
  for (let i = 0; i < Math.min(h1.length, h2.length); i++) {
    if (h1[i] !== h2[i]) dist++;
  }
  return dist;
}

// ─── Process Image ───────────────────────────────────────

export async function processImage(buf: Buffer, mimeType: string): Promise<ProcessedImage> {
  const hash = await averageHash(buf);
  const colors = await extractColors(buf, 5);
  return {
    dataUri: `data:${mimeType};base64,${buf.toString('base64')}`,
    hash: hash || '',
    colors,
    colorNames: colors.map(c => colorName(c))
  };
}

// ─── Search By Image ─────────────────────────────────────

export interface SearchOptions {
  type?: string;
  colors?: string;
  description?: string;
}

export async function searchByImage(imageBuf: Buffer, options: SearchOptions = {}) {
  const queryHash = await averageHash(imageBuf);
  const queryColors = await extractColors(imageBuf, 5);
  const colorNames = queryColors.map(c => colorName(c));
  const optionsColors = (options.colors || '').split(/[,\s،]+/).filter(Boolean);

  const missing = db.getMissingReports();
  const sightings = db.getSightingReports();
  const results: VisualSearchResult[] = [];

  // Search missing reports
  for (const m of missing) {
    const images: { type: string; hash: string | null; colors: number[][]; url?: string }[] = [];
    if (m.image) images.push({ type: 'person', url: m.image, hash: m.imageHash || null, colors: m.imageColors || [] });
    if (m.clothingImage) images.push({ type: 'clothing', url: m.clothingImage, hash: m.clothingHash || null, colors: m.clothingColors || [] });
    if (m.featureImages) {
      try {
        const feats = JSON.parse(m.featureImages) as any[];
        feats.forEach(f => images.push({ type: 'feature', url: f.url, hash: f.hash || null, colors: f.colors || [] }));
      } catch { /* ignore */ }
    }

    let bestScore = 0;
    const matchDetails: string[] = [];

    for (const img of images) {
      let score = 0;
      const pieces: string[] = [];

      if (img.hash && queryHash) {
        const dist = hamming(queryHash, img.hash);
        const sim = Math.max(0, 100 - (dist / 256) * 100);
        if (sim > 40) { score += sim * 0.5; pieces.push(`تشابه بصري: ${Math.round(sim)}%`); }
      }

      const matchedColors = queryColors.filter(qc =>
        img.colors.some(ic => Math.sqrt(Math.pow(qc[0] - ic[0], 2) + Math.pow(qc[1] - ic[1], 2) + Math.pow(qc[2] - ic[2], 2)) < 64)
      );
      if (matchedColors.length > 0) {
        const colorScore = (matchedColors.length / Math.max(queryColors.length, 1)) * 25;
        score += colorScore;
        pieces.push(`ألوان متطابقة: ${matchedColors.length}/${queryColors.length}`);
      }

      if (optionsColors.length > 0 && img.colors.length > 0) {
        const imgColorNames = img.colors.map(c => colorName(c));
        const matched = optionsColors.filter(oc => imgColorNames.some(ic => ic.includes(oc) || oc.includes(ic)));
        if (matched.length > 0) { score += (matched.length / optionsColors.length) * 20; pieces.push(`ألوان مطابقة للبحث: ${matched.join('، ')}`); }
      }

      if (options.type && img.type && options.type === img.type) { score += 10; pieces.push('نفس نوع الصورة'); }

      if (score > bestScore) { bestScore = score; matchDetails.length = 0; matchDetails.push(...pieces); }
    }

    if (bestScore > 15) {
      results.push({
        type: 'missing', id: m.id, name: m.name, age: m.age, gender: m.gender,
        location: m.location, description: m.description, image: m.image,
        reportStatus: m.reportStatus, status: m.status, score: Math.round(bestScore), details: matchDetails
      });
    }
  }

  // Search sightings
  for (const s of sightings) {
    if (!s.image) continue;
    const imgHash = s.imageHash || null;
    const imgColors = s.imageColors || [];

    let score = 0;
    const pieces: string[] = [];

    if (imgHash && queryHash) {
      const dist = hamming(queryHash, imgHash);
      const sim = Math.max(0, 100 - (dist / 256) * 100);
      if (sim > 40) { score += sim * 0.5; pieces.push(`تشابه بصري: ${Math.round(sim)}%`); }
    }

    const matchedColors = queryColors.filter(qc =>
      imgColors.some(ic => Math.sqrt(Math.pow(qc[0] - ic[0], 2) + Math.pow(qc[1] - ic[1], 2) + Math.pow(qc[2] - ic[2], 2)) < 64)
    );
    if (matchedColors.length > 0) {
      const colorScore = (matchedColors.length / Math.max(queryColors.length, 1)) * 25;
      score += colorScore;
      pieces.push(`ألوان متطابقة: ${matchedColors.length}/${queryColors.length}`);
    }

    if (score > 15) {
      results.push({
        type: 'sighting', id: s.id, name: s.missingPersonName || 'غير محدد',
        reporter: s.reporter, location: s.location, date: s.date,
        description: s.description || '', image: s.image || undefined,
        score: Math.round(score), details: pieces
      });
    }
  }

  return {
    queryColors: colorNames,
    results: results.sort((a, b) => b.score - a.score).slice(0, 20)
  };
}
