(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const content = window.SITE_CONTENT || {};
  const sections = ['home', 'about', 'research', 'projects', 'notes', 'contact'];
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const safeRead = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const safeWrite = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  let language = safeRead('personal-site-language') === 'en' ? 'en' : 'zh';
  let theme = ['system', 'light', 'dark'].includes(safeRead('personal-site-theme')) ? safeRead('personal-site-theme') : 'system';
  let currentSection = 'home';
  let navMotion = null;
  let anchorScrollLock = null;

  function applyLanguage() {
    const strings = content[language] || {};
    root.lang = language === 'zh' ? 'zh-CN' : 'en';
    $$('[data-text]').forEach((node) => {
      const value = strings[node.dataset.text];
      if (typeof value === 'string') node.textContent = value;
    });
    // Preserve the colored period and the intended line break.
    $$('[id$="-title"][data-text]').forEach((node) => {
      const value = strings[node.dataset.text];
      if (typeof value === 'string') {
        node.replaceChildren(document.createTextNode(value), Object.assign(document.createElement('span'), { className: 'title-period', textContent: '.' }));
      }
    });
    const contactTitle = $('#contact-title');
    if (contactTitle && strings.contactTitle) {
      contactTitle.replaceChildren();
      strings.contactTitle.split('\n').forEach((line, index) => {
        if (index) contactTitle.appendChild(document.createElement('br'));
        contactTitle.appendChild(document.createTextNode(line));
      });
    }
    $('#language-label').textContent = language === 'zh' ? 'EN' : '中';
    $('#language-switch').setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换到中文');
    $('#language-switch').title = language === 'zh' ? 'Switch to English' : '切换到中文';
    $('meta[name="description"]').content = language === 'zh' ? '个人主页 · 研究、项目与日常记录' : 'Personal space for research, projects, and notes';
    document.title = language === 'zh' ? '个人主页 · Personal Space' : 'Personal Space · Portfolio';
    updateActiveSection(currentSection);
    updateThemeLabel();
    $('#back-top').setAttribute('aria-label', strings.backTop || 'Back to top');
    $('#back-top').title = strings.backTop || 'Back to top';
  }

  function resolvedTheme() { return theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme; }
  function updateThemeLabel() {
    const strings = content[language] || {};
    const label = strings['theme' + theme[0].toUpperCase() + theme.slice(1)] || 'Theme';
    const button = $('#theme-switch');
    button.setAttribute('aria-label', (strings.themeToggle || 'Switch theme') + ' · ' + label);
    button.title = label;
    const icon = theme === 'system' ? 'monitor' : (theme === 'light' ? 'sun' : 'moon');
    $('#theme-icon use').setAttribute('href', '#icon-' + icon);
  }
  function applyTheme() {
    const actual = resolvedTheme();
    root.dataset.theme = actual;
    root.dataset.themePreference = theme;
    $('meta[name="theme-color"]').content = actual === 'dark' ? '#101418' : '#F8FAFD';
    updateThemeLabel();
  }
  function updateActiveSection(id) {
    if (!sections.includes(id)) return;
    currentSection = id;
    $$('.nav-link, .mobile-nav-link').forEach((item) => {
      const active = item.dataset.section === id;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'location');
      else item.removeAttribute('aria-current');
    });
    navMotion?.setActive(id);
    const strings = content[language] || {};
    const labelKey = 'nav' + id[0].toUpperCase() + id.slice(1);
    $('#current-section').textContent = strings[labelKey] || id;
  }
  function navigateToSection(id) {
    const element = document.getElementById(id);
    if (!element) return;
    updateActiveSection(id);
    anchorScrollLock = { id, until: performance.now() + 2600 };
    if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    element.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
  // Mobile bottom track: a web adaptation of Discourum's elastic horizontal
  // indicator (track/press springs, ghost snap, overflow resistance and strain).
  function setupMobileNav() {
    const nav = $('.mobile-nav');
    if (!nav) return null;
    const links = Array.from(nav.querySelectorAll('.mobile-nav-link'));
    const ghost = nav.querySelector('.mobile-nav-ghost');
    const indicator = nav.querySelector('.mobile-nav-indicator');
    const stretch = nav.querySelector('.mobile-nav-indicator-stretch');
    const surface = nav.querySelector('.mobile-nav-indicator-surface');
    const ripple = nav.querySelector('.mobile-nav-ripple');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const trackSpring = { damping: 19, stiffness: 300, mass: .85 };
    const pressSpring = { damping: 20, stiffness: 280, mass: .7 };
    const crossSpring = { damping: 12, stiffness: 180, mass: .8 };
    const state = {
      positions: [], width: 0, height: 0, min: 0, max: 0,
      x: 0, vx: 0, targetX: 0, y: 0, vy: 0, targetY: 0,
      ghost: 0, vg: 0, ghostTarget: 0, scale: 1, vs: 0, targetScale: 1,
      u: 0, v: 0, du: 0, dv: 0, dx: 0, dy: 0, velX: 0, velY: 0,
      pointer: null, touched: -1, preview: -1, startX: 0, startY: 0,
      dragX: 0, dragging: false, active: false, ready: false,
      rippleX: 0, rippleY: 0, rippleR: 0, rippleP: 0, rippleStart: -1,
      last: 0, frame: 0, skipClickUntil: 0,
    };
    const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
    const overflow = (value, limit) => limit * value / (limit + Math.abs(value)) / 2;
    function elasticX(value) {
      if (value < state.min) return state.min - overflow(state.min - value, Math.max(innerWidth, 1));
      if (value > state.max) return state.max + overflow(value - state.max, Math.max(innerWidth, 1));
      return value;
    }
    function spring(pos, vel, target, config, dt) {
      const acceleration = (config.stiffness * (target - pos) - config.damping * vel) / config.mass;
      const nextVel = vel + acceleration * dt;
      return [pos + nextVel * dt, nextVel];
    }
    function directionalStrain(x, y, gain, cap) {
      const length = Math.hypot(x, y);
      if (length < .000001) return [0, 0];
      const amount = Math.min(cap, length * gain);
      const nx = x / length, ny = y / length;
      return [amount * (nx * nx - ny * ny), amount * 2 * nx * ny];
    }
    function nearestIndex(x) {
      let closest = 0, distance = Infinity;
      state.positions.forEach((position, i) => {
        const delta = Math.abs(position - x);
        if (delta < distance) { closest = i; distance = delta; }
      });
      return closest;
    }
    function indexAt(pageX) {
      const x = pageX - nav.getBoundingClientRect().left;
      let nearest = 0, dist = Infinity;
      links.forEach((link, i) => {
        const center = link.offsetLeft + link.offsetWidth / 2;
        if (Math.abs(center - x) < dist) { dist = Math.abs(center - x); nearest = i; }
      });
      return nearest;
    }
    function showPreview(index) {
      if (state.preview === index) return;
      state.preview = index;
      nav.classList.toggle('interacting', state.active);
      links.forEach((link, i) => link.classList.toggle('highlighted', state.active && i === index));
    }
    function paint() {
      const { x, y, ghost: ghostX, scale, u, v } = state;
      const length = Math.min(.32, Math.hypot(u, v));
      const angle = length > .003 ? .5 * Math.atan2(v, u) : 0;
      const stretchRatio = Math.exp(length);
      indicator.style.transform = `translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0) rotate(${angle.toFixed(5)}rad)`;
      stretch.style.transform = `scale(${(stretchRatio * scale).toFixed(5)},${(scale / stretchRatio).toFixed(5)})`;
      surface.style.transform = `rotate(${(-angle).toFixed(5)}rad)`;
      ghost.style.transform = `translate3d(${ghostX.toFixed(3)}px,0,0)`;
      ghost.style.opacity = state.active ? '1' : '0';
      if (state.active && state.rippleStart >= 0) {
        const elapsed = performance.now() - state.rippleStart;
        const progress = clamp(elapsed / 280, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const r = state.rippleR;
        ripple.style.width = `${2 * r}px`;
        ripple.style.height = `${2 * r}px`;
        ripple.style.left = `${state.rippleX - r}px`;
        ripple.style.top = `${state.rippleY - r}px`;
        ripple.style.opacity = String(clamp(1 - Math.max(0, elapsed - 220) / 140, 0, 1));
        ripple.style.transform = `scale(${eased.toFixed(4)})`;
      } else {
        ripple.style.opacity = '0';
      }
    }
    function run(timestamp) {
      state.frame = 0;
      if (!state.ready || nav.offsetWidth === 0 || reduced.matches) { state.last = 0; return; }
      const elapsed = state.last ? Math.min((timestamp - state.last) / 1000, 1 / 30) : 1 / 60;
      state.last = timestamp;
      const steps = Math.max(1, Math.ceil(elapsed / (1 / 120)));
      const dt = elapsed / steps;
      for (let i = 0; i < steps; i++) {
        const oldX = state.x, oldY = state.y;
        if (!state.dragging) [state.x, state.vx] = spring(state.x, state.vx, state.targetX, trackSpring, dt);
        [state.ghost, state.vg] = spring(state.ghost, state.vg, state.ghostTarget, trackSpring, dt);
        [state.y, state.vy] = spring(state.y, state.vy, state.targetY, crossSpring, dt);
        [state.scale, state.vs] = spring(state.scale, state.vs, state.targetScale, pressSpring, dt);
        const blend = 1 - Math.exp(-dt / .025);
        const lastVx = state.velX, lastVy = state.velY;
        state.velX += (((state.x - oldX) / dt) - state.velX) * blend;
        state.velY += (((state.y - oldY) / dt) - state.velY) * blend;
        const accel = directionalStrain((state.velX - lastVx) / dt, (state.velY - lastVy) / dt, .000012, .16);
        const pull = state.active ? directionalStrain(state.x - clamp(state.x, state.min, state.max), state.y, .0018, .24) : [0, 0];
        let targetU = accel[0] + pull[0], targetV = accel[1] + pull[1];
        const magnitude = Math.hypot(targetU, targetV);
        if (magnitude > .28) { targetU *= .28 / magnitude; targetV *= .28 / magnitude; }
        // Exact under-damped strain spring from Discourum's deformation model.
        const decay = 4, frequency = 24, attenuation = Math.exp(-decay * dt);
        const sine = Math.sin(frequency * dt) / frequency;
        const a = attenuation * (Math.cos(frequency * dt) + decay * sine);
        const b = attenuation * sine;
        const c = -attenuation * (frequency * frequency + decay * decay) * sine;
        const d = attenuation * (Math.cos(frequency * dt) - decay * sine);
        const u = targetU + a * (state.u - targetU) + b * state.du;
        const v = targetV + a * (state.v - targetV) + b * state.dv;
        const du = c * (state.u - targetU) + d * state.du;
        const dv = c * (state.v - targetV) + d * state.dv;
        state.u = u; state.v = v; state.du = du; state.dv = dv;
      }
      paint();
      const stillMoving = state.active ||
        Math.abs(state.x - state.targetX) + Math.abs(state.vx) * .01 > .06 ||
        Math.abs(state.ghost - state.ghostTarget) + Math.abs(state.vg) * .01 > .06 ||
        Math.abs(state.y) + Math.abs(state.vy) * .01 > .06 ||
        Math.abs(state.scale - state.targetScale) + Math.abs(state.vs) * .01 > .0008 ||
        Math.abs(state.u) + Math.abs(state.v) + Math.abs(state.du) * .01 + Math.abs(state.dv) * .01 > .001;
      if (stillMoving) start();
      else {
        state.x = state.targetX; state.y = 0; state.ghost = state.ghostTarget;
        state.scale = state.targetScale; state.vx = state.vy = state.vg = state.vs = 0;
        state.u = state.v = state.du = state.dv = 0;
        paint(); state.last = 0;
      }
    }
    function start() {
      if (state.frame || reduced.matches || !state.ready) return;
      state.frame = requestAnimationFrame(run);
    }
    function layout() {
      if (!nav.offsetWidth || !links[0]?.offsetWidth) return;
      const oldWidth = state.width;
      state.width = links[0].offsetWidth;
      state.height = links[0].offsetHeight;
      state.positions = links.map(link => link.offsetLeft);
      state.min = state.positions[0];
      state.max = state.positions[state.positions.length - 1];
      ghost.style.width = indicator.style.width = `${state.width}px`;
      ghost.style.height = indicator.style.height = `${state.height}px`;
      ghost.style.top = indicator.style.top = `${links[0].offsetTop}px`;
      const selected = Math.max(0, links.findIndex(link => link.classList.contains('active')));
      const target = state.positions[selected];
      state.targetX = state.ghostTarget = target;
      if (!state.ready || oldWidth !== state.width) {
        state.x = state.ghost = target;
        state.y = state.targetY = 0;
        state.vx = state.vg = state.vy = 0;
        state.u = state.v = state.du = state.dv = 0;
      }
      state.ready = true;
      paint();
      start();
    }
    function setActive(id) {
      const index = links.findIndex(link => link.dataset.section === id);
      if (index < 0 || !state.ready || state.active) return;
      state.targetX = state.ghostTarget = state.positions[index];
      if (reduced.matches) { state.x = state.ghost = state.targetX; paint(); }
      else start();
    }
    function handleDown(e) {
      const link = e.target.closest('.mobile-nav-link');
      if (!link || state.active || reduced.matches || e.button > 0 || !state.ready) return;
      const index = links.indexOf(link);
      state.pointer = e.pointerId;
      state.touched = index;
      state.active = true;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.dragX = state.positions[index];
      state.dragging = false;
      state.targetY = 0;
      state.targetScale = 1.26;
      state.targetX = state.positions[index];
      state.ghostTarget = state.positions[index];
      state.rippleStart = -1;
      const navRect = nav.getBoundingClientRect();
      const pointerX = e.clientX - navRect.left - state.x;
      const pointerY = e.clientY - navRect.top - links[0].offsetTop - state.y;
      if (pointerX >= 0 && pointerX <= state.width && pointerY >= 0 && pointerY <= state.height) {
        state.rippleX = pointerX; state.rippleY = pointerY;
        state.rippleR = Math.max(state.height / 2,
          Math.hypot(pointerX, pointerY), Math.hypot(state.width - pointerX, pointerY),
          Math.hypot(pointerX, state.height - pointerY), Math.hypot(state.width - pointerX, state.height - pointerY));
        state.rippleStart = performance.now();
      }
      nav.classList.add('interacting');
      showPreview(index);
      try { nav.setPointerCapture(e.pointerId); } catch { /* Some mouse emulators disallow capture. */ }
      start();
    }
    function handleMove(e) {
      if (!state.active || e.pointerId !== state.pointer) return;
      const dx = e.clientX - state.startX, dy = e.clientY - state.startY;
      if (!state.dragging && Math.hypot(dx, dy) > 5) {
        state.dragging = true;
        state.rippleStart = -1;
      }
      if (!state.dragging) return;
      state.x = elasticX(state.dragX + dx);
      state.vx = 0;
      state.y = overflow(dy, 60);
      state.vy = 0;
      state.targetY = state.y;
      const index = nearestIndex(clamp(state.x, state.min, state.max));
      state.ghostTarget = state.positions[index];
      showPreview(index);
      start();
    }
    function finish(e, cancelled = false) {
      if (!state.active || e.pointerId !== state.pointer) return;
      const dx = e.clientX - state.startX, dy = e.clientY - state.startY;
      const index = cancelled ? Math.max(0, links.findIndex(link => link.classList.contains('active')))
        : !state.dragging || Math.hypot(dx, dy) < 5 ? state.touched
        : nearestIndex(clamp(state.x, state.min, state.max));
      state.pointer = null;
      state.active = false;
      state.dragging = false;
      state.targetScale = 1;
      state.targetY = 0;
      state.targetX = state.ghostTarget = state.positions[index];
      state.rippleStart = -1;
      state.skipClickUntil = performance.now() + 500;
      nav.classList.remove('interacting');
      showPreview(-1);
      links.forEach(link => link.classList.remove('highlighted'));
      if (reduced.matches) { state.x = state.ghost = state.targetX; state.y = 0; state.scale = 1; paint(); }
      else start();
      if (!cancelled && links[index]) navigateToSection(links[index].dataset.section);
    }
    nav.addEventListener('dragstart', e => e.preventDefault());
    nav.addEventListener('pointerdown', handleDown);
    nav.addEventListener('pointermove', handleMove);
    nav.addEventListener('pointerup', e => finish(e));
    nav.addEventListener('pointercancel', e => finish(e, true));
    nav.addEventListener('lostpointercapture', e => finish(e, true));
    nav.addEventListener('click', e => {
      const link = e.target.closest('.mobile-nav-link');
      if (!link) return;
      e.preventDefault();
      if (performance.now() >= state.skipClickUntil) navigateToSection(link.dataset.section);
    });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(layout).observe(nav);
    window.addEventListener('resize', layout, { passive: true });
    if (reduced.addEventListener) reduced.addEventListener('change', layout);
    requestAnimationFrame(layout);
    return { setActive, layout };
  }

  $('#language-switch').addEventListener('click', () => {
    language = language === 'zh' ? 'en' : 'zh'; safeWrite('personal-site-language', language); applyLanguage();
  });
  $('#theme-switch').addEventListener('click', () => {
    theme = { system: 'light', light: 'dark', dark: 'system' }[theme];
    safeWrite('personal-site-theme', theme); applyTheme();
  });
  if (mq.addEventListener) mq.addEventListener('change', applyTheme);
  else if (mq.addListener) mq.addListener(applyTheme);
  $$('.nav-link').forEach(link => {
    link.addEventListener('click', () => { anchorScrollLock = null; updateActiveSection(link.dataset.section); });
  });
  navMotion = setupMobileNav();
  const backTop = $('#back-top');
  backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
  let scrollPending = false;
  function updateScroll() {
    scrollPending = false;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    $('#scroll-progress').style.width = (Math.max(0, Math.min(1, window.scrollY / max)) * 100) + '%';
    backTop.classList.toggle('visible', window.scrollY > 650);
    const threshold = window.scrollY + (window.innerWidth <= 650 ? 160 : 175);
    let active = 'home';
    for (const id of sections) {
      const element = document.getElementById(id);
      if (element && element.offsetTop <= threshold) active = id;
    }
    // Keep the final item active when the document cannot scroll past its anchor.
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 20) active = 'contact';
    if (anchorScrollLock) {
      const locked = document.getElementById(anchorScrollLock.id);
      const nearTarget = locked && Math.abs(locked.getBoundingClientRect().top - (window.innerWidth <= 650 ? 80 : 90)) < 110;
      const reachedEnd = anchorScrollLock.id === 'contact' && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 20;
      if (nearTarget || reachedEnd || performance.now() >= anchorScrollLock.until) anchorScrollLock = null;
      else return;
    }
    if (active !== currentSection) updateActiveSection(active);
  }
  function onScroll() {
    if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateScroll); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
      });
    }, { threshold: .06, rootMargin: '0px 0px 30px 0px' });
    $$('.reveal').forEach((item) => revealObserver.observe(item));
  } else { $$('.reveal').forEach((item) => item.classList.add('in-view')); }
  const year = String(new Date().getFullYear());
  $('#year').textContent = year;
  $('#year-side').textContent = year;
  applyTheme();
  applyLanguage();
  updateScroll();
})();
