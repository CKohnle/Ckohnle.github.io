/**
 * transitions.js
 * ──────────────
 * Drives the black-hole exit effect when the user clicks a cluster.
 *
 * Effect:
 *   1. A circular black overlay starts at the click position at scale 0.
 *   2. It expands via CSS clip-path (circle) to cover the entire viewport.
 *   3. Browser navigates to the target href.
 *
 * The matching centre-out reveal on the destination page is in page-reveal.js.
 */

'use strict';

const Transitions = (() => {

  // Duration of the black-hole expansion (ms)
  const DURATION_MS = 650;

  // Easing: fast start, then smooth fill
  function ease(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Begin the transition.
   *
   * @param {string} href      - Destination URL
   * @param {number} originX   - Click x in viewport px (origin of the "event horizon")
   * @param {number} originY   - Click y in viewport px
   */
  function navigate(href, originX, originY) {
    const overlay = document.getElementById('transition-overlay');
    if (!overlay) {
      // Fallback: just navigate
      window.location.href = href;
      return;
    }

    // Position the transform origin at the click point
    overlay.style.transformOrigin = `${originX}px ${originY}px`;
    overlay.style.borderRadius    = '50%';
    overlay.style.opacity         = '1';

    // Calculate the minimum scale needed to cover the entire viewport
    // from the click origin.
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Distance from origin to farthest viewport corner
    const dx = Math.max(originX, vw - originX);
    const dy = Math.max(originY, vh - originY);
    const maxDist = Math.sqrt(dx * dx + dy * dy);

    // The overlay starts as a circle with diameter ~1px (scale=0);
    // we need to scale it until it covers maxDist in all directions.
    // Since transform-origin is at click point, scale = maxDist / (half-overlay-size)
    // We use a large enough base size. Let's use 4px as base and compute multiplier.
    // Actually we scale the whole element — it fills the viewport at scale 1 (via inset:0).
    // At scale 0 it's a dot; we just need scale large enough that the circle covers.
    // Using clip-path is the cleanest approach here:

    overlay.style.borderRadius = '0';        // full coverage doesn't need rounding
    overlay.style.transform    = 'scale(0)';
    overlay.style.opacity      = '1';

    // Use clip-path circle instead for the true circular reveal
    // Reset transform
    overlay.style.transform = 'none';
    overlay.style.borderRadius = '0';

    const start = performance.now();

    function tick(now) {
      const raw  = Math.min((now - start) / DURATION_MS, 1);
      const t    = ease(raw);

      // clip-path circle(radius at x% y%)
      // At t=0: radius=0 (collapsed at origin)
      // At t=1: radius = maxDist + small buffer (full cover)
      const radius = t * (maxDist + 20);
      const pctX   = (originX / vw * 100).toFixed(2);
      const pctY   = (originY / vh * 100).toFixed(2);

      overlay.style.clipPath =
        `circle(${radius.toFixed(1)}px at ${pctX}% ${pctY}%)`;

      if (raw < 1) {
        requestAnimationFrame(tick);
      } else {
        // Fully covered — navigate
        window.location.href = href;
      }
    }

    requestAnimationFrame(tick);
  }

  return { navigate };
})();

window.Transitions = Transitions;
