/**
 * hero-universe.js
 * ────────────────
 * Interactive homepage universe for a static site.
 *
 * STATE MACHINE
 * ─────────────
 *  idle        → waiting for first click
 *  burst       → dense hot Big Bang / plasma phase
 *  expansion   → particles free-stream and cool
 *  clustering  → surviving colored particles gather into 4 section galaxies
 *  navigation  → stable interactive state; cursor = black hole
 *  transition  → user clicked a cluster; page transition handled elsewhere
 */

'use strict';

// ── TUNABLE CONSTANTS ───────────────────────────────────────────────────────
const CFG = {
  // Section-galaxy particles
  PARTICLE_COUNT_DESKTOP: 1200,
  PARTICLE_COUNT_MOBILE: 400,

  // Ambient/free stars (persistent background)
  AMBIENT_STAR_COUNT_DESKTOP: 1200,
  AMBIENT_STAR_COUNT_MOBILE: 400,
  AMBIENT_STAR_SPEED_MIN: 0.18,
  AMBIENT_STAR_SPEED_MAX: 0.85,
  AMBIENT_STAR_RADIUS_MIN: 0.25,
  AMBIENT_STAR_RADIUS_MAX: 1.35,
  AMBIENT_SWIRL_STRENGTH: 0.0026,
  AMBIENT_CENTER_PULL: 0.00012,

  // Temporary dense burst/plasma particles
  BURST_FIELD_COUNT_DESKTOP: 2000,
  BURST_FIELD_COUNT_MOBILE: 1000,
  BURST_FIELD_SPEED_MIN: 0.4,
  BURST_FIELD_SPEED_MAX: 7.5,
  BURST_FIELD_RADIUS_MIN: 0.6,
  BURST_FIELD_RADIUS_MAX: 2.4,
  BURST_FIELD_SURVIVAL_RATE: 0.5,

  // Burst
  BURST_DURATION_MS: 450,
  BURST_MAX_SPEED: 28,
  BURST_PARTICLE_RADIUS: 2.5,
  BURST_FADE_RADIUS: 1.0,

  // Expansion / cooling
  EXPANSION_DURATION_MS: 1700,
  EXPANSION_FRICTION: 0.965,

  // Clustering
  CLUSTERING_DURATION_MS: 2000,
  CLUSTER_SPRING_K: 0.025,
  CLUSTER_NOISE: 0.35,
  CLUSTER_SCATTER_RADIUS: 120,
  CLUSTER_STAGGER_MS: 300,

  // Navigation
  BLACK_HOLE_RADIUS: 90,
  BLACK_HOLE_STRENGTH: 0.55,
  BLACK_HOLE_ORBIT_SCALE: 0.08,

  STAR_MIN_RADIUS: 0.6,
  STAR_MAX_RADIUS: 2.0,

  // Labels
  LABEL_FONT_SIZE_DESKTOP: '13px',
  LABEL_FONT_SIZE_MOBILE: '11px',
  LABEL_OFFSET_Y: 58,
  CLUSTER_HIT_RADIUS: 70,

  // Timing
  HINT_SHOW_DELAY_MS: 4200,

  // Colours
  COLOURS: {
    background: { r: 6, g: 7, b: 13 },
    starBase: { r: 180, g: 190, b: 230 },
    starWarm: { r: 232, g: 192, b: 125 },
    burstCore: { r: 255, g: 245, b: 210 },
    clusters: [
      { r: 79,  g: 129, b: 245 },  // research
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

// ── SECTION-GALAXY PARTICLE ────────────────────────────────────────────────
class Particle {
  constructor(x, y, clusterIdx, totalCount, index) {
    this.clusterIdx = clusterIdx;

    this.x = x + Utils.rand(-2, 2);
    this.y = y + Utils.rand(-2, 2);
    this.ox = this.x;
    this.oy = this.y;

    const angle = (index / totalCount) * Math.PI * 2 + Utils.rand(-0.4, 0.4);
    const speed = Utils.rand(CFG.BURST_MAX_SPEED * 0.3, CFG.BURST_MAX_SPEED);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.radius = CFG.BURST_PARTICLE_RADIUS;
    this.targetRadius = Utils.rand(CFG.STAR_MIN_RADIUS, CFG.STAR_MAX_RADIUS);
    this.twinklePhase = Utils.rand(0, Math.PI * 2);
    this.twinkleSpeed = Utils.rand(0.02, 0.06);

    const clusterRgb = CFG.COLOURS.clusters[clusterIdx];
    const t = Utils.rand(0, 0.7);
    this.baseColour = Utils.lerpColour(CFG.COLOURS.starBase, clusterRgb, t);
    this.colour = { ...this.baseColour };

    this.clusterTarget = null;
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
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 12);

    const preferredRadius = CFG.CLUSTER_SCATTER_RADIUS * 1.15;

    if (dist > preferredRadius) {
      this.vx += dx * 0.0016;
      this.vy += dy * 0.0016;
    } else if (dist < preferredRadius * 0.55) {
      this.vx -= dx * 0.0009;
      this.vy -= dy * 0.0009;
    }

    const orbitStrength = 0.085 / Math.sqrt(dist + 18);
    this.vx += (-dy / dist) * orbitStrength;
    this.vy += ( dx / dist) * orbitStrength;

    this.vx *= 0.945;
    this.vy *= 0.945;

    this.x += this.vx;
    this.y += this.vy;

    this.twinklePhase += this.twinkleSpeed;
    const tw = (Math.sin(this.twinklePhase) * 0.5 + 0.5);
    this.radius = Utils.lerp(this.targetRadius * 0.6, this.targetRadius, tw);
  }

  draw(ctx, alpha = 1) {
    if (this.radius < 0.1) return;
    Utils.fillCircle(
      ctx,
      this.x,
      this.y,
      this.radius,
      Utils.rgba(this.colour, Utils.clamp(alpha, 0, 1))
    );
  }
}

// ── TEMPORARY HOT BURST / PLASMA PARTICLE ──────────────────────────────────
class BurstParticle {
  constructor(x, y, angle, speed, colour) {
    const jitterR = Utils.rand(0, 56);
    const jitterA = Utils.rand(0, Math.PI * 2);

    this.x = x + Math.cos(jitterA) * jitterR;
    this.y = y + Math.sin(jitterA) * jitterR;

    this.vx = Math.cos(angle) * speed + Utils.gaussRand() * 0.45;
    this.vy = Math.sin(angle) * speed + Utils.gaussRand() * 0.45;

    this.radius = Utils.rand(CFG.BURST_FIELD_RADIUS_MIN, CFG.BURST_FIELD_RADIUS_MAX);
    this.alpha = Utils.rand(0.35, 1.0);
    this.colour = colour;

    this.alive = true;
    this.survives = Math.random() < CFG.BURST_FIELD_SURVIVAL_RATE;
  }

  update(friction = 0.992) {
    this.vx *= friction;
    this.vy *= friction;
    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx, coolingProgress = 0) {
    if (!this.alive) return;

    const fade = this.survives
      ? Utils.lerp(1.0, 0.12, coolingProgress)
      : Utils.lerp(1.0, 0.0, coolingProgress);

    if (fade <= 0.01) return;

    Utils.fillCircle(
      ctx,
      this.x,
      this.y,
      this.radius,
      Utils.rgba(this.colour, this.alpha * fade)
    );
  }
}

// ── AMBIENT BACKGROUND STAR ────────────────────────────────────────────────
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

    const white = { r: 255, g: 255, b: 255 };
    this.colour = Utils.lerpColour(
      CFG.COLOURS.starBase,
      white,
      Utils.rand(0.65, 1.0)
    );
  }

  freeUpdate(width, height, friction = 1.0) {
    this.vx *= friction;
    this.vy *= friction;

    this.x += this.vx;
    this.y += this.vy;

    this.twinklePhase += this.twinkleSpeed;

    if (this.x < -20) this.x = width + 20;
    if (this.x > width + 20) this.x = -20;
    if (this.y < -20) this.y = height + 20;
    if (this.y > height + 20) this.y = -20;
  }

  update(width, height, cx, cy) {
    const dx = this.x - cx;
    const dy = this.y - cy;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 12);

    this.vx += (-dy / dist) * CFG.AMBIENT_SWIRL_STRENGTH * dist;
    this.vy += ( dx / dist) * CFG.AMBIENT_SWIRL_STRENGTH * dist;

    this.vx += (-dx) * CFG.AMBIENT_CENTER_PULL;
    this.vy += (-dy) * CFG.AMBIENT_CENTER_PULL;

    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy) || 1;
    const targetSpeed = Utils.clamp(speed, CFG.AMBIENT_STAR_SPEED_MIN, CFG.AMBIENT_STAR_SPEED_MAX);

    this.vx = (this.vx / speed) * targetSpeed;
    this.vy = (this.vy / speed) * targetSpeed;

    this.x += this.vx;
    this.y += this.vy;

    this.twinklePhase += this.twinkleSpeed;

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

    this.state = 'idle';
    this.stateT = 0;
    this.phaseStart = 0;

    this.particles = [];
    this.ambientStars = [];
    this.burstParticles = [];
    this.clusters = [];
    this.grid = new SpatialGrid(CFG.BLACK_HOLE_RADIUS);

    this.originX = 0;
    this.originY = 0;

    this.cursorX = -1000;
    this.cursorY = -1000;

    this.ambientCenterX = 0;
    this.ambientCenterY = 0;
    this.targetAmbientCenterX = 0;
    this.targetAmbientCenterY = 0;

    this._rafId = null;
    this._lastTime = 0;

    this.onNavigate = null;
    this.onStable = null;

    this._boundResize = Utils.throttle(() => this._resize(), 150);

    this._init();
  }

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

  _buildClusters() {
    this.clusters = CLUSTER_DEFS.map((def, i) => {
      return new GalaxyCluster(def, CFG.COLOURS.clusters[i], this.width, this.height);
    });
  }

  _buildBurstField() {
    this.burstParticles = [];

    const n = this.isMobile
      ? CFG.BURST_FIELD_COUNT_MOBILE
      : CFG.BURST_FIELD_COUNT_DESKTOP;

    for (let i = 0; i < n; i++) {
      const angle = Utils.rand(0, Math.PI * 2);

      const speedBias = Math.random();
      const speed = speedBias < 0.72
        ? Utils.rand(CFG.BURST_FIELD_SPEED_MIN, CFG.BURST_FIELD_SPEED_MAX * 0.45)
        : Utils.rand(CFG.BURST_FIELD_SPEED_MIN, CFG.BURST_FIELD_SPEED_MAX);

      let colour;
      const t = Math.random();
      if (t < 0.72) {
        colour = Utils.lerpColour(CFG.COLOURS.burstCore, { r: 255, g: 255, b: 255 }, Math.random());
      } else if (t < 0.82) {
        colour = CFG.COLOURS.clusters[0];
      } else if (t < 0.90) {
        colour = CFG.COLOURS.clusters[1];
      } else if (t < 0.97) {
        colour = CFG.COLOURS.clusters[2];
      } else {
        colour = CFG.COLOURS.clusters[3];
      }

      this.burstParticles.push(
        new BurstParticle(this.originX, this.originY, angle, speed, colour)
      );
    }
  }

  _buildAmbientStars() {
    this.ambientStars = [];
    const n = this.isMobile
      ? CFG.AMBIENT_STAR_COUNT_MOBILE
      : CFG.AMBIENT_STAR_COUNT_DESKTOP;

    for (let i = 0; i < n; i++) {
      const angle = Utils.rand(0, Math.PI * 2);
      const speed = Utils.rand(CFG.AMBIENT_STAR_SPEED_MIN, CFG.AMBIENT_STAR_SPEED_MAX) + Utils.rand(0.2, 1.8);
      const spread = Utils.rand(0, 28);

      const x = this.originX + Math.cos(angle) * spread;
      const y = this.originY + Math.sin(angle) * spread;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      this.ambientStars.push(new AmbientStar(x, y, vx, vy));
    }
  }

  triggerBang(ox, oy) {
    if (this.state !== 'idle') return;

    this.originX = ox;
    this.originY = oy;

    const n = this.isMobile
      ? CFG.PARTICLE_COUNT_MOBILE
      : CFG.PARTICLE_COUNT_DESKTOP;

    this._buildClusters();
    this._buildBurstField();

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

  _update() {
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
    const friction = Utils.lerp(0.90, CFG.EXPANSION_FRICTION, progress);

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

    this.burstParticles.forEach(p => p.update(0.988));

    this.ambientStars.forEach(s =>
      s.freeUpdate(this.width, this.height, 0.998)
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

    this.burstParticles.forEach(p => p.update(0.992));

    if (progress > 0.08) {
      this.burstParticles.forEach(p => {
        if (!p.survives && Math.random() < progress * 0.065) {
          p.alive = false;
        }
      });
    }
    this.burstParticles = this.burstParticles.filter(p => p.alive || p.survives);

    this.ambientStars.forEach(s =>
      s.freeUpdate(this.width, this.height, 0.999)
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

    this.burstParticles.forEach(p => p.update(0.996));
    this.burstParticles = this.burstParticles.filter(p => p.alive || p.survives);

    this.ambientStars.forEach(s =>
      s.freeUpdate(this.width, this.height, 1.0)
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
            CFG.BLACK_HOLE_STRENGTH * falloff * 16
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
    this.ambientCenterX = Utils.lerp(this.ambientCenterX, this.targetAmbientCenterX, 0.012);
    this.ambientCenterY = Utils.lerp(this.ambientCenterY, this.targetAmbientCenterY, 0.012);
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.fillStyle = Utils.rgba(CFG.COLOURS.background, 1);
    ctx.fillRect(0, 0, this.width, this.height);

    Utils.drawGlow(
      ctx,
      this.ambientCenterX,
      this.ambientCenterY,
      110,
      { r: 20, g: 18, b: 40 },
      0.16
    );

    if (this.state === 'idle' && this._idleStars) {
      this._idleStars.forEach(s => {
        Utils.fillCircle(ctx, s.x, s.y, s.r, Utils.rgba(s.c, s.a));
      });
    }

    this.ambientStars.forEach(s => s.draw(ctx));

    if (this.state === 'burst') {
      const flashT = Utils.clamp(1 - this.stateT / CFG.BURST_DURATION_MS, 0, 1);
      const flashAlp = Utils.easeInExpo(flashT) * 0.85;
      Utils.drawGlow(
        ctx,
        this.originX,
        this.originY,
        360 * (1 - flashT + 0.14),
        CFG.COLOURS.burstCore,
        flashAlp
      );
    }

    let coolingProgress = 0;
    if (this.state === 'burst') {
      coolingProgress = 0;
    } else if (this.state === 'expansion') {
      coolingProgress = Utils.clamp(this.stateT / CFG.EXPANSION_DURATION_MS, 0, 1);
    } else if (this.state === 'clustering' || this.state === 'navigation') {
      coolingProgress = 1;
    }

    this.burstParticles.forEach(p => p.draw(ctx, coolingProgress));

    this.particles.forEach(p => {
      let alpha = 1;
      if (this.state === 'burst') {
        alpha = Utils.clamp(this.stateT / (CFG.BURST_DURATION_MS * 0.5), 0, 1);
      }
      p.draw(ctx, alpha);
    });

    this.clusters.forEach(c => c.draw(ctx, this.isMobile));

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

  getState() {
    return this.state;
  }

  destroy() {
    this._stopLoop();
    window.removeEventListener('resize', this._boundResize);
  }
}

window.HeroUniverse = HeroUniverse;
