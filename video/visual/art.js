// Illustration primitives. Expensive static art is rendered once to sprites.
'use strict';
const SPR = {};

// ------------------------------------------------------------- dizi (bamboo flute)
function buildFlute(len = 980, th = 44, cheap = false) {
  const c = mkCanvas(len + 40, th + 140), g = c.getContext('2d');
  const x0 = 20, y0 = 30;
  const body = g.createLinearGradient(0, y0, 0, y0 + th);
  if (cheap) { body.addColorStop(0, '#D9D2C4'); body.addColorStop(0.5, '#BDB5A6'); body.addColorStop(1, '#8F887B'); }
  else { body.addColorStop(0, '#E9CE93'); body.addColorStop(0.35, C.bamboo); body.addColorStop(1, C.bambooD); }
  g.fillStyle = body; rrect(g, x0, y0, len, th, th / 2); g.fill();
  if (!cheap) {
    // grain fibres
    const r = rng(11);
    g.save(); rrect(g, x0, y0, len, th, th / 2); g.clip();
    for (let k = 0; k < 90; k++) { g.strokeStyle = `rgba(110,76,30,${0.05 + r() * 0.12})`; g.lineWidth = 1; const y = y0 + r() * th; g.beginPath(); g.moveTo(x0 + r() * len * 0.3, y); g.lineTo(x0 + len * (0.5 + r() * 0.5), y + (r() - 0.5) * 2); g.stroke(); }
    g.fillStyle = 'rgba(255,248,225,0.35)'; g.fillRect(x0, y0 + th * 0.18, len, th * 0.12);
    g.restore();
    // nodes
    for (const f of [0.07, 0.5, 0.93]) { g.fillStyle = 'rgba(90,60,25,0.55)'; g.fillRect(x0 + len * f, y0 + 2, 5, th - 4); }
    // black silk bindings
    const bind = (f, n) => { for (let k = 0; k < n; k++) { g.fillStyle = k % 2 ? '#2a2420' : '#14110f'; g.fillRect(x0 + len * f + k * 5, y0 - 1, 4, th + 2); } };
    bind(0.025, 6); bind(0.13, 5); bind(0.43, 3); bind(0.82, 5); bind(0.95, 6);
  }
  // holes: blow hole, membrane hole, 6 finger holes, 2 end holes
  const hole = (f, w = 0.9) => { g.fillStyle = '#1a120a'; g.beginPath(); g.ellipse(x0 + len * f, y0 + th * 0.42, th * 0.2 * w, th * 0.17, 0, 0, Math.PI * 2); g.fill(); };
  hole(0.19, 1.05);
  if (!cheap) { g.fillStyle = 'rgba(245,240,225,0.9)'; g.beginPath(); g.ellipse(x0 + len * 0.27, y0 + th * 0.42, th * 0.22, th * 0.19, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(120,110,90,0.6)'; g.stroke(); }
  for (let k = 0; k < 6; k++) hole(0.47 + k * 0.058);
  hole(0.86, 0.7); hole(0.9, 0.7);
  if (!cheap) {
    // red tassel
    g.strokeStyle = C.red; g.lineWidth = 3;
    const tx = x0 + len * 0.97, ty = y0 + th;
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx, ty + 20); g.stroke();
    g.fillStyle = C.red; g.beginPath(); g.arc(tx, ty + 24, 7, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 14; k++) { g.lineWidth = 1.6; g.beginPath(); g.moveTo(tx, ty + 28); g.lineTo(tx + (k - 7) * 1.6, ty + 100 + (k % 3) * 6); g.stroke(); }
  }
  return c;
}
// draw flute sprite centred at (x,y) with width w, rotation rot
function flute(ctx, x, y, w, o = {}) {
  const s = o.cheap ? SPR.fluteCheap : SPR.flute;
  const sc = w / (s.width - 40);
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.globalAlpha *= (o.alpha === undefined ? 1 : o.alpha);
  if (o.glow) glow(ctx, 0, 0, w * 0.6, hexA(C.lamp, 0.35 * o.glow));
  if (o.reveal !== undefined) { ctx.beginPath(); ctx.rect(-s.width * sc / 2, -200, s.width * sc * clamp(o.reveal), 400); ctx.clip(); }
  ctx.drawImage(s, -s.width * sc / 2, -(30 + 22) * sc, s.width * sc, s.height * sc);
  ctx.restore();
}

// ------------------------------------------------------------- bamboo stalk
function buildBamboo(h = 1300) {
  const c = mkCanvas(420, h), g = c.getContext('2d'), r = rng(5);
  const x = 150, wv = 70;
  const gr = g.createLinearGradient(x, 0, x + wv, 0);
  gr.addColorStop(0, '#4E6B47'); gr.addColorStop(0.4, '#7E9B6B'); gr.addColorStop(1, '#3F5A3A');
  let y = 0;
  while (y < h) {
    const seg = 200 + r() * 70;
    g.fillStyle = gr; rrect(g, x, y + 6, wv, seg - 10, 10); g.fill();
    g.fillStyle = '#3B5236'; rrect(g, x - 4, y + seg - 8, wv + 8, 12, 6); g.fill();
    // leaves at some nodes
    if (r() < 0.6 && y > 60) {
      for (let k = 0; k < 3; k++) {
        const side = r() < 0.5 ? -1 : 1, ang = side * (0.35 + r() * 0.5), L = 120 + r() * 90;
        const bx = x + (side > 0 ? wv : 0), by = y + seg - 4;
        g.save(); g.translate(bx, by); g.rotate(ang + (side > 0 ? 0 : Math.PI));
        const lg = g.createLinearGradient(0, 0, L, 0); lg.addColorStop(0, '#3F5A3A'); lg.addColorStop(1, '#6F8E5C');
        g.fillStyle = lg; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.45, -L * 0.13, L, 0); g.quadraticCurveTo(L * 0.45, L * 0.1, 0, 0); g.fill();
        g.restore();
      }
    }
    y += seg;
  }
  return c;
}

