/**
 * hero-universe.js
 * ────────────────
 * Full Canvas 2D simulation for the homepage hero.
 *
 * STATE MACHINE
 * ─────────────
 *  idle        → waiting for first click
 *  burst       → Big Bang origin burst (≈0.4 s)
 *  expansion   → particles cool and spread outward (≈1.2 s)
 *  clustering  → spring-force pulls particles into four galaxy clusters (≈2 s)
 *  navigation  → stable interactive state; cursor = black hole
 *  transition  → user clicked a cluster; plays black-hole exit
 *
 * ARCHITECTURE
 * ────────────
 *  HeroUniverse   — top-level controller, owns canvas & RAF loop
 *  Particle       — a single star/particle with position, velocity, colour
 *  GalaxyCluster  — attractor + label + hit area for one section
 *  SpatialGrid    — loose-grid for O(local) cursor influence
 */

'use strict';

// ── TUNABLE CONSTANTS ───────────────────────────────────────────────────────
const CFG = {
  // Particle counts
  PARTICLE_COUNT_DESKTOP: 620,
  PARTICLE_COUNT_MOBILE:  220,

  // Burst
  BURST_DURATION_MS:      400,   // how long the initial bang lasts
  BURST_MAX_SPEED:        28,    // px/frame at peak
  BURST_PARTICLE_RADIUS:  2.5,   // initial glowing radius
  BURST_FADE_RADIUS:      1.0,   // radius at end of burst

  // Expansion phase
  EXPANSION_DURATION_MS:  1400,
  EXPANSION_FRICTION:     0.96,  // velocity damping per frame

  // Clustering phase
  CLUSTERING_DURATION_MS: 2000,
  CLUSTER_SPRING_K:       0.025, // spring constant toward cluster centre
  CLUSTER_NOISE:          0.35,  // random jitter while clustering
  CLUSTER_SCATTER_RADIUS: 80,    // final scatter radius around cluster
  CLUSTER_STAGGER_MS:     300,   // stagger start of clustering per galaxy

  // Navigation (steady state)
  BLACK_HOLE_RADIUS:        90,   // px — cursor influence radius
  BLACK_HOLE_STRENGTH:      0.55, // force multiplier
  BLACK_HOLE_ORBIT_SCALE:   0.08, // tangential velocity component
  STAR_MIN_RADIUS:          0.6,
  STAR_MAX_RADIUS:          2.0,

  // Galaxy label
  LABEL_FONT_SIZE_DESKTOP:  '13px',
  LABEL_FONT_SIZE_MOBILE:   '11px',
  LABEL_OFFSET_Y:           58,   // px below cluster centre
  CLUSTER_HIT_RADIUS:       70,   // click hit-test radius

  // Timing totals
  HINT_SHOW_DELAY_MS:       4200, // when to show "Move your cursor…" hint

  // Colours — must match CSS vars
  COLOURS: {
    background:  { r:  6, g:  7, b: 13 },
    starBase:    { r:180, g:190, b:230 },
    starWarm:    { r:232, g:192, b:125 },
    burstCore:   { r:255, g:245, b:210 },

    clusters: [
      { r: 79, g:129, b:245 },   // research  — blue
      { r:155, g:127, b:234 },   // writing   — violet
      { r:125, g:211, b:232 },   // about     — cyan
      { r:232, g:192, b:125 },   // projects  — warm
    ],
  },
};

// ── GALAXY CLUSTER DEFINITIONS ────────────────────────────────────────────
// Positions are expressed as fractions of viewport — resolved to px at init.
const CLUSTER_DEFS = [
  { id: 'research', label: 'Research', href: 'research.html', fx: 0.28, fy: 0.38 },
  { id: 'writing',  label: 'Writing',  href: 'blog.html',     fx: 0.72, fy: 0.38 },
  { id: 'about',    label: 'About',    href: 'personal.html', fx: 0.28, fy: 0.66 },
  { id: 'projects', label: 'Projects', href: 'projects.html', fx: 0.72, fy: 0.66 },
];

