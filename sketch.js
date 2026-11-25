/* 山水的回响 · Echoes of Landscape  (v2 · 暗夜潮汐)
   第 2 周 · 生成艺术 / p5.js
   粒子沿 Perlin 风场漂移成潮汐长线，鼠标是风，点击荡开回声。
   按钮 / 1 2 3 换墨色   R 重来   S 存图
*/

const PALETTES = [
  { name: '一 · 玄墨', paper: [8, 10, 12], ink: [225, 231, 236], mist: [96, 120, 134], seal: [158, 84, 62] },
  { name: '二 · 青瓷', paper: [9, 15, 16], ink: [212, 230, 226], mist: [86, 124, 118], seal: [150, 96, 68] },
  { name: '三 · 夜金', paper: [12, 10, 9], ink: [236, 226, 211], mist: [124, 105, 84], seal: [176, 132, 74] }
];

let P = PALETTES[0];
let pi = 0;

let base, ink, grain, vignette;
let titleG, glowG, glints = [];
let titleX = 0, titleY = 0, titleSize = 80;
const TITLE_FONT = '"Source Han Serif SC", "STZhongsong", "STSong", "SimSun", serif';
let ridges = [];
let parts = [];
let sparks = [];
let rings = [];
let burst = [];
let hist = [];
const ghostDelays = [16, 34, 56];
const ghostStrength = [0.55, 0.28, 0.12];

let t = 0;
let intro = 0;
let showHint = true;
let hintStart = 0;
let needsBuild = true;

const N = 1300;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(Math.min(2, displayDensity()));
  textFont('Songti SC, SimSun, STSong, serif');

  const m = location.search.match(/[?&]p=([0-9])/);
  if (m) { pi = Number(m[1]) % 3; P = PALETTES[pi]; }

  needsBuild = true;
  hintStart = millis();
  wireUI();

  if (location.search.indexOf('clean') >= 0) {
    const d = document.getElementById('dock');
    if (d) d.style.display = 'none';
  }

  if (location.search.indexOf('still') >= 0) {
    intro = 2;
    ensureLayers();
    for (let i = 0; i < 1100; i++) stepWorld(false);
    showHint = false;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  needsBuild = true;
}

function ensureLayers() {
  if (!needsBuild && base && base.width === width && base.height === height &&
      ink && ink.width === width && ink.height === height) return;
  buildAll();
  needsBuild = false;
}

function buildAll() {
  base = createGraphics(width, height);
  base.pixelDensity(1);
  ink = createGraphics(width, height);
  ink.pixelDensity(1);
  drawBase(base);
  makeGrain();
  makeVignette();
  seedParts();
  seedSparks();
  seedGlints();
  rings = [];
  hist = [];
}

/* ---------------- 夜与山 ---------------- */

