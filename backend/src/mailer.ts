import nodemailer from 'nodemailer';

const FROM = process.env.MAIL_FROM || 'noreply@aman-platform.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@aman-platform.com';

// Create transporter (uses Ethereal in dev, real SMTP in production)
function getTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  // Dev mode: create Ethereal test account
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: process.env.ETHEREAL_USER || '',
      pass: process.env.ETHEREAL_PASS || ''
    }
  });
}

let transporter: nodemailer.Transporter | null = null;

async function getTransport(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;
  transporter = getTransporter();
  // Verify connection (don't fail on Ethereal without creds)
  try { await transporter.verify(); } catch { }
  return transporter;
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  try {
    const t = await getTransport();
    await t.sendMail({ from: FROM, to, subject, html });
    console.log(`[Mailer] Email sent to ${to}: ${subject}`);
  } catch (e) {
    console.warn(`[Mailer] Failed to send email to ${to}:`, (e as Error).message);
  }
}

// ─── Templates ──────────────────────────────────────────────

export async function sendContactAutoReply(userEmail: string, userName: string): Promise<void> {
  await sendMail(userEmail, 'شكراً لتواصلك مع أمان', `
    <div dir="rtl" style="font-family: 'IBM Plex Sans Arabic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1e40af; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">أمان</h1>
        <p style="color: #93c5fd; margin: 5px 0 0;">معاً لنعيد الأمل</p>
      </div>
      <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
        <p style="font-size: 16px; color: #1e293b;">مرحباً ${userName}،</p>
        <p style="color: #475569; line-height: 1.8;">نشكرك على تواصلك مع منصة أمان. تم استلام رسالتك بنجاح وسنقوم بالرد عليها في أقرب وقت ممكن.</p>
        <p style="color: #475569; line-height: 1.8;">فريق أمان يتمنى لك يوماً سعيداً.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">هذا بريد إلكتروني آلي، يرجى عدم الرد عليه. للتواصل المباشر: support@aman-platform.com</p>
      </div>
    </div>
  `);
}

export async function sendAdminNotification(subject: string, message: string): Promise<void> {
  await sendMail(ADMIN_EMAIL, `[أمان] ${subject}`, `
    <div dir="rtl" style="font-family: 'IBM Plex Sans Arabic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #dc2626; padding: 15px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 18px;">إشعار إداري</h2>
      </div>
      <div style="background: white; padding: 20px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
        <p style="font-size: 16px; color: #1e293b; font-weight: bold;">${subject}</p>
        <p style="color: #475569; line-height: 1.8; white-space: pre-wrap;">${message}</p>
      </div>
    </div>
  `);
}

export async function sendPasswordReset(userEmail: string, userName: string, resetLink: string): Promise<void> {
  await sendMail(userEmail, 'استعادة كلمة المرور - أمان', `
    <div dir="rtl" style="font-family: 'IBM Plex Sans Arabic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1e40af; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">أمان</h1>
      </div>
      <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
        <p style="font-size: 16px; color: #1e293b;">مرحباً ${userName}،</p>
        <p style="color: #475569; line-height: 1.8;">لقد تلقينا طلباً لاستعادة كلمة المرور الخاصة بحسابك في منصة أمان.</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${resetLink}" style="background: #1e40af; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">استعادة كلمة المرور</a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">إذا لم تطلب استعادة كلمة المرور، يرجى تجاهل هذا البريد.</p>
      </div>
    </div>
  `);
}
