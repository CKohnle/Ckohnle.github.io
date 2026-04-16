/**
 * hero-universe.js
 * ────────────────
 * Full Canvas 2D simulation for the homepage hero.
 *
 * STATE MACHINE
 * ─────────────
 *  idle        → waiting for first click
 *  burst       → Big Bang origin burst (≈0.4 s)
 *  expansion   → particles cool and spread outward (≈1.4 s)
 *  clustering  → spring-force pulls particles into four galaxy clusters (≈2 s)
 *  navigation  → stable interactive state; cursor = black hole
 *  transition  → user clicked a cluster; plays black-hole exit
 *
 * ARCHITECTURE
 * ────────────
 *  HeroUniverse   — top-level controller, owns canvas & RAF loop
 *  Particle       — a single star/particle with position, velocity, colour
 *  AmbientStar    — free background star, not bound to any attractor
 *  GalaxyCluster  — attractor + label + hit area for one section
 *  SpatialGrid    — loose-grid for O(local) cursor influence
 */

'use strict';

// ── TUNABLE CONSTANTS ───────────────────────────────────────────────────────
const CFG = {
  // Particle counts (bound to clusters)
  PARTICLE_COUNT_DESKTOP: 620,
  PARTICLE_COUNT_MOBILE: 220,

    // Ambient/free stars (global galactic background)
  AMBIENT_STAR_COUNT_DESKTOP: 1200,
  AMBIENT_STAR_COUNT_MOBILE: 320,
  AMBIENT_STAR_SPEED_MIN: 0.18,
  AMBIENT_STAR_SPEED_MAX: 0.85,
  AMBIENT_STAR_RADIUS_MIN: 0.25,
  AMBIENT_STAR_RADIUS_MAX: 1.35,
  AMBIENT_SWIRL_STRENGTH: 0.005,
  AMBIENT_CENTER_PULL: 0.00035,

  // Burst
  BURST_DURATION_MS: 400,
  BURST_MAX_SPEED: 28,
  BURST_PARTICLE_RADIUS: 2.5,
  BURST_FADE_RADIUS: 1.0,

  // Expansion phase
  EXPANSION_DURATION_MS: 1400,
  EXPANSION_FRICTION: 0.96,

  // Clustering phase
  CLUSTERING_DURATION_MS: 2000,
  CLUSTER_SPRING_K: 0.025,
  CLUSTER_NOISE: 0.35,
  CLUSTER_SCATTER_RADIUS: 80,
  CLUSTER_STAGGER_MS: 300,

  // Navigation (steady state)
  BLACK_HOLE_RADIUS: 90,
  BLACK_HOLE_STRENGTH: 0.55,
  BLACK_HOLE_ORBIT_SCALE: 0.08,

  STAR_MIN_RADIUS: 0.6,
  STAR_MAX_RADIUS: 2.0,

  // Orbital return around attractors
  CLUSTER_ORBIT_STRENGTH: 0.012,
  CLUSTER_RETURN_STRENGTH: 0.004,
  CLUSTER_NAV_FRICTION: 0.94,

  // Galaxy label
  LABEL_FONT_SIZE_DESKTOP: '13px',
  LABEL_FONT_SIZE_MOBILE: '11px',
  LABEL_OFFSET_Y: 58,
  CLUSTER_HIT_RADIUS: 70,

  // Timing totals
  HINT_SHOW_DELAY_MS: 4200,

  // Colours — should roughly match CSS
  COLOURS: {
    background: { r: 6, g: 7, b: 13 },
    starBase: { r: 180, g: 190, b: 230 },
    starWarm: { r: 232, g: 192, b: 125 },
    burstCore: { r: 255, g: 245, b: 210 },

    clusters: [
      { r: 79, g: 129, b: 245 },   // research
      { r: 155, g: 127, b: 234 },  // writing
      { r: 125, g: 211, b: 232 },  // about
      { r: 232, g: 192, b: 125 },  // projects
    ],
  },
};