function drawBase(g) {
  ridges = [];
  const ctx = g.drawingContext;
  const dark = luminance(P.paper) < 0.4;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  if (dark) {
    grad.addColorStop(0, rgba(shade(P.paper, 0.015), 1));
    grad.addColorStop(0.55, rgba(P.paper, 1));
    grad.addColorStop(1, rgba(shade(P.paper, -0.012), 1));
  } else {
    grad.addColorStop(0, rgba(P.paper, 1));
    grad.addColorStop(0.58, rgba(P.paper, 1));
    grad.addColorStop(1, rgba(shade(P.paper, -0.05), 1));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 地平线微光（不画月亮，避免与参考撞形）
  const hx = width * 0.5, hy = height * 1.02, hr = Math.max(width, height) * 0.95;
  const halo = ctx.createRadialGradient(hx, hy, hr * 0.05, hx, hy, hr);
  halo.addColorStop(0, rgba(P.mist, dark ? 0.52 : 0.22));
  halo.addColorStop(0.40, rgba(P.mist, dark ? 0.16 : 0.08));
  halo.addColorStop(1, rgba(P.mist, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  // 远山剪影（暗底时只在光晕里隐约可见）
  const layers = dark
    ? [
        { b: 0.700, a: 0.10, al: 0.10, f: 0.00120 },
        { b: 0.790, a: 0.11, al: 0.13, f: 0.00160 },
        { b: 0.885, a: 0.09, al: 0.18, f: 0.00230 }
      ]
    : [
        { b: 0.545, a: 0.115, al: 0.10, f: 0.00120 },
        { b: 0.635, a: 0.130, al: 0.17, f: 0.00155 },
        { b: 0.745, a: 0.150, al: 0.26, f: 0.00195 },
        { b: 0.880, a: 0.105, al: 0.50, f: 0.00260 }
      ];

  for (let L = 0; L < layers.length; L++) {
    const c = layers[L];
    const pts = [];
    g.noStroke();
    g.fill(P.mist[0], P.mist[1], P.mist[2], c.al * 255);
    g.beginShape();
    g.vertex(-10, height + 10);
    for (let x = -10; x <= width + 10; x += 4) {
      const n1 = noise(x * c.f + L * 19.7);
      const n2 = noise(x * c.f * 2.9 + L * 6.3) * 0.34;
      const bell = 1 - Math.pow((x / width - 0.62) / 0.78, 2) * 0.72;
      const y = height * c.b - (n1 + n2) * height * c.a * Math.max(0.22, bell);
      g.vertex(x, y);
      pts.push(y);
    }
    g.vertex(width + 10, height + 10);
    g.endShape(CLOSE);
    ridges.push(pts);
  }

  // 底部雾带
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const fog = ctx.createLinearGradient(0, height * 0.72, 0, height);
  fog.addColorStop(0, rgba(P.paper, 0));
  fog.addColorStop(1, rgba(dark ? shade(P.paper, 0.05) : shade(P.paper, -0.05), dark ? 0.45 : 0.30));
  ctx.fillStyle = fog;
  ctx.fillRect(0, height * 0.72, width, height * 0.28);
  ctx.restore();
}

function makeGrain() {
  grain = createGraphics(width, height);
  grain.pixelDensity(1);
  grain.loadPixels();
  const light = luminance(P.paper) > 0.5;
  const count = Math.floor(width * height * 0.03);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const idx = 4 * (y * width + x);
    grain.pixels[idx] = light ? 0 : 255;
    grain.pixels[idx + 1] = light ? 0 : 255;
    grain.pixels[idx + 2] = light ? 0 : 255;
    grain.pixels[idx + 3] = Math.random() * 9;
  }
  grain.updatePixels();
}

function makeVignette() {
  vignette = createGraphics(width, height);
  vignette.pixelDensity(1);
  const ctx = vignette.drawingContext;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const r = Math.max(width, height) * 0.82;
  const g2 = ctx.createRadialGradient(width * 0.5, height * 0.45, r * 0.40, width * 0.5, height * 0.45, r);
  const light = luminance(P.paper) > 0.5;
  g2.addColorStop(0, 'rgba(0,0,0,0)');
  g2.addColorStop(1, light ? 'rgba(26,30,24,0.14)' : 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/* ---------------- 潮汐线 ---------------- */

function seedParts() {
  parts = [];
  for (let i = 0; i < N; i++) parts.push(newDust(true));
}

function seedSparks() {
  sparks = [];
  const n = Math.max(160, Math.round(width * height / 3600));
  for (let i = 0; i < n; i++) {
    sparks.push({
      x: Math.random() * width,
      y: height * (0.03 + Math.pow(Math.random(), 0.85) * 0.88),
      r: 0.5 + Math.random() * 1.5,
      ph: Math.random() * TWO_PI,
      sp: 0.012 + Math.random() * 0.045,
      a: 0.35 + Math.random() * 0.65
    });
  }
}

function drawSparks() {
  const k = Math.min(1, Math.max(0, intro / 1.1));
  if (k <= 0 || luminance(P.paper) > 0.4) return;
  blendMode(ADD);
  noStroke();
  for (const s of sparks) {
    const tw = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
    const a = s.a * (0.10 + 0.90 * tw * tw * tw) * k;
    fill(P.ink[0], P.ink[1], P.ink[2], 9 * a);
    circle(s.x, s.y, s.r * 9);
    fill(P.ink[0], P.ink[1], P.ink[2], 235 * a);
    circle(s.x, s.y, s.r * 1.1);
  }
  // 星芒
  for (const g of glints) {
    const tw = Math.max(0, Math.sin(t * g.sp + g.ph));
    const a = Math.pow(tw, 2.2) * k;
    if (a < 0.02) continue;
    stroke(P.ink[0], P.ink[1], P.ink[2], 120 * a);
    strokeWeight(0.8);
    line(g.x - g.r, g.y, g.x + g.r, g.y);
    line(g.x, g.y - g.r, g.x, g.y + g.r);
    noStroke();
    fill(P.ink[0], P.ink[1], P.ink[2], 40 * a);
    circle(g.x, g.y, g.r * 1.1);
    fill(P.ink[0], P.ink[1], P.ink[2], 230 * a);
    circle(g.x, g.y, 1.8);
  }
  // 点击迸出的光尘
  for (const b of burst) {
    const a = Math.max(0, b.life);
    fill(P.ink[0], P.ink[1], P.ink[2], 40 * a);
    circle(b.x, b.y, b.r * 9);
    fill(P.ink[0], P.ink[1], P.ink[2], 235 * a);
    circle(b.x, b.y, b.r * 1.6);
  }
  blendMode(BLEND);
}

function seedGlints() {
  glints = [];
  const n = 16;
  for (let i = 0; i < n; i++) {
    glints.push({
      x: Math.random() * width,
      y: height * (0.08 + Math.random() * 0.62),
      r: 7 + Math.random() * 16,
      ph: Math.random() * TWO_PI,
      sp: 0.006 + Math.random() * 0.018
    });
  }
}

function buildTitleLayer() {
  const port = width / height < 0.95;
  const ts = Math.max(30, Math.min(width * (port ? 0.155 : 0.105), height * (port ? 0.085 : 0.135)));
  titleSize = ts;
  const chars = ['山', '水', '的', '回', '响'];
  const gap = ts * 1.08;
  const pad = ts * 0.42;
  const bw = Math.ceil(gap * (chars.length - 1) + ts + pad * 2);
  const bh = Math.ceil(ts * 1.5 + pad * 2);

  titleG = createGraphics(bw, bh);
  titleG.pixelDensity(1);
  titleG.clear();
  titleG.textFont(TITLE_FONT);
  titleG.textAlign(CENTER, CENTER);
  titleG.textSize(ts);
  titleG.noStroke();
  titleG.fill(255);
  for (let i = 0; i < chars.length; i++) {
    titleG.text(chars[i], pad + ts / 2 + i * gap, bh / 2);
  }

  // 金属渐变：上白 → 冷银 → 下白
  const dark = luminance(P.paper) < 0.4;
  const c = titleG.drawingContext;
  c.save();
  c.globalCompositeOperation = 'source-in';
  const gd = c.createLinearGradient(0, 0, 0, bh);
  if (dark) {
    gd.addColorStop(0.00, '#FFFFFF');
    gd.addColorStop(0.34, '#EAF4FB');
    gd.addColorStop(0.52, '#8FB6D0');
    gd.addColorStop(0.62, '#D8E9F4');
    gd.addColorStop(1.00, '#FFFFFF');
  } else {
    gd.addColorStop(0.00, '#22302A');
    gd.addColorStop(0.50, '#556E60');
    gd.addColorStop(1.00, '#1B2620');
  }
  c.fillStyle = gd;
  c.fillRect(0, 0, bw, bh);
  c.restore();

  glowG = createGraphics(bw, bh);
  glowG.pixelDensity(1);
  glowG.clear();
  const gc = glowG.drawingContext;
  gc.filter = 'blur(' + Math.max(7, ts * 0.09) + 'px)';
  gc.drawImage(titleG.canvas, 0, 0);
  gc.filter = 'none';

  titleX = width * 0.5 - bw * 0.5;
  titleY = height * (port ? 0.50 : 0.505) - bh * 0.5;
}

function ridgeYAt(L, x) {
  if (!ridges.length) return height * 0.8;
  const row = ridges[Math.max(0, Math.min(ridges.length - 1, L))];
  const i = Math.max(0, Math.min(row.length - 1, Math.round((x + 10) / 4)));
  return row[i];
}

function newDust(anywhere) {
  const L = Math.floor(Math.random() * Math.max(1, ridges.length));
  const x = Math.random() * width;
  const y = Math.random() < 0.55
    ? ridgeYAt(L, x) + Math.random() * (30 + L * 40)
    : height * (0.25 + Math.random() * 0.75);
  return {
    x: x, y: y,
    s: 0.7 + Math.random() * 1.4,
    w: 0.7 + Math.random() * 1.3,
    age: Math.random() * 400,
    life: 420 + Math.random() * 700,
    L: L
  };
}

function fieldAngle(x, y) {
  return noise(x * 0.0016, y * 0.0016, t * 0.00028) * TWO_PI * 2.6 - PI;
}

function stepWorld(silent) {
  t += 1;

  const c = ink.drawingContext;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = 'rgba(0,0,0,0.0028)';
  c.fillRect(0, 0, width, height);
  c.restore();

  const pointers = [];
  if (hist.length) {
    pointers.push({ x: hist[hist.length - 1].x, y: hist[hist.length - 1].y, k: 1 });
    for (let i = 0; i < ghostDelays.length; i++) {
      const idx = Math.max(0, hist.length - 1 - ghostDelays[i]);
      pointers.push({ x: hist[idx].x, y: hist[idx].y, k: ghostStrength[i] });
    }
  }

  for (const p of parts) {
    const a = fieldAngle(p.x, p.y);
    let vx = Math.cos(a) * 1.5 * p.s;
    let vy = Math.sin(a) * 0.8 * p.s + 0.06;

    for (const q of pointers) {
      const dx = p.x - q.x, dy = p.y - q.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
      if (d < 300) {
        const f = (1 - d / 300) * 1.9 * q.k;
        vx += (dx / d) * f * 7.0;
        vy += (dy / d) * f * 7.0;
      }
    }

    p.x += vx; p.y += vy;
    p.age += 0.4 + Math.random() * 0.5;

    if (!silent) {
      ink.stroke(P.ink[0], P.ink[1], P.ink[2], 14 + Math.random() * 16);
      ink.strokeWeight(p.w);
      ink.line(p.x - vx * 4, p.y - vy * 4, p.x, p.y);
    }

    if (p.age > p.life || p.x < -60 || p.x > width + 60 || p.y < -60 || p.y > height + 60) {
      const f = newDust(false);
      p.x = f.x; p.y = f.y; p.age = 0; p.s = f.s; p.w = f.w; p.L = f.L;
    }
  }

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.r += 2.4; r.a *= 0.968;
    ink.noFill();
    ink.stroke(P.ink[0], P.ink[1], P.ink[2], r.a);
    ink.strokeWeight(1.1);
    ink.circle(r.x, r.y, r.r * 2);
    ink.strokeWeight(0.5);
    ink.circle(r.x, r.y, r.r * 2 * 0.8);
    if (r.a < 1.2) rings.splice(i, 1);
  }
}

/* ---------------- 画面 ---------------- */

function draw() {
  ensureLayers();
  stepWorld(false);

  for (let i = burst.length - 1; i >= 0; i--) {
    const b = burst[i];
    b.x += b.vx; b.y += b.vy;
    b.vx *= 0.955; b.vy *= 0.955;
    b.life -= 0.014;
    if (b.life <= 0) burst.splice(i, 1);
  }

  if (hist.length > 160) hist.splice(0, hist.length - 160);
  intro = Math.min(1.6, intro + 0.014);

  image(base, 0, 0, width, height);
  image(ink, 0, 0, width, height);
  image(vignette, 0, 0, width, height);

  drawSparks();
  drawType();
  if (showHint) drawHint();

  image(grain, 0, 0, width, height);
}

function drawType() {
  const k = Math.min(1, Math.max(0, (intro - 0.2) / 0.9));
  const W = width, H = height;
  const port = W / H < 0.95;
  const u = Math.min(W, H);
  const dark = luminance(P.paper) < 0.4;

  // 竖排小标题（不要大字，靠画面本身撑）
  const vs = Math.max(14, u * 0.023);
  const chars = ['山', '水', '的', '回', '响'];
  const vx = W * 0.062;
  const vy = H * (port ? 0.12 : 0.13);
  push();
  textAlign(CENTER, TOP);
  textFont(TITLE_FONT);
  for (let i = 0; i < chars.length; i++) {
    const kk = Math.min(1, Math.max(0, (intro - 0.3 - i * 0.06) / 0.7));
    fill(P.ink[0], P.ink[1], P.ink[2], 235 * k * kk);
    textSize(vs);
    text(chars[i], vx, vy + i * vs * 1.18);
  }
  pop();

  // 英文与题注
  push();
  textAlign(LEFT, TOP);
  textFont('Georgia, "Times New Roman", serif');
  textSize(Math.max(7, u * 0.0105));
  fill(P.ink[0], P.ink[1], P.ink[2], 120 * k);
  text('E C H O E S   O F   L A N D S C A P E', vx - vs * 0.55, vy + chars.length * vs * 1.18 + u * 0.016);
  textSize(Math.max(8, u * 0.0115));
  fill(P.ink[0], P.ink[1], P.ink[2], 95 * k);
  text('第 2 周 · 生成艺术 / p5.js · 1300 particles', vx - vs * 0.55, vy + chars.length * vs * 1.18 + u * 0.038);
  pop();

  // 右下角：署名
  push();
  textAlign(RIGHT, BOTTOM);
  textSize(Math.max(8, u * 0.0115));
  fill(P.ink[0], P.ink[1], P.ink[2], 130 * k);
  text('施俊妍 · 数字媒体艺术 · 2026', W * 0.945, H * 0.935);
  pop();

  // 右上角：墨色名
  push();
  textAlign(RIGHT, TOP);
  textSize(Math.max(8, u * 0.0115));
  fill(P.ink[0], P.ink[1], P.ink[2], 105 * k);
  text(P.name, W * 0.945, H * 0.065);
  pop();

  // 印章
  drawSeal(vx - vs * 0.5, H * 0.80, Math.max(16, u * 0.030), k);

  // 细框
  push();
  noFill();
  stroke(P.ink[0], P.ink[1], P.ink[2], dark ? 24 * k : 28 * k);
  strokeWeight(1);
  rect(W * 0.03, H * 0.038, W * 0.94, H * 0.925);
  pop();
}
function drawSeal(x, y, s, k) {
  push();
  translate(x, y);
  noFill();
  stroke(P.seal[0], P.seal[1], P.seal[2], 200 * k);
  strokeWeight(Math.max(1, s * 0.07));
  rect(0, 0, s, s, s * 0.05);
  noStroke();
  fill(P.seal[0], P.seal[1], P.seal[2], 200 * k);
  textAlign(CENTER, CENTER);
  textSize(s * 0.54);
  text('回', s / 2, s * 0.53);
  pop();
}

function drawHint() {
  const e = (millis() - hintStart) / 1000;
  const a = e < 6 ? 110 : Math.max(0, 110 - (e - 6) * 34);
  if (a <= 0) return;
  push();
  textAlign(CENTER, BOTTOM);
  textSize(Math.max(9, Math.min(width, height) * 0.014));
  fill(P.ink[0], P.ink[1], P.ink[2], a);
  text('移动起风 · 点击回声 · S 存图', width * 0.5, height * 0.878);
  pop();
}

/* ---------------- 输入 ---------------- */

function pointerMove(x, y) { hist.push({ x: x, y: y }); }
function mouseMoved() { pointerMove(mouseX, mouseY); }
function mouseDragged() { pointerMove(mouseX, mouseY); return false; }
function touchMoved() { pointerMove(mouseX, mouseY); return false; }

function mousePressed() {
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  rings.push({ x: mouseX, y: mouseY, r: 10, a: 52 });
  for (let i = 0; i < 26; i++) {
    const p = parts[Math.floor(Math.random() * parts.length)];
    const ang = Math.random() * TWO_PI;
    p.x += Math.cos(ang) * 30; p.y += Math.sin(ang) * 30;
  }
  // 点击迸出的光尘
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * TWO_PI;
    const sp = 1.2 + Math.random() * 4.6;
    burst.push({
      x: mouseX, y: mouseY,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.7 + Math.random() * 0.7,
      r: 0.7 + Math.random() * 1.5
    });
  }
  return false;
}

function touchStarted() { mousePressed(); return false; }

function wireUI() {
  const dock = document.getElementById('dock');
  if (dock) {
    const btns = dock.querySelectorAll('[data-palette]');
    for (let i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function (e) {
        e.preventDefault();
        setPalette(Number(this.getAttribute('data-palette')));
      });
    }
    const sv = dock.querySelector('[data-save]');
    if (sv) sv.addEventListener('click', function (e) { e.preventDefault(); exportPNG(); });
  }
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === '1') { setPalette(0); e.preventDefault(); }
    else if (k === '2') { setPalette(1); e.preventDefault(); }
    else if (k === '3') { setPalette(2); e.preventDefault(); }
    else if (k === 'r' || k === 'R') { rings = []; ink.clear(); seedParts(); }
    else if (k === 's' || k === 'S') { exportPNG(); e.preventDefault(); }
  });
  syncDock();
}

function syncDock() {
  const dock = document.getElementById('dock');
  if (!dock) return;
  const c = P.ink;
  dock.style.color = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.94)';
  dock.style.borderColor = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.22)';
  dock.style.background = luminance(P.paper) > 0.5 ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.08)';
}

function setPalette(i) {
  pi = i; P = PALETTES[i];
  const fresh = createGraphics(width, height);
  fresh.pixelDensity(1);
  drawBase(fresh);
  base = fresh;
  makeGrain();
  makeVignette();
  ink.clear();
  syncDock();
}

function exportPNG() {
  ensureLayers();
  const was = showHint;
  showHint = false;
  stepWorld(false);
  image(base, 0, 0, width, height);
  image(ink, 0, 0, width, height);
  image(vignette, 0, 0, width, height);
  drawType();
  image(grain, 0, 0, width, height);
  saveCanvas('山水的回响_' + (pi + 1) + '_' + nf(frameCount, 3), 'png');
  showHint = was;
}

/* ---------------- 小工具 ---------------- */

function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
function shade(c, amt) { return c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v + 255 * amt))); }); }
function luminance(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
