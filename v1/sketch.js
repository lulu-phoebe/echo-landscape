/* 山水的回响 · Echoes of Landscape
   第 2 周 · 生成艺术 / p5.js
   粒子沿 Perlin 风场漂移成远山，鼠标扰动风场并留下淡墨，点击荡开回声。
   1 / 2 / 3 切换配色   R 重来   S 保存 PNG
*/

const PALETTES = [
  { name: '一 · 宣纸', paper: [242, 238, 228], ink: [38, 48, 43], mist: [104, 126, 111], seal: [176, 72, 52] },
  { name: '二 · 夜山', paper: [13, 19, 23], ink: [236, 241, 246], mist: [116, 155, 178], seal: [200, 94, 74] },
  { name: '三 · 赭石', paper: [239, 226, 208], ink: [66, 41, 30], mist: [158, 92, 58], seal: [146, 56, 36] }
];

let P = PALETTES[0];
let pi = 0;

let base, ink, grain, vignette;
let ridges = [];
let parts = [];
let rings = [];
let hist = [];
const ghostDelays = [16, 34, 56];
const ghostStrength = [0.55, 0.28, 0.12];

let t = 0;
let intro = 0;
let showHint = true;
let hintStart = 0;
let needsBuild = true;

const N = 1200;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(Math.min(2, displayDensity()));
  textFont('Songti SC, SimSun, STSong, serif');

  const m = location.search.match(/[?&]p=([0-9])/);
  if (m) { pi = Number(m[1]) % 3; P = PALETTES[pi]; }

  needsBuild = true;
  hintStart = millis();
  wireUI();

  if (location.search.indexOf('still') >= 0) {
    intro = 2;
    ensureLayers();
    for (let i = 0; i < 900; i++) stepWorld(false);
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
  rings = [];
  hist = [];
}

/* ---------------- 纸与山 ---------------- */

function drawBase(g) {
  ridges = [];
  const ctx = g.drawingContext;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, rgba(P.paper, 1));
  grad.addColorStop(0.58, rgba(P.paper, 1));
  grad.addColorStop(1, rgba(shade(P.paper, -0.045), 1));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 淡日轮
  const cx = width * 0.705, cy = height * 0.295, cr = Math.min(width, height) * 0.052;
  const halo = ctx.createRadialGradient(cx, cy, cr * 0.9, cx, cy, cr * 3.6);
  halo.addColorStop(0, rgba(P.mist, 0.07));
  halo.addColorStop(1, rgba(P.mist, 0));
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx, cy, cr * 3.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba(P.mist, 0.10);
  ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // 远 → 近 四层山脊
  const layers = [
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

  // 山脚雾带
  const fog = ctx.createLinearGradient(0, height * 0.60, 0, height * 0.98);
  fog.addColorStop(0, rgba(P.paper, 0));
  fog.addColorStop(0.42, rgba(P.paper, 0.42));
  fog.addColorStop(1, rgba(P.paper, 0.10));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = fog;
  ctx.fillRect(0, height * 0.60, width, height * 0.40);

  // 前景压深，给画面一个"底"
  const foot = ctx.createLinearGradient(0, height * 0.72, 0, height);
  foot.addColorStop(0, rgba(P.ink, 0));
  foot.addColorStop(1, rgba(P.ink, 0.16));
  ctx.fillStyle = foot;
  ctx.fillRect(0, height * 0.72, width, height * 0.28);
  ctx.restore();
}

function makeGrain() {
  grain = createGraphics(width, height);
  grain.pixelDensity(1);
  grain.loadPixels();
  const light = luminance(P.paper) > 0.5;
  const count = Math.floor(width * height * 0.022);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const idx = 4 * (y * width + x);
    grain.pixels[idx] = light ? 0 : 255;
    grain.pixels[idx + 1] = light ? 0 : 255;
    grain.pixels[idx + 2] = light ? 0 : 255;
    grain.pixels[idx + 3] = Math.random() * 10;
  }
  grain.updatePixels();
}

