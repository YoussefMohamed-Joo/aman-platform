import * as db from './db.js';
import { MissingReport, SightingReport, MatchResult, Notification } from './types.js';

// ─── SSE Clients ─────────────────────────────────────────

type SSEClient = { id: number; res: any };
let sseClients: SSEClient[] = [];
let sseIdCounter = 0;

export function addSSEClient(res: any): number {
  const id = ++sseIdCounter;
  sseClients.push({ id, res });
  return id;
}

export function removeSSEClient(id: number): void {
  sseClients = sseClients.filter(c => c.id !== id);
}

function broadcast(event: string, data: any): void {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(c => {
    try { c.res.write(msg); } catch { /* ignore */ }
  });
}

// ─── Matching Engine ──────────────────────────────────────

export function matchSighting(sighting: Partial<SightingReport>): MatchResult[] {
  const missing = db.getMissingReports();
  return missing.map(m => {
    let score = 0;
    const pieces: string[] = [];

    // Name match (40%)
    if (sighting.missingPersonName && m.name) {
      const sn = sighting.missingPersonName.replace(/\s+/g, '').toLowerCase();
      const mn = m.name.replace(/\s+/g, '').toLowerCase();
      if (sn === mn) { score += 40; pieces.push('اسم مطابق تام (+40)'); }
      else if (sn.includes(mn) || mn.includes(sn)) { score += 30; pieces.push('اسم متطابق جزئياً (+30)'); }
      else {
        const sWords = sn.split(/\s+/);
        const mWords = mn.split(/\s+/);
        const common = sWords.filter(w => mWords.includes(w)).length;
        if (common > 0) { score += (common / Math.max(sWords.length, mWords.length)) * 40; pieces.push(`اسم: ${common}/${Math.max(sWords.length, mWords.length)} كلمات مشتركة`); }
      }
    }

    // Location match (25%)
    if (sighting.location && m.location) {
      const sl = sighting.location.replace(/\s+/g, '').toLowerCase();
      const ml = m.location.replace(/\s+/g, '').toLowerCase();
      if (sl === ml) { score += 25; pieces.push('موقع مطابق تام (+25)'); }
      else if (sl.includes(ml) || ml.includes(sl)) { score += 15; pieces.push('موقع متطابق جزئياً (+15)'); }
      else if (m.governorate && sl.includes(m.governorate.replace(/\s+/g, '').toLowerCase())) { score += 10; pieces.push('نفس المحافظة (+10)'); }
    }

    // Keywords match (20%)
    const keywords = ['عباءة', 'طويل', 'قصير', 'أزرق', 'أخضر', 'أبيض', 'أسود', 'أحمر', 'نظارة', 'شعر', 'مدرسة', 'حديقة', 'مترو', 'شارع', 'مسجد', 'سوق', 'مول', 'كافيه', 'مقهى', 'مستشفى', 'كلية', 'جامعة', 'طفل', 'طفلة', 'فتاة', 'شاب', 'مسن', 'عجوز', 'كرسي', 'عصا'];
    if (sighting.description && m.description) {
      const sd = sighting.description.replace(/\s+/g, '').toLowerCase();
      const md = m.description.replace(/\s+/g, '').toLowerCase();
      let matchCount = 0;
      keywords.forEach(kw => { if (sd.includes(kw) && md.includes(kw)) matchCount++; });
      const kwScore = Math.min(matchCount * 5, 20);
      if (kwScore > 0) { score += kwScore; pieces.push(`كلمات مفتاحية: ${matchCount} تطابق (+${kwScore})`); }
    }

    return { missing: m, score: Math.round(score), pieces };
  }).filter(r => r.score > 30).sort((a, b) => b.score - a.score).slice(0, 5);
}

// ─── Duplicate Detection ─────────────────────────────────

export function findDuplicates(newReport: Partial<MissingReport>): MissingReport[] {
  const missing = db.getMissingReports();
  return missing.filter(m => {
    if (m.id === newReport.id) return false;
    const nameMatch = m.name.replace(/\s+/g, '') === (newReport.name || '').replace(/\s+/g, '');
    const locationMatch = m.location.replace(/\s+/g, '') === (newReport.location || '').replace(/\s+/g, '');
    return nameMatch && locationMatch;
  });
}

export function findDuplicateSightings(newSighting: Partial<SightingReport>): SightingReport[] {
  const sightings = db.getSightingReports();
  return sightings.filter(s => {
    if (s.id === newSighting.id) return false;
    const reporterMatch = s.reporter.replace(/\s+/g, '') === (newSighting.reporter || '').replace(/\s+/g, '');
    const locationMatch = s.location.replace(/\s+/g, '') === (newSighting.location || '').replace(/\s+/g, '');
    const dateMatch = s.date === newSighting.date;
    return reporterMatch && locationMatch && dateMatch;
  });
}

// ─── Auto-Suggest Status ────────────────────────────────

