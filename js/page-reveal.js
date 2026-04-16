/**
 * page-reveal.js
 * ──────────────
 * On inner pages (non-homepage), creates a centre-out reveal effect
 * that mirrors the black-hole exit from the homepage.
 *
 * Effect:
 *   1. Page loads under a solid black overlay.
 *   2. A circular clip-path expands from the viewport centre outward.
 *   3. Content fades in slightly behind the reveal.
 *
 * Auto-runs on DOMContentLoaded for any page that includes this script
 * and does NOT have the class "home" on <body>.
 *
 * Also provides Transitions.navigate() for inner-page → inner-page moves.
 */

'use strict';

const PageReveal = (() => {

  const DURATION_MS  = 700;
  const DELAY_MS     = 80;   // small delay so browser has painted content

  function ease(t) {
    return 1 - Math.pow(1 - t, 2.5);
  }

  function run() {
    // Inject overlay element
    const overlay   = document.createElement('div');
    overlay.id      = 'page-reveal-overlay';
    overlay.className = 'page-reveal-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: #000;
      z-index: 9998;
      pointer-events: none;
    `;
    document.body.appendChild(overlay);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = vw / 2;
    const cy = vh / 2;

    // Distance to farthest corner
    const maxR = Math.sqrt(cx * cx + cy * cy) + 20;

    // Start: fully covered
    overlay.style.clipPath = `circle(${maxR.toFixed(0)}px at 50% 50%)`;

    setTimeout(() => {
      const start = performance.now();

      function tick(now) {
        const raw = Math.min((now - start) / DURATION_MS, 1);
        const t   = ease(raw);

        // Shrink circle from maxR → 0
        const radius = maxR * (1 - t);
        overlay.style.clipPath =
          `circle(${radius.toFixed(1)}px at 50% 50%)`;

        if (raw < 1) {
          requestAnimationFrame(tick);
        } else {
          overlay.remove();
        }
      }

      requestAnimationFrame(tick);
    }, DELAY_MS);
  }

  /**
   * Navigate from an inner page to another with a matching exit.
   * Used for any internal links that want the transition effect.
   */
  function navigateTo(href, originX, originY) {
    // Reuse the same Transitions module if available, else simple nav
    if (window.Transitions) {
      window.Transitions.navigate(href, originX, originY);
    } else {
      window.location.href = href;
    }
  }

  return { run, navigateTo };
})();

// Auto-run on inner pages
document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('home')) {
    // Only run if NOT reduced motion
    if (!Utils.prefersReducedMotion()) {
      PageReveal.run();
    }
  }
});

window.PageReveal = PageReveal;
