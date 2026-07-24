import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer, { MulterError } from 'multer';
import crypto from 'crypto';
import fs from 'fs';

import * as db from './db.js';
import * as visualEngine from './visual-engine.js';
import { sanitizeObj } from './sanitize.js';
import { matchSighting, autoProcessNewSighting, autoProcessNewMissing, startScheduler, addSSEClient, removeSSEClient } from './automation.js';
import { MissingReport, SightingReport, JwtPayload } from './types.js';
import { sendContactAutoReply, sendAdminNotification } from './mailer.js';
import { logger, logSecurity, logAction, logError } from './logger.js';
import adminRouter from './admin-routes.js';
import { askAI, describeImage, compareImages, searchByImageWithAI } from './ai-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'aman-secret-key-change-in-production-2026';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'aman-refresh-secret-change-in-production-2026';

// Token blacklist (in-memory; for production use Redis)
const tokenBlacklist = new Set<string>();

// ─── Uploads directory ────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ─── Security Middleware ─────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://unpkg.com", "https://code.jquery.com", "https://cdn.jsdelivr.net", "https://accounts.google.com", "https://connect.facebook.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:", "http://*.tile.openstreetmap.org", "https://*.tile.openstreetmap.org"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://unpkg.com"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://graph.facebook.com"],
      frameSrc: ["'self'", "https://accounts.google.com", "https://www.facebook.com"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate Limiting ──────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false,
  message: { error: 'طلبات كثيرة جداً، يرجى المحاولة لاحقاً' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'محاولات دخول كثيرة جداً، يرجى المحاولة بعد 15 دقيقة' }
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'طلبات كثيرة، يرجى الانتظار قليلاً' }
});
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);
app.use(generalLimiter);

// ─── File Upload (disk storage) ──────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('نوع الملف غير مدعوم. يُرجى رفع صور فقط بصيغة JPEG, PNG, أو WebP'));
  }
});

// ─── Serve static: project root + uploads ────────────────────
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, '..', '..')));

// ─── IP Tracking Middleware ──────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  (req as any).clientIp = ip;
  (req as any).userAgent = ua;
  next();
});

// ─── JWT ─────────────────────────────────────────────────────
interface JwtPayload { id: number; email: string; name: string; }

declare global {
  namespace Express { interface Request { user?: JwtPayload; } }
}

function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) { res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' }); return; }
  if (tokenBlacklist.has(token)) { res.status(401).json({ error: 'انتهت صلاحية الجلسة' }); return; }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً' });
  }
}

function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token && !tokenBlacklist.has(token)) {
    try { req.user = jwt.verify(token, JWT_SECRET) as JwtPayload; } catch { }
  }
  next();
}

function generateTokens(user: { id: number; email: string; name: string }) {
  const accessToken = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

function validate(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array().map(e => e.msg).join('، ') }); return false; }
  return true;
}

function getImageUrl(filename: string | undefined): string {
  if (!filename) return '';
  if (filename.startsWith('http') || filename.startsWith('data:')) return filename;
  return `/uploads/${filename}`;
}

// ─── API: Stats ────────────────────────────────────────────
app.get('/api/stats', (_req: Request, res: Response) => {
  try {
    const data = db.getAll();
    const missing = data.missingReports || [];
    const sightings = data.sightingReports || [];
    res.json({
      totalFound: missing.filter(r => r.status === 'found').length,
      totalActive: missing.filter(r => r.status === 'searching').length,
      totalVerified: missing.filter(r => r.reportStatus === 'verified').length + sightings.filter(s => s.verified).length,
      totalMembers: (data.users || []).length,
      totalMissing: missing.length,
      totalSightings: sightings.length
    });
  } catch (e) { console.error('GET /api/stats error:', e); res.status(500).json({ error: 'حدث خطأ' }); }
});