// ── GALAXY CLUSTER DEFINITIONS ─────────────────────────────────────────────
const CLUSTER_DEFS = [
  { id: 'research', label: 'Research', href: 'research.html', fx: 0.28, fy: 0.38 },
  { id: 'writing',  label: 'Writing',  href: 'blog.html',     fx: 0.72, fy: 0.38 },
  { id: 'about',    label: 'About',    href: 'personal.html', fx: 0.28, fy: 0.66 },
  { id: 'projects', label: 'Projects', href: 'projects.html', fx: 0.72, fy: 0.66 },
];

// ── SPATIAL GRID ────────────────────────────────────────────────────────────
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

// ── PARTICLE ────────────────────────────────────────────────────────────────
class Particle {
  constructor(x, y, clusterIdx, totalCount, index) {
    this.clusterIdx = clusterIdx;

    // Position
    this.x = x + Utils.rand(-2, 2);
    this.y = y + Utils.rand(-2, 2);
    this.ox = this.x;
    this.oy = this.y;

    // Burst velocity
    const angle = (index / totalCount) * Math.PI * 2 + Utils.rand(-0.4, 0.4);
    const speed = Utils.rand(CFG.BURST_MAX_SPEED * 0.3, CFG.BURST_MAX_SPEED);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    // Visual
    this.radius = CFG.BURST_PARTICLE_RADIUS;
    this.targetRadius = Utils.rand(CFG.STAR_MIN_RADIUS, CFG.STAR_MAX_RADIUS);
    this.twinklePhase = Utils.rand(0, Math.PI * 2);
    this.twinkleSpeed = Utils.rand(0.02, 0.06);

    const clusterRgb = CFG.COLOURS.clusters[clusterIdx];
    const t = Utils.rand(0, 0.7);
    this.baseColour = Utils.lerpColour(CFG.COLOURS.starBase, clusterRgb, t);
    this.colour = { ...this.baseColour };

    this.clusterTarget = null;
    this.settled = false;
  }

  updateBurst(friction) {
    this.vx *= friction;
    this.vy *= friction;
    this.x += this.vx;
    this.y += this.vy;
  }

  updateClustering(tx, ty, phase) {
    if (phase < 0) return;

    const dx = tx - this.x;
    const dy = ty - this.y;

    this.vx += dx * CFG.CLUSTER_SPRING_K;
    this.vy += dy * CFG.CLUSTER_SPRING_K;

    this.vx *= 0.88;
    this.vy *= 0.88;

    this.vx += Utils.gaussRand() * CFG.CLUSTER_NOISE;
    this.vy += Utils.gaussRand() * CFG.CLUSTER_NOISE;

    this.x += this.vx;
    this.y += this.vy;
  }

  applyCursorForce(cx, cy, strength) {
    const dx = cx - this.x;
    const dy = cy - this.y;
    const dSq = dx * dx + dy * dy;
    if (dSq === 0) return;

    const d = Math.sqrt(dSq);
    const norm = strength / dSq;

    this.vx += dx * norm * 0.6;
    this.vy += dy * norm * 0.6;

    this.vx += (-dy / d) * strength * CFG.BLACK_HOLE_ORBIT_SCALE;
    this.vy += ( dx / d) * strength * CFG.BLACK_HOLE_ORBIT_SCALE;
  }

  updateNavigation(clusterX, clusterY) {
    const dx = clusterX - this.x;
    const dy = clusterY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  
    // inward restoring force
    this.vx += dx * 0.006;
    this.vy += dy * 0.006;
  
    // tangential orbital force, bounded so it does not grow forever
    const orbitStrength = 0.38 / Math.sqrt(dist + 12);
    this.vx += (-dy / dist) * orbitStrength;
    this.vy += ( dx / dist) * orbitStrength;
  
    // damping
    this.vx *= 0.92;
    this.vy *= 0.92;
  
    this.x += this.vx;
    this.y += this.vy;
  
    // twinkle
    this.twinklePhase += this.twinkleSpeed;
    const tw = (Math.sin(this.twinklePhase) * 0.5 + 0.5);
    this.radius = Utils.lerp(this.targetRadius * 0.6, this.targetRadius, tw);
}

