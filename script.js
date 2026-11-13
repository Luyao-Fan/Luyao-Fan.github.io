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
    const strings = content[language] || {};
    const labelKey = 'nav' + id[0].toUpperCase() + id.slice(1);
    $('#current-section').textContent = strings[labelKey] || id;
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
  $$('.nav-link, .mobile-nav-link').forEach((link) => {
    link.addEventListener('click', () => updateActiveSection(link.dataset.section));
  });
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
