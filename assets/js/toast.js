/**
 * Aman Toast Notification System (toast.js)
 */

var AmanToast = (function() {
  var container = null;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = 'aman-toast-container';
      container.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:12px;align-items:center;pointer-events:none;max-width:90vw;';
      document.body.appendChild(container);
    }
    return container;
  }

  function show(message, type, duration) {
    type = type || 'info';
    duration = duration || 4000;
    var c = getContainer();

    var toast = document.createElement('div');
    toast.style.cssText = 'pointer-events:auto;background:#fff;border-radius:16px;padding:16px 24px;box-shadow:0 10px 40px rgba(0,0,0,0.15),0 2px 8px rgba(0,0,0,0.08);display:flex;align-items:center;gap:12px;font-size:14px;font-weight:600;direction:rtl;transform:translateY(-20px) scale(0.95);opacity:0;transition:all 0.35s cubic-bezier(0.34,1.56,0.64,1);max-width:480px;border:1px solid rgba(226,232,240,0.5);font-family:"Cairo",sans-serif;';

    // Icon based on type
    var icon = document.createElement('span');
    icon.style.cssText = 'display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;flex-shrink:0;font-size:18px;';

    var text = document.createElement('span');
    text.style.cssText = 'flex:1;color:#1e293b;line-height:1.4;';
    text.textContent = message;

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = 'background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:4px;flex-shrink:0;transition:color 0.2s;';
    closeBtn.onmouseenter = function() { this.style.color = '#475569'; };
    closeBtn.onmouseleave = function() { this.style.color = '#94a3b8'; };

    switch(type) {
      case 'success':
        icon.style.background = '#dcfce7';
        icon.style.color = '#16a34a';
        icon.innerHTML = '✓';
        toast.style.borderRight = '4px solid #16a34a';
        break;
      case 'error':
        icon.style.background = '#fee2e2';
        icon.style.color = '#dc2626';
        icon.innerHTML = '✕';
        toast.style.borderRight = '4px solid #dc2626';
        break;
      case 'warning':
        icon.style.background = '#fef3c7';
        icon.style.color = '#d97706';
        icon.innerHTML = '⚠';
        toast.style.borderRight = '4px solid #d97706';
        break;
      default: // info
        icon.style.background = '#dbeafe';
        icon.style.color = '#2563eb';
        icon.innerHTML = 'ℹ';
        toast.style.borderRight = '4px solid #2563eb';
    }

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(closeBtn);
    c.appendChild(toast);

    // Animate in
    requestAnimationFrame(function() {
      toast.style.transform = 'translateY(0) scale(1)';
      toast.style.opacity = '1';
    });

    var timeout = setTimeout(function() { dismiss(toast); }, duration);

    closeBtn.addEventListener('click', function() { clearTimeout(timeout); dismiss(toast); });

    return toast;
  }

  function dismiss(toast) {
    toast.style.transform = 'translateY(-20px) scale(0.95)';
    toast.style.opacity = '0';
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 350);
  }

  return {
    success: function(msg, dur) { return show(msg, 'success', dur); },
    error: function(msg, dur) { return show(msg, 'error', dur); },
    warning: function(msg, dur) { return show(msg, 'warning', dur); },
    info: function(msg, dur) { return show(msg, 'info', dur); }
  };
})();