// ─── API: Missing Reports ──────────────────────────────────
app.get('/api/missing', (req: Request, res: Response) => {
  try {
    const filters: Record<string, string> = {};
    if (req.query.name) filters.name = req.query.name as string;
    if (req.query.governorate) filters.governorate = req.query.governorate as string;
    if (req.query.gender) filters.gender = req.query.gender as string;
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.reportStatus) filters.reportStatus = req.query.reportStatus as string;
    if (req.query.age) filters.age = req.query.age as string;
    res.json(db.getMissingReports(Object.keys(filters).length > 0 ? filters : undefined));
  } catch (e) { console.error('GET /api/missing error:', e); res.status(500).json({ error: 'حدث خطأ في تحميل بيانات المفقودين' }); }
});

app.get('/api/missing/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: 'معرّف غير صحيح' }); return; }
    const report = db.getMissingById(id);
    if (!report) { res.status(404).json({ error: 'لم يتم العثور على البلاغ' }); return; }
    res.json(report);
  } catch (e) { console.error('GET /api/missing/:id error:', e); res.status(500).json({ error: 'حدث خطأ' }); }
});

app.post('/api/missing', [
  body('name').trim().notEmpty().withMessage('يرجى إدخال اسم المفقود'),
  body('description').trim().notEmpty().withMessage('يرجى إدخال وصف الحالة'),
  body('contact').trim().notEmpty().withMessage('يرجى إدخال رقم للتواصل'),
  body('location').trim().notEmpty().withMessage('يرجى إدخال موقع الفقدان'),
  body('date').trim().notEmpty().withMessage('يرجى إدخال تاريخ الفقدان'),
  body('governorate').trim().notEmpty().withMessage('يرجى اختيار المحافظة'),
  body('age').isInt({ min: 0, max: 150 }).withMessage('العمر يجب أن يكون رقماً بين 0 و 150'),
  body('gender').isIn(['male', 'female']).withMessage('يرجى اختيار الجنس')
], upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'clothingImage', maxCount: 1 },
  { name: 'featureImages', maxCount: 5 }
]), optionalAuth, async (req: Request, res: Response) => {
  if (!validate(req, res)) return;
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const report = sanitizeObj<Partial<MissingReport>>({
      name: req.body.name,
      age: parseInt(req.body.age),
      gender: req.body.gender,
      governorate: req.body.governorate,
      location: req.body.location,
      since: req.body.since || '',
      date: req.body.date,
      description: req.body.description,
      features: req.body.features || '',
      health: req.body.health || '',
      contact: req.body.contact,
      reporter: req.user?.name || req.body.reporter || 'مجهول',
      userId: req.user?.id,
      status: 'searching',
      reportStatus: 'pending',
      image: getImageUrl(files?.image?.[0]?.filename || req.body.image),
      clothingImage: getImageUrl(files?.clothingImage?.[0]?.filename || req.body.clothingImage),
      coords: req.body.coords || ''
    });

    // Process images with visual engine
    if (files?.image?.[0]) {
      try {
        const buf = fs.readFileSync(files.image[0].path);
        const processed = await visualEngine.processImage(buf, files.image[0].mimetype);
        report.imageHash = processed.hash;
        report.imageColors = processed.colors;
      } catch { }
    }
    if (files?.clothingImage?.[0]) {
      try {
        const buf = fs.readFileSync(files.clothingImage[0].path);
        const processed = await visualEngine.processImage(buf, files.clothingImage[0].mimetype);
        report.clothingHash = processed.hash;
        report.clothingColors = processed.colors;
      } catch { }
    }

    const saved = db.addMissingReport(report as MissingReport);
    autoProcessNewMissing(report);

    // Email notification to admin
    sendAdminNotification('بلاغ مفقود جديد', `تم تقديم بلاغ مفقود جديد: ${report.name} في ${report.location}`).catch(() => {});

    res.status(201).json(saved);
  } catch (e) { console.error('POST /api/missing error:', e); res.status(500).json({ error: 'حدث خطأ في حفظ البلاغ' }); }
});

