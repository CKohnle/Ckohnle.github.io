/**
 * utils.js
 * ────────
 * Shared math, easing, and canvas helpers.
 * No dependencies. Loaded first.
 */

'use strict';

// ── MATH ────────────────────────────────────────────────────

const Utils = {

  /** Linear interpolation */
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  /** Clamp x between min and max */
  clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
  },

  /** Map a value from one range to another */
  map(x, inMin, inMax, outMin, outMax) {
    return outMin + ((x - inMin) / (inMax - inMin)) * (outMax - outMin);
  },

  /** Euclidean distance between two points */
  dist(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  },

  /** Squared distance (cheaper, use when comparing distances) */
  distSq(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return dx * dx + dy * dy;
  },

  /** Random float in [min, max) */
  rand(min, max) {
    return min + Math.random() * (max - min);
  },

  /** Random integer in [min, max] */
  randInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  },

  /** Random element from an array */
  choice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  /** Angle between two points (radians) */
  angle(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
  },

  /** Normalise angle to [0, 2π) */
  normaliseAngle(a) {
    return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  },

  /** Box-Muller gaussian random, mean=0 stddev=1 */
  gaussRand() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  },

  // ── EASING ────────────────────────────────────────────────

  /** Ease out cubic */
  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  },

  /** Ease in cubic */
  easeInCubic(t) {
    return t * t * t;
  },

  /** Ease out expo */
  easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  },

  /** Ease in expo */
  easeInExpo(t) {
    return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
  },

  /** Ease in-out quad */
  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  },

  /** Smooth step */
  smoothStep(t) {
    return t * t * (3 - 2 * t);
  },

  // ── COLOUR ────────────────────────────────────────────────

  /**
   * Parse a CSS hex colour (#RRGGBB or #RGB) to {r, g, b} 0-255.
   */
  hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  },

  /**
   * Return an rgba() string.
   * colour: {r, g, b}  OR a CSS hex string
   */
  rgba(colour, alpha) {
    const c = typeof colour === 'string' ? this.hexToRgb(colour) : colour;
    return `rgba(${c.r},${c.g},${c.b},${alpha})`;
  },

  /**
   * Linearly interpolate between two {r,g,b} objects.
   */
  lerpColour(a, b, t) {
    return {
      r: Math.round(this.lerp(a.r, b.r, t)),
      g: Math.round(this.lerp(a.g, b.g, t)),
      b: Math.round(this.lerp(a.b, b.b, t)),
    };
  },

  // ── CANVAS HELPERS ────────────────────────────────────────

  /**
   * Set up canvas for high-DPI rendering.
   * Returns the pixel ratio used.
   */
  setupHiDPI(canvas, ctx, width, height) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.round(width  * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width  = width  + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);
    return dpr;
  },

  /**
   * Draw a filled circle.
   */
  fillCircle(ctx, x, y, r, fillStyle) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fillStyle;
    ctx.fill();
  },

  /**
   * Draw a soft radial glow centred at (x, y).
   * radius: outer radius of the glow
   * colour: {r, g, b}
   */
  drawGlow(ctx, x, y, radius, colour, alpha = 1) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0,   Utils.rgba(colour, alpha));
    grad.addColorStop(0.4, Utils.rgba(colour, alpha * 0.4));
    grad.addColorStop(1,   Utils.rgba(colour, 0));
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  },

  // ── MISC ──────────────────────────────────────────────────

  /** Performance-aware throttle */
  throttle(fn, ms) {
    let last = 0;
    return function(...args) {
      const now = performance.now();
      if (now - last >= ms) {
        last = now;
        fn.apply(this, args);
      }
    };
  },

  /** Check media query */
  prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  /** Mobile check — pointer: coarse is the reliable signal */
  isMobile() {
    return window.matchMedia('(pointer: coarse)').matches;
  },
};

// Expose globally (no build step, no modules)
window.Utils = Utils;
