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
  let sideMotion = null;
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
    sideMotion?.setActive(id);
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
      lastFrameX: 0, lastFrameY: 0, pointerVX: 0, pointerVY: 0,
      lastMoveTime: 0, lastMoveX: 0, lastMoveY: 0, hoverIndex: -1,
    };
    const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
    const overflow = (value, limit) => limit * value / (limit + Math.abs(value)) / 2;
    function elasticX(value) {
      // Keep Discourum's elastic snap resistance, but allow dragging beyond
      // the track. The physical viewport edge, not the selected-tab range,
      // is the final limit. This matters for the first and last tabs.
      const limit = Math.max(innerWidth, nav.offsetWidth, 1);
      const resisted = value < state.min
        ? state.min - overflow(state.min - value, limit)
        : value > state.max
          ? state.max + overflow(value - state.max, limit)
          : value;
      const left = nav.getBoundingClientRect().left;
      return clamp(resisted, 8 - left, innerWidth - left - state.width - 8);
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
        if (!state.dragging) [state.x, state.vx] = spring(state.x, state.vx, state.targetX, trackSpring, dt);
        [state.ghost, state.vg] = spring(state.ghost, state.vg, state.ghostTarget, trackSpring, dt);
        [state.y, state.vy] = spring(state.y, state.vy, state.targetY, crossSpring, dt);
        [state.scale, state.vs] = spring(state.scale, state.vs, state.targetScale, pressSpring, dt);
        const blend = 1 - Math.exp(-dt / .025);
        const lastVx = state.velX, lastVy = state.velY;
        // Track actual frame-to-frame movement. The old implementation read
        // x after pointermove had already assigned it, yielding zero motion
        // and thus no visible acceleration-induced elastic deformation.
        const deltaVX = (state.x - state.lastFrameX) / dt;
        const deltaVY = (state.y - state.lastFrameY) / dt;
        state.lastFrameX = state.x;
        state.lastFrameY = state.y;
        state.velX += (deltaVX - state.velX) * blend;
        state.velY += (deltaVY - state.velY) * blend;
        const accel = directionalStrain((state.velX - lastVx) / dt, (state.velY - lastVy) / dt, .000012, .16);
        const finger = state.active && state.dragging
          ? directionalStrain(state.pointerVX, state.pointerVY, .000028, .12)
          : [0, 0];
        const pull = state.active
          ? directionalStrain(state.x - clamp(state.x, state.min, state.max), state.y, .0018, .24)
          : [0, 0];
        let targetU = accel[0] + finger[0] + pull[0];
        let targetV = accel[1] + finger[1] + pull[1];
        const pointerDecay = Math.exp(-dt / .055);
        state.pointerVX *= pointerDecay;
        state.pointerVY *= pointerDecay;
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
        state.lastFrameX = state.x;
        state.lastFrameY = state.y;
      }
      state.ready = true;
      paint();
      start();
    }
    function setActive(id) {
      const index = links.findIndex(link => link.dataset.section === id);
      if (index < 0 || !state.ready || state.active) return;
      if (state.hoverIndex >= 0) return; // Don't fight a mouse-hover preview.
      state.targetX = state.ghostTarget = state.positions[index];
      if (reduced.matches) { state.x = state.ghost = state.targetX; paint(); }
      else start();
    }
    function handleDown(e) {
      const link = e.target.closest('.mobile-nav-link');
      // Touch/stylus owns the drag gesture. Mouse and trackpad never capture
      // anchors: they use a magnetic hover preview and normal click instead.
      if (e.pointerType === 'mouse' || reduced.matches || !link || state.active || e.button > 0 || !state.ready) return;
      const index = links.indexOf(link);
      state.pointer = e.pointerId;
      state.touched = index;
      state.active = true;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.dragX = state.positions[index];
      state.dragging = false;
      state.pointerVX = state.pointerVY = 0;
      state.lastMoveTime = e.timeStamp;
      state.lastMoveX = e.clientX;
      state.lastMoveY = e.clientY;
      state.targetY = 0;
      state.targetScale = reduced.matches ? 1 : 1.26;
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
      const elapsed = Math.max(1 / 240, Math.min(.05, (e.timeStamp - state.lastMoveTime) / 1000 || 1 / 60));
      state.pointerVX = (e.clientX - state.lastMoveX) / elapsed;
      state.pointerVY = (e.clientY - state.lastMoveY) / elapsed;
      state.lastMoveTime = e.timeStamp;
      state.lastMoveX = e.clientX;
      state.lastMoveY = e.clientY;
      state.x = elasticX(state.dragX + dx);
      state.vx = 0;
      // The former 60px cross-axis limit only allowed ~30px of travel.
      // Match Discourum's 500px elastic range, bounded by the viewport.
      const navRect = nav.getBoundingClientRect();
      const pillTop = navRect.top + links[0].offsetTop;
      const upper = Math.max(-220, 9 - pillTop);
      const lower = Math.min(75, innerHeight - pillTop - state.height - 8);
      state.y = clamp(overflow(dy, 500), upper, lower);
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
    function hoverMouse(e) {
      if (e.pointerType !== 'mouse' || state.active || !state.ready || reduced.matches) return;
      const rect = nav.getBoundingClientRect();
      const y = e.clientY - rect.top;
      if (y < -12 || y > rect.height + 12) return;
      const index = indexAt(e.clientX);
      const link = links[index];
      const centerX = rect.left + link.offsetLeft + link.offsetWidth / 2;
      const centerY = rect.top + link.offsetTop + link.offsetHeight / 2;
      const pullX = clamp((e.clientX - centerX) * .17, -10, 10);
      const pullY = clamp((e.clientY - centerY) * .15, -5, 5);
      state.hoverIndex = index;
      state.targetX = state.positions[index] + pullX;
      state.targetY = pullY;
      state.targetScale = 1.085;
      state.ghostTarget = state.positions[index];
      nav.classList.add('mouse-magnetic');
      showPreview(index);
      links.forEach((item, i) => item.classList.toggle('highlighted', i === index));
      start();
    }
    function leaveMouse(e) {
      if (e.pointerType !== 'mouse' || state.active) return;
      state.hoverIndex = -1;
      state.targetY = 0;
      state.targetScale = 1;
      const selected = Math.max(0, links.findIndex(link => link.classList.contains('active')));
      state.targetX = state.ghostTarget = state.positions[selected];
      links.forEach(link => link.classList.remove('highlighted'));
      nav.classList.remove('mouse-magnetic');
      showPreview(-1);
      if (reduced.matches) { state.x = state.targetX; state.y = 0; state.scale = 1; paint(); }
      else start();
    }
    nav.addEventListener('dragstart', e => e.preventDefault());
    nav.addEventListener('pointerdown', handleDown);
    nav.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse') hoverMouse(e);
      else handleMove(e);
    });
    nav.addEventListener('pointerleave', leaveMouse);
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


  // Pointer/trackpad magnetic navigation for the desktop sidebar. No dragging
  // and no pointer capture, so anchors retain normal browser semantics.
  function setupSideNavMagnet() {
    const nav = $('.side-nav');
    const indicator = nav?.querySelector('.side-nav-indicator');
    if (!nav || !indicator) return null;
    const items = Array.from(nav.querySelectorAll('.nav-link'));
    const fine = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 651px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const s = { y: 0, x: 0, vy: 0, vx: 0, targetY: 0, targetX: 0, frame: 0, last: 0, hover: -1, ready: false };
    function selectedIndex() { return Math.max(0, items.findIndex(el => el.classList.contains('active'))); }
    function paint() {
      indicator.style.transform = `translate3d(${s.x.toFixed(2)}px,${s.y.toFixed(2)}px,0)`;
    }
    function tick(t) {
      s.frame = 0;
      if (!fine.matches || reduced.matches) return;
      const dt = Math.min(.033, s.last ? (t-s.last)/1000 : 1/60);
      s.last = t;
      for(let n=0; n<Math.max(1,Math.ceil(dt/(1/120))); n++) {
        const step = dt/Math.max(1,Math.ceil(dt/(1/120)));
        s.vy += (420*(s.targetY-s.y)-25*s.vy)*step;
        s.vx += (380*(s.targetX-s.x)-26*s.vx)*step;
        s.y += s.vy*step;
        s.x += s.vx*step;
      }
      paint();
      if (Math.abs(s.y-s.targetY)> .08 || Math.abs(s.x-s.targetX)>.08 || Math.abs(s.vx)+Math.abs(s.vy)>.3) start();
      else {s.x=s.targetX;s.y=s.targetY;s.vx=s.vy=0;s.last=0;paint();}
    }
    function start() { if (!s.frame && fine.matches && !reduced.matches) s.frame = requestAnimationFrame(tick); }
    function jump() {
      if (!fine.matches || !nav.offsetWidth) return;
      const item = items[selectedIndex()];
      if (!item) return;
      indicator.style.height = item.offsetHeight + 'px';
      indicator.style.width = item.offsetWidth + 'px';
      s.targetY = item.offsetTop;
      s.targetX = item.offsetLeft;
      if (!s.ready || reduced.matches) {s.y=s.targetY;s.x=s.targetX;paint();}
      else start();
      s.ready = true;
    }
    function setActive() { if (s.hover === -1) jump(); }
    function reset() {
      s.hover=-1;
      nav.classList.remove('mouse-magnetic');
      items.forEach(el => {el.classList.remove('magnet-hover');el.style.removeProperty('--pull-x');el.style.removeProperty('--pull-y');});
      jump();
    }
    nav.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !fine.matches) return;
      const item = e.target.closest('.nav-link');
      if (!item || !items.includes(item)) {reset();return;}
      const i = items.indexOf(item), r = item.getBoundingClientRect();
      const dx=clamp((e.clientX-(r.left+r.width/2))*.095,-8,8);
      const dy=clamp((e.clientY-(r.top+r.height/2))*.12,-4,4);
      s.hover=i;
      s.targetX=item.offsetLeft+dx;
      s.targetY=item.offsetTop+dy;
      items.forEach((el,k) => {
        el.classList.toggle('magnet-hover',i===k);
        if (i === k) {el.style.setProperty('--pull-x',(dx*.32).toFixed(2)+'px');el.style.setProperty('--pull-y',(dy*.32).toFixed(2)+'px');}
        else {el.style.removeProperty('--pull-x');el.style.removeProperty('--pull-y');}
      });
      nav.classList.add('mouse-magnetic');
      start();
    });
    nav.addEventListener('pointerleave', e => {if (e.pointerType === 'mouse') reset();});
    window.addEventListener('resize', jump, {passive:true});
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(jump).observe(nav);
    if (fine.addEventListener) fine.addEventListener('change', reset);
    if (reduced.addEventListener) reduced.addEventListener('change', jump);
    requestAnimationFrame(jump);
    return {setActive};
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
  sideMotion = setupSideNavMagnet();
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
