// Core: design tokens, math, timeline lookup, text + drawing helpers.
'use strict';
const W = 1080, H = 1920, FPS = 30;
const C = {
  paper: '#F2ECE1', paper2: '#E6DDCD', ink: '#1F1C19', ink2: '#57514A', mute: '#9C9387', faint: '#CFC6B8',
  red: '#B5372C', red2: '#D65A44', green: '#5D7A57', bamboo: '#C8A262', bambooD: '#8E6B33', gold: '#C29A55',
  night: '#0D0F13', night2: '#181C24', lamp: '#F3B466', lampD: '#9A5A23', white: '#F6F1E8',
  pink: '#FF2D78', yellow: '#FFE14A', cyan: '#36EEFF', violet: '#7B3CFF', neonBg: '#0B0612',
};
const F = {
  serif: '"Noto Serif SC", serif', sans: '"Noto Sans SC", sans-serif', brush: '"Ma Shan Zheng", serif',
  en: '"Cormorant Garamond", serif', mono: '"JetBrains Mono", monospace', hand: '"Caveat", cursive',
};

// ---------------------------------------------------------------- math
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const E = {
  lin: t => t,
  out2: t => 1 - (1 - t) * (1 - t),
  out3: t => 1 - Math.pow(1 - t, 3),
  out5: t => 1 - Math.pow(1 - t, 5),
  in3: t => t * t * t,
  inOut3: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutS: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outExpo: t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  outElastic: t => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};
// progress of t through [t0, t0+dur] with easing
// (exact 0 before t0 and 1 after: overshooting easings are not exactly 0 at 0)
const P = (t, t0, dur, e = E.out3) => { const x = (t - t0) / Math.max(dur, 1e-6); return x <= 0 ? 0 : x >= 1 ? 1 : e(x); };
// 1 inside [a,b], with fade in/out of length f
const win = (t, a, b, f = 0.3) => clamp((t - a) / f) * clamp((b - t) / f);
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// smooth 1D value noise
function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const h = n => { const s = Math.sin((n + seed * 101.3) * 127.1) * 43758.5453; return s - Math.floor(s); };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

// ---------------------------------------------------------------- timeline
let TL = null, CUES = null;
const Lstart = i => TL.lines[i].start, Lend = i => TL.lines[i].end;
// (t0,t1) of the k-th occurrence of `sub` in line i — same algorithm as cues.py
function wd(i, sub, k = 0) {
  const cs = TL.lines[i].chars; const s = cs.map(c => c.c).join('');
  let pos = -1;
  for (let n = 0; n <= k; n++) { pos = s.indexOf(sub, pos + 1); if (pos < 0) throw new Error(`"${sub}" not in line ${i}: ${s}`); }
  let off = 0, start = 0;
  for (let idx = 0; idx < cs.length; idx++) {
    if (off === pos) start = idx;
    if (off + cs[idx].c.length >= pos + sub.length) return [cs[start].t0, cs[idx].t1];
    off += cs[idx].c.length;
  }
  throw new Error(sub);
}
const T0 = (i, sub, k = 0) => wd(i, sub, k)[0];
const T1 = (i, sub, k = 0) => wd(i, sub, k)[1];