// ─── Admin: Update/Delete ──────────────────────────────────
app.put('/api/missing/:id/status', authenticateToken, [
  body('status').isIn(['pending', 'verified', 'rejected']).withMessage('حالة غير صحيحة')
], (req: Request, res: Response) => {
  if (!validate(req, res)) return;
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: 'معرّف غير صحيح' }); return; }
    if (!db.updateReportStatus(id, req.body.status, 'missing')) { res.status(404).json({ error: 'لم يتم العثور على البلاغ' }); return; }
    res.json({ success: true });
  } catch (e) { console.error('PUT /api/missing/:id/status error:', e); res.status(500).json({ error: 'حدث خطأ في تحديث الحالة' }); }
});

app.put('/api/sightings/:id/status', authenticateToken, [
  body('status').isIn(['pending', 'verified', 'rejected']).withMessage('حالة غير صحيحة')
], (req: Request, res: Response) => {
  if (!validate(req, res)) return;
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: 'معرّف غير صحيح' }); return; }
    if (!db.updateReportStatus(id, req.body.status, 'sighting')) { res.status(404).json({ error: 'لم يتم العثور على المشاهدة' }); return; }
    res.json({ success: true });
  } catch (e) { console.error('PUT /api/sightings/:id/status error:', e); res.status(500).json({ error: 'حدث خطأ في تحديث الحالة' }); }
});

app.delete('/api/missing/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: 'معرّف غير صحيح' }); return; }
    if (!db.deleteReport(id, 'missing')) { res.status(404).json({ error: 'لم يتم العثور على البلاغ' }); return; }
    res.json({ success: true });
  } catch (e) { console.error('DELETE /api/missing/:id error:', e); res.status(500).json({ error: 'حدث خطأ في حذف البلاغ' }); }
});

app.delete('/api/sightings/:id', authenticateToken, (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: 'معرّف غير صحيح' }); return; }
    if (!db.deleteReport(id, 'sighting')) { res.status(404).json({ error: 'لم يتم العثور على المشاهدة' }); return; }
    res.json({ success: true });
  } catch (e) { console.error('DELETE /api/sightings/:id error:', e); res.status(500).json({ error: 'حدث خطأ في حذف المشاهدة' }); }
});

// ─── API: Sighting Reports ─────────────────────────────────
app.get('/api/sightings', (_req: Request, res: Response) => {
  try { res.json(db.getSightingReports()); }
  catch (e) { console.error('GET /api/sightings error:', e); res.status(500).json({ error: 'حدث خطأ في تحميل بيانات المشاهدات' }); }
});

app.post('/api/sightings', [
  body('reporter').trim().notEmpty().withMessage('يرجى إدخال اسم المبلغ'),
  body('phone').trim().notEmpty().withMessage('يرجى إدخال رقم الهاتف'),
  body('location').trim().notEmpty().withMessage('يرجى إدخال موقع المشاهدة'),
  body('description').trim().notEmpty().withMessage('يرجى إدخال تفاصيل المشاهدة')
], upload.single('image'), (req: Request, res: Response) => {
  if (!validate(req, res)) return;
  try {
    const report = sanitizeObj<Partial<SightingReport>>({
      missingPersonName: req.body.missingPersonName || '',
      reporter: req.body.reporter,
      phone: req.body.phone,
      location: req.body.location,
      date: req.body.date || new Date().toISOString().split('T')[0],
      description: req.body.description,
      image: getImageUrl(req.file?.filename || req.body.image)
    });
    const saved = db.addSightingReport(report as SightingReport);
    const matches = autoProcessNewSighting(saved);
    if (matches.length > 0) {
      sendAdminNotification('تطابق جديد مع مشاهدة', `تم العثور على ${matches.length} تطابق للمشاهدة المسجلة بواسطة ${report.reporter}`).catch(() => {});
    }
    res.status(201).json({ sighting: saved, matches });
  } catch (e) { console.error('POST /api/sightings error:', e); res.status(500).json({ error: 'حدث خطأ في حفظ المشاهدة' }); }
});

app.get('/api/sightings/for-missing', (req: Request, res: Response) => {
  try {
    const name = req.query.name as string;
    if (!name) { res.status(400).json({ error: 'يرجى إرسال اسم المفقود' }); return; }
    res.json(db.getSightingsForMissing(name));
  } catch (e) { console.error('GET /api/sightings/for-missing error:', e); res.status(500).json({ error: 'حدث خطأ' }); }
});

