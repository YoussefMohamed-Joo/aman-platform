(function () {
  var page = window.location.pathname.replace(/\/+$/, '') || '/';

  var links = [
    { href: '/', label: 'الرئيسية' },
    { href: '/missing', label: 'المفقودين' },
    { href: '/reports', label: 'البلاغات والمشاهدات' },
    { href: '/visual-search', label: 'البحث بالصورة' },
    { href: '/about', label: 'من نحن' },
    { href: '/contact', label: 'اتصل بنا' }
  ];

  var navLinks = links.map(function (l) {
    var active = (page === l.href) || (page !== '/' && l.href !== '/' && page.startsWith(l.href));
    return '<li><a class="hover:text-aman-blue transition-colors' + (active ? ' text-aman-blue border-b-2 border-aman-blue pb-1' : '') + '" href="' + l.href + '">' + l.label + '</a></li>';
  }).join('');

  var token = localStorage.getItem('aman_token');
  var authHTML = token
    ? '<div class="flex items-center gap-3"><span class="text-sm text-slate-600 font-medium">' + (localStorage.getItem('aman_user_name') || '') + '</span><button onclick="localStorage.removeItem(\'aman_token\');localStorage.removeItem(\'aman_refresh\');window.location.href=\'/\'" class="px-4 py-2 text-sm font-bold text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-all">تسجيل خروج</button></div>'
    : '<div class="flex items-center gap-3"><a href="/signup" class="px-5 py-2 text-sm font-bold text-white bg-aman-blue rounded-md hover:bg-aman-dark-blue transition-all inline-block">إنشاء حساب</a><a href="/login" class="px-5 py-2 text-sm font-bold text-aman-blue border border-aman-blue rounded-md hover:bg-blue-50 transition-all inline-block">تسجيل الدخول</a></div>';

  var el = document.getElementById('navbar-root');
  if (el) {
    el.innerHTML = '<header class="sticky top-0 z-50 bg-white shadow-sm border-b border-slate-100"><nav class="container mx-auto px-4 py-3 flex items-center justify-between"><div class="flex items-center gap-2"><svg class="h-10 w-10 text-aman-blue" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="2.5"/><path d="M20 12v8l5 5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="20" cy="20" r="4" fill="currentColor" opacity="0.3"/></svg><div class="flex flex-col"><span class="text-xl font-bold text-aman-blue leading-none">أمان</span><span class="text-[10px] text-aman-gray">معاً لنعيد الأمل</span></div></div><ul class="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-600">' + navLinks + '</ul>' + authHTML + '</nav></header>';
  }
})();