document.addEventListener('DOMContentLoaded', function () {
  const form = document.querySelector('form');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirmPassword');
  const toggleBtns = document.querySelectorAll('#togglePassword, #toggleConfirm');
  const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  toggleBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = this.getAttribute('data-target') || 'password';
      var input = document.getElementById(targetId);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      var icon = this.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = input.type === 'password' ? 'visibility' : 'visibility_off';
    });
  });

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const phone = document.getElementById('phone') ? document.getElementById('phone').value.trim() : '';
      const password = passwordInput.value.trim();
      const confirm = confirmInput ? confirmInput.value.trim() : password;

      if (!name) { AmanToast.error('يرجى إدخال الاسم الكامل'); return; }
      if (!email) { AmanToast.error('يرجى إدخال البريد الإلكتروني'); return; }
      if (!phone) { AmanToast.error('يرجى إدخال رقم الهاتف'); return; }
      if (password.length < 6) { AmanToast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
      if (password !== confirm) { AmanToast.error('كلمتا المرور غير متطابقتين'); return; }

      // Validate Arabic name
      if (!/^[\u0600-\u06FF\u0750-\u077F\s]+$/.test(name)) {
        AmanToast.error('الاسم يجب أن يكون باللغة العربية فقط'); return;
      }

      // Validate English password
      if (!/^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]+$/.test(password)) {
        AmanToast.error('كلمة المرور يجب أن تحتوي على أحرف إنجليزية فقط'); return;
      }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'جاري إنشاء الحساب...'; }

      try {
        const data = await AmanAPI.register({ name, email, phone, password });
        localStorage.setItem('aman_token', data.accessToken);
        if (data.refreshToken) localStorage.setItem('aman_refresh', data.refreshToken);
        localStorage.setItem('aman_user', JSON.stringify(data.user));
        AmanToast.success('تم إنشاء الحساب بنجاح! مرحباً بك في أمان.');
        setTimeout(function () { window.location.href = 'index.html'; }, 800);
      } catch (err) {
        AmanToast.error(err.message || 'تعذر إنشاء الحساب. يرجى المحاولة لاحقاً.');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'إنشاء حساب'; }
      }
    });
  }
});
