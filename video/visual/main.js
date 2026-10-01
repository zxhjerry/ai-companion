// Scene manager, captions, chapter cards, frame composition.
'use strict';
let BLOCKS = [];
const CHAPTERS = [
  { n: '01', zh: '深夜直播间', en: 'THE MIDNIGHT LIVESTREAM', line: 6 },
  { n: '02', zh: '两条赛道', en: 'TWO TRACKS, ONE FATE', line: 29 },
  { n: '03', zh: '二十年', en: 'TWENTY YEARS', line: 45 },
  { n: '04', zh: '走出去', en: 'STEPPING OUTSIDE', line: 60 },
  { n: '05', zh: '根', en: 'ROOTS', line: 74 },
  { n: '06', zh: '被看见', en: 'TO BE SEEN', line: 90 },
];
const CARD_PRE = 1.0, CARD_LEN = 2.6;

function buildBlocks() {
  BLOCKS = [];
  for (const ln of TL.lines) {
    const last = BLOCKS[BLOCKS.length - 1];
    if (last && last.name === ln.scene) { last.lines.push(ln.i); continue; }
    BLOCKS.push({ name: ln.scene, lines: [ln.i] });
  }
  BLOCKS.forEach((b, k) => {
    const def = SC[b.name];
    if (!def) throw new Error('no scene ' + b.name);
    Object.assign(b, { def, first: b.lines[0], last: b.lines[b.lines.length - 1] });
    const ch = CHAPTERS.find(c => c.line === b.first);
    const lead = ch ? CARD_PRE - CARD_LEN + 0.55 : (def.lead === undefined ? 0.35 : def.lead);
    b.t0 = k === 0 ? 0 : Lstart(b.first) - lead;
  });
  BLOCKS.forEach((b, k) => { b.t1 = k + 1 < BLOCKS.length ? BLOCKS[k + 1].t0 : TL.duration + 1; });
}
function isDark(b, t) { const d = b.def; return d.isDark ? d.isDark(t, b) : !!(d.dark || d.bg !== 'paper'); }
function chapterAt(t) { let c = null; for (const ch of CHAPTERS) if (t >= Lstart(ch.line) - CARD_PRE) c = ch; return c; }

function drawBlock(g, b, t) {
  const d = b.def;
  if (d.bg === 'paper') bgPaper(g, d.tint);
  else if (d.bg === 'night') bgNight(g);
  else if (d.bg === 'neon') bgNeon(g, t);
  else { g.fillStyle = d.bg || '#000'; g.fillRect(0, 0, W, H); }
  g.save(); d.draw(g, t, b); g.restore();
}

