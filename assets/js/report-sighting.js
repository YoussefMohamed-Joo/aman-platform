document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('sightingForm');
  var infoName = document.getElementById('infoName');
  var infoPhone = document.getElementById('infoPhone');
  var infoText = document.getElementById('infoText');
  var submitBtn = document.getElementById('submitBtn');
  var submitText = document.getElementById('submitText');
  var submitSpinner = document.getElementById('submitSpinner');
  var formSuccess = document.getElementById('formSuccess');

  // Auth buttons
  var headerBtns = document.querySelectorAll('header button');
  headerBtns.forEach(function(btn) {
    var text = btn.textContent.trim();
    if (text.includes('إنشاء حساب')) btn.addEventListener('click', function () { window.location.href = 'signup.html'; });
    else if (text.includes('تسجيل الدخول')) btn.addEventListener('click', function () { window.location.href = 'login.html'; });
  });

  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var name = infoName ? infoName.value.trim() : '';
    var phone = infoPhone ? infoPhone.value.trim() : '';
    var text = infoText ? infoText.value.trim() : '';

    // Validation with toast
    if (typeof AmanToast !== 'undefined') {
      if (!name) { AmanToast.error('يرجى إدخال الاسم الكامل'); if (infoName) infoName.focus(); return; }
      if (!phone) { AmanToast.error('يرجى إدخال رقم الهاتف للتواصل'); if (infoPhone) infoPhone.focus(); return; }
      if (phone.length < 10) { AmanToast.error('رقم الهاتف غير صحيح'); if (infoPhone) infoPhone.focus(); return; }
      if (!text) { AmanToast.error('يرجى كتابة تفاصيل المشاهدة'); if (infoText) infoText.focus(); return; }
    }

    // Save to AmanData
    if (typeof AmanData !== 'undefined') {
      var newSighting = {
        missingPersonName: name,
        reporter: name,
        phone: phone,
        location: '',
        date: new Date().toLocaleDateString('ar-EG'),
        description: text,
        image: null
      };
      AmanData.addSightingReport(newSighting);
    }

    // Also try to save to the backend API
    if (typeof AmanAPI !== 'undefined') {
      var fd = new FormData();
      fd.append('missingPersonName', name);
      fd.append('reporter', name);
      fd.append('phone', phone);
      fd.append('location', '');
      fd.append('date', new Date().toLocaleDateString('ar-EG'));
      fd.append('description', text);
      AmanAPI.createSighting(fd).catch(function() {});
    }

    // Check for matches
    var matches = [];
    if (typeof AmanMatch !== 'undefined' && typeof AmanData !== 'undefined') {
      var allMissing = AmanData.getMissingReports();
      if (allMissing) {
        matches = AmanMatch.findMatches({ missingPersonName: name, description: text, location: '', age: '' }, allMissing);
      }
    }

    // Show loading
    if (submitText) submitText.classList.add('hidden');
    if (submitSpinner) submitSpinner.classList.remove('hidden');
    if (submitBtn) submitBtn.disabled = true;

    setTimeout(function () {
      if (submitSpinner) submitSpinner.classList.add('hidden');
      if (submitText) submitText.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = false;

      if (typeof AmanToast !== 'undefined') {
        AmanToast.success('تم استلام بلاغك بنجاح. شكراً لمساهمتك.');
      }

      // Show matches if any
      var matchSection = document.getElementById('matchResults');
      if (matchSection && matches.length > 0) {
        var html = '<div class="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6">' +
          '<h3 class="text-lg font-bold text-amber-800 mb-4 flex items-center gap-2">' +
          '<span class="material-symbols-outlined">link</span> ' +
          'هل تقصد أحد هؤلاء المفقودين؟</h3>' +
          '<div class="space-y-3">';
        matches.slice(0, 3).forEach(function(m) {
          if (m.score >= 30) {
            html += '<div class="bg-white rounded-xl p-4 border border-amber-100 flex items-center gap-4">' +
              '<img class="w-16 h-16 rounded-xl object-cover" src="' + (m.missingImage || '') + '" alt="' + m.missingName + '" />' +
              '<div class="flex-1">' +
                '<p class="font-bold text-slate-800">' + m.missingName + '</p>' +
                '<p class="text-sm text-slate-500">' + m.location + ' · ' + m.since + '</p>' +
                '<div class="flex items-center gap-2 mt-1">' +
                  '<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">' + m.score + '% مطابقة</span>' +
                  (m.reasons.length > 0 ? '<span class="text-xs text-slate-400">' + m.reasons[0] + '</span>' : '') +
                '</div>' +
              '</div>' +
              '<a href="case-detail.html?name=' + encodeURIComponent(m.missingName) + '&location=' + encodeURIComponent(m.location || '') + '&description=' + encodeURIComponent(m.description || '') + '&contact=' + encodeURIComponent(m.contact || '') + '" class="px-4 py-2 bg-aman-blue text-white text-sm font-bold rounded-lg hover:bg-aman-dark-blue transition-colors shrink-0">عرض الحالة</a>' +
            '</div>';
          }
        });
        html += '</div></div>';
        matchSection.innerHTML = html;
        matchSection.classList.remove('hidden');
      }

      // Hide form, show success
      if (form) {
        form.querySelectorAll('input, textarea').forEach(function(el) { el.style.display = 'none'; });
        if (submitBtn) submitBtn.style.display = 'none';
        var uploadBtn = form.querySelector('button[type="button"]');
        if (uploadBtn) uploadBtn.style.display = 'none';
        form.querySelectorAll('label').forEach(function(el) { el.style.display = 'none'; });
      }
      if (formSuccess) formSuccess.classList.remove('hidden');
    }, 2000);
  });
});