// ---------------------------------------------------------------- canvas helpers
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function font(ctx, size, fam = F.serif, weight = 400, style = '') { ctx.font = `${style} ${weight} ${size}px ${fam}`; }
function txt(ctx, s, x, y, o = {}) {
  ctx.save();
  font(ctx, o.size || 48, o.font || F.serif, o.weight || 400, o.style || '');
  ctx.fillStyle = o.color || C.ink;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.base || 'middle';
  if (o.ls !== undefined) ctx.letterSpacing = o.ls + 'px';
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur || 20; }
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 2; ctx.strokeText(s, x, y); }
  if (!o.noFill) ctx.fillText(s, x, y);
  ctx.restore();
}
function measure(ctx, s, size, fam = F.serif, weight = 400, ls = 0) {
  ctx.save(); font(ctx, size, fam, weight); ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(s).width; ctx.restore(); return w;
}
// Reveal characters one by one; times = array of t0 per char or [start, perChar]
function typeChars(ctx, s, x, y, t, times, o = {}) {
  const size = o.size || 60, fam = o.font || F.serif, wt = o.weight || 400, ls = o.ls || 0;
  const chars = [...s];
  ctx.save(); font(ctx, size, fam, wt); ctx.letterSpacing = ls + 'px';
  const widths = chars.map(c => ctx.measureText(c).width + ls);
  const total = widths.reduce((a, b) => a + b, 0) - ls;
  let cx = o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2;
  ctx.textAlign = 'left'; ctx.textBaseline = o.base || 'middle';
  const rise = o.rise === undefined ? 18 : o.rise, dur = o.dur || 0.35;
  for (let k = 0; k < chars.length; k++) {
    const tk = Array.isArray(times) ? times[Math.min(k, times.length - 1)] : times + k * (o.per || 0.06);
    const p = P(t, tk, dur, E.out3);
    if (p > 0) {
      ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * p;
      ctx.fillStyle = (o.colorAt && o.colorAt(k)) || o.color || C.ink;
      const yy = y + (1 - p) * rise;
      if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur || 24; }
      ctx.fillText(chars[k], cx, yy);
    }
    cx += widths[k];
  }
  ctx.restore();
  return total;
}
// char timings of a substring as spoken, for typeChars
function spokenTimes(i, sub, k = 0) {
  const [a] = wd(i, sub, k); const cs = TL.lines[i].chars;
  const idx = cs.findIndex(c => Math.abs(c.t0 - a) < 1e-6);
  const out = [];
  for (let n = idx; n < cs.length && out.length < [...sub].length; n++) out.push(cs[n].t0);
  return out;
}
function fadeText(ctx, s, x, y, t, t0, o = {}) {
  const p = P(t, t0, o.dur || 0.6, E.out3);
  if (p <= 0) return;
  const out = o.out !== undefined ? clamp((o.out - t) / 0.4) : 1;
  txt(ctx, s, x, y + (1 - p) * (o.rise === undefined ? 24 : o.rise), Object.assign({}, o, { alpha: (o.alpha === undefined ? 1 : o.alpha) * p * out }));
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// hand-drawn polyline revealed by progress p (0..1)
function handLine(ctx, pts, p, o = {}) {
  if (p <= 0) return;
  const segs = []; let total = 0;
  for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); segs.push(d); total += d; }
  let rem = total * clamp(p);
  ctx.save(); ctx.strokeStyle = o.color || C.red; ctx.lineWidth = o.lw || 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.blur || 16; }
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length && rem > 0; k++) {
    const d = segs[k - 1];
    if (rem >= d) ctx.lineTo(pts[k][0], pts[k][1]);
    else { const f = rem / d; ctx.lineTo(lerp(pts[k - 1][0], pts[k][0], f), lerp(pts[k - 1][1], pts[k][1], f)); }
    rem -= d;
  }
  ctx.stroke(); ctx.restore();
}
function wobbleLine(x1, y1, x2, y2, seed = 1, amp = 3, n = 24) {
  const r = rng(seed), pts = [];
  for (let k = 0; k <= n; k++) { const f = k / n; pts.push([lerp(x1, x2, f) + (r() - 0.5) * amp * 0.5, lerp(y1, y2, f) + noise1(f * 4, seed) * amp]); }
  return pts;
}
function wobbleEllipse(cx, cy, rx, ry, seed = 1, turns = 1.1, amp = 0.05) {
  const pts = [], n = 80, ph = rng(seed)() * 6.28;
  for (let k = 0; k <= n; k++) { const a = ph + (k / n) * Math.PI * 2 * turns; const j = 1 + noise1(k / 9, seed) * amp; pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]); }
  return pts;
}
function strike(ctx, x1, x2, y, p, o = {}) { handLine(ctx, wobbleLine(x1 - 8, y + 3, x2 + 8, y - 4, o.seed || 3, 6), p, Object.assign({ lw: 7 }, o)); }
function glow(ctx, x, y, r, color, a = 1) {
  ctx.save(); ctx.globalAlpha *= a;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

// ---------------------------------------------------------------- textures (built once)
const TEX = {};
function buildTextures() {
  // paper: base + blotches + fibres + speckles
  const p = mkCanvas(W, H), g = p.getContext('2d'), r = rng(7);
  g.fillStyle = C.paper; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 60; k++) {
    const x = r() * W, y = r() * H, rr = 80 + r() * 380;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr);
    const dark = r() < 0.5; gr.addColorStop(0, dark ? 'rgba(120,100,70,0.045)' : 'rgba(255,255,250,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  g.lineCap = 'round';
  for (let k = 0; k < 1400; k++) {
    const x = r() * W, y = r() * H, a = r() * Math.PI, l = 6 + r() * 26;
    g.strokeStyle = `rgba(110,92,64,${0.03 + r() * 0.07})`; g.lineWidth = 0.6 + r() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let k = 0; k < 2600; k++) { g.fillStyle = `rgba(80,64,40,${r() * 0.12})`; g.fillRect(r() * W, r() * H, 1 + r() * 1.5, 1 + r() * 1.5); }
  TEX.paper = p;
  // film grain frames (half-res, scaled up)
  TEX.grain = [];
  for (let f = 0; f < 6; f++) {
    const c = mkCanvas(W / 2, H / 2), cg = c.getContext('2d'), id = cg.createImageData(W / 2, H / 2), rr = rng(100 + f);
    for (let k = 0; k < id.data.length; k += 4) { const v = 128 + (rr() + rr() + rr() - 1.5) * 120; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255; }
    cg.putImageData(id, 0, 0); TEX.grain.push(c);
  }
  // vignette
  const v = mkCanvas(W, H), vg = v.getContext('2d');
  const gr = vg.createRadialGradient(W / 2, H * 0.46, H * 0.28, W / 2, H * 0.5, H * 0.75);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); vg.fillStyle = gr; vg.fillRect(0, 0, W, H);
  TEX.vignette = v;
}
function bgPaper(ctx, tint) { ctx.drawImage(TEX.paper, 0, 0); if (tint) { ctx.save(); ctx.globalAlpha = tint[1]; ctx.fillStyle = tint[0]; ctx.fillRect(0, 0, W, H); ctx.restore(); } }
function bgNight(ctx, top = C.night, bot = C.night2) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function bgNeon(ctx, t) {
  ctx.fillStyle = C.neonBg; ctx.fillRect(0, 0, W, H);
  glow(ctx, W * (0.2 + 0.1 * Math.sin(t * 3)), H * 0.25, 700, hexA(C.pink, 0.35));
  glow(ctx, W * (0.85 + 0.1 * Math.cos(t * 2.3)), H * 0.7, 800, hexA(C.violet, 0.35));
  glow(ctx, W * 0.5, H * (0.5 + 0.1 * Math.sin(t * 1.7)), 600, hexA(C.cyan, 0.15));
}
function grain(ctx, t, amount) {
  const f = TEX.grain[Math.floor(t * FPS) % TEX.grain.length];
  ctx.save(); ctx.globalAlpha = amount; ctx.globalCompositeOperation = 'overlay'; ctx.drawImage(f, 0, 0, W, H); ctx.restore();
}
function vignette(ctx, a) { ctx.save(); ctx.globalAlpha = a; ctx.drawImage(TEX.vignette, 0, 0); ctx.restore(); }

// Editorial frame: crop marks, header labels, page number
function frameUI(ctx, t, dark, label, page, a = 1) {
  if (a <= 0) return;
  const col = dark ? 'rgba(246,241,232,0.55)' : 'rgba(31,28,25,0.55)';
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = 2;
  const m = 56, l = 34;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + sy * l); ctx.lineTo(x, y); ctx.lineTo(x + sx * l, y); ctx.stroke();
  }
  txt(ctx, label || 'THE QUIET ONES', 110, 112, { size: 25, font: F.mono, color: col, align: 'left', ls: 3 });
  txt(ctx, '千锤百炼之后', W - 110, 112, { size: 25, font: F.serif, color: col, align: 'right', ls: 4 });
  if (page) txt(ctx, page, W - 110, H - 108, { size: 24, font: F.mono, color: col, align: 'right', ls: 2 });
  txt(ctx, 'NOTES · 2026', 110, H - 108, { size: 24, font: F.mono, color: col, align: 'left', ls: 2 });
  ctx.restore();
}