export function suggestStatusForMissing(report: MissingReport): 'pending' | 'verified' | 'rejected' {
  const sightings = db.getSightingsForMissing(report.name);
  if (sightings.length >= 3) return 'verified';
  if (sightings.length >= 1) return 'pending';
  return 'pending';
}

// ─── Run After New Sighting ─────────────────────────────

export function autoProcessNewSighting(sighting: Partial<SightingReport>): MatchResult[] {
  const matches = matchSighting(sighting);

  // Generate notifications for high-scoring matches
  matches.forEach(m => {
    if (m.score > 50) {
      db.addNotification({
        type: 'match',
        title: 'تطابق جديد مع بلاغ مشاهدة',
        message: `تم العثور على تطابق بنسبة ${m.score}% بين بلاغ مشاهدة والمفقود ${m.missing.name}`,
        reportId: m.missing.id,
        reportType: 'missing',
        read: false
      });
    }
  });

  // Auto update missing report status if very high match
  matches.forEach(m => {
    if (m.score >= 80) {
      db.updateReportStatus(m.missing.id, 'verified', 'missing');
    } else if (m.score >= 50) {
      db.updateReportStatus(m.missing.id, 'pending', 'missing');
    }
  });

  // Broadcast real-time update
  broadcast('new-sighting', { sighting, matches: matches.length });

  return matches;
}

// ─── Run After New Missing Report ──────────────────────

export function autoProcessNewMissing(report: Partial<MissingReport>): {
  duplicates: MissingReport[];
  matchingSightings: SightingReport[];
  suggestedStatus: string;
} {
  const duplicates = findDuplicates(report);
  const sightings = db.getSightingReports().filter(s =>
    s.missingPersonName && report.name && s.missingPersonName.includes(report.name)
  );

  let suggestedStatus = 'pending';
  if (sightings.length >= 3) suggestedStatus = 'verified';
  if (duplicates.length > 0) suggestedStatus = 'rejected';

  if (duplicates.length > 0) {
    db.addNotification({
      type: 'alert',
      title: 'بلاغ مكرر محتمل',
      message: `تم اكتشاف ${duplicates.length} بلاغ مشابه لـ ${report.name}`,
      read: false
    });
  }

  broadcast('new-missing', { report, duplicates: duplicates.length, matchingSightings: sightings.length });

  return { duplicates, matchingSightings: sightings, suggestedStatus };
}

// ─── Scheduled Tasks (runs every 30 minutes) ───────────

export function startScheduler(): void {
  console.log('[Automation] Scheduler started (runs every 30 minutes)');

  setInterval(() => {
    try {
      const data = db.getAll();
      const now = Date.now();
      let changes = 0;

      // #1: Auto-expire old reports (>30 days without update)
      (data.missingReports || []).forEach(r => {
        const age = now - r.timestamp;
        if (age > 30 * 24 * 60 * 60 * 1000 && r.status === 'searching') {
          db.addNotification({
            type: 'info',
            title: 'بلاغ قديم',
            message: `بلاغ ${r.name} تجاوز 30 يوماً دون تحديث. يرجى مراجعة الحالة.`,
            reportId: r.id,
            reportType: 'missing',
            read: false
          });
          changes++;
        }
      });

      // #2: Verify reports with many sightings
      (data.missingReports || []).forEach(r => {
        if (r.reportStatus === 'pending') {
          const upgraded = suggestStatusForMissing(r);
          if (upgraded !== r.reportStatus) {
            db.updateReportStatus(r.id, upgraded, 'missing');
            if (upgraded === 'verified') {
              db.addNotification({
                type: 'status',
                title: 'تم التحقق من البلاغ',
                message: `تم التحقق من بلاغ ${r.name} تلقائياً لكثرة المشاهدات المرتبطة`,
                reportId: r.id,
                reportType: 'missing',
                read: false
              });
            }
            changes++;
          }
        }
      });

      // #3: Re-run matching for unmatched sightings
      (data.sightingReports || []).forEach(s => {
        if (!s.missingPersonName) {
          const matches = matchSighting(s);
          if (matches.length > 0 && matches[0].score > 60) {
            db.addNotification({
              type: 'match',
              title: 'تطابق جديد',
              message: `تم العثور على تطابق محتمل لمشاهدة غير مرتبطة: ${matches[0].missing.name} (${matches[0].score}%)`,
              read: false
            });
            changes++;
          }
        }
      });

      if (changes > 0) {
        broadcast('scheduler-update', { changes });
        console.log(`[Automation] Scheduled task completed: ${changes} changes`);
      }
    } catch (e) {
      console.error('[Automation] Scheduler error:', e);
    }
  }, 30 * 60 * 1000);

  // Also run immediately on start
  setTimeout(() => {
    broadcast('automation-ready', { status: 'active' });
    console.log('[Automation] Engine ready');
  }, 2000);
}
