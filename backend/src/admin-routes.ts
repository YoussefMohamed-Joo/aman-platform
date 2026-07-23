import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as db from './db.js';
import { JwtPayload } from './types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'aman-secret-key-change-in-production-2026';
const tokenBlacklist = new Set<string>();

function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) { res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' }); return; }
  if (tokenBlacklist.has(token)) { res.status(401).json({ error: 'انتهت صلاحية الجلسة' }); return; }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).user = decoded;
    next();
  } catch {
    res.status(403).json({ error: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً' });
  }
}

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' }); return; }
  const user = db.findUserById(userId);
  if (!user || !user.isAdmin) { res.status(403).json({ error: 'غير مصرح بالوصول إلى لوحة التحكم' }); return; }
  next();
}

// All admin routes require authentication + admin role
router.use(authenticateToken, requireAdmin);

// GET /api/admin/stats
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = db.getAdminStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: 'فشل تحميل الإحصائيات', details: err.message });
  }
});

// GET /api/admin/users
router.get('/users', (_req: Request, res: Response) => {
  try {
    const users = db.getUsers();
    const enriched = users.map(u => {
      const sessions = db.getUserSessions(u.id);
      const recentActions = db.getUserActions(u.id, 20);
      const lastSession = sessions[0] || null;
      return {
        ...u,
        sessions: sessions.slice(0, 5),
        recentActions: recentActions,
        ip: lastSession?.ip || '',
        device: lastSession?.device || '',
        browser: lastSession?.browser || '',
        os: lastSession?.os || '',
        lastLogin: lastSession?.loginAt || null
      };
    });
    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: 'فشل تحميل المستخدمين', details: err.message });
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', (req: Request, res: Response) => {
  try {
    const users = db.getUsers();
    const user = users.find(u => u.id === parseInt(req.params.id));
    if (!user) { res.status(404).json({ error: 'المستخدم غير موجود' }); return; }
    const sessions = db.getUserSessions(user.id);
    const actions = db.getUserActions(user.id, 200);
    res.json({ ...user, sessions, recentActions: actions });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل تحميل بيانات المستخدم', details: err.message });
  }
});

// PUT /api/admin/users/:id/password
router.put('/users/:id/password', (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) { res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }); return; }
    const hashed = bcrypt.hashSync(password, 10);
    db.getDb().prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, parseInt(req.params.id));
    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل تغيير كلمة المرور', details: err.message });
  }
});

// GET /api/admin/sessions
router.get('/sessions', (_req: Request, res: Response) => {
  try {
    const active = db.getAllActiveSessions();
    const all = db.getAdminStats();
    const users = db.getUsers();
    const enriched = active.map(s => {
      const user = users.find(u => u.id === s.userId);
      return { ...s, userName: user?.name || 'غير معروف', userEmail: user?.email || '' };
    });
    res.json({ active: enriched, total: all.totalSessions, activeCount: all.activeSessions });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل تحميل الجلسات', details: err.message });
  }
});

// GET /api/admin/actions
router.get('/actions', (_req: Request, res: Response) => {
  try {
    const actions = db.getAllUserActions(500);
    const users = db.getUsers();
    const enriched = actions.map(a => {
      const user = users.find(u => u.id === a.userId);
      return { ...a, userName: user?.name || 'غير معروف', userEmail: user?.email || '' };
    });
    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: 'فشل تحميل الإجراءات', details: err.message });
  }
});

// GET /api/admin/errors
router.get('/errors', (_req: Request, res: Response) => {
  try {
    const errors = db.getErrorLogs(200);
    res.json(errors);
  } catch (err: any) {
    res.status(500).json({ error: 'فشل تحميل سجل الأخطاء', details: err.message });
  }
});

// GET /api/admin/messages
router.get('/messages', (_req: Request, res: Response) => {
  try {
    const messages = db.getContactMessages();
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: 'فشل تحميل الرسائل', details: err.message });
  }
});

// DELETE /api/admin/messages/:id
router.delete('/messages/:id', (req: Request, res: Response) => {
  try {
    const d = getDb();
    d.prepare('DELETE FROM contact_messages WHERE id = ?').run(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'فشل حذف الرسالة', details: err.message });
  }
});

export default router;