// ------------------------------------------------------------- seal stamp
function buildSeal(text, size = 200, col = C.red, round = false) {
  const c = mkCanvas(size, size), g = c.getContext('2d'), r = rng(text.length * 13 + size);
  g.fillStyle = col;
  if (round) { g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2); g.fill(); }
  else { rrect(g, 4, 4, size - 8, size - 8, size * 0.08); g.fill(); }
  g.globalCompositeOperation = 'destination-out';
  g.strokeStyle = '#000'; g.lineWidth = size * 0.035; rrect(g, size * 0.09, size * 0.09, size * 0.82, size * 0.82, size * 0.05); if (!round) g.stroke();
  const chars = [...text];
  g.fillStyle = '#000'; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (chars.length <= 2) { font(g, size * (chars.length === 1 ? 0.62 : 0.38), F.brush); chars.forEach((ch, k) => g.fillText(ch, size / 2, size * (chars.length === 1 ? 0.53 : 0.33 + k * 0.36))); }
  else if (chars.length <= 4) { // 2x2, read right column first (traditional)
    font(g, size * 0.36, F.brush); const pos = [[0.68, 0.32], [0.68, 0.7], [0.32, 0.32], [0.32, 0.7]];
    chars.forEach((ch, k) => g.fillText(ch, size * pos[k][0], size * pos[k][1]));
  } else { font(g, size * 0.2, F.brush); chars.forEach((ch, k) => g.fillText(ch, size / 2, size * (0.18 + k * 0.16))); }
  // worn texture
  for (let k = 0; k < 260; k++) { g.globalAlpha = r() * 0.6; g.beginPath(); g.arc(r() * size, r() * size, r() * size * 0.012, 0, Math.PI * 2); g.fill(); }
  return c;
}
const _seals = {};
function seal(ctx, text, x, y, size, t, tHit, o = {}) {
  if (t < tHit - 0.02) return;
  const key = text + size + (o.round ? 'r' : '') + (o.color || '');
  if (!_seals[key]) _seals[key] = buildSeal(text, size, o.color || C.red, o.round);
  const p = P(t, tHit, 0.22, E.out3);
  const sc = lerp(1.9, 1, p), a = clamp(p * 1.4) * (o.alpha === undefined ? 1 : o.alpha);
  ctx.save(); ctx.translate(x, y); ctx.rotate((o.rot === undefined ? -0.06 : o.rot) + (1 - p) * 0.12); ctx.scale(sc, sc);
  ctx.globalAlpha *= a * 0.93; ctx.globalCompositeOperation = o.blend || 'multiply';
  ctx.drawImage(_seals[key], -size / 2, -size / 2); ctx.restore();
  // impact ring
  const q = P(t, tHit, 0.5, E.out3);
  if (q > 0 && q < 1) { ctx.save(); ctx.globalAlpha *= (1 - q) * 0.35; ctx.strokeStyle = o.color || C.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, size * (0.6 + q * 0.6), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
}

// ------------------------------------------------------------- ink mountains (pre-rendered layers)
function buildMountains(seed = 3) {
  const layers = [], r = rng(seed);
  const cols = ['rgba(40,40,40,0.18)', 'rgba(35,35,38,0.32)', 'rgba(28,28,30,0.55)', 'rgba(20,20,22,0.82)'];
  for (let L = 0; L < 4; L++) {
    const c = mkCanvas(W + 400, 900), g = c.getContext('2d');
    const base = 260 + L * 140, amp = 260 - L * 40, s = r() * 100;
    const grad = g.createLinearGradient(0, base - amp, 0, 900);
    grad.addColorStop(0, cols[L]); grad.addColorStop(0.55, cols[L].replace(/[\d.]+\)$/, '0.05)')); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.beginPath(); g.moveTo(0, 900);
    for (let x = 0; x <= W + 400; x += 6) {
      const n = noise1(x / 260 + s, L) * 0.6 + noise1(x / 90 + s, L + 9) * 0.25 + noise1(x / 30 + s, L + 4) * 0.08;
      g.lineTo(x, base - amp * (0.45 + n));
    }
    g.lineTo(W + 400, 900); g.closePath(); g.fill();
    layers.push(c);
  }
  return layers;
}
function mountains(ctx, y, t, a = 1, drift = 1, dark = false) {
  ctx.save(); ctx.globalAlpha *= a;
  if (dark) ctx.filter = 'invert(1)';
  SPR.mountains.forEach((m, L) => ctx.drawImage(m, -200 - Math.sin(t * 0.05 + L) * 40 * drift * (L + 1), y + L * 30));
  ctx.restore();
}