function makeVignette() {
  vignette = createGraphics(width, height);
  vignette.pixelDensity(1);
  const ctx = vignette.drawingContext;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const r = Math.max(width, height) * 0.80;
  const g2 = ctx.createRadialGradient(width * 0.5, height * 0.44, r * 0.42, width * 0.5, height * 0.44, r);
  const light = luminance(P.paper) > 0.5;
  g2.addColorStop(0, 'rgba(0,0,0,0)');
  g2.addColorStop(1, light ? 'rgba(26,30,24,0.13)' : 'rgba(0,0,0,0.30)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/* ---------------- 尘埃 ---------------- */

function seedParts() {
  parts = [];
  for (let i = 0; i < N; i++) parts.push(newDust(true));
}

function ridgeYAt(L, x) {
  if (!ridges.length) return height * 0.7;
  const row = ridges[Math.max(0, Math.min(ridges.length - 1, L))];
  const i = Math.max(0, Math.min(row.length - 1, Math.round((x + 10) / 4)));
  return row[i];
}

function newDust(anywhere) {
  const x = Math.random() * width;
  const L = Math.random() < 0.45 ? 1 : (Math.random() < 0.6 ? 2 : 3);
  const y = ridgeYAt(L, x) + Math.random() * (40 + L * 26);
  return {
    x: x, y: y, px: x, py: y, L: L,
    s: 0.55 + Math.random() * 0.9,
    w: 1.1 + Math.random() * 1.7,
    age: Math.random() * 300,
    life: 260 + Math.random() * 520
  };
}

function fieldAngle(x, y) {
  return noise(x * 0.0019, y * 0.0019, t * 0.00035) * TWO_PI * 2.4 - PI;
}

function stepWorld(silent) {
  t += 1;

  const c = ink.drawingContext;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = 'rgba(0,0,0,0.006)';
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
    let vx = Math.cos(a) * 0.9 * p.s;
    let vy = Math.sin(a) * 0.55 * p.s + 0.05;

    for (const q of pointers) {
      const dx = p.x - q.x, dy = p.y - q.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
      if (d < 300) {
        const f = (1 - d / 300) * 1.9 * q.k;
        vx += (dx / d) * f * 7.5;
        vy += (dy / d) * f * 7.5;
      }
    }

    p.px = p.x; p.py = p.y;
    p.x += vx; p.y += vy;
    p.age += 0.4 + Math.random() * 0.5;

    if (!silent) {
      ink.stroke(P.ink[0], P.ink[1], P.ink[2], 9 + Math.random() * 13);
      ink.strokeWeight(p.w);
      ink.line(p.x - vx * 5.5, p.y - vy * 5.5, p.x, p.y);
    }

    const roof = ridgeYAt(p.L, p.x) - 12;
    if (p.age > p.life || p.x < -50 || p.x > width + 50 || p.y < roof || p.y > height + 60) {
      const f = newDust(false);
      p.x = f.x; p.y = f.y; p.age = 0; p.px = p.x; p.py = p.y; p.L = f.L;
    }
  }

  // 指针只负责"风"，不在纸上留东西：墨的移动本身就是痕迹

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.r += 2.0; r.a *= 0.972;
    ink.noFill();
    ink.stroke(P.ink[0], P.ink[1], P.ink[2], r.a);
    ink.strokeWeight(1.2);
    ink.circle(r.x, r.y, r.r * 2);
    ink.strokeWeight(0.6);
    ink.circle(r.x, r.y, r.r * 2 * 0.82);
    if (r.a < 1.4) rings.splice(i, 1);
  }
}

/* ---------------- 画面 ---------------- */

function draw() {
  ensureLayers();
  stepWorld(false);

  if (hist.length > 160) hist.splice(0, hist.length - 160);
  intro = Math.min(1.6, intro + 0.016);

  image(base, 0, 0, width, height);
  image(ink, 0, 0, width, height);
  image(vignette, 0, 0, width, height);

  drawType();
  if (showHint) drawHint();

  image(grain, 0, 0, width, height);

  if (location.search.indexOf('debug') >= 0) {
    push();
    noFill(); stroke(255, 0, 0); strokeWeight(2); rect(1, 1, width - 2, height - 2);
    noStroke(); fill(255, 0, 0); textSize(22);
    text('w=' + width + ' h=' + height + ' base=' + base.width + 'x' + base.height, 30, 30);
    pop();
  }
}