// ---------------------------------------------------------------- captions
const PUNCT = '，。、：；？！…“”",.:;?!—';
function phrasesOf(i) {
  const ln = TL.lines[i];
  if (ln._ph) return ln._ph;
  const spoken = ln.chars.filter(c => !PUNCT.includes(c.c));
  // expand units like "AI" into per-letter entries
  const sp = []; spoken.forEach(c => { const n = [...c.c].length; [...c.c].forEach((ch, k) => sp.push({ c: ch, w: k === 0 ? c.w : 0, t0: c.t0 + (c.t1 - c.t0) * k / n, t1: c.t0 + (c.t1 - c.t0) * (k + 1) / n })); });
  const disp = [...ln.text];
  const dIdx = disp.map((c, k) => k).filter(k => !PUNCT.includes(disp[k]));
  const times = new Array(disp.length).fill(null);
  const wflag = new Array(disp.length).fill(0);
  dIdx.forEach((k, n) => { const m = sp.length === dIdx.length ? n : Math.floor(n * sp.length / dIdx.length); times[k] = sp[Math.min(m, sp.length - 1)].t0; wflag[k] = sp.length === dIdx.length ? (sp[m].w || 0) : 0; });
  // split into phrases at punctuation (drop ，。、： ; keep ？！ and quotes)
  const ph = []; let cur = [];
  disp.forEach((c, k) => {
    if ('，。、：；,.:;…'.includes(c)) { if (cur.length) ph.push(cur); cur = []; return; }
    if ('？！?!'.includes(c)) { cur.push({ c, t: null }); ph.push(cur); cur = []; return; }
    cur.push({ c, t: times[k], w: wflag[k] });
  });
  if (cur.length) ph.push(cur);
  const out = ph.filter(p => p.some(x => x.t !== null)).map(p => {
    let last = null; p.forEach(x => { if (x.t === null) x.t = last === null ? p.find(y => y.t !== null).t : last; last = x.t; });
    return { chars: p, t0: p[0].t };
  });
  out.forEach((p, k) => { p.t1 = k + 1 < out.length ? out[k + 1].t0 : ln.end + 0.45; });
  ln._ph = out; return out;
}
function captions(ctx, t, b) {
  if (b.def.caps === false) return;
  let line = null;
  for (const i of b.lines) if (t >= Lstart(i) - 0.15 && t < Lend(i) + 0.5) line = i;
  if (line === null || (b.def.nocap && b.def.nocap.includes(line))) return;
  const ph = phrasesOf(line).find(p => t >= p.t0 - 0.12 && t < p.t1);
  if (!ph) return;
  const dark = isDark(b, t);
  const a = clamp((t - (ph.t0 - 0.12)) / 0.12) * clamp((ph.t1 - t) / 0.1);
  const size = 54, maxRow = 15;
  const chars = ph.chars;
  let rows = [chars];
  if (chars.length > maxRow) { // split at the word boundary nearest the middle
    let best = Math.ceil(chars.length / 2), bd = 1e9;
    chars.forEach((c, k) => { if (k > 0 && c.w && Math.abs(k - chars.length / 2) < bd) { bd = Math.abs(k - chars.length / 2); best = k; } });
    rows = [chars.slice(0, best), chars.slice(best)];
  }
  const y0 = (b.def.capY || 1612) - (rows.length - 1) * 38;
  ctx.save();
  // soft band for legibility
  const band = ctx.createLinearGradient(0, y0 - 120, 0, y0 + rows.length * 76 + 60);
  const bc = dark ? '0,0,0' : '242,236,225';
  band.addColorStop(0, `rgba(${bc},0)`); band.addColorStop(0.35, `rgba(${bc},${dark ? 0.45 : 0.55})`); band.addColorStop(0.75, `rgba(${bc},${dark ? 0.45 : 0.55})`); band.addColorStop(1, `rgba(${bc},0)`);
  ctx.globalAlpha = a * (b.def.capBand === false ? 0 : 1); ctx.fillStyle = band; ctx.fillRect(0, y0 - 120, W, rows.length * 76 + 180);
  ctx.globalAlpha = a;
  font(ctx, size, F.serif, 600); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.letterSpacing = '4px';
  rows.forEach((row, r) => {
    const s = row.map(x => x.c).join('');
    const w = ctx.measureText(s).width; let x = W / 2 - w / 2; const y = y0 + r * 76;
    for (const ch of row) {
      const on = t >= ch.t - 0.03;
      ctx.fillStyle = dark ? (on ? '#FFF8EC' : 'rgba(255,248,236,0.42)') : (on ? C.ink : 'rgba(31,28,25,0.36)');
      if (dark) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; }
      ctx.fillText(ch.c, x, y); x += ctx.measureText(ch.c).width + 4;
    }
  });
  ctx.restore();
}

