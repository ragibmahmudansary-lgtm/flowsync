/* Orko portfolio — interactions */
(function () {
  'use strict';

  // Year in footer
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // Sticky header state + scroll progress
  var header = document.getElementById('siteHeader');
  var progress = document.getElementById('scrollProgress');
  var ticking = false;
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    if (header) header.classList.toggle('scrolled', y > 20);
    if (progress) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  // Mobile nav
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('mainNav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Project filters
  var filterButtons = document.querySelectorAll('.filter-btn');
  var cards = document.querySelectorAll('.project-card');
  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterButtons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var f = btn.getAttribute('data-filter');
      cards.forEach(function (card) {
        var show = f === 'all' || card.getAttribute('data-category') === f;
        card.classList.toggle('hidden', !show);
      });
    });
  });

  // Reveal on scroll
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.service-card, .project-card, .step, .about-copy, .about-panel, .contact-copy, .contact-form, .section-head').forEach(function (el) {
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  // Hide any other broken image (e.g. headshot before it is copied in)
  document.querySelectorAll('img:not(.project-media img)').forEach(function (img) {
    img.addEventListener('error', function () { img.style.display = 'none'; });
    if (img.complete && img.naturalWidth === 0) img.style.display = 'none';
  });

  // Missing image fallback — show gradient placeholder instead of broken icon
  document.querySelectorAll('.project-media img').forEach(function (img) {
    var media = img.parentElement;
    media.setAttribute('data-label', (img.getAttribute('alt') || 'PROJECT IMAGE').toUpperCase().slice(0, 28));
    img.addEventListener('error', function () {
      img.style.display = 'none';
      media.classList.add('img-missing');
    });
    if (img.complete && img.naturalWidth === 0) {
      img.style.display = 'none';
      media.classList.add('img-missing');
    }
  });

  // Count-up for hero stats (only when visible)
  var stats = document.querySelectorAll('.stat strong[data-count]');
  if ('IntersectionObserver' in window && stats.length) {
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = parseInt(el.getAttribute('data-count'), 10) || 0;
        var start = 0, duration = 1100, t0 = performance.now();
        function frame(now) {
          var p = Math.min((now - t0) / duration, 1);
          el.textContent = Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3))) + (p === 1 ? '' : '');
          if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        sio.unobserve(el);
      });
    }, { threshold: 0.5 });
    stats.forEach(function (s) { sio.observe(s); });
  }

  // Contact form -> mailto fallback
  // REPLACE: set your real email in index.html AND here.
  var CONTACT_EMAIL = 'ragibmahmudansary@gmail.com';
  var form = document.getElementById('contactForm');
  var note = document.getElementById('formNote');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var name = (data.get('name') || '').toString().trim();
      var email = (data.get('email') || '').toString().trim();
      var service = (data.get('service') || '').toString();
      var message = (data.get('message') || '').toString().trim();

      if (!name || !email || !message) {
        note.textContent = 'Please fill in your name, email and message.';
        note.classList.remove('success');
        return;
      }

      var subject = 'Project enquiry — ' + service + ' — ' + name;
      var body = 'Name: ' + name + '\nEmail: ' + email + '\nService: ' + service + '\n\n' + message;
      window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      note.textContent = 'Your email app should open with the message ready. If it did not, email ' + CONTACT_EMAIL + ' directly.';
      note.classList.add('success');
    });
  }
})();