  draw(ctx, alpha = 1) {
    if (this.radius < 0.1) return;
    const a = Utils.clamp(alpha, 0, 1);
    Utils.fillCircle(ctx, this.x, this.y, this.radius, Utils.rgba(this.colour, a));
  }
}

class AmbientStar {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;

    this.radius = Utils.rand(CFG.AMBIENT_STAR_RADIUS_MIN, CFG.AMBIENT_STAR_RADIUS_MAX);
    this.alpha = Utils.rand(0.18, 0.85);
    this.twinklePhase = Utils.rand(0, Math.PI * 2);
    this.twinkleSpeed = Utils.rand(0.008, 0.03);

    // Mostly white, with slight cool variation
    const white = { r: 255, g: 255, b: 255 };
    this.colour = Utils.lerpColour(
      CFG.COLOURS.starBase,
      white,
      Utils.rand(0.65, 1.0)
    );
  }

  update(width, height, cx, cy) {
    const dx = this.x - cx;
    const dy = this.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Swirl around the moving center
    this.vx += (-dy / dist) * CFG.AMBIENT_SWIRL_STRENGTH * dist;
    this.vy += ( dx / dist) * CFG.AMBIENT_SWIRL_STRENGTH * dist;

    // Very weak inward pull to keep the large galactic structure together
    this.vx += (-dx) * CFG.AMBIENT_CENTER_PULL;
    this.vy += (-dy) * CFG.AMBIENT_CENTER_PULL;

    // Renormalize toward near-constant speed
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy) || 1;
    const targetSpeed = Utils.clamp(speed, CFG.AMBIENT_STAR_SPEED_MIN, CFG.AMBIENT_STAR_SPEED_MAX);

    this.vx = (this.vx / speed) * targetSpeed;
    this.vy = (this.vy / speed) * targetSpeed;

    this.x += this.vx;
    this.y += this.vy;

    this.twinklePhase += this.twinkleSpeed;

    // Soft wrap
    if (this.x < -20) this.x = width + 20;
    if (this.x > width + 20) this.x = -20;
    if (this.y < -20) this.y = height + 20;
    if (this.y > height + 20) this.y = -20;
  }

  draw(ctx) {
    const tw = 0.72 + 0.28 * Math.sin(this.twinklePhase);
    Utils.fillCircle(ctx, this.x, this.y, this.radius, Utils.rgba(this.colour, this.alpha * tw));
  }
}

// ── GALAXY CLUSTER ─────────────────────────────────────────────────────────
class GalaxyCluster {
  constructor(def, colourRgb, viewW, viewH) {
    this.id = def.id;
    this.label = def.label;
    this.href = def.href;
    this.colour = colourRgb;

    this.x = def.fx * viewW;
    this.y = def.fy * viewH;

    this.hitRadius = CFG.CLUSTER_HIT_RADIUS;

    this.labelAlpha = 0;
    this.glowAlpha = 0;
    this.hovered = false;
    this.particles = [];
  }