// ---------------------------------------------------------------- chapter card
function chapterCard(ctx, t) {
  for (const ch of CHAPTERS) {
    const tc = Lstart(ch.line) - CARD_PRE, u = t - tc;
    if (u < 0 || u > CARD_LEN) continue;
    const pin = P(u, 0, 0.45, E.inOut3), pout = P(u, CARD_LEN - 0.5, 0.5, E.inOut3);
    const x0 = W * pout, x1 = W * pin;
    if (x1 <= x0) continue;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, x1 - x0, H); ctx.clip();
    bgPaper(ctx, ['#E9E0CF', 0.5]);
    const k = P(u, 0.25, 1.1, E.out5);
    // giant outlined numeral
    txt(ctx, ch.n, W / 2 + 10, 760 - (1 - k) * 60, { size: 520, font: F.en, weight: 500, noFill: true, stroke: hexA(C.ink, 0.85), lw: 3, alpha: k });
    ctx.fillStyle = C.red; ctx.fillRect(W / 2 - 160 * k, 1080, 320 * k, 4);
    txt(ctx, 'CHAPTER  ' + ch.n, W / 2, 1020, { size: 30, font: F.mono, color: C.ink2, ls: 8, alpha: k });
    typeChars(ctx, ch.zh, W / 2, 1210, u, 0.45, { size: 128, font: F.serif, weight: 900, per: 0.09, ls: 14, color: C.ink });
    txt(ctx, ch.en, W / 2, 1345, { size: 40, font: F.en, style: 'italic', color: C.ink2, ls: 4, alpha: P(u, 0.8, 0.6) });
    ctx.restore();
    // wipe edges
    ctx.save(); ctx.fillStyle = C.red;
    if (pin < 1) ctx.fillRect(x1 - 6, 0, 6, H);
    if (pout > 0 && pout < 1) ctx.fillRect(x0, 0, 6, H);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- frame
let canvas, ctx, off, offc;
function renderFrame(t) {
  let k = BLOCKS.findIndex(b => t >= b.t0 && t < b.t1); if (k < 0) k = BLOCKS.length - 1;
  const b = BLOCKS[k], d = b.def, dt = t - b.t0, tdur = d.tdur || 0.45, trans = d.trans || 'fade';
  if (k > 0 && trans !== 'cut' && dt < tdur) {
    drawBlock(ctx, BLOCKS[k - 1], t);
    offc.setTransform(1, 0, 0, 1, 0, 0); drawBlock(offc, b, t);
    const p = clamp(dt / tdur);
    ctx.save();
    if (trans === 'slide') { const e = E.inOut3(p); ctx.drawImage(off, 0, H * (1 - e)); }
    else if (trans === 'flash') { ctx.globalAlpha = 1; ctx.drawImage(off, 0, 0); ctx.globalAlpha = 1 - p; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
    else { ctx.globalAlpha = E.inOutS(p); ctx.drawImage(off, 0, 0); }
    ctx.restore();
  } else drawBlock(ctx, b, t);
  const dark = isDark(b, t);
  const ch = chapterAt(t);
  if (d.ui !== false) frameUI(ctx, t, dark, ch ? `CH.${ch.n} — ${ch.en}` : 'THE QUIET ONES', ch ? 'P.' + ch.n : '', d.uiAlpha === undefined ? 1 : d.uiAlpha);
  captions(ctx, t, b);
  chapterCard(ctx, t);
  grain(ctx, t, dark ? 0.16 : 0.1);
  vignette(ctx, dark ? 0.55 : 0.22);
  if (window.DEBUG) txt(ctx, t.toFixed(2) + 's  ' + b.name, 40, 40, { size: 28, font: F.mono, color: '#0f0', align: 'left' });
}

async function init() {
  canvas = document.getElementById('c'); ctx = canvas.getContext('2d');
  off = mkCanvas(W, H); offc = off.getContext('2d');
  TL = await (await fetch('build/timeline.json')).json();
  CUES = await (await fetch('build/cues.json')).json();
  const sample = TL.lines.map(l => l.text).join('') + SCENE_TEXT;
  const fams = [['"Noto Serif SC"', [400, 600, 900]], ['"Noto Sans SC"', [400, 700, 900]], ['"Ma Shan Zheng"', [400]]];
  const loads = [];
  for (const [f, ws] of fams) for (const w of ws) loads.push(document.fonts.load(`${w} 40px ${f}`, sample));
  for (const f of ['500 40px "Cormorant Garamond"', 'italic 500 40px "Cormorant Garamond"', '400 40px "JetBrains Mono"', '700 40px "JetBrains Mono"', '500 40px "Caveat"'])
    loads.push(document.fonts.load(f, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.:—·%+¥'));
  await Promise.all(loads); await document.fonts.ready;
  buildTextures(); buildSprites(); buildBlocks();
  return { duration: TL.duration, blocks: BLOCKS.map(b => [b.name, +b.t0.toFixed(2)]) };
}
window.ready = init();
window.renderFrame = renderFrame;
