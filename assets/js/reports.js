(function() {
  var currentTab = 'missing';
  var currentData = [];
  var currentPage = 1;
  var pageSize = 9;
  var searchTerm = '';
  var statusFilter = '';

  var missingContainer = document.getElementById('missingReports');
  var sightingContainer = document.getElementById('sightingReports');
  var missingEmpty = document.getElementById('missingEmpty');
  var sightingEmpty = document.getElementById('sightingEmpty');
  var skeleton = document.getElementById('skeletonGrid');
  var tabMissing = document.getElementById('tabMissing');
  var tabSighting = document.getElementById('tabSighting');
  var pagination = document.getElementById('pagination');
  var pageInfo = document.getElementById('pageInfo');
  var prevBtn = document.getElementById('prevPage');
  var nextBtn = document.getElementById('nextPage');
  var searchInput = document.getElementById('searchInput');
  var statusSelect = document.getElementById('statusFilter');
  var clearBtn = document.getElementById('clearBtn');

  // Status badge
  function statusBadge(status) {
    var labels = { verified: 'تم التحقق', pending: 'قيد المراجعة', rejected: 'مرفوض' };
    return '<span class="status-' + status + ' px-3 py-1 rounded-full text-xs font-bold">' + (labels[status] || status) + '</span>';
  }

  // Build missing card (safe innerHTML via sanitize)
  function buildMissingCard(r) {
    var safe = AmanSanitizeObj(r);
    var statusText = r.status === 'found' ? 'تم العثور' : (r.status === 'searching' ? 'جاري البحث' : r.status);
    var statusColor = r.status === 'found' ? 'bg-green-100 text-green-700' : (r.status === 'searching' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600');
    var img = r.image || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(safe.name) + '&background=1e40af&color=fff&size=128';

    return '<div class="card-animate bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden card-hover opacity-0">' +
      '<div class="p-5">' +
        '<div class="flex items-start gap-4">' +
          '<img src="' + AmanSanitize(img) + '" alt="' + safe.name + '" class="w-16 h-16 rounded-xl object-cover shadow-sm" onerror="this.src=\'https://ui-avatars.com/api/?name=' + encodeURIComponent(safe.name) + '&background=1e40af&color=fff&size=128\'" />' +
          '<div class="flex-1 min-w-0">' +
            '<div class="flex items-center gap-2 mb-1">' +
              '<h3 class="font-bold text-slate-800 truncate">' + safe.name + '</h3>' +
              '<span class="' + statusColor + ' text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0">' + statusText + '</span>' +
            '</div>' +
            '<p class="text-xs text-slate-500"><span class="font-semibold text-slate-600">المُبلّغ:</span> ' + (safe.reporter || 'مجهول') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="mt-4 space-y-2 text-sm text-slate-600">' +
          '<p><span class="font-semibold text-slate-700">المفقود:</span> ' + safe.name + ' (' + safe.age + ' سنة)</p>' +
          '<p><span class="font-semibold text-slate-700">التاريخ:</span> ' + safe.date + ' · <span class="font-semibold text-slate-700">الموقع:</span> ' + safe.location + '</p>' +
          '<p class="line-clamp-2 text-xs text-slate-500">' + safe.description + '</p>' +
        '</div>' +
        '<div class="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">' +
          '<div>' + statusBadge(r.reportStatus) + '</div>' +
          '<a href="case-detail.html?name=' + encodeURIComponent(safe.name) + '&age=' + safe.age + '&gender=' + (safe.gender || '') + '&location=' + encodeURIComponent(safe.location) + '&since=' + encodeURIComponent(safe.since || '') + '&description=' + encodeURIComponent(safe.description) + '&features=' + encodeURIComponent(safe.features || '') + '&health=' + encodeURIComponent(safe.health || '') + '&contact=' + encodeURIComponent(safe.contact || '') + '&image=' + encodeURIComponent(safe.image || '') + '&status=' + safe.status + '&reportStatus=' + safe.reportStatus + '&coords=' + encodeURIComponent(safe.coords || '') + '" class="inline-flex items-center gap-1 text-aman-blue text-sm font-bold hover:underline">' +
            'عرض التفاصيل ' +
            '<span class="material-symbols-outlined text-sm">arrow_forward</span>' +
          '</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Build sighting card
  function buildSightingCard(s) {
    var safe = AmanSanitizeObj(s);
    var nameDisplay = safe.missingPersonName || 'غير محدد';

    return '<div class="card-animate bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden card-hover opacity-0">' +
      '<div class="p-5">' +
        '<div class="flex items-center gap-3 mb-4">' +
          '<div class="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">' +
            '<span class="material-symbols-outlined">visibility</span>' +
          '</div>' +
          '<div>' +
            '<h3 class="font-bold text-slate-800">' + safe.reporter + '</h3>' +
            '<p class="text-xs text-slate-500">مُبلّغ</p>' +
          '</div>' +
        '</div>' +
        '<div class="space-y-2 text-sm text-slate-600">' +
          '<p><span class="font-semibold text-slate-700">الشخص المُشاهد:</span> ' + nameDisplay + '</p>' +
          '<p><span class="font-semibold text-slate-700">التاريخ:</span> ' + safe.date + '</p>' +
          '<p><span class="font-semibold text-slate-700">الموقع:</span> ' + safe.location + '</p>' +
          '<p class="line-clamp-2 text-xs text-slate-500">' + safe.description + '</p>' +
        '</div>' +
        '<div class="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">' +
          '<div>' + statusBadge('pending') + '</div>' +
          (nameDisplay !== 'غير محدد'
            ? '<a href="case-detail.html?name=' + encodeURIComponent(nameDisplay) + '" class="inline-flex items-center gap-1 text-aman-blue text-sm font-bold hover:underline">عرض الحالة <span class="material-symbols-outlined text-sm">arrow_forward</span></a>'
            : '<span class="text-xs text-slate-400">غير مرتبط بحالة</span>') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // Render
  function render() {
    var filtered = currentData;
    if (searchTerm) {
      var term = searchTerm.toLowerCase();
      filtered = filtered.filter(function(item) {
        var name = (item.name || item.reporter || '').toLowerCase();
        var location = (item.location || '').toLowerCase();
        var description = (item.description || '').toLowerCase();
        return name.includes(term) || location.includes(term) || description.includes(term);
      });
    }
    if (statusFilter) {
      filtered = filtered.filter(function(item) {
        return item.reportStatus === statusFilter || item.status === statusFilter;
      });
    }

    var total = filtered.length;
    var totalPages = Math.ceil(total / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    var start = (currentPage - 1) * pageSize;
    var page = filtered.slice(start, start + pageSize);

    var container = currentTab === 'missing' ? missingContainer : sightingContainer;
    var emptyEl = currentTab === 'missing' ? missingEmpty : sightingEmpty;
    var builder = currentTab === 'missing' ? buildMissingCard : buildSightingCard;

    container.innerHTML = '';
    container.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';

    if (page.length === 0) {
      container.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      pagination.classList.add('hidden');
    } else {
      container.classList.remove('hidden');
      emptyEl.classList.add('hidden');
      for (var i = 0; i < page.length; i++) {
        container.innerHTML += builder(page[i]);
      }
      // Trigger animations
      setTimeout(function() {
        var cards = container.querySelectorAll('.card-animate');
        for (var j = 0; j < cards.length; j++) {
          cards[j].style.opacity = '1';
        }
      }, 50);
      if (totalPages > 1) {
        pagination.classList.remove('hidden');
        pageInfo.textContent = 'الصفحة ' + currentPage + ' من ' + totalPages;
        prevBtn.disabled = currentPage <= 1;
        nextBtn.disabled = currentPage >= totalPages;
      } else {
        pagination.classList.add('hidden');
      }
    }
  }

  // Load data
  function loadData() {
    skeleton.classList.remove('hidden');
    missingContainer.classList.add('hidden');
    sightingContainer.classList.add('hidden');
    missingEmpty.classList.add('hidden');
    sightingEmpty.classList.add('hidden');

    var promises = [];
    if (currentTab === 'missing') {
      promises.push(AmanAPI.getMissing().then(function(d) { currentData = d; }).catch(function() { currentData = []; }));
    } else {
      promises.push(AmanAPI.getSightings().then(function(d) { currentData = d; }).catch(function() { currentData = []; }));
    }

    // Also load stats
    promises.push(AmanAPI.getStats().then(function(s) {
      var ids = ['statFound', 'statActive', 'statVerified', 'statMembers'];
      var vals = [s.totalFound, s.totalActive, s.totalVerified, s.totalMembers];
      for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el) el.textContent = vals[i].toLocaleString('ar-EG') + (ids[i] === 'statFound' || ids[i] === 'statVerified' ? '+' : '');
      }
    }).catch(function() {}));

    Promise.all(promises).then(function() {
      skeleton.classList.add('hidden');
      currentPage = 1;
      render();
    });
  }

  // Tab switch
  tabMissing.addEventListener('click', function() {
    if (currentTab === 'missing') return;
    currentTab = 'missing';
    tabMissing.className = 'tab-active px-10 py-3.5 rounded-xl font-bold transition-all text-sm md:text-base flex items-center gap-2';
    tabSighting.className = 'tab-inactive px-10 py-3.5 rounded-xl font-bold transition-all text-sm md:text-base flex items-center gap-2';
    loadData();
  });

  tabSighting.addEventListener('click', function() {
    if (currentTab === 'sighting') return;
    currentTab = 'sighting';
    tabSighting.className = 'tab-active px-10 py-3.5 rounded-xl font-bold transition-all text-sm md:text-base flex items-center gap-2';
    tabMissing.className = 'tab-inactive px-10 py-3.5 rounded-xl font-bold transition-all text-sm md:text-base flex items-center gap-2';
    loadData();
  });

  // Filter events
  searchInput.addEventListener('input', function() { searchTerm = this.value; currentPage = 1; render(); });
  statusSelect.addEventListener('change', function() { statusFilter = this.value; currentPage = 1; render(); });
  clearBtn.addEventListener('click', function() { searchInput.value = ''; statusSelect.value = ''; searchTerm = ''; statusFilter = ''; currentPage = 1; render(); });
  prevBtn.addEventListener('click', function() { if (currentPage > 1) { currentPage--; render(); } });
  nextBtn.addEventListener('click', function() { if (currentPage < Math.ceil(currentData.length / pageSize)) { currentPage++; render(); } });

  // Auth buttons
  document.querySelectorAll('header button').forEach(function(btn) {
    var text = btn.textContent.trim();
    if (text.includes('إنشاء حساب')) btn.addEventListener('click', function() { window.location.href = 'signup.html'; });
    else if (text.includes('تسجيل الدخول')) btn.addEventListener('click', function() { window.location.href = 'login.html'; });
  });

  // Init
  loadData();
})();
