(function() {
  var btn = document.createElement('button');
  btn.id = 'backToTop';
  btn.innerHTML = '↑';
  btn.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:9999;width:50px;height:50px;border-radius:50%;background:#1e40af;color:white;font-size:24px;font-weight:bold;border:none;cursor:pointer;box-shadow:0 4px 15px rgba(30,64,175,0.4);opacity:0;visibility:hidden;transform:translateY(20px);transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);display:flex;align-items:center;justify-content:center;';
  btn.onmouseenter = function() { this.style.transform = 'scale(1.1)'; };
  btn.onmouseleave = function() { this.style.transform = 'scale(1)'; };
  document.body.appendChild(btn);

  window.addEventListener('scroll', function() {
    if (window.scrollY > 400) {
      btn.style.opacity = '1';
      btn.style.visibility = 'visible';
      btn.style.transform = 'translateY(0) scale(1)';
    } else {
      btn.style.opacity = '0';
      btn.style.visibility = 'hidden';
      btn.style.transform = 'translateY(20px) scale(0.9)';
    }
  });

  btn.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
