/**
 * main.js
 * ───────
 * Bootstraps the homepage interaction.
 * Loaded last (after utils, hero-universe, transitions).
 *
 * Responsibilities:
 *  - Detect reduced motion and show static fallback
 *  - Instantiate HeroUniverse on the canvas
 *  - Wire prompt hide / hint show callbacks
 *  - Handle back-to-homepage link transitions on inner pages
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  const isHome = document.body.classList.contains('home');

  // ── INNER PAGES ─────────────────────────────────────────
  // Wire any internal nav links for the reveal transition.
  if (!isHome) {
    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      // Only intercept relative internal links
      if (!href || href.startsWith('http') || href.startsWith('#')) return;

      link.addEventListener('click', (e) => {
        if (Utils.prefersReducedMotion()) return; // let browser handle it
        e.preventDefault();
        const rect = link.getBoundingClientRect();
        const ox   = rect.left + rect.width  / 2;
        const oy   = rect.top  + rect.height / 2;
        PageReveal.navigateTo(href, ox, oy);
      });
    });
    return; // nothing more to do on inner pages
  }

  // ── HOMEPAGE ────────────────────────────────────────────

  const canvas = document.getElementById('universe-canvas');
  if (!canvas) return;

  const prompt     = document.getElementById('hero-prompt');
  const hint       = document.getElementById('hero-hint');
  const reducedNav = document.getElementById('reduced-motion-nav');

  // ── REDUCED MOTION FALLBACK ──────────────────────────────
  if (Utils.prefersReducedMotion()) {
    // Hide canvas-based hero, show static nav
    canvas.style.display = 'none';
    if (prompt)      prompt.hidden = true;
    if (reducedNav)  reducedNav.hidden = false;

    // Static nav links use normal browser navigation
    return;
  }

  // ── INIT UNIVERSE ────────────────────────────────────────
  const universe = new HeroUniverse(canvas);

  // When clusters are stable, show the hint
  universe.onStable = () => {
    setTimeout(() => {
      if (hint) hint.classList.add('visible');
    }, CFG.HINT_SHOW_DELAY_MS - 4000); // relative to stable, not page load
  };

  // When user navigates, run exit transition
  universe.onNavigate = (href, ox, oy) => {
    if (hint) hint.style.opacity = '0';
    Transitions.navigate(href, ox, oy);
  };

  // Hide prompt on first click (which triggers the bang)
  canvas.addEventListener('click', () => {
    if (prompt && !prompt.classList.contains('hidden')) {
      prompt.classList.add('hidden');
    }
  }, { once: true });

  // ── MOBILE: also support tap to start ────────────────────
  canvas.addEventListener('touchend', (e) => {
    if (prompt && !prompt.classList.contains('hidden')) {
      prompt.classList.add('hidden');
    }
  }, { once: true });

  // ── SCROLL: hide hint when user scrolls below hero ───────
  const heroEl = document.getElementById('hero');
  if (heroEl && hint) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          hint.classList.remove('visible');
        }
      });
    }, { threshold: 0.1 });
    observer.observe(heroEl);
  }

});
