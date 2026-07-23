import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { MissingReport, SightingReport, ContactMessage, User, ReportFilters, Notification, UserSession, UserAction, ErrorLog, AdminStats } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'aman.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_FILE);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    seedIfEmpty();
  }
  return db;
}

function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT DEFAULT '',
      password TEXT DEFAULT '',
      provider TEXT DEFAULT 'local',
      providerId TEXT DEFAULT '',
      isAdmin INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS missing_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER DEFAULT 0,
      name TEXT NOT NULL,
      age INTEGER DEFAULT 0,
      gender TEXT DEFAULT 'male',
      governorate TEXT DEFAULT '',
      location TEXT DEFAULT '',
      since TEXT DEFAULT '',
      date TEXT DEFAULT '',
      description TEXT DEFAULT '',
      features TEXT DEFAULT '',
      health TEXT DEFAULT '',
      contact TEXT DEFAULT '',
      reporter TEXT DEFAULT '',
      status TEXT DEFAULT 'searching',
      reportStatus TEXT DEFAULT 'pending',
      image TEXT DEFAULT '',
      clothingImage TEXT DEFAULT '',
      featureImages TEXT DEFAULT '',
      imageHash TEXT DEFAULT '',
      imageColors TEXT DEFAULT '',
      clothingHash TEXT DEFAULT '',
      clothingColors TEXT DEFAULT '',
      coords TEXT DEFAULT '',
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sighting_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER DEFAULT 0,
      missingPersonName TEXT DEFAULT '',
      reporter TEXT NOT NULL,
      phone TEXT DEFAULT '',
      location TEXT DEFAULT '',
      date TEXT DEFAULT '',
      description TEXT DEFAULT '',
      image TEXT DEFAULT '',
      imageHash TEXT DEFAULT '',
      imageColors TEXT DEFAULT '',
      verified INTEGER DEFAULT 0,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      subject TEXT DEFAULT '',
      message TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT DEFAULT '',
      message TEXT DEFAULT '',
      reportId INTEGER DEFAULT 0,
      reportType TEXT DEFAULT '',
      read INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      ip TEXT DEFAULT '',
      userAgent TEXT DEFAULT '',
      device TEXT DEFAULT '',
      browser TEXT DEFAULT '',
      os TEXT DEFAULT '',
      location TEXT DEFAULT '',
      loginAt INTEGER NOT NULL,
      lastActivity INTEGER NOT NULL,
      logoutAt INTEGER,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS user_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT DEFAULT '',
      ip TEXT DEFAULT '',
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT DEFAULT 'error',
      context TEXT DEFAULT '',
      message TEXT NOT NULL,
      stack TEXT DEFAULT '',
      ip TEXT DEFAULT '',
      userId INTEGER DEFAULT 0,
      url TEXT DEFAULT '',
      timestamp INTEGER NOT NULL
    );

    -- Migrate existing tables (ignore errors if column already exists)
    try { db.exec('ALTER TABLE missing_reports ADD COLUMN userId INTEGER DEFAULT 0'); } catch {}
    try { db.exec('ALTER TABLE sighting_reports ADD COLUMN userId INTEGER DEFAULT 0'); } catch {}
  `);
}

function seedIfEmpty(): void {
  const count = db.prepare('SELECT COUNT(*) as c FROM missing_reports').get() as { c: number };
  if (count.c > 0) return;

  const now = Date.now();
  const insertMissing = db.prepare(`
    INSERT INTO missing_reports (name, age, gender, governorate, location, since, date, description, features, health, contact, reporter, status, reportStatus, image, coords, timestamp)
    VALUES (@name, @age, @gender, @governorate, @location, @since, @date, @description, @features, @health, @contact, @reporter, @status, @reportStatus, @image, @coords, @timestamp)
  `);

  const seedMissing = [
    { name: 'عمر هاشم', age: 43, gender: 'male', governorate: 'الشرقية', location: 'الشرقية - الشرقية', since: '58 أيام', date: '2026-05-26', description: 'آخر اتصال كان منذ عدة أيام.', features: 'نظارة شمسية طبية، لحية خفيفة.', health: 'يعاني من الزهايمر', contact: '01234567001', reporter: 'يوسف هاشم', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1779767638877 },
    { name: 'مصطفى سعيد', age: 10, gender: 'male', governorate: 'الأقصر', location: 'الأقصر - الأقصر', since: '19 أيام', date: '2026-07-04', description: 'شوهد آخر مرة في الحديقة العامة.', features: 'عيون عسلية، حاجبان كثيفان.', health: 'يعاني من الزهايمر', contact: '01555667788', reporter: 'هاني أمين', status: 'found', reportStatus: 'pending', image: '', coords: '', timestamp: 1783108907580 },
    { name: 'إبراهيم شريف', age: 9, gender: 'male', governorate: 'الأقصر', location: 'الأقصر - الأقصر', since: '27 أيام', date: '2026-06-26', description: 'آخر اتصال كان منذ عدة أيام.', features: 'ندبة صغيرة على الذقن، شعر أسود قصير.', health: 'جيدة، لا تعاني من أمراض مزمنة', contact: '01099887766', reporter: 'محمد حسن', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1782473101782 },
    { name: 'مها حسن', age: 57, gender: 'female', governorate: 'القاهرة', location: 'القاهرة - القاهرة', since: '14 أيام', date: '2026-07-09', description: 'شوهد آخر مرة في الحديقة العامة.', features: 'شعر طويل أسود، قامة طويلة.', health: 'جيدة جداً', contact: '01199887766', reporter: 'تامر أمين', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1783598187018 },
    { name: 'سميرة رفعت', age: 52, gender: 'female', governorate: 'بني سويف', location: 'بني سويف - بني سويف', since: '36 أيام', date: '2026-06-17', description: 'فُقد أثناء التنزه في المنطقة.', features: 'عيون عسلية، حاجبان كثيفان.', health: 'يعاني من الزهايمر', contact: '01223344556', reporter: 'خالد موسى', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1781642792504 },
    { name: 'ناصر عبد الله', age: 5, gender: 'male', governorate: 'بني سويف', location: 'بني سويف - بني سويف', since: '40 أيام', date: '2026-06-13', description: 'شوهد آخر مرة في موقف المواصلات العامة.', features: 'نظارة طبية بإطار أسود، شعر بني.', health: 'تعاني من ضغط الدم', contact: '01011121314', reporter: 'عبد الله زكريا', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1781328009375 },
    { name: 'سميرة موسى', age: 36, gender: 'female', governorate: 'القاهرة', location: 'القاهرة - القاهرة', since: '42 أيام', date: '2026-06-11', description: 'فُقد أثناء التنزه في المنطقة.', features: 'وشم صغير على اليد اليمنى.', health: 'جيدة', contact: '01555667788', reporter: 'حسن محمود', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1781144840720 },
    { name: 'منى شريف', age: 44, gender: 'female', governorate: 'الإسماعيلية', location: 'الإسماعيلية - الإسماعيلية', since: '12 أيام', date: '2026-07-11', description: 'لم يعد إلى المنزل منذ خروجه مع الأصدقاء.', features: 'ندبة صغيرة على الذقن، شعر أسود قصير.', health: 'جيدة', contact: '01234567890', reporter: 'أيمن عبد الله', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1783760776249 },
    { name: 'مصطفى عبد الله', age: 43, gender: 'male', governorate: 'الشرقية', location: 'الشرقية - الشرقية', since: 'اليوم', date: '2026-07-23', description: 'فُقد بالقرب من المدرسة.', features: 'نظارة شمسية طبية، لحية خفيفة.', health: 'جيدة جداً', contact: '01556677889', reporter: 'محمد أحمد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1784804571555 },
    { name: 'كريم كريم', age: 27, gender: 'male', governorate: 'الغربية', location: 'الغربية - الغربية', since: '59 أيام', date: '2026-05-25', description: 'فُقد أثناء التنزه في المنطقة.', features: 'نظارة طبية بإطار أسود، شعر بني.', health: 'يعاني من مرض السكري', contact: '01122334455', reporter: 'محمود ناصر', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1779689736896 },
    { name: 'عمر ناصر', age: 56, gender: 'male', governorate: 'المنوفية', location: 'المنوفية - المنوفية', since: '53 أيام', date: '2026-05-31', description: 'فُقد بالقرب من المدرسة.', features: 'شعر طويل أسود، قامة طويلة.', health: 'جيدة جداً', contact: '01099887766', reporter: 'حسن أحمد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1780215612818 },
    { name: 'هاني شريف', age: 66, gender: 'male', governorate: 'الغربية', location: 'الغربية - الغربية', since: '20 أيام', date: '2026-07-03', description: 'آخر مشاهدة كانت في السوق المركزي.', features: 'طول متوسط، بنية جسمانية عادية.', health: 'جيدة', contact: '01556677889', reporter: 'محمود رفعت', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1783069322355 },
    { name: 'منى إبراهيم', age: 59, gender: 'female', governorate: 'أسوان', location: 'أسوان - أسوان', since: '7 أيام', date: '2026-07-16', description: 'شوهد آخر مرة في الحديقة العامة.', features: 'طول متوسط، بنية جسمانية عادية.', health: 'يعاني من الزهايمر', contact: '01012345678', reporter: 'يوسف ناصر', status: 'found', reportStatus: 'pending', image: '', coords: '', timestamp: 1784181937483 },
    { name: 'دينا حسن', age: 39, gender: 'female', governorate: 'الدقهلية', location: 'الدقهلية - الدقهلية', since: '6 أيام', date: '2026-07-17', description: 'شوهد آخر مرة في موقف المواصلات العامة.', features: 'شعر طويل أسود، قامة طويلة.', health: 'تعاني من ضغط الدم', contact: '01099887766', reporter: 'أحمد سعيد', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1784268893248 },
    { name: 'يوسف زكريا', age: 53, gender: 'male', governorate: 'الشرقية', location: 'الشرقية - الشرقية', since: '30 أيام', date: '2026-06-23', description: 'غادر المنزل صباحاً ولم يعد.', features: 'شعر طويل أسود، قامة طويلة.', health: 'جيدة جداً', contact: '01234567001', reporter: 'ناصر محمد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1782175745206 },
    { name: 'كريم خالد', age: 40, gender: 'male', governorate: 'دمياط', location: 'دمياط - دمياط', since: '17 أيام', date: '2026-07-06', description: 'فُقد أثناء التنزه في المنطقة.', features: 'شامة أسفل العين اليمنى، عيون بنية.', health: 'جيدة', contact: '01199887766', reporter: 'ناصر موسى', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1783285351747 },
    { name: 'هند رفعت', age: 50, gender: 'female', governorate: 'الأقصر', location: 'الأقصر - الأقصر', since: '6 أيام', date: '2026-07-17', description: 'آخر اتصال كان منذ عدة أيام.', features: 'شعر طويل أسود، قامة طويلة.', health: 'جيدة', contact: '01234567001', reporter: 'إبراهيم إبراهيم', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1784262056153 },
    { name: 'أحمد جابر', age: 9, gender: 'male', governorate: 'قنا', location: 'قنا - قنا', since: '51 أيام', date: '2026-06-02', description: 'فُقد أثناء التنزه في المنطقة.', features: 'عيون عسلية، حاجبان كثيفان.', health: 'جيدة جداً', contact: '01199887766', reporter: 'يوسف إبراهيم', status: 'found', reportStatus: 'verified', image: '', coords: '', timestamp: 1780377692876 },
    { name: 'خالد زكريا', age: 58, gender: 'male', governorate: 'بني سويف', location: 'بني سويف - بني سويف', since: '41 أيام', date: '2026-06-12', description: 'آخر اتصال كان منذ عدة أيام.', features: 'شامة أسفل العين اليمنى، عيون بنية.', health: 'جيدة', contact: '01099887766', reporter: 'عمرو زكريا', status: 'found', reportStatus: 'verified', image: '', coords: '', timestamp: 1781279399954 },
    { name: 'محمود عمران', age: 21, gender: 'male', governorate: 'القليوبية', location: 'القليوبية - القليوبية', since: '50 أيام', date: '2026-06-03', description: 'فُقد أثناء التنزه في المنطقة.', features: 'شامة أسفل العين اليمنى، عيون بنية.', health: 'جيدة', contact: '01556677889', reporter: 'حسن شريف', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1780494201932 },
    { name: 'سميرة هاشم', age: 35, gender: 'female', governorate: 'الجيزة', location: 'الجيزة - الجيزة', since: '34 أيام', date: '2026-06-19', description: 'غادر المنزل صباحاً ولم يعد.', features: 'طول متوسط، بنية جسمانية عادية.', health: 'جيدة', contact: '01012345678', reporter: 'عمر رفعت', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1781861336578 },
    { name: 'مصطفى موسى', age: 49, gender: 'male', governorate: 'القاهرة', location: 'القاهرة - القاهرة', since: '37 أيام', date: '2026-06-16', description: 'شوهد آخر مرة في الحديقة العامة.', features: 'ندبة على الجبهة، عيون خضراء.', health: 'تعاني من ضغط الدم', contact: '01012345678', reporter: 'حسن موسى', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1781573140018 },
    { name: 'أحمد رفعت', age: 40, gender: 'male', governorate: 'أسيوط', location: 'أسيوط - أسيوط', since: '30 أيام', date: '2026-06-23', description: 'لم يعد إلى المنزل منذ خروجه مع الأصدقاء.', features: 'عيون عسلية، حاجبان كثيفان.', health: 'جيدة', contact: '01234567890', reporter: 'أحمد ناصر', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1782157319801 },
    { name: 'وائل هاشم', age: 66, gender: 'male', governorate: 'أسيوط', location: 'أسيوط - أسيوط', since: '11 أيام', date: '2026-07-12', description: 'لم يعد إلى المنزل منذ خروجه مع الأصدقاء.', features: 'طول متوسط، بنية جسمانية عادية.', health: 'يعاني من الزهايمر', contact: '01234567001', reporter: 'سامي موسى', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1783809832949 },
    { name: 'يوسف ناصر', age: 39, gender: 'male', governorate: 'المنيا', location: 'المنيا - المنيا', since: '5 أيام', date: '2026-07-18', description: 'شوهد آخر مرة في الحديقة العامة.', features: 'وشم صغير على اليد اليمنى.', health: 'يعاني من الزهايمر', contact: '01122334455', reporter: 'عمرو إبراهيم', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1784357508146 },
    { name: 'صباح جابر', age: 14, gender: 'female', governorate: 'الدقهلية', location: 'الدقهلية - الدقهلية', since: '2 أيام', date: '2026-07-21', description: 'فُقد أثناء التنزه في المنطقة.', features: 'شامة أسفل العين اليمنى، عيون بنية.', health: 'تعاني من ضغط الدم', contact: '01555667788', reporter: 'أحمد محمود', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1784634433944 },
    { name: 'مها شريف', age: 11, gender: 'female', governorate: 'القليوبية', location: 'القليوبية - القليوبية', since: '31 أيام', date: '2026-06-22', description: 'غادر المنزل صباحاً ولم يعد.', features: 'ندبة صغيرة على الذقن، شعر أسود قصير.', health: 'جيدة جداً', contact: '01199887766', reporter: 'هاني موسى', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1782124538490 },
    { name: 'نادية شريف', age: 55, gender: 'female', governorate: 'الغربية', location: 'الغربية - الغربية', since: '43 أيام', date: '2026-06-10', description: 'آخر مرة شوهد فيها بالقرب من المنطقة التجارية.', features: 'وشم صغير على اليد اليمنى.', health: 'جيدة جداً', contact: '01199887766', reporter: 'وائل جابر', status: 'found', reportStatus: 'pending', image: '', coords: '', timestamp: 1781079724809 },
    { name: 'تامر زكريا', age: 25, gender: 'male', governorate: 'الدقهلية', location: 'الدقهلية - الدقهلية', since: '12 أيام', date: '2026-07-11', description: 'آخر مشاهدة كانت في السوق المركزي.', features: 'شعر طويل أسود، قامة طويلة.', health: 'يعاني من مرض السكري', contact: '01234567001', reporter: 'عبد الله أمين', status: 'found', reportStatus: 'verified', image: '', coords: '', timestamp: 1783759024562 },
    { name: 'علي يوسف', age: 28, gender: 'male', governorate: 'القاهرة', location: 'القاهرة - القاهرة', since: '19 أيام', date: '2026-07-04', description: 'فُقد أثناء عودته من العمل. لم يعد إلى المنزل.', features: 'ندبة صغيرة على الذقن، شعر أسود قصير.', health: 'جيدة', contact: '01122334455', reporter: 'إبراهيم محمود', status: 'found', reportStatus: 'pending', image: '', coords: '', timestamp: 1783118776280 },
    { name: 'علي عبد الله', age: 41, gender: 'male', governorate: 'الإسكندرية', location: 'الإسكندرية - الإسكندرية', since: '6 أيام', date: '2026-07-17', description: 'آخر مشاهدة كانت في السوق المركزي.', features: 'ندبة صغيرة على الذقن، شعر أسود قصير.', health: 'جيدة', contact: '01012345678', reporter: 'كريم يوسف', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1784247467954 },
    { name: 'ناصر محمود', age: 61, gender: 'male', governorate: 'سوهاج', location: 'سوهاج - سوهاج', since: '41 أيام', date: '2026-06-12', description: 'فُقد أثناء عودته من العمل. لم يعد إلى المنزل.', features: 'نظارة شمسية طبية، لحية خفيفة.', health: 'جيدة جداً', contact: '01555667788', reporter: 'علي زكريا', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1781250637510 },
    { name: 'إيمان محمود', age: 30, gender: 'female', governorate: 'الإسماعيلية', location: 'الإسماعيلية - الإسماعيلية', since: '31 أيام', date: '2026-06-22', description: 'فُقد أثناء عودته من العمل. لم يعد إلى المنزل.', features: 'حية خفيفة، شعر رمادي.', health: 'حساسية تجاه بعض الأطعمة', contact: '01122334455', reporter: 'محمود أحمد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1782065074735 },
    { name: 'أمل خالد', age: 20, gender: 'female', governorate: 'قنا', location: 'قنا - قنا', since: '17 أيام', date: '2026-07-06', description: 'شوهد آخر مرة في موقف المواصلات العامة.', features: 'نظارة طبية بإطار أسود، شعر بني.', health: 'تعاني من ضغط الدم', contact: '01012345678', reporter: 'أيمن محمد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1783276455640 },
    { name: 'دينا ناصر', age: 44, gender: 'female', governorate: 'الغربية', location: 'الغربية - الغربية', since: '23 أيام', date: '2026-06-30', description: 'فُقد أثناء التنزه في المنطقة.', features: 'نظارة طبية بإطار أسود، شعر بني.', health: 'حساسية تجاه بعض الأطعمة', contact: '01234567890', reporter: 'حسن شريف', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1782756126523 },
    { name: 'يوسف إبراهيم', age: 20, gender: 'male', governorate: 'الإسماعيلية', location: 'الإسماعيلية - الإسماعيلية', since: 'اليوم', date: '2026-07-23', description: 'آخر مرة شوهد فيها بالقرب من المنطقة التجارية.', features: 'ندبة صغيرة على الذقن، شعر أسود قصير.', health: 'جيدة جداً', contact: '01555667788', reporter: 'محمود أحمد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1784807558147 },
    { name: 'مها عمران', age: 3, gender: 'female', governorate: 'بورسعيد', location: 'بورسعيد - بورسعيد', since: '40 أيام', date: '2026-06-13', description: 'شوهد آخر مرة في موقف المواصلات العامة.', features: 'حية خفيفة، شعر رمادي.', health: 'جيدة، لا تعاني من أمراض مزمنة', contact: '01234567001', reporter: 'محمد كريم', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1781308303119 },
    { name: 'عمر جابر', age: 48, gender: 'male', governorate: 'المنيا', location: 'المنيا - المنيا', since: '7 أيام', date: '2026-07-16', description: 'شوهد آخر مرة في الحديقة العامة.', features: 'ندبة على الجبهة، عيون خضراء.', health: 'جيدة جداً', contact: '01555667788', reporter: 'حسن كريم', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1784187077553 },
    { name: 'مها حسن', age: 39, gender: 'female', governorate: 'كفر الشيخ', location: 'كفر الشيخ - كفر الشيخ', since: '38 أيام', date: '2026-06-15', description: 'شوهد آخر مرة في الحديقة العامة.', features: 'شامة أسفل العين اليمنى، عيون بنية.', health: 'جيدة جداً', contact: '01555667788', reporter: 'حسن سعيد', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1781517362426 },
    { name: 'عمرو محمود', age: 52, gender: 'male', governorate: 'الإسماعيلية', location: 'الإسماعيلية - الإسماعيلية', since: '48 أيام', date: '2026-06-05', description: 'شوهد آخر مرة في موقف المواصلات العامة.', features: 'ندبة على الجبهة، عيون خضراء.', health: 'يعاني من مرض السكري', contact: '01234567001', reporter: 'إبراهيم خالد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1780610677970 },
    { name: 'خالد هاشم', age: 38, gender: 'male', governorate: 'أسيوط', location: 'أسيوط - أسيوط', since: '49 أيام', date: '2026-06-04', description: 'لم يعد إلى المنزل منذ خروجه مع الأصدقاء.', features: 'ندبة صغيرة على الذقن، شعر أسود قصير.', health: 'يعاني من الزهايمر', contact: '01234567890', reporter: 'عمر شريف', status: 'found', reportStatus: 'verified', image: '', coords: '', timestamp: 1780592802785 },
    { name: 'فاطمة محمود', age: 2, gender: 'female', governorate: 'الأقصر', location: 'الأقصر - الأقصر', since: '10 أيام', date: '2026-07-13', description: 'لم يعد إلى المنزل منذ خروجه مع الأصدقاء.', features: 'وشم صغير على اليد اليمنى.', health: 'جيدة جداً', contact: '01555667788', reporter: 'علي محمد', status: 'found', reportStatus: 'pending', image: '', coords: '', timestamp: 1783900296830 },
    { name: 'سامي إبراهيم', age: 22, gender: 'male', governorate: 'المنيا', location: 'المنيا - المنيا', since: '23 أيام', date: '2026-06-30', description: 'فُقد أثناء عودته من العمل. لم يعد إلى المنزل.', features: 'حية خفيفة، شعر رمادي.', health: 'يعاني من الزهايمر', contact: '01556677889', reporter: 'هاني أحمد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1782834360456 },
    { name: 'كريم عبد الله', age: 28, gender: 'male', governorate: 'السويس', location: 'السويس - السويس', since: '5 أيام', date: '2026-07-18', description: 'فُقد أثناء التنزه في المنطقة.', features: 'شعر طويل أسود، قامة طويلة.', health: 'حساسية تجاه بعض الأطعمة', contact: '01011121314', reporter: 'تامر علي', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1784315722625 },
    { name: 'سارة أحمد', age: 50, gender: 'female', governorate: 'بني سويف', location: 'بني سويف - بني سويف', since: '34 أيام', date: '2026-06-19', description: 'آخر مشاهدة كانت في السوق المركزي.', features: 'ندبة على الجبهة، عيون خضراء.', health: 'يعاني من الزهايمر', contact: '01011121314', reporter: 'عمرو محمد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1781845395908 },
    { name: 'عمرو حسن', age: 12, gender: 'male', governorate: 'قنا', location: 'قنا - قنا', since: '53 أيام', date: '2026-05-31', description: 'فُقد أثناء عودته من العمل. لم يعد إلى المنزل.', features: 'نظارة طبية بإطار أسود، شعر بني.', health: 'جيدة جداً', contact: '01011121314', reporter: 'تامر علي', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1780170474121 },
    { name: 'تامر سعيد', age: 37, gender: 'male', governorate: 'المنوفية', location: 'المنوفية - المنوفية', since: '24 أيام', date: '2026-06-29', description: 'لم يعد إلى المنزل منذ خروجه مع الأصدقاء.', features: 'نظارة شمسية طبية، لحية خفيفة.', health: 'جيدة، لا تعاني من أمراض مزمنة', contact: '01234567890', reporter: 'تامر أحمد', status: 'found', reportStatus: 'pending', image: '', coords: '', timestamp: 1782743071450 },
    { name: 'مريم زكريا', age: 50, gender: 'female', governorate: 'أسيوط', location: 'أسيوط - أسيوط', since: '8 أيام', date: '2026-07-15', description: 'لم يعد إلى المنزل منذ خروجه مع الأصدقاء.', features: 'طول متوسط، بنية جسمانية عادية.', health: 'جيدة', contact: '01556677889', reporter: 'تامر ناصر', status: 'found', reportStatus: 'verified', image: '', coords: '', timestamp: 1784063002521 },
    { name: 'حسن أحمد', age: 57, gender: 'male', governorate: 'القليوبية', location: 'القليوبية - القليوبية', since: '8 أيام', date: '2026-07-15', description: 'غادر المنزل صباحاً ولم يعد.', features: 'طول متوسط، بنية جسمانية عادية.', health: 'جيدة، لا تعاني من أمراض مزمنة', contact: '01011121314', reporter: 'هاني علي', status: 'found', reportStatus: 'verified', image: '', coords: '', timestamp: 1784131560493 },
    { name: 'خالد جابر', age: 8, gender: 'male', governorate: 'الغربية', location: 'الغربية - الغربية', since: '35 أيام', date: '2026-06-18', description: 'شوهد آخر مرة في موقف المواصلات العامة.', features: 'نظارة شمسية طبية، لحية خفيفة.', health: 'يعاني من الزهايمر', contact: '01122334455', reporter: 'علي علي', status: 'found', reportStatus: 'pending', image: '', coords: '', timestamp: 1781769738496 },
    { name: 'منى كريم', age: 63, gender: 'female', governorate: 'القليوبية', location: 'القليوبية - القليوبية', since: '31 أيام', date: '2026-06-22', description: 'غادر المنزل صباحاً ولم يعد.', features: 'نظارة شمسية طبية، لحية خفيفة.', health: 'يعاني من مرض السكري', contact: '01234567890', reporter: 'يوسف رفعت', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1782140830189 },
    { name: 'سامي محمود', age: 7, gender: 'male', governorate: 'سوهاج', location: 'سوهاج - سوهاج', since: '17 أيام', date: '2026-07-06', description: 'آخر اتصال كان منذ عدة أيام.', features: 'شعر طويل أسود، قامة طويلة.', health: 'جيدة جداً', contact: '01234567890', reporter: 'محمد موسى', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1783344146945 },
    { name: 'سارة زكريا', age: 8, gender: 'female', governorate: 'السويس', location: 'السويس - السويس', since: '51 أيام', date: '2026-06-02', description: 'آخر مرة شوهد فيها بالقرب من المنطقة التجارية.', features: 'وشم صغير على اليد اليمنى.', health: 'جيدة جداً', contact: '01011121314', reporter: 'حسن خالد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1780420579926 },
    { name: 'مها شريف', age: 56, gender: 'female', governorate: 'قنا', location: 'قنا - قنا', since: '7 أيام', date: '2026-07-16', description: 'فُقد أثناء التنزه في المنطقة.', features: 'نظارة شمسية طبية، لحية خفيفة.', health: 'جيدة جداً', contact: '01556677889', reporter: 'وائل زكريا', status: 'found', reportStatus: 'verified', image: '', coords: '', timestamp: 1784150836597 },
    { name: 'نورة جابر', age: 31, gender: 'female', governorate: 'القاهرة', location: 'القاهرة - القاهرة', since: '57 أيام', date: '2026-05-27', description: 'فُقد أثناء التنزه في المنطقة.', features: 'حية خفيفة، شعر رمادي.', health: 'جيدة جداً', contact: '01556677889', reporter: 'يوسف سعيد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1779838632815 },
    { name: 'مريم يوسف', age: 60, gender: 'female', governorate: 'بني سويف', location: 'بني سويف - بني سويف', since: '16 أيام', date: '2026-07-07', description: 'شوهد آخر مرة في موقف المواصلات العامة.', features: 'ندبة على الجبهة، عيون خضراء.', health: 'جيدة، لا تعاني من أمراض مزمنة', contact: '01122334455', reporter: 'ناصر حسن', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1783422716676 },
    { name: 'وائل علي', age: 39, gender: 'male', governorate: 'كفر الشيخ', location: 'كفر الشيخ - كفر الشيخ', since: '54 أيام', date: '2026-05-30', description: 'فُقد أثناء عودته من العمل. لم يعد إلى المنزل.', features: 'شعر طويل أسود، قامة طويلة.', health: 'حساسية تجاه بعض الأطعمة', contact: '01011121314', reporter: 'هاني زكريا', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1780154326966 },
    { name: 'مصطفى ناصر', age: 41, gender: 'male', governorate: 'المنوفية', location: 'المنوفية - المنوفية', since: '21 أيام', date: '2026-07-02', description: 'غادر المنزل صباحاً ولم يعد.', features: 'شامة أسفل العين اليمنى، عيون بنية.', health: 'جيدة', contact: '01011121314', reporter: 'عمرو علي', status: 'found', reportStatus: 'verified', image: '', coords: '', timestamp: 1782987900688 },
    { name: 'فاطمة حسن', age: 19, gender: 'female', governorate: 'القاهرة', location: 'القاهرة - القاهرة', since: '3 أيام', date: '2026-07-20', description: 'غادر المنزل صباحاً ولم يعد.', features: 'ندبة على الجبهة، عيون خضراء.', health: 'يعاني من الزهايمر', contact: '01555667788', reporter: 'حسن علي', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1784537465879 },
    { name: 'عمر حسن', age: 17, gender: 'male', governorate: 'الإسكندرية', location: 'الإسكندرية - الإسكندرية', since: '32 أيام', date: '2026-06-21', description: 'فُقد بالقرب من المدرسة.', features: 'نظارة شمسية طبية، لحية خفيفة.', health: 'يعاني من مرض السكري', contact: '01012345678', reporter: 'مصطفى رفعت', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1782000540473 },
    { name: 'عزة حسن', age: 30, gender: 'female', governorate: 'المنيا', location: 'المنيا - المنيا', since: '24 أيام', date: '2026-06-29', description: 'فُقد أثناء عودته من العمل. لم يعد إلى المنزل.', features: 'ندبة صغيرة على الذقن، شعر أسود قصير.', health: 'جيدة', contact: '01223344556', reporter: 'يوسف موسى', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1782677562709 },
    { name: 'حسن زكريا', age: 63, gender: 'male', governorate: 'الإسكندرية', location: 'الإسكندرية - الإسكندرية', since: '3 أيام', date: '2026-07-20', description: 'لم يعد إلى المنزل منذ خروجه مع الأصدقاء.', features: 'حية خفيفة، شعر رمادي.', health: 'جيدة', contact: '01234567890', reporter: 'عمرو جابر', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1784489203909 },
    { name: 'هدى عبد الله', age: 49, gender: 'female', governorate: 'سوهاج', location: 'سوهاج - سوهاج', since: '47 أيام', date: '2026-06-06', description: 'غادر المنزل صباحاً ولم يعد.', features: 'وشم صغير على اليد اليمنى.', health: 'جيدة', contact: '01223344556', reporter: 'كريم محمود', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1780738185927 },
    { name: 'صباح رفعت', age: 15, gender: 'female', governorate: 'قنا', location: 'قنا - قنا', since: '35 أيام', date: '2026-06-18', description: 'آخر اتصال كان منذ عدة أيام.', features: 'نظارة شمسية طبية، لحية خفيفة.', health: 'جيدة', contact: '01012345678', reporter: 'تامر خالد', status: 'found', reportStatus: 'verified', image: '', coords: '', timestamp: 1781738128833 },
    { name: 'إيمان أحمد', age: 14, gender: 'female', governorate: 'قنا', location: 'قنا - قنا', since: '12 أيام', date: '2026-07-11', description: 'غادر المنزل صباحاً ولم يعد.', features: 'طول متوسط، بنية جسمانية عادية.', health: 'جيدة', contact: '01099887766', reporter: 'خالد أمين', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1783747096952 },
    { name: 'سارة زكريا', age: 56, gender: 'female', governorate: 'المنيا', location: 'المنيا - المنيا', since: '22 أيام', date: '2026-07-01', description: 'فُقد أثناء التنزه في المنطقة.', features: 'نظارة شمسية طبية، لحية خفيفة.', health: 'جيدة جداً', contact: '01223344556', reporter: 'علي سعيد', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1782876771209 },
    { name: 'هاني سعيد', age: 5, gender: 'male', governorate: 'الأقصر', location: 'الأقصر - الأقصر', since: '35 أيام', date: '2026-06-18', description: 'شوهد آخر مرة في موقف المواصلات العامة.', features: 'طول متوسط، بنية جسمانية عادية.', health: 'حساسية تجاه بعض الأطعمة', contact: '01199887766', reporter: 'أحمد موسى', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1781793545119 },
    { name: 'رانيا رفعت', age: 57, gender: 'female', governorate: 'المنوفية', location: 'المنوفية - المنوفية', since: '42 أيام', date: '2026-06-11', description: 'فُقد بالقرب من المدرسة.', features: 'نظارة شمسية طبية، لحية خفيفة.', health: 'يعاني من الزهايمر', contact: '01555667788', reporter: 'كريم أمين', status: 'found', reportStatus: 'pending', image: '', coords: '', timestamp: 1781183600470 },
    { name: 'إيمان زكريا', age: 50, gender: 'female', governorate: 'القليوبية', location: 'القليوبية - القليوبية', since: '48 أيام', date: '2026-06-05', description: 'فُقد أثناء التنزه في المنطقة.', features: 'حية خفيفة، شعر رمادي.', health: 'يعاني من الزهايمر', contact: '01099887766', reporter: 'إبراهيم هاشم', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1780645409152 },
    { name: 'مها موسى', age: 22, gender: 'female', governorate: 'القاهرة', location: 'القاهرة - القاهرة', since: '21 أيام', date: '2026-07-02', description: 'آخر مشاهدة كانت في السوق المركزي.', features: 'نظارة طبية بإطار أسود، شعر بني.', health: 'جيدة، لا تعاني من أمراض مزمنة', contact: '01011121314', reporter: 'يوسف علي', status: 'found', reportStatus: 'verified', image: '', coords: '', timestamp: 1782954091471 },
    { name: 'منى سعيد', age: 11, gender: 'female', governorate: 'دمياط', location: 'دمياط - دمياط', since: '57 أيام', date: '2026-05-27', description: 'آخر مشاهدة كانت في السوق المركزي.', features: 'نظارة طبية بإطار أسود، شعر بني.', health: 'جيدة جداً', contact: '01234567890', reporter: 'عمرو كريم', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1779875271407 },
    { name: 'رانيا أحمد', age: 59, gender: 'female', governorate: 'كفر الشيخ', location: 'كفر الشيخ - كفر الشيخ', since: '35 أيام', date: '2026-06-18', description: 'آخر مشاهدة كانت في السوق المركزي.', features: 'شامة أسفل العين اليمنى، عيون بنية.', health: 'جيدة جداً', contact: '01011121314', reporter: 'يوسف سعيد', status: 'found', reportStatus: 'verified', image: '', coords: '', timestamp: 1781759879354 },
    { name: 'سارة خالد', age: 54, gender: 'female', governorate: 'بني سويف', location: 'بني سويف - بني سويف', since: '25 أيام', date: '2026-06-28', description: 'فُقد بالقرب من المدرسة.', features: 'ندبة على الجبهة، عيون خضراء.', health: 'جيدة جداً', contact: '01012345678', reporter: 'هاني إبراهيم', status: 'found', reportStatus: 'pending', image: '', coords: '', timestamp: 1782585070952 },
    { name: 'صباح عبد الله', age: 66, gender: 'female', governorate: 'دمياط', location: 'دمياط - دمياط', since: '59 أيام', date: '2026-05-25', description: 'شوهد آخر مرة في موقف المواصلات العامة.', features: 'ندبة صغيرة على الذقن، شعر أسود قصير.', health: 'جيدة', contact: '01012345678', reporter: 'عمر حسن', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1779729634559 },
    { name: 'رانيا سعيد', age: 3, gender: 'female', governorate: 'الإسكندرية', location: 'الإسكندرية - الإسكندرية', since: '25 أيام', date: '2026-06-28', description: 'غادر المنزل صباحاً ولم يعد.', features: 'شعر طويل أسود، قامة طويلة.', health: 'جيدة', contact: '01012345678', reporter: 'هاني ناصر', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1782643454828 },
    { name: 'أيمن يوسف', age: 36, gender: 'male', governorate: 'المنيا', location: 'المنيا - المنيا', since: '55 أيام', date: '2026-05-29', description: 'غادر المنزل صباحاً ولم يعد.', features: 'ندبة صغيرة على الذقن، شعر أسود قصير.', health: 'يعاني من مرض السكري', contact: '01099887766', reporter: 'عبد الله محمود', status: 'found', reportStatus: 'pending', image: '', coords: '', timestamp: 1780023311821 },
    { name: 'علي ناصر', age: 21, gender: 'male', governorate: 'بني سويف', location: 'بني سويف - بني سويف', since: '45 أيام', date: '2026-06-08', description: 'آخر مشاهدة كانت في السوق المركزي.', features: 'حية خفيفة، شعر رمادي.', health: 'جيدة، لا تعاني من أمراض مزمنة', contact: '01099887766', reporter: 'حسن علي', status: 'found', reportStatus: 'pending', image: '', coords: '', timestamp: 1780884737622 },
    { name: 'علي خالد', age: 48, gender: 'male', governorate: 'المنيا', location: 'المنيا - المنيا', since: '6 أيام', date: '2026-07-17', description: 'شوهد آخر مرة في الحديقة العامة.', features: 'عيون عسلية، حاجبان كثيفان.', health: 'جيدة', contact: '01199887766', reporter: 'عبد الله عبد الله', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1784286336432 },
    { name: 'سامي هاشم', age: 20, gender: 'male', governorate: 'الدقهلية', location: 'الدقهلية - الدقهلية', since: '25 أيام', date: '2026-06-28', description: 'فُقد أثناء التنزه في المنطقة.', features: 'نظارة شمسية طبية، لحية خفيفة.', health: 'جيدة جداً', contact: '01555667788', reporter: 'كريم جابر', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1782641025572 },
    { name: 'حبيبة أمين', age: 20, gender: 'female', governorate: 'سوهاج', location: 'سوهاج - سوهاج', since: '58 أيام', date: '2026-05-26', description: 'فُقد أثناء عودته من العمل. لم يعد إلى المنزل.', features: 'حية خفيفة، شعر رمادي.', health: 'يعاني من الزهايمر', contact: '01099887766', reporter: 'ناصر أحمد', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1779787142086 },
    { name: 'فاطمة يوسف', age: 36, gender: 'female', governorate: 'الجيزة', location: 'الجيزة - الجيزة', since: '25 أيام', date: '2026-06-28', description: 'شوهد آخر مرة في الحديقة العامة.', features: 'نظارة طبية بإطار أسود، شعر بني.', health: 'يعاني من مرض السكري', contact: '01555667788', reporter: 'علي ناصر', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1782659018669 },
    { name: 'نادية علي', age: 26, gender: 'female', governorate: 'المنيا', location: 'المنيا - المنيا', since: '16 أيام', date: '2026-07-07', description: 'فُقد أثناء عودته من العمل. لم يعد إلى المنزل.', features: 'شعر طويل أسود، قامة طويلة.', health: 'جيدة', contact: '01012345678', reporter: 'عمر رفعت', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1783383573169 },
    { name: 'فاطمة هاشم', age: 24, gender: 'female', governorate: 'الغربية', location: 'الغربية - الغربية', since: '36 أيام', date: '2026-06-17', description: 'فُقد أثناء التنزه في المنطقة.', features: 'طول متوسط، بنية جسمانية عادية.', health: 'جيدة', contact: '01555667788', reporter: 'خالد محمود', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1781711809658 },
    { name: 'مصطفى هاشم', age: 46, gender: 'male', governorate: 'القليوبية', location: 'القليوبية - القليوبية', since: '51 أيام', date: '2026-06-02', description: 'لم يعد إلى المنزل منذ خروجه مع الأصدقاء.', features: 'شامة أسفل العين اليمنى، عيون بنية.', health: 'جيدة، لا تعاني من أمراض مزمنة', contact: '01234567001', reporter: 'كريم زكريا', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1780400808018 },
    { name: 'نورة موسى', age: 16, gender: 'female', governorate: 'السويس', location: 'السويس - السويس', since: '12 أيام', date: '2026-07-11', description: 'فُقد أثناء عودته من العمل. لم يعد إلى المنزل.', features: 'شعر طويل أسود، قامة طويلة.', health: 'جيدة', contact: '01099887766', reporter: 'شريف سعيد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1783739718793 },
    { name: 'شريف خالد', age: 15, gender: 'male', governorate: 'السويس', location: 'السويس - السويس', since: '14 أيام', date: '2026-07-09', description: 'غادر المنزل صباحاً ولم يعد.', features: 'حية خفيفة، شعر رمادي.', health: 'تعاني من ضغط الدم', contact: '01234567890', reporter: 'محمد إبراهيم', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1783547293307 },
    { name: 'يوسف أمين', age: 43, gender: 'male', governorate: 'المنوفية', location: 'المنوفية - المنوفية', since: '39 أيام', date: '2026-06-14', description: 'آخر اتصال كان منذ عدة أيام.', features: 'عيون عسلية، حاجبان كثيفان.', health: 'جيدة', contact: '01099887766', reporter: 'محمود رفعت', status: 'found', reportStatus: 'pending', image: '', coords: '', timestamp: 1781397255700 },
    { name: 'دينا ناصر', age: 61, gender: 'female', governorate: 'بورسعيد', location: 'بورسعيد - بورسعيد', since: '7 أيام', date: '2026-07-16', description: 'غادر المنزل صباحاً ولم يعد.', features: 'نظارة شمسية طبية، لحية خفيفة.', health: 'جيدة، لا تعاني من أمراض مزمنة', contact: '01122334455', reporter: 'وائل محمود', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1784217477263 },
    { name: 'أمل جابر', age: 44, gender: 'female', governorate: 'الإسماعيلية', location: 'الإسماعيلية - الإسماعيلية', since: '45 أيام', date: '2026-06-08', description: 'فُقد أثناء عودته من العمل. لم يعد إلى المنزل.', features: 'طول متوسط، بنية جسمانية عادية.', health: 'جيدة', contact: '01556677889', reporter: 'علي كريم', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1780911277954 },
    { name: 'كريم جابر', age: 54, gender: 'male', governorate: 'القليوبية', location: 'القليوبية - القليوبية', since: '37 أيام', date: '2026-06-16', description: 'آخر مشاهدة كانت في السوق المركزي.', features: 'نظارة طبية بإطار أسود، شعر بني.', health: 'حساسية تجاه بعض الأطعمة', contact: '01012345678', reporter: 'مصطفى سعيد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1781564117275 },
    { name: 'عمرو محمود', age: 65, gender: 'male', governorate: 'الشرقية', location: 'الشرقية - الشرقية', since: '54 أيام', date: '2026-05-30', description: 'فُقد بالقرب من المدرسة.', features: 'نظارة شمسية طبية، لحية خفيفة.', health: 'جيدة جداً', contact: '01012345678', reporter: 'سامي علي', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1780139334626 },
    { name: 'حبيبة جابر', age: 15, gender: 'female', governorate: 'بورسعيد', location: 'بورسعيد - بورسعيد', since: '39 أيام', date: '2026-06-14', description: 'شوهد آخر مرة في الحديقة العامة.', features: 'ندبة صغيرة على الذقن، شعر أسود قصير.', health: 'جيدة', contact: '01099887766', reporter: 'تامر يوسف', status: 'found', reportStatus: 'verified', image: '', coords: '', timestamp: 1781383951293 },
    { name: 'كريم ناصر', age: 31, gender: 'male', governorate: 'كفر الشيخ', location: 'كفر الشيخ - كفر الشيخ', since: 'اليوم', date: '2026-07-23', description: 'شوهد آخر مرة في موقف المواصلات العامة.', features: 'ندبة على الجبهة، عيون خضراء.', health: 'جيدة', contact: '01122334455', reporter: 'وائل أحمد', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1784786119046 },
    { name: 'محمد أمين', age: 63, gender: 'male', governorate: 'البحيرة', location: 'البحيرة - البحيرة', since: '39 أيام', date: '2026-06-14', description: 'شوهد آخر مرة في موقف المواصلات العامة.', features: 'حية خفيفة، شعر رمادي.', health: 'جيدة جداً', contact: '01223344556', reporter: 'عبد الله زكريا', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1781458859680 },
    { name: 'سارة عبد الله', age: 36, gender: 'female', governorate: 'الغربية', location: 'الغربية - الغربية', since: '48 أيام', date: '2026-06-05', description: 'لم يعد إلى المنزل منذ خروجه مع الأصدقاء.', features: 'ندبة على الجبهة، عيون خضراء.', health: 'جيدة', contact: '01122334455', reporter: 'سامي موسى', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1780609689462 },
    { name: 'ناهد أحمد', age: 3, gender: 'female', governorate: 'القليوبية', location: 'القليوبية - القليوبية', since: '13 أيام', date: '2026-07-10', description: 'فُقد أثناء التنزه في المنطقة.', features: 'ندبة على الجبهة، عيون خضراء.', health: 'جيدة جداً', contact: '01556677889', reporter: 'محمود خالد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1783626113040 },
    { name: 'تامر عمران', age: 26, gender: 'male', governorate: 'الشرقية', location: 'الشرقية - الشرقية', since: '49 أيام', date: '2026-06-04', description: 'فُقد أثناء التنزه في المنطقة.', features: 'طول متوسط، بنية جسمانية عادية.', health: 'جيدة', contact: '01122334455', reporter: 'عمرو خالد', status: 'searching', reportStatus: 'verified', image: '', coords: '', timestamp: 1780548009693 },
    { name: 'وائل عمران', age: 17, gender: 'male', governorate: 'الغربية', location: 'الغربية - الغربية', since: '45 أيام', date: '2026-06-08', description: 'شوهد آخر مرة في موقف المواصلات العامة.', features: 'عيون عسلية، حاجبان كثيفان.', health: 'جيدة', contact: '01223344556', reporter: 'محمود زكريا', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1780935176961 },
    { name: 'مريم حسن', age: 10, gender: 'female', governorate: 'القليوبية', location: 'القليوبية - القليوبية', since: '6 أيام', date: '2026-07-17', description: 'آخر اتصال كان منذ عدة أيام.', features: 'ندبة على الجبهة، عيون خضراء.', health: 'يعاني من الزهايمر', contact: '01555667788', reporter: 'يوسف شريف', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1784307056800 },
    { name: 'محمود شريف', age: 14, gender: 'male', governorate: 'قنا', location: 'قنا - قنا', since: '58 أيام', date: '2026-05-26', description: 'شوهد آخر مرة في الحديقة العامة.', features: 'حية خفيفة، شعر رمادي.', health: 'جيدة، لا تعاني من أمراض مزمنة', contact: '01012345678', reporter: 'شريف ناصر', status: 'searching', reportStatus: 'pending', image: '', coords: '', timestamp: 1779799776468 }
];


  const insertSighting = db.prepare(`
    INSERT INTO sighting_reports (missingPersonName, reporter, phone, location, date, description, timestamp)
    VALUES (@missingPersonName, @reporter, @phone, @location, @date, @description, @timestamp)
  `);

  const seedSightings = [
    { missingPersonName: 'سارة محمد علي', reporter: 'كريم السيد', phone: '01234567892', location: 'الجيزة - المهندسين', date: '2026-07-16', description: 'شوهدت في شارع البطل أحمد عبد العزيز ترتدي عباءة زرقاء.', timestamp: now - 4500000 },
    { missingPersonName: '', reporter: 'مصطفى كريم', phone: '01556677889', location: 'القاهرة - الدقي', date: '2026-07-23', description: 'رأيت فتاة ترتدي عباءة زرقاء تتحدث مع أحدهم في مقهى.', timestamp: now - 500000 }
  ];

  // Seed admin user if none exists
  const adminCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE isAdmin = 1').get() as { c: number };
  if (adminCount.c === 0) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@aman-eg.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    const hashedPassword = bcrypt.hashSync(adminPassword, 12);
    db.prepare('INSERT INTO users (name, email, phone, password, isAdmin, createdAt) VALUES (?, ?, ?, ?, 1, ?)')
      .run('مدير النظام', adminEmail, '15544', hashedPassword, now);
  }

  const tx = db.transaction(() => {
    for (const m of seedMissing) insertMissing.run(m);
    for (const s of seedSightings) insertSighting.run(s);
  });
  tx();
}

// ──── Public API ─────────────────────────────────────────

export function getAll() {
  const d = getDb();
  return {
    missingReports: d.prepare('SELECT * FROM missing_reports ORDER BY timestamp DESC').all(),
    sightingReports: d.prepare('SELECT * FROM sighting_reports ORDER BY timestamp DESC').all(),
    users: d.prepare('SELECT * FROM users').all(),
    contactMessages: d.prepare('SELECT * FROM contact_messages ORDER BY timestamp DESC').all(),
    notifications: d.prepare('SELECT * FROM notifications ORDER BY createdAt DESC').all()
  };
}

function rowToMissing(row: any): MissingReport {
  return { ...row, featureImages: row.featureImages || '', imageColors: row.imageColors ? JSON.parse(row.imageColors) : [], clothingColors: row.clothingColors ? JSON.parse(row.clothingColors) : [] };
}

function missingToRow(r: Partial<MissingReport>): any {
  return { ...r, imageColors: r.imageColors ? JSON.stringify(r.imageColors) : '', clothingColors: r.clothingColors ? JSON.stringify(r.clothingColors) : '' };
}

export function getMissingReports(filters?: ReportFilters): MissingReport[] {
  const d = getDb();
  let sql = 'SELECT * FROM missing_reports WHERE 1=1';
  const params: any[] = [];
  if (filters?.name) { sql += ' AND name LIKE ?'; params.push(`%${filters.name}%`); }
  if (filters?.governorate) { sql += ' AND governorate = ?'; params.push(filters.governorate); }
  if (filters?.gender) { sql += ' AND gender = ?'; params.push(filters.gender); }
  if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status); }
  if (filters?.reportStatus) { sql += ' AND reportStatus = ?'; params.push(filters.reportStatus); }
  sql += ' ORDER BY timestamp DESC';
  return (d.prepare(sql).all(...params) as any[]).map(rowToMissing);
}

export function getMissingById(id: number): MissingReport | undefined {
  const d = getDb();
  const row = d.prepare('SELECT * FROM missing_reports WHERE id = ?').get(id) as any;
  return row ? rowToMissing(row) : undefined;
}

export function addMissingReport(report: Partial<MissingReport>): MissingReport {
  const d = getDb();
  const row = missingToRow({
    ...report,
    id: undefined,
    timestamp: Date.now(),
    status: report.status || 'searching',
    reportStatus: report.reportStatus || 'pending'
  });
  const keys = Object.keys(row).filter(k => k !== 'id');
  const cols = keys.join(', ');
  const vals = keys.map(() => '?').join(', ');
  const result = d.prepare(`INSERT INTO missing_reports (${cols}) VALUES (${vals})`).run(...keys.map(k => (row as any)[k]));
  return getMissingById(result.lastInsertRowid as number)!;
}

export function getSightingReports(): SightingReport[] {
  const d = getDb();
  return d.prepare('SELECT * FROM sighting_reports ORDER BY timestamp DESC').all() as SightingReport[];
}

export function addSightingReport(report: Partial<SightingReport>): SightingReport {
  const d = getDb();
  const row = { ...report, id: undefined, timestamp: Date.now(), verified: report.verified ? 1 : 0 };
  const keys = Object.keys(row).filter(k => k !== 'id');
  const cols = keys.join(', ');
  const vals = keys.map(() => '?').join(', ');
  const result = d.prepare(`INSERT INTO sighting_reports (${cols}) VALUES (${vals})`).run(...keys.map(k => (row as any)[k]));
  return d.prepare('SELECT * FROM sighting_reports WHERE id = ?').get(result.lastInsertRowid) as SightingReport;
}

export function getSightingsForMissing(missingName: string): SightingReport[] {
  const d = getDb();
  return d.prepare('SELECT * FROM sighting_reports WHERE missingPersonName LIKE ? ORDER BY timestamp DESC').all(`%${missingName}%`) as SightingReport[];
}

export function addContactMessage(msg: Partial<ContactMessage>): ContactMessage {
  const d = getDb();
  const row = { ...msg, id: undefined, timestamp: Date.now() };
  const keys = Object.keys(row).filter(k => k !== 'id');
  const cols = keys.join(', ');
  const vals = keys.map(() => '?').join(', ');
  const result = d.prepare(`INSERT INTO contact_messages (${cols}) VALUES (${vals})`).run(...keys.map(k => (row as any)[k]));
  return d.prepare('SELECT * FROM contact_messages WHERE id = ?').get(result.lastInsertRowid) as ContactMessage;
}

export function findUserByEmail(email: string): User | undefined {
  const d = getDb();
  return d.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
}

export function findUserById(id: number): User | undefined {
  const d = getDb();
  return d.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function createUser(user: Partial<User>): User {
  const d = getDb();
  const row = { ...user, id: undefined, createdAt: Date.now() };
  const keys = Object.keys(row).filter(k => k !== 'id');
  const cols = keys.join(', ');
  const vals = keys.map(() => '?').join(', ');
  const result = d.prepare(`INSERT INTO users (${cols}) VALUES (${vals})`).run(...keys.map(k => (row as any)[k]));
  return d.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as User;
}

export function addNotification(notif: Partial<Notification>): Notification {
  const d = getDb();
  const row = { ...notif, id: undefined, createdAt: Date.now(), read: notif.read ? 1 : 0 };
  const keys = Object.keys(row).filter(k => k !== 'id');
  const cols = keys.join(', ');
  const vals = keys.map(() => '?').join(', ');
  const result = d.prepare(`INSERT INTO notifications (${cols}) VALUES (${vals})`).run(...keys.map(k => (row as any)[k]));
  return d.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid) as Notification;
}

export function getNotifications(): Notification[] {
  const d = getDb();
  return d.prepare('SELECT * FROM notifications ORDER BY createdAt DESC LIMIT 50').all() as Notification[];
}

export function updateReportStatus(reportId: number, status: string, reportType: 'missing' | 'sighting'): boolean {
  const d = getDb();
  if (reportType === 'missing') {
    const r = d.prepare('UPDATE missing_reports SET reportStatus = ? WHERE id = ?').run(status, reportId);
    return r.changes > 0;
  }
  const r = d.prepare('UPDATE sighting_reports SET verified = ? WHERE id = ?').run(status === 'verified' ? 1 : 0, reportId);
  return r.changes > 0;
}

export function deleteReport(reportId: number, reportType: 'missing' | 'sighting'): boolean {
  const d = getDb();
  const table = reportType === 'missing' ? 'missing_reports' : 'sighting_reports';
  const r = d.prepare(`DELETE FROM ${table} WHERE id = ?`).run(reportId);
  return r.changes > 0;
}

export function getUsers(): User[] {
  const d = getDb();
  return d.prepare('SELECT * FROM users ORDER BY createdAt DESC').all() as User[];
}

export function getContactMessages(): ContactMessage[] {
  const d = getDb();
  return d.prepare('SELECT * FROM contact_messages ORDER BY timestamp DESC').all() as ContactMessage[];
}

export function reset(): void {
  const d = getDb();
  d.exec(`
    DELETE FROM missing_reports;
    DELETE FROM sighting_reports;
    DELETE FROM contact_messages;
    DELETE FROM notifications;
    DELETE FROM users;
  `);
  seedIfEmpty();
}

// ─── Admin: Sessions ────────────────────────────────────────
export function createSession(session: Partial<UserSession>): UserSession {
  const d = getDb();
  const now = Date.now();
  const row = { id: undefined, ...session, loginAt: now, lastActivity: now, active: 1 };
  const keys = Object.keys(row).filter(k => k !== 'id');
  const cols = keys.join(', ');
  const vals = keys.map(() => '?').join(', ');
  const result = d.prepare(`INSERT INTO user_sessions (${cols}) VALUES (${vals})`).run(...keys.map(k => (row as any)[k]));
  return d.prepare('SELECT * FROM user_sessions WHERE id = ?').get(result.lastInsertRowid) as UserSession;
}

export function endSession(sessionId: number): void {
  const d = getDb();
  d.prepare('UPDATE user_sessions SET logoutAt = ?, active = 0 WHERE id = ?').run(Date.now(), sessionId);
}

export function updateSessionActivity(sessionId: number): void {
  const d = getDb();
  d.prepare('UPDATE user_sessions SET lastActivity = ? WHERE id = ?').run(Date.now(), sessionId);
}

export function getUserSessions(userId: number): UserSession[] {
  const d = getDb();
  return d.prepare('SELECT * FROM user_sessions WHERE userId = ? ORDER BY loginAt DESC LIMIT 50').all(userId) as UserSession[];
}

export function getAllActiveSessions(): UserSession[] {
  const d = getDb();
  return d.prepare('SELECT * FROM user_sessions WHERE active = 1 ORDER BY lastActivity DESC').all() as UserSession[];
}

// ─── Admin: User Actions ────────────────────────────────────
export function logUserAction(userId: number, action: string, details: string, ip: string): UserAction {
  const d = getDb();
  const row = { id: undefined, userId, action, details, ip, timestamp: Date.now() };
  const keys = Object.keys(row).filter(k => k !== 'id');
  const cols = keys.join(', ');
  const vals = keys.map(() => '?').join(', ');
  const result = d.prepare(`INSERT INTO user_actions (${cols}) VALUES (${vals})`).run(...keys.map(k => (row as any)[k]));
  return d.prepare('SELECT * FROM user_actions WHERE id = ?').get(result.lastInsertRowid) as UserAction;
}

export function getUserActions(userId: number, limit = 100): UserAction[] {
  const d = getDb();
  return d.prepare('SELECT * FROM user_actions WHERE userId = ? ORDER BY timestamp DESC LIMIT ?').all(userId, limit) as UserAction[];
}

export function getAllUserActions(limit = 200): UserAction[] {
  const d = getDb();
  return d.prepare('SELECT * FROM user_actions ORDER BY timestamp DESC LIMIT ?').all(limit) as UserAction[];
}

// ─── Admin: Error Logs ──────────────────────────────────────
export function logError(error: Partial<ErrorLog>): ErrorLog {
  const d = getDb();
  const row = { id: undefined, level: 'error', userId: 0, ip: '', url: '', stack: '', ...error, timestamp: Date.now() };
  const keys = Object.keys(row).filter(k => k !== 'id');
  const cols = keys.join(', ');
  const vals = keys.map(() => '?').join(', ');
  const result = d.prepare(`INSERT INTO error_logs (${cols}) VALUES (${vals})`).run(...keys.map(k => (row as any)[k]));
  return d.prepare('SELECT * FROM error_logs WHERE id = ?').get(result.lastInsertRowid) as ErrorLog;
}

export function getErrorLogs(limit = 100): ErrorLog[] {
  const d = getDb();
  return d.prepare('SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT ?').all(limit) as ErrorLog[];
}

// ─── Admin: Stats ───────────────────────────────────────────
export function getAdminStats(): AdminStats {
  const d = getDb();
  const users = d.prepare('SELECT COUNT(*) as c FROM users').get() as any;
  const sessions = d.prepare('SELECT COUNT(*) as c FROM user_sessions').get() as any;
  const activeSessions = d.prepare('SELECT COUNT(*) as c FROM user_sessions WHERE active = 1').get() as any;
  const actions = d.prepare('SELECT COUNT(*) as c FROM user_actions').get() as any;
  const errors = d.prepare('SELECT COUNT(*) as c FROM error_logs').get() as any;
  const messages = d.prepare('SELECT COUNT(*) as c FROM contact_messages').get() as any;
  const today = Date.now() - 86400000;
  const usersToday = d.prepare('SELECT COUNT(*) as c FROM users WHERE createdAt > ?').get(today) as any;
  const uniqueIps = d.prepare('SELECT COUNT(DISTINCT ip) as c FROM user_sessions').get() as any;
  return {
    totalUsers: users.c, totalSessions: sessions.c, activeSessions: activeSessions.c,
    totalActions: actions.c, totalErrors: errors.c, totalMessages: messages.c,
    usersToday: usersToday.c, uniqueIps: uniqueIps.c
  };
}

