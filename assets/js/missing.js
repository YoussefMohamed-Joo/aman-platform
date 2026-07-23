(async function () {
  const searchInput = document.getElementById('searchInput');
  const locationFilter = document.getElementById('locationFilter');
  const genderFilter = document.getElementById('genderFilter');
  const ageFilter = document.getElementById('ageFilter');
  const statusFilter = document.getElementById('statusFilter');
  const searchBtn = document.getElementById('searchBtn');
  const resetBtn = document.getElementById('resetBtn');
  const cardsGrid = document.getElementById('cardsGrid');
  const resultsCount = document.getElementById('resultsCount');

  // Loading state
  cardsGrid.innerHTML = '<div class="col-span-full text-center py-20"><div class="inline-block w-10 h-10 border-4 border-aman-blue border-t-transparent rounded-full animate-spin"></div><p class="mt-4 text-slate-500">جاري تحميل البيانات...</p></div>';

  let allCards = [];

  function createCard(person) {
    const card = document.createElement('div');
    card.className = 'case-card bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-shadow';
    card.dataset.name = person.name || '';
    card.dataset.governorate = person.governorate || '';
    card.dataset.gender = person.gender || '';
    card.dataset.age = person.age || 0;
    card.dataset.status = person.status || 'searching';
    card.dataset.since = person.since || '';
    card.dataset.location = person.location || '';
    card.dataset.description = person.description || '';
    card.dataset.features = person.features || '';
    card.dataset.health = person.health || '';
    card.dataset.contact = person.contact || '';
    card.dataset.coords = person.coords || '';

    const statusText = person.status === 'found' ? 'تم العثور' : 'جاري البحث';
    const statusClass = person.status === 'found' ? 'bg-green-600' : 'bg-red-600';

    card.innerHTML = `
      <div class="relative h-64">
        <img alt="صورة شخص" class="w-full h-full object-cover" src="${sanitizeHTML(person.image || '')}" />
        <span class="absolute top-4 right-4 ${statusClass} text-white text-xs font-bold px-3 py-1 rounded-full">${statusText}</span>
      </div>
      <div class="p-5">
        <h4 class="text-xl font-bold text-center mb-4">${sanitizeHTML(person.name || '')}</h4>
        <div class="space-y-2 text-sm text-slate-600 mb-6">
          <div class="flex justify-between">
            <span>العمر: ${person.age || '?'} سنة</span>
            <span>النوع: ${person.gender === 'male' ? 'ذكر' : 'أنثى'}</span>
          </div>
          <div class="flex items-center gap-2">
            <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" /></svg>
            مفقود${person.gender === 'female' ? 'ة' : ''} منذ: ${person.since || ''}
          </div>
          <div class="flex items-center gap-2">
            <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" /><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" /></svg>
            آخر مكان: ${sanitizeHTML(person.location || '')}
          </div>
        </div>
        <div class="flex gap-2">
          <a class="flex-1 py-2 border-2 border-aman-blue text-aman-blue font-bold rounded-lg hover:bg-blue-50 transition-colors text-center text-sm detail-btn" href="#">عرض التفاصيل</a>
          <a class="flex-1 py-2 bg-aman-blue text-white font-bold rounded-lg hover:bg-aman-dark-blue transition-colors text-center text-sm sighting-btn" href="#">الإبلاغ عن مشاهدة</a>
        </div>
      </div>
    `;
    return card;
  }

  function renderCards(data) {
    cardsGrid.innerHTML = '';
    data.forEach(person => {
      const card = createCard(person);
      cardsGrid.appendChild(card);
    });
    allCards = cardsGrid.querySelectorAll('.case-card');
    filterCards();
    bindDetailButtons();
    bindSightingButtons();
  }

  function filterCards() {
    const nameQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const gov = locationFilter ? locationFilter.value : '';
    const gender = genderFilter ? genderFilter.value : '';
    const age = ageFilter ? ageFilter.value : '';
    const status = statusFilter ? statusFilter.value : '';

    let visibleCount = 0;
    allCards.forEach(card => {
      const cardName = (card.dataset.name || '').toLowerCase();
      const cardGov = card.dataset.governorate || '';
      const cardGender = card.dataset.gender || '';
      const cardAge = parseInt(card.dataset.age) || 0;
      const cardStatus = card.dataset.status || '';

      let show = true;

      if (nameQuery && !cardName.includes(nameQuery)) show = false;
      if (gov && cardGov !== gov) show = false;
      if (gender && cardGender !== gender) show = false;
      if (status && cardStatus !== status) show = false;
      if (age) {
        if (age === '51+') {
          if (cardAge < 51) show = false;
        } else {
          const [min, max] = age.split('-').map(Number);
          if (max && (cardAge < min || cardAge > max)) show = false;
        }
      }

      card.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });

    if (resultsCount) resultsCount.textContent = visibleCount + ' حالة';
  }

  function bindDetailButtons() {
    document.querySelectorAll('.detail-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        const card = this.closest('.case-card');
        if (!card) return;

        const params = new URLSearchParams({
          name: card.dataset.name || '',
          age: card.dataset.age || '',
          gender: card.dataset.gender || '',
          since: card.dataset.since || '',
          location: card.dataset.location || '',
          description: card.dataset.description || '',
          features: card.dataset.features || '',
          health: card.dataset.health || '',
          contact: card.dataset.contact || '',
          status: card.dataset.status || '',
          coords: card.dataset.coords || '',
          image: card.querySelector('img')?.src || ''
        });
        window.location.href = 'case-detail.html?' + params.toString();
      });
    });
  }

  function bindSightingButtons() {
    document.querySelectorAll('.sighting-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = 'reports.html';
      });
    });
  }

  if (searchBtn) searchBtn.addEventListener('click', filterCards);
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (searchInput) searchInput.value = '';
      if (locationFilter) locationFilter.value = '';
      if (genderFilter) genderFilter.value = '';
      if (ageFilter) ageFilter.value = '';
      if (statusFilter) statusFilter.value = '';
      filterCards();
    });
  }
  if (searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') filterCards(); });
  if (locationFilter) locationFilter.addEventListener('change', filterCards);
  if (genderFilter) genderFilter.addEventListener('change', filterCards);
  if (ageFilter) ageFilter.addEventListener('change', filterCards);
  if (statusFilter) statusFilter.addEventListener('change', filterCards);

  // Auth buttons
  const headerBtns = document.querySelectorAll('header button');
  headerBtns.forEach(btn => {
    const text = btn.textContent.trim();
    if (text.includes('إنشاء حساب')) btn.addEventListener('click', function () { window.location.href = 'signup.html'; });
    else if (text.includes('تسجيل الدخول')) btn.addEventListener('click', function () { window.location.href = 'login.html'; });
  });

  function readFilters() {
    var f = {};
    if (searchInput && searchInput.value.trim()) f.name = searchInput.value.trim();
    if (locationFilter && locationFilter.value) f.governorate = locationFilter.value;
    if (genderFilter && genderFilter.value) f.gender = genderFilter.value;
    if (ageFilter && ageFilter.value) f.age = ageFilter.value;
    if (statusFilter && statusFilter.value) f.status = statusFilter.value;
    return f;
  }

  try {
    const data = await AmanAPI.getMissing(Object.keys(readFilters()).length ? readFilters() : undefined);
    renderCards(data);
  } catch (err) {
    cardsGrid.innerHTML = '<div class="col-span-full text-center py-20"><p class="text-red-500 font-bold">عذراً، حدث خطأ أثناء تحميل البيانات. حاول مرة أخرى لاحقاً.</p></div>';
    if (resultsCount) resultsCount.textContent = '0 حالة';
  }
})();
