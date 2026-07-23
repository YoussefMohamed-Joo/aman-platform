// Change this to your backend URL in production, e.g. 'https://aman-backend.onrender.com'
// For local development, keep it empty (uses same origin with /api prefix)
window.AMAN_BACKEND_URL = ''; // ← ضع رابط الباك إند هنا للنشر
const API_BASE = window.AMAN_BACKEND_URL ? window.AMAN_BACKEND_URL + '/api' : window.location.origin + '/api';

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('aman_refresh');
  if (!refreshToken) return false;
  try {
    const res = await fetch(API_BASE + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    if (!res.ok) { localStorage.removeItem('aman_token'); localStorage.removeItem('aman_refresh'); return false; }
    const data = await res.json();
    localStorage.setItem('aman_token', data.accessToken);
    localStorage.setItem('aman_refresh', data.refreshToken);
    return true;
  } catch { return false; }
}

const AmanAPI = {
  async request(method, path, body, retried) {
    const opts = { method, headers: {} };
    const token = localStorage.getItem('aman_token');
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;

    if (body && !(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      opts.body = body;
    }

    try {
      const res = await fetch(API_BASE + path, opts);
      if (res.status === 401 && !retried) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return this.request(method, path, body, true);
        localStorage.removeItem('aman_token');
        localStorage.removeItem('aman_refresh');
        if (window.location.pathname !== '/login.html') window.location.href = '/login.html';
        throw new Error('انتهت صلاحية الجلسة');
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } catch (e) {
      if (e.message === 'Failed to fetch') {
        const fallback = AmanFallback[method.toLowerCase() + path.replace(/\/(\d+)$/, 'ById')];
        if (fallback) return fallback(body, path);
        return null;
      }
      throw e;
    }
  },

  getMissing(filters) {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return this.request('GET', '/missing' + params);
  },

  getMissingById(id) {
    return this.request('GET', '/missing/' + id);
  },

  createMissing(formData) {
    return this.request('POST', '/missing', formData);
  },

  getSightings() {
    return this.request('GET', '/sightings');
  },

  createSighting(formData) {
    return this.request('POST', '/sightings', formData);
  },

  getSightingsForMissing(name) {
    return this.request('GET', '/sightings/for-missing?name=' + encodeURIComponent(name));
  },

  matchSighting(data) {
    return this.request('POST', '/match', data);
  },

  getStats() {
    return this.request('GET', '/stats');
  },

  contact(data) {
    return this.request('POST', '/contact', data);
  },

  register(data) {
    return this.request('POST', '/auth/register', data);
  },

  login(data) {
    return this.request('POST', '/auth/login', data);
  },

  oauth(data) {
    return this.request('POST', '/auth/oauth', data);
  },

  getProfile() {
    return this.request('GET', '/auth/me');
  },

  async updateStatus(id, status, type) {
    try {
      const token = localStorage.getItem('aman_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch(API_BASE + '/' + type + '/' + id + '/status', { method: 'PUT', headers, body: JSON.stringify({ status }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التحديث');
      if (window.AmanData && typeof window.AmanData.updateReportStatus === 'function') {
        window.AmanData.updateReportStatus(id, status, type);
      }
      return data;
    } catch (e) {
      if (e.message === 'Failed to fetch' && window.AmanData && typeof window.AmanData.updateReportStatus === 'function') {
        window.AmanData.updateReportStatus(id, status, type);
        return { success: true };
      }
      throw e;
    }
  },

  async deleteReport(id, type) {
    try {
      const token = localStorage.getItem('aman_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch(API_BASE + '/' + type + '/' + id, { method: 'DELETE', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الحذف');
      if (window.AmanData && typeof window.AmanData.deleteReport === 'function') {
        window.AmanData.deleteReport(id, type);
      }
      return data;
    } catch (e) {
      if (e.message === 'Failed to fetch' && window.AmanData && typeof window.AmanData.deleteReport === 'function') {
        window.AmanData.deleteReport(id, type);
        return { success: true };
      }
      throw e;
    }
  }
};

// Fallback to localStorage when backend is down
const AmanFallback = {
  get get() {
    if (typeof AmanData === 'undefined') return {};
    return {
      'get/missing'(_, path) {
        const id = path.split('/').pop();
        return id ? AmanData.getMissingById(parseInt(id)) : AmanData.getMissingReports();
      },
      'get/sightings'() { return AmanData.getSightingReports(); },
      'get/sightings/for-missing'(_, path) {
        const name = new URLSearchParams(path.split('?')[1]).get('name');
        return AmanData.getSightingsForMissing(name);
      },
      'get/stats'() {
        const all = AmanData.getAll();
        const m = all.missingReports || [];
        const s = all.sightingReports || [];
        return {
          totalFound: m.filter(r => r.status === 'found').length,
          totalActive: m.filter(r => r.status === 'searching').length,
          totalVerified: m.filter(r => r.reportStatus === 'verified').length,
          totalMembers: JSON.parse(localStorage.getItem('aman_users') || '[]').length,
          totalMissing: m.length,
          totalSightings: s.length
        };
      },
      'post/missing'(body) {
        var report = body;
        if (body instanceof FormData) {
          report = {};
          body.forEach(function(v, k) { report[k] = v; });
        }
        return AmanData.addMissingReport(report);
      },
      'post/sightings'(body) {
        var report = body;
        if (body instanceof FormData) {
          report = {};
          body.forEach(function(v, k) { report[k] = v; });
        }
        return AmanData.addSightingReport(report);
      },
      'post/contact'(body) {
        var data = body;
        if (body instanceof FormData) {
          data = {};
          body.forEach(function(v, k) { data[k] = v; });
        }
        return AmanData.addContactMessage(data);
      },
      'post/auth/register'(body) {
        var users = JSON.parse(localStorage.getItem('aman_users') || '[]');
        var user = body;
        if (body instanceof FormData) {
          user = {};
          body.forEach(function(v, k) { user[k] = v; });
        }
        if (!user.id) user.id = Date.now() + Math.floor(Math.random() * 1000);
        users.push(user);
        localStorage.setItem('aman_users', JSON.stringify(users));
        return { success: true, user: user };
      }
    };
  }
};