// ─── Search API ──────────────────────────────────────────────
app.get('/api/search', (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    const governorate = req.query.governorate as string;
    const gender = req.query.gender as string;
    const status = req.query.status as string;

    if (!q && !governorate && !gender && !status) {
      res.json({ missing: db.getMissingReports().slice(0, 20), sightings: [] });
      return;
    }

    const allMissing = db.getMissingReports();
    const allSightings = db.getSightingReports();

    const qLower = q.toLowerCase();
    const missingResults = allMissing.filter(r => {
      if (q && !r.name.toLowerCase().includes(qLower) && !r.description.toLowerCase().includes(qLower) && !r.location.toLowerCase().includes(qLower)) return false;
      if (governorate && r.governorate !== governorate) return false;
      if (gender && r.gender !== gender) return false;
      if (status && r.status !== status) return false;
      return true;
    });

    const sightingResults = q ? allSightings.filter(s =>
      s.reporter.toLowerCase().includes(qLower) || s.location.toLowerCase().includes(qLower) || s.description.toLowerCase().includes(qLower) || (s.missingPersonName && s.missingPersonName.toLowerCase().includes(qLower))
    ) : [];

    res.json({ missing: missingResults.slice(0, 30), sightings: sightingResults.slice(0, 30) });
  } catch (e) { console.error('GET /api/search error:', e); res.status(500).json({ error: 'حدث خطأ في البحث' }); }
});

// ─── Visual Search ─────────────────────────────────────────
app.post('/api/visual-search', upload.single('image'), [
  body('type').optional().isIn(['person', 'clothing', 'feature', 'any']).withMessage('نوع البحث غير صحيح')
], async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'يرجى رفع صورة للبحث' }); return; }
  try {
    const buf = fs.readFileSync(req.file.path);
    const options = { type: req.body.type || 'any', colors: req.body.colors || '', description: req.body.description || '' };
    const result = await visualEngine.searchByImage(buf, options);
    res.json(result);
  } catch (e) { console.error('POST /api/visual-search error:', e); res.status(500).json({ error: 'حدث خطأ في البحث بالصورة' }); }
});

app.post('/api/process-image', upload.single('image'), async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'يرجى رفع صورة' }); return; }
  try {
    const buf = fs.readFileSync(req.file.path);
    const result = await visualEngine.processImage(buf, req.file.mimetype);
    res.json(result);
  } catch (e) { console.error('POST /api/process-image error:', e); res.status(500).json({ error: 'حدث خطأ في معالجة الصورة' }); }
});

// ─── Matching Engine ────────────────────────────────────────
app.post('/api/match', (req: Request, res: Response) => {
  try { res.json(matchSighting(sanitizeObj(req.body))); }
  catch (e) { console.error('POST /api/match error:', e); res.status(500).json({ error: 'حدث خطأ' }); }
});

// ─── API: Contact ───────────────────────────────────────────
app.post('/api/contact', [
  body('name').trim().notEmpty().withMessage('يرجى إدخال الاسم'),
  body('email').isEmail().withMessage('يرجى إدخال بريد إلكتروني صحيح'),
  body('message').trim().notEmpty().withMessage('يرجى كتابة الرسالة')
], (req: Request, res: Response) => {
  if (!validate(req, res)) return;
  try {
    const msg = sanitizeObj({ name: req.body.name, email: req.body.email, phone: req.body.phone || '', subject: req.body.subject || '', message: req.body.message });
    db.addContactMessage(msg);
    sendContactAutoReply(msg.email, msg.name).catch(() => {});
    sendAdminNotification('رسالة جديدة من اتصل بنا', `من: ${msg.name} (${msg.email})\nالرسالة: ${msg.message}`).catch(() => {});
    res.status(201).json({ success: true, message: 'تم إرسال رسالتك بنجاح' });
  } catch (e) { console.error('POST /api/contact error:', e); res.status(500).json({ error: 'حدث خطأ في إرسال الرسالة' }); }
});