// ------------------------------------------------------------- roots (precomputed branching)
function buildRoots(seed, x, y, len, angle, depth, out, d0 = 0) {
  const r = rng(seed);
  const segs = [];
  (function grow(x, y, len, ang, depth, w, d) {
    if (depth <= 0 || len < 8) return;
    const n = 6, pts = [[x, y]];
    let cx = x, cy = y, a = ang;
    for (let k = 0; k < n; k++) { a += (r() - 0.5) * 0.5; cx += Math.cos(a) * len / n; cy += Math.sin(a) * len / n; pts.push([cx, cy]); }
    segs.push({ pts, w, d0: d, d1: d + len });
    const kids = 2 + (r() < 0.35 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      const f = 0.45 + r() * 0.55, pi = Math.floor(f * n);
      grow(pts[pi][0], pts[pi][1], len * (0.55 + r() * 0.2), a + (r() - 0.5) * 1.3, depth - 1, w * 0.62, d + len * f);
    }
  })(x, y, len, angle, depth, 14, d0);
  out.push(...segs);
  return out;
}
function drawRoots(ctx, segs, grown, o = {}) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = o.color || C.ink;
  for (const s of segs) {
    if (grown <= s.d0) continue;
    const f = clamp((grown - s.d0) / (s.d1 - s.d0));
    ctx.lineWidth = Math.max(1.2, s.w * (o.scale || 1));
    ctx.globalAlpha = o.alpha === undefined ? 0.85 : o.alpha;
    const n = s.pts.length - 1, upto = f * n;
    ctx.beginPath(); ctx.moveTo(s.pts[0][0], s.pts[0][1]);
    for (let k = 1; k <= Math.ceil(upto); k++) {
      const q = Math.min(1, upto - (k - 1));
      ctx.lineTo(lerp(s.pts[k - 1][0], s.pts[k][0], q), lerp(s.pts[k - 1][1], s.pts[k][1], q));
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------- phone + livestream
function phone(ctx, x, y, w, h, drawScreen, o = {}) {
  ctx.save();
  ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot);
  if (o.shadow !== false) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30; ctx.fillStyle = '#0c0c0c'; rrect(ctx, -w / 2, -h / 2, w, h, 64); ctx.fill(); ctx.restore(); }
  ctx.fillStyle = '#0c0c0c'; rrect(ctx, -w / 2, -h / 2, w, h, 64); ctx.fill();
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 3; rrect(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 62); ctx.stroke();
  const sx = -w / 2 + 16, sy = -h / 2 + 16, sw = w - 32, sh = h - 32;
  ctx.save(); rrect(ctx, sx, sy, sw, sh, 50); ctx.clip(); ctx.translate(sx, sy);
  drawScreen(ctx, sw, sh);
  ctx.restore();
  ctx.fillStyle = '#000'; rrect(ctx, -60, -h / 2 + 30, 120, 32, 16); ctx.fill();
  ctx.restore();
}
// The craftsman's livestream (screen content). warmth 0..1, viewers number
function streamScreen(ctx, w, h, t, o = {}) {
  const warm = o.warm === undefined ? 1 : o.warm;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgb(${lerp(28, 40, warm)},${lerp(30, 26, warm)},${lerp(36, 22, warm)})`); g.addColorStop(1, `rgb(${lerp(14, 22, warm)},${lerp(15, 14, warm)},${lerp(18, 12, warm)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // lamp
  glow(ctx, w * 0.3, h * 0.28, w * 0.9, hexA(C.lamp, 0.42 * warm));
  ctx.fillStyle = '#2b2119'; ctx.beginPath(); ctx.moveTo(w * 0.16, h * 0.18); ctx.lineTo(w * 0.44, h * 0.18); ctx.lineTo(w * 0.38, h * 0.1); ctx.lineTo(w * 0.22, h * 0.1); ctx.fill();
  ctx.strokeStyle = '#2b2119'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.1); ctx.lineTo(w * 0.3, 0); ctx.stroke();
  // wall: bamboo blanks leaning
  for (let k = 0; k < 7; k++) { ctx.save(); ctx.globalAlpha = 0.5 * warm + 0.15; ctx.fillStyle = k % 2 ? '#6d5532' : '#7d6238'; ctx.translate(w * (0.58 + k * 0.055), h * 0.62); ctx.rotate(-0.12 + k * 0.01); ctx.fillRect(-9, -h * 0.5, 18, h * 0.5); ctx.restore(); }
  // workbench
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.fillStyle = 'rgba(255,190,110,0.12)'; ctx.fillRect(0, h * 0.62, w, 6);
  // flute on bench
  flute(ctx, w * 0.5, h * 0.7, w * 0.86, { rot: -0.03 });
  // carving tool moving along the flute
  if (o.tool) {
    const tx = w * (0.5 + 0.22 * Math.sin(t * 1.3)), ty = h * 0.69;
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(-0.7 + 0.08 * Math.sin(t * 7));
    ctx.fillStyle = '#c9c9c9'; ctx.fillRect(-4, -70, 8, 70); ctx.fillStyle = '#5a3b22'; rrect(ctx, -11, -190, 22, 122, 8); ctx.fill(); ctx.restore();
    // shavings
    const r = rng(Math.floor(t * 6));
    for (let k = 0; k < 10; k++) { ctx.fillStyle = `rgba(230,190,120,${0.5 * r()})`; ctx.fillRect(tx + (r() - 0.5) * 60, ty + 10 + r() * 50, 3 + r() * 6, 2); }
  }
  // dust in the lamp light
  const r2 = rng(3);
  for (let k = 0; k < 40; k++) { const px = (r2() * w + t * 6 * (r2() + 0.2)) % w, py = (r2() * h * 0.6 + Math.sin(t * 0.7 + k) * 8); ctx.fillStyle = `rgba(255,220,160,${0.25 * warm * r2()})`; ctx.fillRect(px, py, 2, 2); }
  // UI overlay
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, 24, 70, 300, 66, 33); ctx.fill();
  ctx.fillStyle = '#c9a062'; ctx.beginPath(); ctx.arc(57, 103, 26, 0, Math.PI * 2); ctx.fill();
  txt(ctx, '笛', 57, 104, { size: 28, font: F.brush, color: '#2b1d10' });
  txt(ctx, '竹笛老师傅', 96, 92, { size: 24, font: F.sans, weight: 700, color: '#fff', align: 'left' });
  txt(ctx, (o.viewers === undefined ? 7 : o.viewers) + ' 人在看', 96, 120, { size: 20, font: F.sans, color: 'rgba(255,255,255,0.75)', align: 'left' });
  ctx.fillStyle = '#FF3B50'; rrect(ctx, w - 150, 82, 120, 42, 21); ctx.fill();
  txt(ctx, '● 直播中', w - 90, 104, { size: 21, font: F.sans, weight: 700, color: '#fff' });
  // voice level bars (his hoarse voice)
  if (o.voice) {
    for (let k = 0; k < 18; k++) { const a = Math.abs(noise1(t * 9 + k * 0.7, k)) * o.voice; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(40 + k * 14, h * 0.86 - a * 60, 8, a * 60 + 3); }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; rrect(ctx, 24, h - 96, w * 0.62, 60, 30); ctx.fill();
  txt(ctx, '说点什么…', 54, h - 66, { size: 22, font: F.sans, color: 'rgba(255,255,255,0.5)', align: 'left' });
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(w - 66, h - 66, 30, 0, Math.PI * 2); ctx.fill();
  txt(ctx, '♡', w - 66, h - 64, { size: 30, font: F.sans, color: 'rgba(255,255,255,0.8)' });
}

// ------------------------------------------------------------- generic small icons / UI
function chatBubble(ctx, x, y, w, h, text, o = {}) {
  ctx.save(); ctx.globalAlpha *= (o.alpha === undefined ? 1 : o.alpha);
  ctx.fillStyle = o.bg || '#fff'; rrect(ctx, x, y, w, h, h / 2.6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 26, y + h - 4); ctx.lineTo(x + 8, y + h + 18); ctx.lineTo(x + 48, y + h - 4); ctx.fill();
  txt(ctx, text, x + w / 2, y + h / 2 + 2, { size: o.size || 40, font: F.sans, weight: 700, color: o.color || C.ink });
  ctx.restore();
}
function sticker(ctx, x, y, text, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(o.scale || 1, o.scale || 1);
  font(ctx, o.size || 64, F.sans, 900); const tw = ctx.measureText(text).width;
  const pad = (o.size || 64) * 0.35;
  ctx.fillStyle = o.bg || C.yellow; rrect(ctx, -tw / 2 - pad, -(o.size || 64) * 0.75, tw + pad * 2, (o.size || 64) * 1.5, 14); ctx.fill();
  if (o.outline) { ctx.strokeStyle = o.outline; ctx.lineWidth = 6; ctx.stroke(); }
  txt(ctx, text, 0, 4, { size: o.size || 64, font: F.sans, weight: 900, color: o.color || '#111' });
  ctx.restore();
}
function rgbText(ctx, s, x, y, size, t, amt = 8) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const j = amt * (0.5 + 0.5 * Math.abs(noise1(t * 20, 2)));
  txt(ctx, s, x - j, y, { size, font: F.sans, weight: 900, color: 'rgba(255,0,80,0.9)' });
  txt(ctx, s, x + j, y + 2, { size, font: F.sans, weight: 900, color: 'rgba(0,240,255,0.9)' });
  txt(ctx, s, x, y, { size, font: F.sans, weight: 900, color: 'rgba(255,255,255,0.85)' });
  ctx.restore();
}
// stylised "generated" thumbnail (identical, soulless)
function aiTile(ctx, x, y, s, hue = 0, o = {}) {
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createLinearGradient(0, 0, 0, s); g.addColorStop(0, `hsl(${280 + hue},70%,62%)`); g.addColorStop(1, `hsl(${20 + hue},90%,65%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = `hsla(${50 + hue},100%,80%,0.95)`; ctx.beginPath(); ctx.arc(s * 0.62, s * 0.38, s * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `hsl(${260 + hue},40%,25%)`; ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(s * 0.35, s * 0.5); ctx.lineTo(s * 0.6, s * 0.75); ctx.lineTo(s * 0.8, s * 0.55); ctx.lineTo(s, s * 0.8); ctx.lineTo(s, s); ctx.fill();
  if (o.label) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(s * 0.06, s * 0.06, s * 0.3, s * 0.16); txt(ctx, 'AI', s * 0.21, s * 0.145, { size: s * 0.11, font: F.mono, weight: 700, color: '#fff' }); }
  ctx.restore();
}
// hand painting: layered strokes revealed by p (0..1); light = rays strength
function buildPainting(w, h) {
  const layers = [], r = rng(21);
  const mk = () => { const c = mkCanvas(w, h); return [c, c.getContext('2d')]; };
  // 1 sky wash
  let [c, g] = mk();
  let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#D9C7A6'); gr.addColorStop(0.55, '#E8D9BC'); gr.addColorStop(1, '#C8B08A');
  g.fillStyle = gr; g.fillRect(0, 0, w, h); layers.push(c);
  // 2 distant mountains (brushy)
  [c, g] = mk();
  for (let L = 0; L < 3; L++) {
    g.fillStyle = `rgba(${70 - L * 15},${80 - L * 15},${80 - L * 12},${0.28 + L * 0.2})`; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) g.lineTo(x, h * (0.42 + L * 0.12) - (noise1(x / 120 + L * 3, L) * 0.5 + 0.5) * h * (0.22 - L * 0.04));
    g.lineTo(w, h); g.fill();
  }
  layers.push(c);
  // 3 brush strokes texture
  [c, g] = mk();
  for (let k = 0; k < 160; k++) { g.strokeStyle = `rgba(${60 + r() * 60},${55 + r() * 50},${45 + r() * 40},${0.05 + r() * 0.1})`; g.lineWidth = 3 + r() * 10; g.lineCap = 'round'; const x = r() * w, y = h * (0.3 + r() * 0.7), l = 20 + r() * 80, a = -0.3 + r() * 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  layers.push(c);
  // 4 foreground pine + tiny figure + light
  [c, g] = mk();
  g.strokeStyle = '#2a241e'; g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath(); g.moveTo(w * 0.2, h); g.quadraticCurveTo(w * 0.17, h * 0.7, w * 0.27, h * 0.45); g.stroke();
  for (let k = 0; k < 7; k++) { const y = h * (0.5 + k * 0.06), x = w * (0.24 - k * 0.006); g.fillStyle = 'rgba(40,50,40,0.85)'; g.beginPath(); g.ellipse(x + 40, y, 70 - k * 4, 14, -0.15, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#2a241e'; g.beginPath(); g.ellipse(w * 0.68, h * 0.79, 6, 16, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(w * 0.68, h * 0.75, 5, 0, Math.PI * 2); g.fill();
  layers.push(c);
  return layers;
}
function painting(ctx, x, y, w, h, p, o = {}) {
  const L = SPR.painting;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#F7F2E8'; ctx.fillRect(-14, -14, w + 28, h + 28);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; ctx.strokeRect(-14, -14, w + 28, h + 28);
  for (let k = 0; k < L.length; k++) {
    const q = clamp(p * L.length - k);
    if (q <= 0) break;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w * E.inOut3(q), h); ctx.clip(); ctx.drawImage(L[k], 0, 0, w, h); ctx.restore();
  }
  if (o.light) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip(); ctx.globalCompositeOperation = 'screen';
    for (let k = 0; k < 6; k++) {
      ctx.globalAlpha = 0.12 * o.light; ctx.fillStyle = '#FFE2A8';
      ctx.beginPath(); ctx.moveTo(w * 0.85, -20); ctx.lineTo(w * (0.1 + k * 0.12), h); ctx.lineTo(w * (0.16 + k * 0.12), h); ctx.closePath(); ctx.fill();
    }
    glow(ctx, w * 0.85, 0, w * 0.6, 'rgba(255,226,168,0.5)', o.light);
    ctx.restore();
  }
  if (o.grid) {
    ctx.save(); ctx.globalAlpha = o.grid; ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
    for (const f of [1 / 3, 2 / 3]) { ctx.beginPath(); ctx.moveTo(w * f, 0); ctx.lineTo(w * f, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, h * f); ctx.lineTo(w, h * f); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
}
// small line icons
function iconNote(ctx, x, y, s, col) { ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = s * 0.07; ctx.beginPath(); ctx.ellipse(x - s * 0.18, y + s * 0.28, s * 0.16, s * 0.12, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + s * 0.3, y + s * 0.18, s * 0.16, s * 0.12, -0.4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - s * 0.04, y + s * 0.26); ctx.lineTo(x - s * 0.04, y - s * 0.32); ctx.lineTo(x + s * 0.44, y - s * 0.42); ctx.lineTo(x + s * 0.44, y + s * 0.16); ctx.stroke(); ctx.lineWidth = s * 0.12; ctx.beginPath(); ctx.moveTo(x - s * 0.04, y - s * 0.26); ctx.lineTo(x + s * 0.44, y - s * 0.36); ctx.stroke(); ctx.restore(); }
function iconPhonePlay(ctx, x, y, s, col) { ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = s * 0.06; rrect(ctx, x - s * 0.28, y - s * 0.46, s * 0.56, s * 0.92, s * 0.08); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - s * 0.08, y - s * 0.14); ctx.lineTo(x + s * 0.14, y); ctx.lineTo(x - s * 0.08, y + s * 0.14); ctx.fill(); ctx.restore(); }
function heart(ctx, x, y, s, col) { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y + s * 0.3); ctx.bezierCurveTo(x - s * 0.6, y - s * 0.1, x - s * 0.3, y - s * 0.55, x, y - s * 0.2); ctx.bezierCurveTo(x + s * 0.3, y - s * 0.55, x + s * 0.6, y - s * 0.1, x, y + s * 0.3); ctx.fill(); ctx.restore(); }
function sparkle(ctx, x, y, s, a, col = '#FFE7B0') {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = col; ctx.translate(x, y);
  ctx.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.18 : s; const an = k * Math.PI / 4; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); ctx.restore();
  glow(ctx, x, y, s * 2.2, hexA(col, 0.4 * a));
}

function buildSprites() {
  SPR.flute = buildFlute();
  SPR.fluteCheap = buildFlute(980, 44, true);
  SPR.bamboo = buildBamboo();
  SPR.mountains = buildMountains();
  SPR.painting = buildPainting(760, 520);
  SPR.roots = buildRoots(42, 0, 0, 260, Math.PI / 2, 6, []);
  SPR.rootsFlute = buildRoots(77, 0, 0, 170, Math.PI / 2, 5, []);
  SPR.rootsArt = buildRoots(91, 0, 0, 170, Math.PI / 2, 5, []);
}
