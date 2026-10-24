/* 智能注浆开采模型 · 展示网站交互脚本（零依赖） */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- 明暗主题切换 ---------- */
  var themeToggle = document.getElementById('theme-toggle');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) { /* ignore */ }
      if (themeMeta) themeMeta.setAttribute('content', next === 'dark' ? '#0e1418' : '#f6f8fa');
    });
  }

  /* ---------- 移动端菜单 ---------- */
  var mobileToggle = document.getElementById('mobile-toggle');
  var navLinks = document.getElementById('nav-links');
  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      mobileToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
    });
    navLinks.addEventListener('click', function (e) {
      if (e.target.closest('.nav-link')) {
        navLinks.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileToggle.setAttribute('aria-label', '打开菜单');
      }
    });
  }

  /* ---------- 滚动高亮（scroll spy） ---------- */
  var navLinkEls = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
  var spySections = Array.prototype.slice.call(document.querySelectorAll('section[id]'));
  function updateSpy() {
    var pos = window.scrollY + 140;
    var current = '';
    spySections.forEach(function (s) {
      if (s.offsetTop <= pos) current = s.id;
    });
    navLinkEls.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current);
    });
  }
  window.addEventListener('scroll', updateSpy, { passive: true });
  updateSpy();

  /* ---------- 滚动驱动动画（可倒放 · 多变体 · 交错 + 视差层次） ---------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var variants = ['up', 'left', 'right', 'grow', 'curtain', 'swoosh', 'radiate', 'flip', 'fade'];

  revealEls.forEach(function (el) {
    // 同容器内的 reveal 子项作为一组，用于变体分配与交错
    var sibs = el.parentElement
      ? Array.prototype.slice.call(el.parentElement.children)
          .filter(function (c) { return c.classList.contains('reveal'); })
      : [el];
    var idx = Math.max(0, sibs.indexOf(el));

    // 变体：未显式指定 data-reveal 时按顺序循环分配
    if (!el.hasAttribute('data-reveal')) {
      el.setAttribute('data-reveal', variants[idx % variants.length]);
    }
    el._stagger = Math.min(idx, 5) * 20; // 像素级交错，靠后的元素稍晚进入
  });

  // 视差层次：标题相对内容缓慢漂移，形成“一页页深入”的纵深
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll('.section-head, .hero-inner'));
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var animTicking = false;
  function paintScroll() {
    animTicking = false;
    var vh = window.innerHeight || 1;
    var win = 0.3 * vh; // 元素进入视口后快速完成，避免长时间停留在半透明状态

    for (var i = 0; i < revealEls.length; i++) {
      var el = revealEls[i];
      var top = el.getBoundingClientRect().top + (el._stagger || 0);
      var p = (vh - top) / win;
      p = p < 0 ? 0 : (p > 1 ? 1 : p);
      el.style.setProperty('--p', p.toFixed(3));
    }

    for (var j = 0; j < parallaxEls.length; j++) {
      var pe = parallaxEls[j];
      var r = pe.getBoundingClientRect();
      var center = r.top + r.height / 2 - vh / 2;
      var speed = pe.classList.contains('hero-inner') ? 0.1 : 0.06;
      pe.style.translate = '0 ' + (center * speed).toFixed(1) + 'px';
    }
  }

  function onScrollAnim() {
    if (!animTicking) {
      animTicking = true;
      requestAnimationFrame(paintScroll);
    }
  }

  if (reduceMotion) {
    revealEls.forEach(function (el) { el.style.setProperty('--p', '1'); });
  } else {
    window.addEventListener('scroll', onScrollAnim, { passive: true });
    window.addEventListener('resize', onScrollAnim, { passive: true });
    window.addEventListener('load', onScrollAnim);
    paintScroll();
  }

  /* ---------- 回到顶部 ---------- */
  var backTop = document.getElementById('back-to-top');
  function toggleBackTop() {
    if (backTop) backTop.classList.toggle('show', window.scrollY > 620);
  }
  window.addEventListener('scroll', toggleBackTop, { passive: true });
  toggleBackTop();
  if (backTop) {
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- 图片灯箱 ---------- */
  var lightbox = document.getElementById('lightbox');
  if (lightbox) {
    var lightboxImg = document.getElementById('lightbox-img');
    var closeBtn = document.getElementById('lightbox-close');
    var prevBtn = document.getElementById('lightbox-prev');
    var nextBtn = document.getElementById('lightbox-next');
    var items = Array.prototype.slice.call(document.querySelectorAll('.gallery-item img'));
    var current = -1;

    function open(i) {
      current = i;
      lightboxImg.src = items[i].src;
      lightboxImg.alt = items[i].alt;
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    function step(d) {
      if (!items.length) return;
      current = (current + d + items.length) % items.length;
      lightboxImg.src = items[current].src;
      lightboxImg.alt = items[current].alt;
    }

    items.forEach(function (img, i) {
      var fig = img.closest('.gallery-item');
      if (fig) fig.addEventListener('click', function () { open(i); });
    });
    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); step(1); });
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
  }

  /* ---------- 页脚年份 ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