// ─── API: Auth ──────────────────────────────────────────────
app.post('/api/auth/register', [
  body('name').trim().notEmpty().withMessage('يرجى إدخال الاسم الكامل'),
  body('email').isEmail().withMessage('يرجى إدخال بريد إلكتروني صحيح'),
  body('phone').trim().notEmpty().withMessage('يرجى إدخال رقم الهاتف'),
  body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
], async (req: Request, res: Response) => {
  if (!validate(req, res)) return;
  try {
    const { name, email, phone, password } = sanitizeObj(req.body);

    // Force Arabic name
    const arabicRegex = /^[\u0600-\u06FF\u0750-\u077F\s]+$/;
    if (!arabicRegex.test(name)) {
      res.status(400).json({ error: 'الاسم يجب أن يكون باللغة العربية فقط', field: 'name' }); return;
    }

    // Force English password
    const englishRegex = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]+$/;
    if (!englishRegex.test(password)) {
      res.status(400).json({ error: 'كلمة المرور يجب أن تحتوي على أحرف إنجليزية فقط', field: 'password' }); return;
    }

    if (db.findUserByEmail(email)) { res.status(409).json({ error: 'البريد الإلكتروني مسجل مسبقاً' }); return; }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = db.createUser({ name, email, phone, password: hashedPassword, provider: 'local' });

    // Log registration + create session
    const ip = (req as any).clientIp || '';
    const ua = (req as any).userAgent || '';
    logAction(user.id, 'register', { email, ip });
    db.logUserAction(user.id, 'إنشاء حساب', 'تم إنشاء الحساب بنجاح', ip);
    const session = db.createSession({ userId: user.id, ip, userAgent: ua, device: '', browser: '', os: '', location: '' });

    const tokens = generateTokens(user);
    res.status(201).json({ ...tokens, user: { id: user.id, name: user.name, email: user.email }, sessionId: session.id });
  } catch (e: any) { logError('REGISTER', e); res.status(500).json({ error: 'حدث خطأ في إنشاء الحساب' }); }
});

app.post('/api/auth/login', [
  body('email').isEmail().withMessage('يرجى إدخال بريد إلكتروني صحيح'),
  body('password').notEmpty().withMessage('يرجى إدخال كلمة المرور')
], async (req: Request, res: Response) => {
  if (!validate(req, res)) return;
  try {
    const { email, password } = sanitizeObj(req.body);
    const user = db.findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      logSecurity('فشل تسجيل دخول', { email, ip: (req as any).clientIp });
      res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }); return;
    }

    // Create session
    const ip = (req as any).clientIp || '';
    const ua = (req as any).userAgent || '';
    const session = db.createSession({ userId: user.id, ip, userAgent: ua, device: '', browser: '', os: '', location: '' });
    db.logUserAction(user.id, 'تسجيل دخول', 'تم تسجيل الدخول بنجاح', ip);
    logAction(user.id, 'login', { email, ip });

    const tokens = generateTokens(user);
    res.json({ ...tokens, user: { id: user.id, name: user.name, email: user.email }, sessionId: session.id });
  } catch (e: any) { logError('LOGIN', e); res.status(500).json({ error: 'حدث خطأ في تسجيل الدخول' }); }
});