// ── SPATIAL GRID ─────────────────────────────────────────────────────────
/**
 * Loose uniform grid for quick neighbour lookups.
 * Used so the cursor-influence loop only checks O(cell) particles
 * rather than all N particles.
 */
class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  _key(x, y) {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }

  clear() {
    this.cells.clear();
  }

  insert(particle) {
    const k = this._key(particle.x, particle.y);
    if (!this.cells.has(k)) this.cells.set(k, []);
    this.cells.get(k).push(particle);
  }

  /** Return all particles in cells overlapping a circle of given radius */
  query(cx, cy, radius) {
    const cs = this.cellSize;
    const x0 = Math.floor((cx - radius) / cs);
    const x1 = Math.floor((cx + radius) / cs);
    const y0 = Math.floor((cy - radius) / cs);
    const y1 = Math.floor((cy + radius) / cs);
    const results = [];
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const k = `${gx},${gy}`;
        const cell = this.cells.get(k);
        if (cell) results.push(...cell);
      }
    }
    return results;
  }
}

// ── PARTICLE ──────────────────────────────────────────────────────────────
class Particle {
  /**
   * @param {number} x          - initial x (origin of Big Bang)
   * @param {number} y          - initial y
   * @param {number} clusterIdx - which galaxy this particle belongs to (0-3)
   * @param {number} totalCount - total particle count (for angle distribution)
   * @param {number} index      - this particle's index (for angle distribution)
   */
  constructor(x, y, clusterIdx, totalCount, index) {
    this.clusterIdx = clusterIdx;

    // Position
    this.x  = x + Utils.rand(-2, 2);
    this.y  = y + Utils.rand(-2, 2);
    this.ox = this.x; // origin (for burst)
    this.oy = this.y;

    // Burst velocity — distributed outward with some randomness
    const angle = (index / totalCount) * Math.PI * 2 + Utils.rand(-0.4, 0.4);
    const speed = Utils.rand(CFG.BURST_MAX_SPEED * 0.3, CFG.BURST_MAX_SPEED);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    // Visual
    this.radius      = CFG.BURST_PARTICLE_RADIUS;
    this.targetRadius = Utils.rand(CFG.STAR_MIN_RADIUS, CFG.STAR_MAX_RADIUS);
    this.twinklePhase = Utils.rand(0, Math.PI * 2);
    this.twinkleSpeed = Utils.rand(0.02, 0.06);

    // Colour — blend between cool-star white and cluster accent
    const clusterRgb = CFG.COLOURS.clusters[clusterIdx];
    const t          = Utils.rand(0, 0.7);  // bias toward white
    this.baseColour  = Utils.lerpColour(CFG.COLOURS.starBase, clusterRgb, t);
    this.colour      = { ...this.baseColour };

    // Runtime flags
    this.clusterTarget = null;  // set when clustering starts
    this.settled       = false; // true once near cluster
  }

  /** Apply Big Bang burst physics for one frame */
  updateBurst(friction) {
    this.vx *= friction;
    this.vy *= friction;
    this.x  += this.vx;
    this.y  += this.vy;
  }

  /** Spring-pull toward cluster target, with noise */
  updateClustering(tx, ty, phase) {
    // Stagger: particles belonging to different clusters start slightly later
    if (phase < 0) return;

    const dx = tx - this.x;
    const dy = ty - this.y;

    // Spring force (proportional to displacement)
    this.vx += dx * CFG.CLUSTER_SPRING_K;
    this.vy += dy * CFG.CLUSTER_SPRING_K;

    // Friction
    this.vx *= 0.88;
    this.vy *= 0.88;

    // Noise
    this.vx += Utils.gaussRand() * CFG.CLUSTER_NOISE;
    this.vy += Utils.gaussRand() * CFG.CLUSTER_NOISE;

    this.x += this.vx;
    this.y += this.vy;
  }

  /** Black-hole cursor influence */
  applyCursorForce(cx, cy, strength) {
    const dx  = cx - this.x;
    const dy  = cy - this.y;
    const dSq = dx * dx + dy * dy;
    if (dSq === 0) return;

    const d    = Math.sqrt(dSq);
    const norm = strength / dSq;

    // Radial pull toward cursor
    this.vx += dx * norm * 0.6;
    this.vy += dy * norm * 0.6;

    // Tangential orbital component (perpendicular to radial)
    this.vx += (-dy / d) * strength * CFG.BLACK_HOLE_ORBIT_SCALE;
    this.vy += ( dx / d) * strength * CFG.BLACK_HOLE_ORBIT_SCALE;
  }

