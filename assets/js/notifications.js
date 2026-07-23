(function () {
  'use strict';
  let notificationCount = 0;
  let notifications = [];
  const STORAGE_KEY = 'aman_notifications';

  function loadPersisted() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) { notifications = parsed; notificationCount = parsed.filter(n => !n.read).length; }
      }
    } catch { }
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50))); } catch { }
  }

  function addNotification(event, data) {
    const notification = { id: Date.now() + Math.random(), event, data: data || {}, read: false, timestamp: new Date().toISOString() };
    notifications.unshift(notification);
    notificationCount = notifications.filter(n => !n.read).length;
    persist();
    updateBadge();
    renderDropdown();
    showToastForEvent(event, data);
  }

  function updateBadge() {
    const badge = document.getElementById('amanNotifBadge');
    if (!badge) return;
    if (notificationCount > 0) {
      badge.textContent = notificationCount > 99 ? '99+' : notificationCount;
      badge.classList.remove('hidden');
    } else { badge.classList.add('hidden'); }
  }

  function showToastForEvent(event, data) {
    let message = '';
    switch (event) {
      case 'new-sighting': message = data && data.sighting ? 'تم تسجيل مشاهدة جديدة' + (data.sighting.reporter ? ' بواسطة ' + data.sighting.reporter : '') : 'تم تسجيل مشاهدة جديدة'; break;
      case 'new-missing': message = data && data.report ? 'تم تسجيل بلاغ مفقود جديد: ' + data.report.name : 'تم تسجيل بلاغ مفقود جديد'; break;
      case 'match': message = data && data.title ? data.title : 'تم العثور على تطابق جديد'; break;
      case 'automation-ready': message = 'نظام التشغيل الآلي جاهز'; break;
      case 'scheduler-update': message = data && data.changes ? 'تم تحديث ' + data.changes + ' عناصر تلقائياً' : 'تم التحديث التلقائي'; break;
      case 'connected': return;
      default: message = 'تحديث جديد: ' + event;
    }
    if (window.AmanToast && typeof window.AmanToast.success === 'function') { window.AmanToast.info(message, 'تحديث'); }
  }

  function connectSSE() {
    var token = localStorage.getItem('aman_token') || '';
    var base = window.AMAN_BACKEND_URL || window.location.origin;
    var evtSource = new EventSource(base + '/api/sse?token=' + encodeURIComponent(token));

    evtSource.addEventListener('connected', function (e) { try { JSON.parse(e.data); } catch { } });
    evtSource.addEventListener('new-sighting', function (e) { try { addNotification('new-sighting', JSON.parse(e.data)); } catch { addNotification('new-sighting', {}); } });
    evtSource.addEventListener('new-missing', function (e) { try { addNotification('new-missing', JSON.parse(e.data)); } catch { addNotification('new-missing', {}); } });
    evtSource.addEventListener('automation-ready', function (e) { try { addNotification('automation-ready', JSON.parse(e.data)); } catch { addNotification('automation-ready', {}); } });
    evtSource.addEventListener('scheduler-update', function (e) { try { addNotification('scheduler-update', JSON.parse(e.data)); } catch { addNotification('scheduler-update', {}); } });
    evtSource.onerror = function () { setTimeout(connectSSE, 5000); };
  }

  function injectBell() {
    if (document.getElementById('amanNotifBell')) return;

    var authContainer = document.querySelector('header nav .flex.items-center.gap-3, header nav .flex.items-center.gap-2:not(:has(a))');
    if (!authContainer) authContainer = document.querySelector('header .flex.items-center.gap-3, header .flex.items-center.gap-2');
    if (!authContainer) return;

    var bell = document.createElement('div');
    bell.id = 'amanNotifBell';
    bell.className = 'relative cursor-pointer';
    bell.innerHTML = '<button id="amanNotifBtn" class="relative p-2 rounded-full hover:bg-slate-100 transition-colors" aria-label="الإشعارات">' +
      '<svg class="h-6 w-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>' +
      '<span id="amanNotifBadge" class="hidden absolute -top-0.5 -right-0.5 bg-aman-red text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">0</span>' +
      '</button>';
    authContainer.insertBefore(bell, authContainer.firstChild);

    // Dropdown
    var dropdown = document.createElement('div');
    dropdown.id = 'amanNotifDropdown';
    dropdown.className = 'hidden fixed md:absolute top-16 md:top-full left-4 md:left-auto right-4 md:right-0 mt-2 w-[90vw] md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[100] max-h-[70vh] flex flex-col';
    dropdown.innerHTML = '<div class="flex items-center justify-between p-4 border-b border-slate-100"><h3 class="font-bold text-slate-800">الإشعارات</h3><button id="amanNotifMarkRead" class="text-xs text-aman-blue hover:underline">تحديد الكل كمقروء</button></div>' +
      '<div id="amanNotifList" class="flex-1 overflow-y-auto p-2 min-h-[100px]"></div>' +
      '<div class="p-3 border-t border-slate-100 text-center"><span class="text-[10px] text-slate-400">يتم تحديث الإشعارات تلقائياً</span></div>';
    document.body.appendChild(dropdown);

    document.getElementById('amanNotifBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      var dd = document.getElementById('amanNotifDropdown');
      dd.classList.toggle('hidden');
      renderDropdown();
    });

    document.getElementById('amanNotifMarkRead').addEventListener('click', function () {
      notifications.forEach(function (n) { n.read = true; });
      notificationCount = 0;
      persist();
      updateBadge();
      renderDropdown();
    });

    document.addEventListener('click', function (e) {
      var dd = document.getElementById('amanNotifDropdown');
      var bellEl = document.getElementById('amanNotifBell');
      if (dd && !dd.classList.contains('hidden') && !dd.contains(e.target) && !bellEl.contains(e.target)) {
        dd.classList.add('hidden');
      }
    });
  }

  function renderDropdown() {
    var list = document.getElementById('amanNotifList');
    if (!list) return;
    if (notifications.length === 0) {
      list.innerHTML = '<div class="flex flex-col items-center justify-center py-10 text-slate-400"><svg class="h-10 w-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg><p class="text-sm">لا توجد إشعارات</p></div>';
      return;
    }
    var html = '';
    notifications.forEach(function (n) {
      var icon = '';
      var bg = '';
      switch (n.event) {
        case 'new-sighting': icon = 'visibility'; bg = 'bg-blue-50 text-blue-600'; break;
        case 'new-missing': icon = 'person_add'; bg = 'bg-red-50 text-red-600'; break;
        case 'match': icon = 'link'; bg = 'bg-green-50 text-green-600'; break;
        case 'automation-ready': icon = 'robot'; bg = 'bg-purple-50 text-purple-600'; break;
        case 'scheduler-update': icon = 'update'; bg = 'bg-amber-50 text-amber-600'; break;
        default: icon = 'notifications'; bg = 'bg-slate-100 text-slate-600';
      }
      var msg = '';
      if (n.event === 'new-sighting') msg = 'تم تسجيل مشاهدة جديدة';
      else if (n.event === 'new-missing') msg = n.data && n.data.report ? 'بلاغ مفقود: ' + n.data.report.name : 'بلاغ مفقود جديد';
      else if (n.event === 'match') msg = n.data && n.data.title ? n.data.title : 'تم العثور على تطابق';
      else if (n.event === 'automation-ready') msg = 'نظام التشغيل الآلي جاهز';
      else if (n.event === 'scheduler-update') msg = n.data && n.data.changes ? 'تم تحديث ' + n.data.changes + ' عناصر' : 'تحديث تلقائي';
      else msg = n.event;
      var time = n.timestamp ? new Date(n.timestamp).toLocaleString('ar-EG') : '';
      html += '<div class="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors ' + (n.read ? 'opacity-60' : '') + '">' +
        '<div class="w-9 h-9 rounded-full ' + bg + ' flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-lg">' + icon + '</span></div>' +
        '<div class="flex-1 min-w-0"><p class="text-sm font-medium text-slate-800 truncate">' + msg + '</p><p class="text-[10px] text-slate-400 mt-0.5">' + time + '</p></div>' +
        '</div>';
    });
    list.innerHTML = html;
  }

  function init() {
    loadPersisted();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { injectBell(); updateBadge(); connectSSE(); });
    } else { injectBell(); updateBadge(); connectSSE(); }
  }

  window.AmanNotifications = {
    getCount: function () { return notificationCount; },
    markAllRead: function () { notifications.forEach(function (n) { n.read = true; }); notificationCount = 0; persist(); updateBadge(); renderDropdown(); },
    getAll: function () { return notifications; }
  };

  init();
})();