app.post('/api/auth/oauth', [
  body('email').isEmail().withMessage('يرجى إدخال بريد إلكتروني صحيح'),
  body('name').trim().notEmpty().withMessage('يرجى إدخال الاسم'),
  body('provider').isIn(['google', 'facebook']).withMessage('مزوّد غير معروف')
], (req: Request, res: Response) => {
  if (!validate(req, res)) return;
  try {
    const { email, name, provider } = sanitizeObj(req.body);
    let user = db.findUserByEmail(email);
    if (!user) user = db.createUser({ name, email, phone: '', password: '', provider: provider as 'google' | 'facebook', providerId: req.body.providerId || '' });
    const tokens = generateTokens(user);
    res.json({ ...tokens, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) { console.error('POST /api/auth/oauth error:', e); res.status(500).json({ error: 'حدث خطأ في تسجيل الدخول' }); }
});

app.get('/api/auth/me', authenticateToken, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

// ─── Refresh Token ──────────────────────────────────────────
app.post('/api/auth/refresh', (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) { res.status(401).json({ error: 'رمز التحديث مطلوب' }); return; }
  if (tokenBlacklist.has(refreshToken)) { res.status(401).json({ error: 'رمز التحديث غير صالح' }); return; }
  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as { id: number };
    const allData = db.getAll();
    const foundUser = (allData.users as any[]).find(u => u.id === decoded.id);
    if (!foundUser) { res.status(404).json({ error: 'المستخدم غير موجود' }); return; }
    const tokens = generateTokens(foundUser);
    res.json(tokens);
  } catch { res.status(403).json({ error: 'رمز التحديث غير صالح' }); }
});

// ─── OAuth callback (authorization code flow) ──────────────
app.get('/api/auth/oauth/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  if (error) { res.redirect('/login.html?error=' + encodeURIComponent(error as string)); return; }
  if (!code) { res.redirect('/login.html?error=' + encodeURIComponent('Missing authorization code')); return; }

  const provider = (state as string || '').split(':')[0] || 'google';
  const redirectUri = req.protocol + '://' + req.get('host') + '/api/auth/oauth/callback';

  try {
    let tokenData: any;
    let profile: any;

    if (provider === 'google') {
      const params = new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      });
      const tokRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: params });
      tokenData = await tokRes.json();
      if (!tokRes.ok) throw new Error(tokenData.error || 'Google token exchange failed');

      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: 'Bearer ' + tokenData.access_token }
      });
      profile = await profileRes.json();
      if (!profileRes.ok) throw new Error('Failed to get Google profile');
    } else if (provider === 'facebook') {
      const params = new URLSearchParams({
        code: code as string,
        client_id: process.env.FACEBOOK_APP_ID || '',
        client_secret: process.env.FACEBOOK_APP_SECRET || '',
        redirect_uri: redirectUri
      });
      const tokRes = await fetch('https://graph.facebook.com/v19.0/oauth/access_token?' + params.toString());
      tokenData = await tokRes.json();
      if (!tokRes.ok || tokenData.error) throw new Error(tokenData.error?.message || 'Facebook token exchange failed');

      const profileRes = await fetch('https://graph.facebook.com/me?fields=id,name,email&access_token=' + tokenData.access_token);
      profile = await profileRes.json();
      if (!profileRes.ok) throw new Error('Failed to get Facebook profile');
    } else {
      res.redirect('/login.html?error=' + encodeURIComponent('Unsupported provider'));
      return;
    }

    let user = db.findUserByEmail(profile.email);
    if (!user) {
      user = db.createUser({
        name: profile.name,
        email: profile.email,
        provider: provider,
        providerId: profile.id
      });
    }
    const tokens = generateTokens(user);
    res.redirect('/login.html?access_token=' + tokens.accessToken + '&refresh_token=' + tokens.refreshToken);
  } catch (err: any) {
    console.error('OAuth callback error:', err);
    res.redirect('/login.html?error=' + encodeURIComponent(err.message || 'OAuth failed'));
  }
});

// ─── Logout ─────────────────────────────────────────────────
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const { refreshToken } = req.body;
  if (token) tokenBlacklist.add(token);
  if (refreshToken) tokenBlacklist.add(refreshToken);
  res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

// ─── User Profile ──────────────────────────────────────────
app.get('/api/profile', authenticateToken, (req: Request, res: Response) => {
  try {
    const data = db.getAll();
    const userId = req.user!.id;
    const myMissing = (data.missingReports as any[]).filter(r => r.userId === userId);
    const mySightings = (data.sightingReports as any[]).filter(s => s.userId === userId);
    res.json({ user: req.user, myMissing, mySightings });
  } catch (e) { console.error('GET /api/profile error:', e); res.status(500).json({ error: 'حدث خطأ' }); }
});

// ─── Admin Routes ───────────────────────────────────────────
app.use('/api/admin', adminRouter);