  /** Steady-state update with soft friction */
  updateNavigation(clusterX, clusterY) {
    this.vx *= 0.92;
    this.vy *= 0.92;

    this.x += this.vx;
    this.y += this.vy;

    // Gentle spring back to cluster if drifted too far
    const dx   = clusterX - this.x;
    const dy   = clusterY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > CFG.CLUSTER_SCATTER_RADIUS * 2.5) {
      this.vx += dx * 0.005;
      this.vy += dy * 0.005;
    }

    // Twinkle — subtle radius oscillation
    this.twinklePhase += this.twinkleSpeed;
    const tw           = (Math.sin(this.twinklePhase) * 0.5 + 0.5); // 0-1
    this.radius        = Utils.lerp(this.targetRadius * 0.6, this.targetRadius, tw);
  }

  draw(ctx, alpha = 1) {
    if (this.radius < 0.1) return;
    const a = Utils.clamp(alpha, 0, 1);
    Utils.fillCircle(ctx, this.x, this.y, this.radius,
      Utils.rgba(this.colour, a));
  }
}

// ── GALAXY CLUSTER ─────────────────────────────────────────────────────────
class GalaxyCluster {
  constructor(def, colourRgb, viewW, viewH) {
    this.id        = def.id;
    this.label     = def.label;
    this.href      = def.href;
    this.colour    = colourRgb;

    // Pixel position resolved from fraction
    this.x         = def.fx * viewW;
    this.y         = def.fy * viewH;

    // Each particle in this cluster gets a randomised target
    // within a disc around (x,y) — set per-particle at clustering start.
    this.hitRadius = CFG.CLUSTER_HIT_RADIUS;

    // Animation state
    this.labelAlpha = 0;    // fades in during clustering
    this.glowAlpha  = 0;
    this.hovered    = false;
    this.particles  = [];   // references assigned after creation
  }

  /** Resolve a randomised resting position for one particle */
  randomTarget() {
    const r     = Utils.rand(0, CFG.CLUSTER_SCATTER_RADIUS);
    const angle = Utils.rand(0, Math.PI * 2);
    return {
      x: this.x + Math.cos(angle) * r,
      y: this.y + Math.sin(angle) * r,
    };
  }

  isHit(mx, my) {
    return Utils.distSq(mx, my, this.x, this.y) < this.hitRadius * this.hitRadius;
  }