  randomTarget() {
    const r = Utils.rand(0, CFG.CLUSTER_SCATTER_RADIUS);
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

    const ga = this.labelAlpha * (this.hovered ? 0.5 : 0.25);
    Utils.drawGlow(ctx, this.x, this.y, 55, this.colour, ga);

    const fontSize = isMobile ? CFG.LABEL_FONT_SIZE_MOBILE : CFG.LABEL_FONT_SIZE_DESKTOP;
    ctx.save();
    ctx.font = `300 ${fontSize} 'DM Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const tx = this.x;
    const ty = this.y + CFG.LABEL_OFFSET_Y;

    if (this.hovered) {
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(1.08, 1.08);
      ctx.translate(-tx, -ty);
    }

    ctx.shadowColor = Utils.rgba(CFG.COLOURS.background, 0.9);
    ctx.shadowBlur = 8;

    ctx.fillStyle = Utils.rgba(this.colour, this.labelAlpha * (this.hovered ? 1 : 0.85));
    ctx.fillText(this.label.toUpperCase(), tx, ty);

    if (this.hovered) ctx.restore();
    ctx.restore();
  }
}

// ── HERO UNIVERSE ──────────────────────────────────────────────────────────
class HeroUniverse {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.isMobile = Utils.isMobile();

    // State
    this.state = 'idle';
    this.stateT = 0;
    this.phaseStart = 0;

    // Simulation
    this.particles = [];
    this.ambientStars = [];
    this.clusters = [];
    this.grid = new SpatialGrid(CFG.BLACK_HOLE_RADIUS);

    // Click origin for burst
    this.originX = 0;
    this.originY = 0;

    // Cursor
    this.cursorX = -1000;
    this.cursorY = -1000;

    // Moving galactic swirl center for ambient stars
    this.ambientCenterX = 0;
    this.ambientCenterY = 0;
    this.targetAmbientCenterX = 0;
    this.targetAmbientCenterY = 0;

    // RAF
    this._rafId = null;
    this._lastTime = 0;

    // Callbacks
    this.onNavigate = null;
    this.onStable = null;

    this._boundResize = Utils.throttle(() => this._resize(), 150);

    this._init();
  }

  // ── INIT ────────────────────────────────────────────────

  _init() {
    this._resize();
    window.addEventListener('resize', this._boundResize);

    if (!this.isMobile) {
      this.canvas.addEventListener('mousemove', (e) => {
        const r = this.canvas.getBoundingClientRect();
        this.cursorX = e.clientX - r.left;
        this.cursorY = e.clientY - r.top;

        this.targetAmbientCenterX = this.cursorX;
        this.targetAmbientCenterY = this.cursorY;

        this._updateHover();

        if (this.state === 'idle') this._render();
      });

      this.canvas.addEventListener('mouseleave', () => {
        this.cursorX = -1000;
        this.cursorY = -1000;

        this.targetAmbientCenterX = this.width * 0.5;
        this.targetAmbientCenterY = this.height * 0.5;

        this.clusters.forEach(c => c.hovered = false);
        if (this.state === 'idle') this._render();
      });
    }

    if (this.isMobile) {
      this.canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const r = this.canvas.getBoundingClientRect();
        const t = e.touches[0];
        this.cursorX = t.clientX - r.left;
        this.cursorY = t.clientY - r.top;

        this.targetAmbientCenterX = this.cursorX;
        this.targetAmbientCenterY = this.cursorY;

        this._updateHover();
      }, { passive: false });
    }

    this.canvas.addEventListener('click', (e) => this._handleClick(e));

    this._buildIdleStars();
    this._startLoop();
  }

    _resize() {
    this.width = this.canvas.offsetWidth;
    this.height = this.canvas.offsetHeight;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.dpr = Utils.setupHiDPI(this.canvas, this.ctx, this.width, this.height);

    if (this.ambientCenterX === 0 && this.ambientCenterY === 0) {
      this.ambientCenterX = this.width * 0.5;
      this.ambientCenterY = this.height * 0.5;
      this.targetAmbientCenterX = this.ambientCenterX;
      this.targetAmbientCenterY = this.ambientCenterY;
    }

    this.clusters.forEach((c, i) => {
      c.x = CLUSTER_DEFS[i].fx * this.width;
      c.y = CLUSTER_DEFS[i].fy * this.height;
    });

    if (this.state === 'idle') this._buildIdleStars();
  }

  // ── IDLE ────────────────────────────────────────────────

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

    this._buildClusters();

    this.particles = [];
    for (let i = 0; i < n; i++) {
      const clusterIdx = i % 4;
      const p = new Particle(ox, oy, clusterIdx, n, i);
      this.clusters[clusterIdx].particles.push(p);
      this.particles.push(p);
    }

    this._buildAmbientStars();

    this._enterState('burst');
  }

  _buildClusters() {
    this.clusters = CLUSTER_DEFS.map((def, i) => {
      return new GalaxyCluster(def, CFG.COLOURS.clusters[i], this.width, this.height);
    });
  }

  _buildAmbientStars() {
    this.ambientStars = [];
    const n = this.isMobile
      ? CFG.AMBIENT_STAR_COUNT_MOBILE
      : CFG.AMBIENT_STAR_COUNT_DESKTOP;

    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const maxR = Math.sqrt(cx * cx + cy * cy);

    for (let i = 0; i < n; i++) {
      // Distribute across the whole screen, but biased toward a broad disc
      const angle = Utils.rand(0, Math.PI * 2);
      const r = Math.pow(Math.random(), 0.72) * maxR;

      const x = cx + Math.cos(angle) * r + Utils.rand(-40, 40);
      const y = cy + Math.sin(angle) * r * 0.72 + Utils.rand(-30, 30);

      // Initial velocity tangent to orbit around screen center
      const speed = Utils.rand(CFG.AMBIENT_STAR_SPEED_MIN, CFG.AMBIENT_STAR_SPEED_MAX);
      const vx = (-Math.sin(angle)) * speed;
      const vy = ( Math.cos(angle)) * speed;

      this.ambientStars.push(new AmbientStar(x, y, vx, vy));
    }
  }

  // ── STATE MACHINE ───────────────────────────────────────

  _enterState(name) {
    this.state = name;
    this.phaseStart = performance.now();
    this.stateT = 0;
  }

  _startLoop() {
    if (this._rafId) return;

    this._lastTime = performance.now();

    const tick = (now) => {
      const dt = now - this._lastTime;
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
    this._updateAmbientCenter();
    
    switch (this.state) {
      case 'idle':
        break;
      case 'burst':
        this._updateBurst();
        break;
      case 'expansion':
        this._updateExpansion();
        break;
      case 'clustering':
        this._updateClustering();
        break;
      case 'navigation':
        this._updateNavigation();
        break;
      case 'transition':
        break;
    }
  }

  _updateBurst() {
    const progress = Utils.clamp(this.stateT / CFG.BURST_DURATION_MS, 0, 1);
    const friction = Utils.lerp(0.88, CFG.EXPANSION_FRICTION, progress);

    this.particles.forEach(p => {
      p.updateBurst(friction);
      p.radius = Utils.lerp(
        CFG.BURST_PARTICLE_RADIUS,
        CFG.BURST_FADE_RADIUS,
        Utils.easeOutExpo(progress)
      );
      p.colour = Utils.lerpColour(
        CFG.COLOURS.burstCore,
        p.baseColour,
        Utils.easeOutExpo(progress)
      );
    });

    this.ambientStars.forEach(s =>
      s.update(this.width, this.height, this.ambientCenterX, this.ambientCenterY)
    );

    if (progress >= 1) this._enterState('expansion');
  }

  _updateExpansion() {
    const progress = Utils.clamp(this.stateT / CFG.EXPANSION_DURATION_MS, 0, 1);

    this.particles.forEach(p => {
      p.updateBurst(CFG.EXPANSION_FRICTION);
      p.radius = Utils.lerp(
        CFG.BURST_FADE_RADIUS,
        p.targetRadius,
        Utils.easeOutCubic(progress)
      );
    });

    this.ambientStars.forEach(s =>
      s.update(this.width, this.height, this.ambientCenterX, this.ambientCenterY)
    );
    
    if (progress >= 1) this._beginClustering();
  }

  _beginClustering() {
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

    this.ambientStars.forEach(s =>
      s.update(this.width, this.height, this.ambientCenterX, this.ambientCenterY)
    );

    const labelT = Utils.clamp((progress - 0.4) / 0.6, 0, 1);
    this.clusters.forEach(c => {
      c.labelAlpha = Utils.easeOutCubic(labelT);
      c.glowAlpha = Utils.easeOutCubic(labelT);
    });

    if (progress >= 1) {
      this._enterState('navigation');
      if (this.onStable) this.onStable();
    }
  }

  _updateNavigation() {
    this.grid.clear();
    this.particles.forEach(p => this.grid.insert(p));

    if (this.cursorX > -500) {
      const nearby = this.grid.query(this.cursorX, this.cursorY, CFG.BLACK_HOLE_RADIUS);
      nearby.forEach(p => {
        const dSq = Utils.distSq(this.cursorX, this.cursorY, p.x, p.y);
        if (dSq < CFG.BLACK_HOLE_RADIUS * CFG.BLACK_HOLE_RADIUS) {
          const falloff = 1 - Math.sqrt(dSq) / CFG.BLACK_HOLE_RADIUS;
          p.applyCursorForce(
            this.cursorX,
            this.cursorY,
            CFG.BLACK_HOLE_STRENGTH * falloff * 60
          );
        }
      });
    }

    this.particles.forEach(p => {
      const cluster = this.clusters[p.clusterIdx];
      p.updateNavigation(cluster.x, cluster.y);
    });

    this.ambientStars.forEach(s =>
      s.update(this.width, this.height, this.ambientCenterX, this.ambientCenterY)
    );
  }

  _updateAmbientCenter() {
    this.ambientCenterX = Utils.lerp(this.ambientCenterX, this.targetAmbientCenterX, 0.045);
    this.ambientCenterY = Utils.lerp(this.ambientCenterY, this.targetAmbientCenterY, 0.045);
  }

  // ── RENDER ──────────────────────────────────────────────

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Background
    ctx.fillStyle = Utils.rgba(CFG.COLOURS.background, 1);
    ctx.fillRect(0, 0, this.width, this.height);

    // Idle starfield
    if (this.state === 'idle' && this._idleStars) {
      this._idleStars.forEach(s => {
        Utils.fillCircle(ctx, s.x, s.y, s.r, Utils.rgba(s.c, s.a));
      });
    }

    // Ambient/free stars
    this.ambientStars.forEach(s => s.draw(ctx));

    // Burst flash
    if (this.state === 'burst') {
      const flashT = Utils.clamp(1 - this.stateT / CFG.BURST_DURATION_MS, 0, 1);
      const flashAlp = Utils.easeInExpo(flashT) * 0.75;
      Utils.drawGlow(
        ctx,
        this.originX,
        this.originY,
        300 * (1 - flashT + 0.1),
        CFG.COLOURS.burstCore,
        flashAlp
      );
    }

    // Main particles
    this.particles.forEach(p => {
      let alpha = 1;
      if (this.state === 'burst') {
        alpha = Utils.clamp(this.stateT / (CFG.BURST_DURATION_MS * 0.5), 0, 1);
      }
      p.draw(ctx, alpha);
    });

    // Cluster glows + labels
    this.clusters.forEach(c => c.draw(ctx, this.isMobile));

    // Custom cursor in idle and navigation
    if ((this.state === 'idle' || this.state === 'navigation') && !this.isMobile && this.cursorX > -500) {
      this._drawBlackHoleCursor(ctx);
    }
  }

  _drawBlackHoleCursor(ctx) {
    const x = this.cursorX;
    const y = this.cursorY;
    const r = 7;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, r + 2, 0, Math.PI * 2);
    ctx.strokeStyle = Utils.rgba(CFG.COLOURS.clusters[1], 0.7);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    Utils.drawGlow(ctx, x, y, 30, CFG.COLOURS.clusters[1], 0.12);
  }

  // ── INTERACTION ─────────────────────────────────────────

  _updateHover() {
    if (this.state !== 'navigation') return;

    this.clusters.forEach(c => {
      c.hovered = c.isHit(this.cursorX, this.cursorY);
    });

    this.canvas.style.cursor = 'none';
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

  getState() {
    return this.state;
  }

  destroy() {
    this._stopLoop();
    window.removeEventListener('resize', this._boundResize);
  }
}

window.HeroUniverse = HeroUniverse;
