export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // ─── Block sensitive files ─────────────────────────
  const blockedExtensions = [
    '.env', '.git', '.gitignore', '.json', '.ts', '.tsx',
    '.map', '.md', '.dockerignore', 'Dockerfile',
    'nginx.conf', 'docker-compose.yml'
  ];
  const blockedFiles = [
    'package.json', 'package-lock.json', 'tsconfig.json',
    '.env.example', '.dockerignore', 'yarn.lock', 'pnpm-lock.yaml'
  ];
  for (const ext of blockedExtensions) {
    if (path.endsWith(ext) && !path.startsWith('/assets/')) {
      return new Response('Forbidden', { status: 403 });
    }
  }
  for (const file of blockedFiles) {
    if (path.endsWith('/' + file) || path === '/' + file) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  // ─── Block directory listing ───────────────────────
  if (path.endsWith('/') && path !== '/') {
    return new Response('Forbidden', { status: 403 });
  }

  // ─── Block VPN/Proxy (using ip-api.com free tier) ──
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '127.0.0.1';

  // Skip VPN check for local/LAN IPs
  if (clientIp !== '127.0.0.1' && clientIp !== '::1' && !clientIp.startsWith('192.168.') && !clientIp.startsWith('10.')) {
    try {
      const ipRes = await fetch('http://ip-api.com/json/' + clientIp + '?fields=proxy,hosting,query', {
        signal: AbortSignal.timeout(3000)
      });
      const ipData = await ipRes.json();
      if (ipData.proxy === true || ipData.hosting === true) {
        return new Response(
          '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>ممنوع</title><style>body{font-family:Tahoma,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;text-align:center}.card{background:white;padding:3rem;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08)}h1{color:#1e293b;font-size:1.5rem;margin-bottom:1rem}p{color:#64748b;font-size:.95rem;line-height:1.6}.icon{font-size:3rem;margin-bottom:1rem}</style></head><body><div class="card"><div class="icon">🚫</div><h1>الوصول ممنوع</h1><p>نأسف، لا يُسمح بالوصول عبر شبكات VPN أو بروكسي.<br>يرجى تعطيل VPN والمحاولة مرة أخرى.<br>للتواصل: info@aman-eg.com</p></div></body></html>',
          { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    } catch (_) { /* Skip VPN check on error */ }
  }

  // ─── Security Headers ───────────────────────────────
  const response = await fetch(request);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('X-Frame-Options', 'DENY');
  newResponse.headers.set('X-XSS-Protection', '1; mode=block');
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  return newResponse;
}

export const config = {
  matcher: [
    '/((?!assets/.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot|css)$).*)',
  ]
};