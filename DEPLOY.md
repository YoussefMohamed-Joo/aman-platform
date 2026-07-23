# دليل نشر منصة أمان

## الخطوة 1: رفع الباك إند (Backend)

### الخيار أ: Render.com (مجاني - أسهل)
1. روح على https://render.com واعمل حساب
2. دوس على **New +** → **Web Service**
3. اختار GitHub وارفع `backend/` كمشروع منفصل
4. الإعدادات:
   - **Name:** `aman-backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npx tsx src/server.ts`
   - **Plan:** Free
5. في **Environment Variables** ضيف:
   - `JWT_SECRET` = (حط كلمة سر قوية)
   - `REFRESH_SECRET` = (حط كلمة سر قوية مختلفة)
   - `NODE_ENV` = `production`
6. دوس **Deploy** واستنى 5 دقائق
7. بعد ما يخلص، خذ الرابط اللي يظهرلك، مثلاً: `https://aman-backend.onrender.com`

### الخيار ب: سيرفر VPS (Ubuntu)
```bash
# نقل الملفات للسيرفر
rsync -avz --exclude node_modules --exclude .env ./backend user@server:/opt/aman/backend

# تثبيت التبعيات
cd /opt/aman/backend
npm install --production

# استخدام PM2 للتشغيل المستمر
npm install -g pm2
pm2 start npm --name "aman-backend" -- start
pm2 save
pm2 startup
```

### الخيار ج: Docker
```bash
cd backend
docker build -t aman-backend .
docker run -d -p 3001:3001 -v aman_data:/app/data --name aman-backend aman-backend
```

## الخطوة 2: ربط الفرونت إند مع الباك إند

1. افتح ملف `assets/js/api.js`
2. غير السطر ده:
```js
window.AMAN_BACKEND_URL = ''; // ← ضع رابط الباك إند هنا للنشر
```
   إلى:
```js
window.AMAN_BACKEND_URL = 'https://aman-backend.onrender.com'; // رابط الباك إند بتاعك
```

## الخطوة 3: رفع الفرونت إند على Vercel

### الطريقة: من GitHub (أسهل)
1. ارفع كل ملفات المشروع (ما عدا `backend/`) على GitHub
   - أو اعمل repo منفصل للفرونت إند
2. روح على https://vercel.com
3. دوس **Add New...** → **Project**
4. استورد repo بتاعك
5. الإعدادات:
   - **Framework Preset:** `Other`
   - **Build Command:** (خليها فاضية)
   - **Output Directory:** `.`
6. دوس **Deploy**
7. بعد دقيقتين، هيديك رابط زي: `https://aman-project.vercel.app`

## الخطوة 4: تسجيل الدخول للوحة التحكم

- روح على `https://aman-project.vercel.app/admin.html`
- سجل دخول بـ:
  - **البريد:** `admin@aman-eg.com`
  - **كلمة السر:** `Admin123!`

## الخطوة 5: إعداد الذكاء الاصطناعي (OpenRouter)

1. روح على https://openrouter.ai/keys
2. اعمل حساب وخذ API Key
3. في الباك إند، حط في Environment Variables:
```
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxx
```

## الإعدادات الاختيارية

### SMTP (للبريد الإلكتروني)
في Environment Variables بتاعة الباك إند:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ADMIN_EMAIL=admin@aman-eg.com
```

### OAuth (تسجيل دخول بجوجل وفيسبوك)
شوف شرح Google OAuth و Facebook OAuth في تعليقات `.env.example`

## قاعدة البيانات

- باك إند بيستخدم SQLite
- الملف: `backend/data/aman.db`
- لو عايز تعمل backup:
```bash
cp backend/data/aman.db backup-$(date +%Y%m%d).db
```

## ملاحظات مهمة

1. **JWT_SECRET**: غيرها في الإنتاج (حط كلمة سر طويلة)
2. **SSE (الإشعارات الفورية)**: بتشتغل مباشرة مع الباك إند من غير proxy
3. **CORS**: الباك إند بيسمح بأي domain
4. **الأمان**: Rate limiting (200 طلب/15 دقيقة) + Helmet headers + تسجيل كل حاجة
5. **النسخ الاحتياطي**: SQLite ملف واحد، سهل تنسخه
6. **لو عايز domain مخصص**: اربط domain مع Vercel

## بنية المجلدات

```
aman-project/
├── index.html              # الصفحة الرئيسية
├── admin.html              # لوحة التحكم
├── missing.html            # المفقودين
├── contact.html            # اتصل بنا
├── login.html              # تسجيل الدخول
├── signup.html             # إنشاء حساب
├── assets/js/
│   ├── api.js              # API client (عدل الرابط هنا)
│   └── ...
├── backend/
│   └── src/
│       ├── server.ts       # Express server
│       └── ...
└── vercel.json
```