// ─── AI Routes (OpenRouter) ─────────────────────────────────
app.post('/api/ai/describe', authenticateToken, upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'يرجى رفع صورة' }); return; }
    const imageUrl = '/uploads/' + req.file.filename;
    const description = await describeImage(imageUrl);
    res.json({ description });
  } catch (err: any) { logError('AI-DESCRIBE', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/ai/compare', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { image1, image2 } = req.body;
    if (!image1 || !image2) { res.status(400).json({ error: 'يرجى توفير رابطي الصور' }); return; }
    const result = await compareImages(image1, image2);
    res.json(result);
  } catch (err: any) { logError('AI-COMPARE', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/ai/search', authenticateToken, upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'يرجى رفع صورة' }); return; }
    const imageUrl = '/uploads/' + req.file.filename;
    const results = await searchByImageWithAI(imageUrl);
    res.json(results);
  } catch (err: any) { logError('AI-SEARCH', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/ai/chat', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { prompt, system } = req.body;
    if (!prompt) { res.status(400).json({ error: 'يرجى إدخال النص' }); return; }
    const answer = await askAI(prompt, system || 'أنت مساعد ذكي لمنصة أمان للمفقودين. أجب باللغة العربية.');
    res.json({ answer });
  } catch (err: any) { logError('AI-CHAT', err); res.status(500).json({ error: err.message }); }
});

// ─── SSE ────────────────────────────────────────────────────
app.get('/api/sse', optionalAuth, (req: Request, res: Response) => {
  // Also allow token via query param (EventSource can't set headers)
  const token = req.query.token as string;
  if (token && !req.user) {
    try { req.user = jwt.verify(token, JWT_SECRET) as JwtPayload; } catch { }
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  const clientId = addSSEClient(res);
  res.write(`event: connected\ndata: {"clientId":${clientId}}\n\n`);
  req.on('close', () => removeSSEClient(clientId));
});

// ─── 404 for unknown API routes ─────────────────────────────
app.use('/api', (_req: Request, res: Response) => { res.status(404).json({ error: 'الرابط غير موجود' }); });

// ─── SPA fallback ───────────────────────────────────────────
app.use((req: Request, res: Response, _next: NextFunction) => {
  if (req.method !== 'GET') return;
  res.sendFile(path.join(__dirname, '..', '..', 'index.html'));
});

// ─── Client Error Logging (from browser) ─────────────────
app.post('/api/log-client-error', (req: Request, res: Response) => {
  try {
    const errors = Array.isArray(req.body) ? req.body : [req.body];
    for (const e of errors) {
      const msg = e.message || e.stack || JSON.stringify(e);
      const stack = e.stack || '';
      const ip = (req as any).clientIp || '';
      const userId = (req as any).user?.id || 0;
      db.logError({ level: 'error', context: 'CLIENT:' + (e.type || 'window.onerror'), message: msg, stack, ip, userId, url: e.url || req.originalUrl });
    }
    res.json({ ok: true });
  } catch (err: any) { logError('CLIENT-ERROR-LOG', err); res.status(500).json({ error: 'فشل تسجيل الخطأ' }); }
});

// ─── Error Handler with Logging ────────────────────────────
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const ctx = 'HTTP';
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : '';
  const ip = (req as any).clientIp || '';
  const userId = (req as any).user?.id || 0;

  logger.error('[' + ctx + '] ' + msg, { stack, ip, url: req.originalUrl });
  try { db.logError({ level: 'error', context: ctx, message: msg, stack, ip, userId, url: req.originalUrl }); } catch {}

  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') { res.status(400).json({ error: 'حجم الصورة كبير جداً (الحد الأقصى 5MB)' }); return; }
    res.status(400).json({ error: err.message }); return;
  }
  res.status(500).json({ error: 'حدث خطأ داخلي في الخادم' });
});

// ─── Start Server ───────────────────────────────────────────
const isDirectRun = process.argv[1] && (process.argv[1].includes('server') || process.argv[1].includes('tsx'));
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`Aman Platform Backend running on http://localhost:${PORT}`);
    console.log(`Serving static files from: ${path.join(__dirname, '..', '..')}`);
    console.log(`Uploads directory: ${UPLOAD_DIR}`);
    startScheduler();
  });
}

export { app };
