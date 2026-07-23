document.addEventListener('DOMContentLoaded', function () {
  const form = document.querySelector('form');
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.getElementById('togglePassword');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', function () {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      const icon = this.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = isPassword ? 'visibility' : 'visibility_off';
    });
  }

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = passwordInput.value.trim();

      if (!email) { AmanToast.error('يرجى إدخال البريد الإلكتروني'); return; }
      if (!password || password.length < 6) { AmanToast.error('يرجى إدخال كلمة مرور صحيحة (6 أحرف على الأقل)'); return; }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'جاري تسجيل الدخول...'; }

      try {
        const data = await AmanAPI.login({ email, password });
        localStorage.setItem('aman_token', data.accessToken);
        if (data.refreshToken) localStorage.setItem('aman_refresh', data.refreshToken);
        localStorage.setItem('aman_user', JSON.stringify(data.user));
        AmanToast.success('تم تسجيل الدخول بنجاح! مرحباً بعودتك.');
        setTimeout(function () { window.location.href = 'index.html'; }, 800);
      } catch (err) {
        AmanToast.error(err.message || 'تعذر الاتصال بالخادم. يرجى المحاولة لاحقاً.');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'تسجيل الدخول'; }
      }
    });
  }

  // OAuth callback handling (from backend redirect)
  const urlParams = new URLSearchParams(window.location.search);
  const accessToken = urlParams.get('access_token');
  const refreshToken = urlParams.get('refresh_token');
  if (accessToken) {
    localStorage.setItem('aman_token', accessToken);
    if (refreshToken) localStorage.setItem('aman_refresh', refreshToken);
    window.location.href = 'index.html';
    return;
  }

  const errMsg = urlParams.get('error');
  if (errMsg) { AmanToast.error('فشل تسجيل الدخول: ' + decodeURIComponent(errMsg)); }

  // Social login - Google OAuth (code flow)
  document.querySelectorAll('.google-btn, .btn-google').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var redirectUri = window.location.origin + '/api/auth/oauth/callback';
      var clientId = localStorage.getItem('aman_google_client_id') || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
      var state = 'google:' + crypto.randomUUID();
      window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + encodeURIComponent(clientId) + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&response_type=code&scope=email+profile&prompt=select_account&state=' + state;
    });
  });

  // Social login - Facebook OAuth (code flow)
  document.querySelectorAll('.facebook-btn, .btn-facebook').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var redirectUri = window.location.origin + '/api/auth/oauth/callback';
      var appId = localStorage.getItem('aman_facebook_app_id') || 'YOUR_FACEBOOK_APP_ID';
      var state = 'facebook:' + crypto.randomUUID();
      window.location.href = 'https://www.facebook.com/v19.0/dialog/oauth?client_id=' + encodeURIComponent(appId) + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&response_type=code&scope=email,public_profile&state=' + state;
    });
  });
});
