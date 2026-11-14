/* Discourum-inspired elastic controls: magnetic mouse, tactile touch.
   Keep geometry on each native button/link so tab order, hitboxes and
   accessible labels never move with the visual effect. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mouseCapable = matchMedia('(hover: hover) and (pointer: fine)');
  const targets = Array.from(document.querySelectorAll(
    '.icon-button, .top-github, .hero-actions .button, .contact-actions .button, .back-top'
  ));
  if (!targets.length) return;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const states = targets.map((element) => ({
    element, x: 0, y: 0, vx: 0, vy: 0,
    targetX: 0, targetY: 0, scale: 1, targetScale: 1, vs: 0,
    u: 0, v: 0, du: 0, dv: 0,
    lastX: 0, lastY: 0, motionVX: 0, motionVY: 0,
    pointerVX: 0, pointerVY: 0, pressed: false, pointer: null,
    startX: 0, startY: 0, lastPointerX: 0, lastPointerY: 0,
    lastPointerTime: 0, dragging: false, suppressUntil: 0,
    rippleX: '50%', rippleY: '50%', rippleOpacity: 0,
  }));
  let activeMouse = null;
  const sidebar = document.querySelector('.sidebar');
  let frame = 0;
  let lastTime = 0;
  const elastic = (v, limit) => {
    const abs = Math.abs(v);
    // Small movements track the finger precisely. Beyond 28px, the
    // control progressively resists and caps travel rather than clipping.
    return Math.sign(v) * (abs <= 28 ? abs : 28 + limit * (abs - 28) / (limit + abs - 28));
  };
  function directionalStrain(x, y, gain, cap) {
    const len = Math.hypot(x, y);
    if (len < 1e-6) return [0, 0];
    const amount = Math.min(cap, len * gain), nx = x / len, ny = y / len;
    return [amount * (nx * nx - ny * ny), amount * 2 * nx * ny];
  }
  function spring(pos, velocity, target, stiffness, damping, mass, dt) {
    velocity += (stiffness * (target - pos) - damping * velocity) / mass * dt;
    return [pos + velocity * dt, velocity];
  }
  function paint(s) {
    const el = s.element;
    const size = Math.min(.28, Math.hypot(s.u, s.v));
    const angle = size > .0001 ? .5 * Math.atan2(s.v, s.u) : 0;
    const stretch = Math.exp(size);
    const stretchX = s.scale * stretch;
    const stretchY = s.scale / stretch;
    el.style.translate = `${s.x.toFixed(3)}px ${s.y.toFixed(3)}px`;
    // R(theta) diag(e^q,e^-q) R(-theta): true symmetric, area-preserving strain.
    el.style.transform = `rotate(${angle.toFixed(5)}rad) scale(${stretchX.toFixed(5)},${stretchY.toFixed(5)}) rotate(${(-angle).toFixed(5)}rad)`;
    el.style.setProperty('--elastic-ripple-x', s.rippleX);
    el.style.setProperty('--elastic-ripple-y', s.rippleY);
    el.style.setProperty('--elastic-ripple-opacity', s.rippleOpacity.toFixed(3));
  }
  function tick(time) {
    frame = 0;
    const elapsed = lastTime ? clamp((time - lastTime) / 1000, 1 / 240, 1 / 30) : 1 / 60;
    lastTime = time;
    const steps = Math.max(1, Math.ceil(elapsed / (1 / 120))), dt = elapsed / steps;
    let moving = false;
    for (const s of states) {
      for (let n = 0; n < steps; n++) {
        [s.x, s.vx] = spring(s.x, s.vx, s.targetX, 300, 19, .85, dt);
        [s.y, s.vy] = spring(s.y, s.vy, s.targetY, 180, 12, .8, dt);
        [s.scale, s.vs] = spring(s.scale, s.vs, s.targetScale, 280, 20, .7, dt);
        const blend = 1 - Math.exp(-dt / .025);
        const oldVX = s.motionVX, oldVY = s.motionVY;
        s.motionVX += ((s.x - s.lastX) / dt - s.motionVX) * blend;
        s.motionVY += ((s.y - s.lastY) / dt - s.motionVY) * blend;
        s.lastX = s.x; s.lastY = s.y;
        const accel = directionalStrain((s.motionVX - oldVX) / dt, (s.motionVY - oldVY) / dt, .000012, .16);
        const finger = s.pressed && s.dragging
          ? directionalStrain(s.pointerVX, s.pointerVY, .000025, .12) : [0, 0];
        const pull = s.pressed
          ? directionalStrain(s.x, s.y, .0012, .14) : [0, 0];
        let targetU = accel[0] + finger[0] + pull[0];
        let targetV = accel[1] + finger[1] + pull[1];
        const magnitude = Math.hypot(targetU, targetV);
        if (magnitude > .28) {
          targetU *= .28 / magnitude;
          targetV *= .28 / magnitude;
        }
        s.pointerVX *= Math.exp(-dt / .055);
        s.pointerVY *= Math.exp(-dt / .055);
        // Same underdamped traceless-strain solver used by Discourum.
        const decay = 4, frequency = 24, attenuation = Math.exp(-decay * dt);
        const sine = Math.sin(frequency * dt) / frequency, cosine = Math.cos(frequency * dt);
        const a = attenuation * (cosine + decay * sine);
        const b = attenuation * sine;
        const c = -attenuation * (frequency * frequency + decay * decay) * sine;
        const d = attenuation * (cosine - decay * sine);
        const u = targetU + a * (s.u - targetU) + b * s.du;
        const v = targetV + a * (s.v - targetV) + b * s.dv;
        const du = c * (s.u - targetU) + d * s.du;
        const dv = c * (s.v - targetV) + d * s.dv;
        s.u = u; s.v = v; s.du = du; s.dv = dv;
      }
      // Avoid expensive layout or paint on idle controls.
      if (s.pressed || Math.abs(s.x - s.targetX) + Math.abs(s.y - s.targetY) > .05 ||
          Math.abs(s.vx) + Math.abs(s.vy) > .4 ||
          Math.abs(s.scale - s.targetScale) > .001 || Math.abs(s.vs) > .01 ||
          Math.abs(s.u) + Math.abs(s.v) + .01 * (Math.abs(s.du) + Math.abs(s.dv)) > .001 ||
          s.rippleOpacity > .002) {
        paint(s); moving = true;
      } else if (s.element.classList.contains('elastic-moving')) {
        s.x = s.targetX; s.y = s.targetY;
        s.scale = s.targetScale; s.vx = s.vy = s.vs = 0;
        s.u = s.v = s.du = s.dv = s.motionVX = s.motionVY = 0;
        s.lastX = s.x; s.lastY = s.y;
        s.rippleOpacity = 0; paint(s);
        s.element.classList.remove('elastic-moving');
      }
      if (s.rippleOpacity > 0 && !s.pressed) s.rippleOpacity *= .72;
    }
    if (moving) start(); else lastTime = 0;
  }
  function start() {
    if (reduced.matches || frame) return;
    for (const s of states) {
      if (s.pressed || Math.abs(s.targetX - s.x) > .001 ||
          Math.abs(s.targetY - s.y) > .001 || Math.abs(s.targetScale - s.scale) > .001 ||
          Math.abs(s.u) + Math.abs(s.v) > .001 || s.rippleOpacity > .001) {
        s.element.classList.add('elastic-moving');
      }
    }
    frame = requestAnimationFrame(tick);
  }
  function reset(s) {
    s.targetX = 0; s.targetY = 0; s.targetScale = 1;
    if (reduced.matches) {
      s.element.style.removeProperty('transform');
      s.element.style.removeProperty('translate');
      s.element.style.removeProperty('--elastic-ripple-opacity');
      s.element.classList.remove('elastic-moving');
    } else start();
  }
  function isAvailable(s) {
    const el = s.element;
    return el.isConnected && !el.disabled && getComputedStyle(el).visibility !== 'hidden' &&
      el.getClientRects().length > 0;
  }
  function pointInsideRect(x, y, rect) {
    return rect && rect.width > 0 && rect.height > 0 &&
      x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
  }
  function clearMouseMagnet() {
    if (activeMouse) reset(activeMouse);
    activeMouse = null;
  }
  function mouseMove(e) {
    if (e.pointerType !== 'mouse' || !mouseCapable.matches || reduced.matches) return;
    // Global pointer tracking must respect the overlay: an obscured control
    // cannot be hovered or magnetically attracted through the desktop sidebar.
    const sidebarRect = sidebar?.getBoundingClientRect();
    if (pointInsideRect(e.clientX, e.clientY, sidebarRect)) {
      clearMouseMagnet();
      return;
    }
    let nearest = null, best = Infinity, location = null;
    for (const s of states) {
      if (s.pressed || !isAvailable(s)) continue;
      const r = s.element.getBoundingClientRect();
      // Reconstruct the original center instead of feeding the animated
      // transform back into pointer proximity (which causes edge jitter).
      const cx = (r.left + r.right) / 2 - s.x;
      const cy = (r.top + r.bottom) / 2 - s.y;
      // Do not attract controls whose resting center is concealed by the rail,
      // even when the pointer sits just outside its edge.
      if (pointInsideRect(cx, cy, sidebarRect)) continue;
      const width = Math.max(1, s.element.offsetWidth), height = Math.max(1, s.element.offsetHeight);
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const outsideX = Math.max(0, Math.abs(dx) - width / 2);
      const outsideY = Math.max(0, Math.abs(dy) - height / 2);
      const distance = Math.hypot(outsideX, outsideY);
      const radius = Math.min(40, Math.max(23, Math.min(width, height) * .8));
      const score = distance / radius + Math.hypot(dx / width, dy / height) * .012;
      if (distance <= radius && score < best) { best = score; nearest = s; location = {dx, dy, distance, radius}; }
    }
    if (activeMouse && activeMouse !== nearest) reset(activeMouse);
    activeMouse = nearest;
    if (!nearest) return;
    const factor = Math.pow(1 - location.distance / location.radius, 1.4);
    nearest.targetX = clamp(location.dx * .16 * factor, -12, 12);
    nearest.targetY = clamp(location.dy * .19 * factor, -9, 9);
    nearest.targetScale = 1 + .045 * factor;
    start();
  }
  function release(s, e, cancelled = false) {
    if (!s.pressed || (e && s.pointer !== e.pointerId)) return;
    if (s.dragging) s.suppressUntil = performance.now() + 700;
    s.pressed = false; s.dragging = false; s.pointer = null;
    s.pointerVX = s.pointerVY = 0;
    s.element.classList.remove('elastic-pressed');
    reset(s);
    if (e) {
      try { if (s.element.hasPointerCapture(e.pointerId)) s.element.releasePointerCapture(e.pointerId); } catch { /* optional */ }
    }
  }
  states.forEach(s => {
    const el = s.element;
    el.classList.add('elastic-control');
    if (el.tagName === 'A') el.setAttribute('draggable', 'false');
    el.addEventListener('dragstart', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || reduced.matches || s.pressed || e.button > 0) return;
      if (activeMouse) { reset(activeMouse); activeMouse = null; }
      s.pressed = true; s.pointer = e.pointerId;
      s.dragging = false;
      s.startX = s.lastPointerX = e.clientX;
      s.startY = s.lastPointerY = e.clientY;
      s.lastPointerTime = e.timeStamp;
      s.pointerVX = s.pointerVY = 0;
      s.targetX = s.targetY = 0;
      s.targetScale = 1.16;
      const rect = el.getBoundingClientRect();
      s.rippleX = `${clamp((e.clientX - rect.left) / rect.width * 100, 0, 100)}%`;
      s.rippleY = `${clamp((e.clientY - rect.top) / rect.height * 100, 0, 100)}%`;
      s.rippleOpacity = .55;
      el.classList.add('elastic-pressed');
      try { el.setPointerCapture(e.pointerId); } catch { /* Safari fallback */ }
      start();
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse' || !s.pressed || s.pointer !== e.pointerId) return;
      const dx = e.clientX - s.startX, dy = e.clientY - s.startY;
      if (!s.dragging && Math.hypot(dx, dy) > 6) { s.dragging = true; s.rippleOpacity = 0; }
      if (!s.dragging) return;
      const dt = clamp((e.timeStamp - s.lastPointerTime) / 1000 || 1 / 60, 1 / 240, .05);
      s.pointerVX = (e.clientX - s.lastPointerX) / dt;
      s.pointerVY = (e.clientY - s.lastPointerY) / dt;
      s.lastPointerX = e.clientX; s.lastPointerY = e.clientY; s.lastPointerTime = e.timeStamp;
      const rect = el.getBoundingClientRect(), baseLeft = rect.left - s.x, baseTop = rect.top - s.y;
      const w = el.offsetWidth, h = el.offsetHeight;
      const horizontal = elastic(dx, Math.min(110, Math.max(65, innerWidth * .23)));
      const vertical = elastic(dy, 90);
      // Clamp to visible viewport instead of an arbitrarily tiny local track.
      s.targetX = clamp(horizontal, 6 - baseLeft, innerWidth - 6 - baseLeft - w);
      s.targetY = clamp(vertical, 6 - baseTop, innerHeight - 6 - baseTop - h);
      start();
    });
    el.addEventListener('pointerup', e => release(s, e));
    el.addEventListener('pointercancel', e => release(s, e, true));
    el.addEventListener('lostpointercapture', e => release(s, e, true));
    el.addEventListener('click', e => {
      if (performance.now() < s.suppressUntil) {
        e.preventDefault(); e.stopImmediatePropagation();
      }
    }, true);
  });
  // Also drop an existing magnetic pull when the sidebar slides under a
  // stationary pointer; waiting for another document pointermove feels sticky.
  sidebar?.addEventListener('pointerenter', e => {
    if (e.pointerType === 'mouse') clearMouseMagnet();
  });
  document.addEventListener('pointermove', mouseMove, { passive: true });
  document.addEventListener('pointerleave', () => { if (activeMouse) reset(activeMouse); activeMouse = null; });
  document.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && activeMouse) {reset(activeMouse); activeMouse = null;} }, true);
  window.addEventListener('blur', () => { for (const s of states) { release(s, null, true); reset(s); } activeMouse = null; });
  window.addEventListener('scroll', () => { if (activeMouse) reset(activeMouse); activeMouse = null; }, { passive: true });
  if (reduced.addEventListener) reduced.addEventListener('change', () => {for(const s of states) { release(s, null, true); reset(s); }});
})();