  draw(ctx, isMobile) {
    if (this.labelAlpha <= 0) return;

    // Core glow
    const ga = this.labelAlpha * (this.hovered ? 0.5 : 0.25);
    Utils.drawGlow(ctx, this.x, this.y, 55, this.colour, ga);

    // Label
    const fontSize = isMobile ? CFG.LABEL_FONT_SIZE_MOBILE : CFG.LABEL_FONT_SIZE_DESKTOP;
    ctx.save();
    ctx.font         = `300 ${fontSize} 'DM Mono', monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.letterSpacing = '0.18em';

    const tx = this.x;
    const ty = this.y + CFG.LABEL_OFFSET_Y;

    // Hover: slight scale and colour shift
    if (this.hovered) {
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(1.08, 1.08);
      ctx.translate(-tx, -ty);
    }

    // Shadow for readability
    ctx.shadowColor  = Utils.rgba(CFG.COLOURS.background, 0.9);
    ctx.shadowBlur   = 8;

    ctx.fillStyle = Utils.rgba(this.colour, this.labelAlpha * (this.hovered ? 1 : 0.85));
    ctx.fillText(this.label.toUpperCase(), tx, ty);

    if (this.hovered) ctx.restore();
    ctx.restore();
  }
}

// ── HERO UNIVERSE ──────────────────────────────────────────────────────────
class HeroUniverse {
  constructor(canvas) {
    this.canvas    = canvas;
    this.ctx       = canvas.getContext('2d');
    this.width     = 0;
    this.height    = 0;
    this.dpr       = 1;
    this.isMobile  = Utils.isMobile();

    // State machine
    // 'idle' | 'burst' | 'expansion' | 'clustering' | 'navigation' | 'transition'
    this.state     = 'idle';
    this.stateT    = 0;     // time (ms) since state entered
    this.phaseStart = 0;    // performance.now() at state entry

    // Simulation
    this.particles = [];
    this.clusters  = [];
    this.grid      = new SpatialGrid(CFG.BLACK_HOLE_RADIUS);

    // Click origin for burst
    this.originX   = 0;
    this.originY   = 0;

    // Cursor
    this.cursorX   = -1000;
    this.cursorY   = -1000;

    // RAF
    this._rafId    = null;
    this._lastTime = 0;

    // Callbacks — set by main.js
    this.onNavigate  = null;  // (href) → void
    this.onStable    = null;  // () → void  (clusters ready)

    this._init();
  }

  // ── INIT ────────────────────────────────────────────────

  _init() {
    this._resize();
    window.addEventListener('resize', Utils.throttle(() => this._resize(), 150));

    // Cursor tracking (desktop only)
    if (!this.isMobile) {
      this.canvas.addEventListener('mousemove', (e) => {
        const r = this.canvas.getBoundingClientRect();
        this.cursorX = e.clientX - r.left;
        this.cursorY = e.clientY - r.top;
        this._updateHover();
      });
      this.canvas.addEventListener('mouseleave', () => {
        this.cursorX = -1000;
        this.cursorY = -1000;
        this.clusters.forEach(c => c.hovered = false);
      });
    }

    // Touch (mobile)
    if (this.isMobile) {
      this.canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const r  = this.canvas.getBoundingClientRect();
        const t  = e.touches[0];
        this.cursorX = t.clientX - r.left;
        this.cursorY = t.clientY - r.top;
        this._updateHover();
      }, { passive: false });
    }

    // Clicks
    this.canvas.addEventListener('click', (e) => this._handleClick(e));

    this._drawIdle();
  }

  _resize() {
    this.width  = this.canvas.offsetWidth;
    this.height = this.canvas.offsetHeight;
    this.dpr    = Utils.setupHiDPI(this.canvas, this.ctx, this.width, this.height);

    // Re-resolve cluster positions on resize
    this.clusters.forEach((c, i) => {
      c.x = CLUSTER_DEFS[i].fx * this.width;
      c.y = CLUSTER_DEFS[i].fy * this.height;
    });
  }

  // ── IDLE ────────────────────────────────────────────────

  _drawIdle() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    // Just a clear black — the prompt overlay is in HTML
    ctx.fillStyle = Utils.rgba(CFG.COLOURS.background, 1);
    ctx.fillRect(0, 0, this.width, this.height);

    // Sprinkle a faint starfield so the canvas isn't completely empty
    if (!this._idleStars) this._buildIdleStars();
    this._idleStars.forEach(s => {
      Utils.fillCircle(ctx, s.x, s.y, s.r, Utils.rgba(s.c, s.a));
    });
  }

  _buildIdleStars() {
    this._idleStars = [];
    const n = this.isMobile ? 80 : 180;
    for (let i = 0; i < n; i++) {
      this._idleStars.push({
        x: Utils.rand(0, this.width),
        y: Utils.rand(0, this.height),
        r: Utils.rand(0.3, 1.2),
        a: Utils.rand(0.06, 0.35),
        c: Utils.choice([
          CFG.COLOURS.starBase,
          CFG.COLOURS.clusters[0],
          CFG.COLOURS.clusters[1],
        ]),
      });
    }
  }

  // ── TRIGGER BIG BANG ────────────────────────────────────

  triggerBang(ox, oy) {
    if (this.state !== 'idle') return;

    this.originX = ox;
    this.originY = oy;

    const n = this.isMobile
      ? CFG.PARTICLE_COUNT_MOBILE
      : CFG.PARTICLE_COUNT_DESKTOP;

    // Build clusters first so particles can reference them
    this._buildClusters();

    // Create particles distributed evenly across the four clusters
    this.particles = [];
    for (let i = 0; i < n; i++) {
      const clusterIdx = i % 4;
      const p = new Particle(ox, oy, clusterIdx, n, i);
      this.clusters[clusterIdx].particles.push(p);
      this.particles.push(p);
    }

    this._enterState('burst');
    this._startLoop();
  }

  _buildClusters() {
    this.clusters = CLUSTER_DEFS.map((def, i) => {
      return new GalaxyCluster(def, CFG.COLOURS.clusters[i], this.width, this.height);
    });
  }

  // ── STATE MACHINE ───────────────────────────────────────

  _enterState(name) {
    this.state      = name;
    this.phaseStart = performance.now();
    this.stateT     = 0;
  }

  _startLoop() {
    if (this._rafId) return;
    this._lastTime = performance.now();
    const tick = (now) => {
      const dt    = now - this._lastTime;
      this._lastTime = now;
      this.stateT = now - this.phaseStart;
      this._update(dt, now);
      this._render();
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _stopLoop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  // ── UPDATE ──────────────────────────────────────────────

  _update(dt, now) {
    switch (this.state) {
      case 'burst':     this._updateBurst();     break;
      case 'expansion': this._updateExpansion(); break;
      case 'clustering':this._updateClustering();break;
      case 'navigation':this._updateNavigation();break;
      // 'transition' is driven by transitions.js, nothing here
    }
  }

  _updateBurst() {
    const progress = Utils.clamp(this.stateT / CFG.BURST_DURATION_MS, 0, 1);
    const friction = Utils.lerp(0.88, CFG.EXPANSION_FRICTION, progress);

    this.particles.forEach(p => {
      p.updateBurst(friction);
      // Radius shrinks from burst glow to normal star size
      p.radius = Utils.lerp(CFG.BURST_PARTICLE_RADIUS, CFG.BURST_FADE_RADIUS,
        Utils.easeOutExpo(progress));
      // Colour fades from bright burst core → star colour
      p.colour = Utils.lerpColour(CFG.COLOURS.burstCore, p.baseColour,
        Utils.easeOutExpo(progress));
    });

    if (progress >= 1) this._enterState('expansion');
  }

  _updateExpansion() {
    const progress = Utils.clamp(this.stateT / CFG.EXPANSION_DURATION_MS, 0, 1);

    this.particles.forEach(p => {
      p.updateBurst(CFG.EXPANSION_FRICTION);
      // Gradually resolve final star radius
      p.radius = Utils.lerp(CFG.BURST_FADE_RADIUS, p.targetRadius,
        Utils.easeOutCubic(progress));
    });

    if (progress >= 1) this._beginClustering();
  }

  _beginClustering() {
    // Assign each particle a randomised resting spot within its cluster
    this.particles.forEach(p => {
      p.clusterTarget = this.clusters[p.clusterIdx].randomTarget();
    });
    this._enterState('clustering');
  }

  _updateClustering() {
    const progress = Utils.clamp(this.stateT / CFG.CLUSTERING_DURATION_MS, 0, 1);

    this.particles.forEach(p => {
      const clusterOffset = p.clusterIdx * CFG.CLUSTER_STAGGER_MS;
      const localT = (this.stateT - clusterOffset) / CFG.CLUSTERING_DURATION_MS;
      p.updateClustering(p.clusterTarget.x, p.clusterTarget.y, localT);
    });

    // Fade in cluster labels
    const labelT = Utils.clamp((progress - 0.4) / 0.6, 0, 1);
    this.clusters.forEach(c => {
      c.labelAlpha = Utils.easeOutCubic(labelT);
      c.glowAlpha  = Utils.easeOutCubic(labelT);
    });

    if (progress >= 1) {
      this._enterState('navigation');
      if (this.onStable) this.onStable();
    }
  }

  _updateNavigation() {
    // Rebuild spatial grid each frame
    this.grid.clear();
    this.particles.forEach(p => this.grid.insert(p));

    // Apply cursor/black-hole force to nearby particles
    if (this.cursorX > -500) {
      const nearby = this.grid.query(this.cursorX, this.cursorY, CFG.BLACK_HOLE_RADIUS);
      nearby.forEach(p => {
        const dSq = Utils.distSq(this.cursorX, this.cursorY, p.x, p.y);
        if (dSq < CFG.BLACK_HOLE_RADIUS * CFG.BLACK_HOLE_RADIUS) {
          const falloff = 1 - Math.sqrt(dSq) / CFG.BLACK_HOLE_RADIUS;
          p.applyCursorForce(this.cursorX, this.cursorY,
            CFG.BLACK_HOLE_STRENGTH * falloff * 60);
        }
      });
    }

    // Update each particle
    this.particles.forEach(p => {
      const cluster = this.clusters[p.clusterIdx];
      p.updateNavigation(cluster.x, cluster.y);
    });
  }

  // ── RENDER ──────────────────────────────────────────────

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Background
    ctx.fillStyle = Utils.rgba(CFG.COLOURS.background, 1);
    ctx.fillRect(0, 0, this.width, this.height);

    // --- Burst flash ---
    if (this.state === 'burst') {
      const flashT   = Utils.clamp(1 - this.stateT / CFG.BURST_DURATION_MS, 0, 1);
      const flashAlp = Utils.easeInExpo(flashT) * 0.75;
      Utils.drawGlow(ctx, this.originX, this.originY,
        300 * (1 - flashT + 0.1), CFG.COLOURS.burstCore, flashAlp);
    }

    // --- Particles ---
    this.particles.forEach(p => {
      // Determine alpha for clustering phase (fade in)
      let alpha = 1;
      if (this.state === 'burst') {
        alpha = Utils.clamp(this.stateT / (CFG.BURST_DURATION_MS * 0.5), 0, 1);
      }
      p.draw(ctx, alpha);
    });

    // --- Cluster glows + labels ---
    this.clusters.forEach(c => c.draw(ctx, this.isMobile));

    // --- Custom cursor (desktop navigation state) ---
    if (this.state === 'navigation' && !this.isMobile && this.cursorX > -500) {
      this._drawBlackHoleCursor(ctx);
    }
  }

  _drawBlackHoleCursor(ctx) {
    const x  = this.cursorX;
    const y  = this.cursorY;
    const r  = 7;

    // Dark disc
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    // Thin violet ring
    ctx.beginPath();
    ctx.arc(x, y, r + 2, 0, Math.PI * 2);
    ctx.strokeStyle = Utils.rgba(CFG.COLOURS.clusters[1], 0.7);
    ctx.lineWidth   = 0.8;
    ctx.stroke();

    // Faint outer glow
    Utils.drawGlow(ctx, x, y, 30, CFG.COLOURS.clusters[1], 0.12);
  }

  // ── INTERACTION ─────────────────────────────────────────

  _updateHover() {
    if (this.state !== 'navigation') return;
    this.clusters.forEach(c => {
      c.hovered = c.isHit(this.cursorX, this.cursorY);
    });

    // Change cursor style on hover
    const anyHovered = this.clusters.some(c => c.hovered);
    this.canvas.style.cursor = anyHovered ? 'none' : 'none';
  }

  _handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    let cx, cy;

    if (e.changedTouches && e.changedTouches.length) {
      cx = e.changedTouches[0].clientX - rect.left;
      cy = e.changedTouches[0].clientY - rect.top;
    } else {
      cx = e.clientX - rect.left;
      cy = e.clientY - rect.top;
    }

    if (this.state === 'idle') {
      this.triggerBang(cx, cy);
      return;
    }

    if (this.state === 'navigation') {
      const hit = this.clusters.find(c => c.isHit(cx, cy));
      if (hit && this.onNavigate) {
        this.state = 'transition';
        this.onNavigate(hit.href, cx, cy);
      }
    }
  }

  // ── PUBLIC API ──────────────────────────────────────────

  /** Returns current state string */
  getState() { return this.state; }

  /** Destroy and stop animation loop */
  destroy() {
    this._stopLoop();
    window.removeEventListener('resize', this._resize);
  }
}

window.HeroUniverse = HeroUniverse;
