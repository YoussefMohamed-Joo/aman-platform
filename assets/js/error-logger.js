(function () {
  var queue = [];
  var sending = false;

  function sendToBackend(data) {
    queue.push(data);
    if (sending) return;
    sending = true;
    (function process() {
      if (!queue.length) { sending = false; return; }
      var batch = queue.splice(0, 5);
      var payload = JSON.stringify(batch);
      var base = window.AMAN_BACKEND_URL || window.location.origin;
      var xhr = new XMLHttpRequest();
      xhr.open('POST', base + '/api/log-client-error', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function () { process(); };
      xhr.onerror = function () { process(); };
      xhr.send(payload);
    })();
  }

  window.onerror = function (msg, source, line, col, error) {
    sendToBackend({
      message: msg,
      source: source,
      line: line,
      col: col,
      stack: error && error.stack ? error.stack : '',
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    });
    return false;
  };

  window.addEventListener('unhandledrejection', function (e) {
    var reason = e.reason || {};
    sendToBackend({
      message: reason.message || String(reason),
      stack: reason.stack || '',
      type: 'unhandledrejection',
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    });
  });

  var origConsoleError = console.error;
  console.error = function () {
    var args = Array.prototype.slice.call(arguments);
    var msg = args.map(function (a) { return typeof a === 'string' ? a : JSON.stringify(a); }).join(' ');
    sendToBackend({
      message: msg,
      type: 'console.error',
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    });
    origConsoleError.apply(console, args);
  };
})();