function drawType() {
  const k = Math.min(1, Math.max(0, (intro - 0.25) / 0.9));
  const W = width, H = height;
  const port = W / H < 0.95;

  const titleSize = Math.max(26, Math.min(H * 0.088, W * 0.070));
  const gap = titleSize * 1.14;
  const x = W * (port ? 0.145 : 0.098);
  const y0 = H * (port ? 0.135 : 0.125);
  const chars = ['山', '水', '的', '回', '响'];

  push();
  textAlign(CENTER, CENTER);
  for (let i = 0; i < chars.length; i++) {
    const kk = Math.min(1, Math.max(0, (intro - 0.35 - i * 0.08) / 0.7));
    fill(P.ink[0], P.ink[1], P.ink[2], 255 * k * kk);
    textSize(titleSize);
    text(chars[i], x, y0 + i * gap);
  }
  pop();

  push();
  textAlign(LEFT, TOP);
  textSize(Math.max(8, titleSize * 0.17));
  fill(P.ink[0], P.ink[1], P.ink[2], 145 * k);
  text('ECHOES  OF  LANDSCAPE', x - titleSize * 0.44, y0 + gap * chars.length + titleSize * 0.10);
  textSize(Math.max(9, titleSize * 0.21));
  fill(P.ink[0], P.ink[1], P.ink[2], 120 * k);
  text('墨随风气 · 声随山回', x - titleSize * 0.44, y0 + gap * chars.length + titleSize * 0.55);
  pop();

  drawSeal(x - titleSize * 0.46, y0 + gap * chars.length + titleSize * 1.55, titleSize * 0.60, k);

  push();
  textAlign(port ? LEFT : RIGHT, BOTTOM);
  textSize(Math.max(9, titleSize * 0.165));
  const cx = port ? W * 0.075 : W * 0.925;
  fill(P.ink[0], P.ink[1], P.ink[2], 135 * k);
  text('施俊妍 · 数字媒体艺术', cx, H * 0.898);
  fill(P.ink[0], P.ink[1], P.ink[2], 95 * k);
  text(port ? 'p5.js · 2026' : 'p5.js · 1200 particles · 2026', cx, H * 0.928);
  pop();

  push();
  textAlign(port ? LEFT : RIGHT, TOP);
  textSize(Math.max(9, titleSize * 0.165));
  fill(P.ink[0], P.ink[1], P.ink[2], 115 * k);
  text(P.name, port ? W * 0.075 : W * 0.925, H * 0.078);
  pop();

  push();
  noFill();
  stroke(P.ink[0], P.ink[1], P.ink[2], 30 * k);
  strokeWeight(1);
  rect(W * 0.045, H * 0.05, W * 0.91, H * 0.90);
  pop();
}

function drawSeal(x, y, s, k) {
  push();
  translate(x, y);
  noFill();
  stroke(P.seal[0], P.seal[1], P.seal[2], 205 * k);
  strokeWeight(Math.max(1, s * 0.07));
  rect(0, 0, s, s, s * 0.05);
  noStroke();
  fill(P.seal[0], P.seal[1], P.seal[2], 205 * k);
  textAlign(CENTER, CENTER);
  textSize(s * 0.54);
  text('回', s / 2, s * 0.53);
  pop();
}

function drawHint() {
  const e = (millis() - hintStart) / 1000;
  const a = e < 5 ? 120 : Math.max(0, 120 - (e - 5) * 40);
  if (a <= 0) return;
  push();
  textAlign(CENTER, BOTTOM);
  textSize(Math.max(9, Math.min(width, height) * 0.016));
  fill(P.ink[0], P.ink[1], P.ink[2], a);
  text('移动 · 点击回声 · 下方按钮或 1 2 3 换配色 · S 保存', width * 0.5, height * 0.955);
  pop();
}

/* ---------------- 输入 ---------------- */

function pointerMove(x, y) { hist.push({ x: x, y: y }); }
function mouseMoved() { pointerMove(mouseX, mouseY); }
function mouseDragged() { pointerMove(mouseX, mouseY); return false; }
function touchMoved() { pointerMove(mouseX, mouseY); return false; }

function mousePressed() {
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  rings.push({ x: mouseX, y: mouseY, r: 8, a: 58 });
  for (let i = 0; i < 24; i++) {
    const p = parts[Math.floor(Math.random() * parts.length)];
    const ang = Math.random() * TWO_PI;
    p.x += Math.cos(ang) * 24; p.y += Math.sin(ang) * 24;
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
  dock.style.color = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.92)';
  dock.style.borderColor = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.18)';
  dock.style.background = luminance(P.paper) > 0.5 ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.07)';
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
