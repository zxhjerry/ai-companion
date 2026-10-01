// Scenes. Each entry: bg, draw(g, t, block), and options:
//   trans 'fade'|'cut'|'flash'|'slide', tdur, lead, caps:false, nocap:[line...], dark, ui:false
'use strict';
const SC = {};

// ------------------------------------------------------------ shared helpers
function label(g, s, x, y, t, t0, o = {}) { fadeText(g, s, x, y, t, t0, Object.assign({ size: 40, font: F.serif, weight: 600 }, o)); }
function hand(g, s, x, y, t, t0, o = {}) { fadeText(g, s, x, y, t, t0, Object.assign({ size: 52, font: F.brush, color: C.red, rise: 10 }, o)); }
function leader(g, x1, y1, x2, y2, p, col = C.ink2) { handLine(g, [[x1, y1], [lerp(x1, x2, 0.6), y1], [x2, y2]], p, { color: col, lw: 2 }); g.save(); g.globalAlpha *= p; g.fillStyle = col; g.beginPath(); g.arc(x2, y2, 6, 0, Math.PI * 2); g.fill(); g.restore(); }
function cardBox(g, x, y, w, h, o = {}) {
  g.save(); g.shadowColor = 'rgba(60,40,20,0.18)'; g.shadowBlur = 30; g.shadowOffsetY = 12; g.fillStyle = o.fill || '#FAF6EE'; rrect(g, x, y, w, h, o.r || 18); g.fill(); g.restore();
  if (o.stroke) { g.save(); g.strokeStyle = o.stroke; g.lineWidth = 2; rrect(g, x, y, w, h, o.r || 18); g.stroke(); g.restore(); }
}
function shakeAt(g, t, hits, amp = 14, dec = 0.35) {
  let a = 0; for (const h of hits) { const d = t - h; if (d >= 0 && d < dec * 3) a += amp * Math.exp(-d / dec); }
  if (a > 0.1) g.translate(noise1(t * 40, 1) * a, noise1(t * 40, 2) * a);
}
function burst(g, x, y, t, t0, o = {}) {
  const d = t - t0, life = o.life || 0.9; if (d < 0 || d > life) return;
  const r = rng(o.seed || 1), n = o.n || 18;
  g.save();
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2, v = (o.speed || 420) * (0.4 + r() * 0.8), q = d / life;
    const px = x + Math.cos(a) * v * d, py = y + Math.sin(a) * v * d + 300 * d * d;
    g.globalAlpha = (1 - q) * (0.6 + r() * 0.4); g.fillStyle = o.color || C.lamp;
    g.fillRect(px, py, 3 + r() * 3, 3 + r() * 3);
  }
  g.restore();
}
function vtext(g, s, x, y, size, times, o = {}) {
  [...s].forEach((ch, k) => {
    const tk = Array.isArray(times) ? times[Math.min(k, times.length - 1)] : times + k * 0.08;
    const p = P(o.t, tk, 0.4);
    if (p <= 0) return;
    txt(g, ch, x, y + k * size * 1.12 + (1 - p) * 14, { size, font: o.font || F.brush, color: (o.colorAt && o.colorAt(k)) || o.color || C.white, alpha: p * (o.alpha === undefined ? 1 : o.alpha), shadow: o.shadow, blur: o.blur });
  });
}
function moonWindow(g, x, y, r, t, a = 1) {
  g.save(); g.globalAlpha *= a;
  glow(g, x + r * 0.25, y - r * 0.2, r * 1.3, 'rgba(255,236,200,0.18)');
  g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip();
  const sky = g.createLinearGradient(0, y - r, 0, y + r); sky.addColorStop(0, '#1c2433'); sky.addColorStop(1, '#0f131b'); g.fillStyle = sky; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  glow(g, x + r * 0.3, y - r * 0.25, r * 0.55, 'rgba(255,240,210,0.5)');
  g.fillStyle = '#F4E9CF'; g.beginPath(); g.arc(x + r * 0.3, y - r * 0.25, r * 0.17, 0, Math.PI * 2); g.fill();
  // bamboo silhouette in the window
  g.fillStyle = 'rgba(8,10,14,0.9)';
  for (const bx of [-0.62, -0.45]) { g.fillRect(x + bx * r, y - r, 14, 2 * r); }
  for (let k = 0; k < 9; k++) {
    g.save(); g.translate(x - r * 0.52 + (k % 2) * 14, y - r * 0.75 + k * 52); g.rotate(0.35 + (k % 3) * 0.18 + Math.sin(t * 0.8 + k) * 0.04);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(60, -10, 130 - (k % 3) * 20, 8); g.quadraticCurveTo(60, 8, 0, 0); g.fill(); g.restore();
  }
  g.restore();
  g.strokeStyle = '#2a2f3a'; g.lineWidth = 22; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(200,170,120,0.25)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 14, 0, Math.PI * 2); g.stroke();
  g.restore();
}
function sfxTimes(type, a, b) { return CUES.sfx.filter(e => e.type === type && e.t >= a && e.t <= b).map(e => e.t); }

// ============================================================ COLD OPEN
SC.title = {
  bg: '#000', caps: false, ui: false, trans: 'cut',
  draw(g, t) {
    // the first breath: a warm line becomes a flute
    const pl = P(t, 0.35, 2.4, E.inOut3), fade = 1 - P(t, 2.6, 0.8);
    if (pl > 0 && fade > 0) {
      handLine(g, [[140, 1430], [940, 1430]], pl, { color: C.lamp, lw: 3, alpha: fade, shadow: C.lamp, blur: 18 });
      glow(g, lerp(140, 940, pl), 1430, 90, hexA(C.lamp, 0.6 * fade));
    }
    const fl = P(t, 2.5, 1.2);
    flute(g, W / 2, 1430, 820, { alpha: fl * (1 - P(t, 9.6, 1.2)) * 0.95, glow: 0.6 });
    const shy = [T0(0, '千'), T0(1, '最'), T0(2, '被')];
    g.save(); shakeAt(g, t, shy.slice(1, 2), 18, 0.25);
    // 千锤百炼 — each strike on the anvil
    const times = spokenTimes(0, '千锤百炼');
    typeChars(g, '千锤百炼', W / 2, 560, t, times, { size: 150, weight: 900, color: C.white, ls: 26, rise: 0, dur: 0.12 });
    times.forEach((tk, k) => { burst(g, W / 2 - 270 + k * 176, 560, t, tk, { seed: k + 3, n: 26, speed: 520 }); glow(g, W / 2 - 270 + k * 176, 560, 160, hexA(C.lamp, 0.5 * (1 - P(t, tk, 0.5)) * (t > tk ? 1 : 0))); });
    typeChars(g, '之后', W / 2 + 250, 705, t, spokenTimes(0, '之后'), { size: 56, weight: 400, color: 'rgba(246,241,232,0.7)', ls: 16 });
    // 最难
    const pz = P(t, shy[1], 0.35, E.outBack);
    if (pz > 0) txt(g, '最难', W / 2, 930, { size: 250 * lerp(1.25, 1, pz), font: F.serif, weight: 900, color: C.white, alpha: clamp(pz * 1.5), ls: 30 });
    g.restore();
    // 是被看见 — revealed by a spotlight
    typeChars(g, '是', W / 2 - 300, 1185, t, spokenTimes(2, '是'), { size: 80, color: 'rgba(246,241,232,0.8)' });
    const ps = P(t, shy[2] - 0.1, 1.1, E.out3);
    if (ps > 0) {
      glow(g, W / 2 + 60, 1185, 520 * ps, 'rgba(214,90,68,0.35)');
      g.save(); g.beginPath(); g.arc(W / 2 + 60, 1185, 560 * ps, 0, Math.PI * 2); g.clip();
      txt(g, '被看见', W / 2 + 60, 1185, { size: 170, font: F.serif, weight: 900, color: C.red2, ls: 18 });
      g.restore();
    }
    // fade everything before the regret line
    const out = P(t, 10.0, 0.8);
    if (out > 0) { g.fillStyle = `rgba(0,0,0,${out})`; g.fillRect(0, 0, W, H); }
  },
};
SC.regret = {
  bg: 'paper', caps: false, trans: 'fade', tdur: 0.8,
  draw(g, t, b) {
    const i = b.first;
    txt(g, 'NOTE · 01', W / 2, 520, { size: 30, font: F.mono, color: C.mute, ls: 10, alpha: P(t, Lstart(i) - 0.4, 0.6) });
    typeChars(g, '我们都在经历', W / 2, 700, t, spokenTimes(i, '我们都在经历'), { size: 64, color: C.ink2, ls: 10 });
    typeChars(g, '同一种遗憾', W / 2, 880, t, spokenTimes(i, '同一种遗憾'), { size: 132, weight: 900, color: C.ink, ls: 12 });
    const tu = T0(i, '遗憾');
    handLine(g, wobbleLine(560, 985, 900, 980, 9, 5), P(t, tu, 0.7), { color: C.red, lw: 7 });
    txt(g, 'a regret we all share', W / 2, 1090, { size: 46, font: F.en, style: 'italic', color: C.mute, alpha: P(t, tu + 0.4, 0.8) });
  },
};
SC.quiet = {
  bg: 'paper', caps: false, trans: 'fade', tdur: 0.6,
  draw(g, t, b) {
    const i = b.first, s = lerp(1.0, 0.93, P(t, Lstart(i), 4, E.lin));
    g.translate(W / 2, H / 2); g.scale(s, s); g.translate(-W / 2, -H / 2);
    typeChars(g, '真正的好东西', W / 2, 780, t, spokenTimes(i, '真正的好东西'), { size: 52, color: C.ink, ls: 14 });
    flute(g, W / 2, 960, 240, { alpha: P(t, Lstart(i), 1.2), glow: 0.4 });
    typeChars(g, '太安静了', W / 2, 1150, t, spokenTimes(i, '太安静了'), { size: 40, color: 'rgba(31,28,25,0.38)', ls: 40, rise: 4 });
  },
};
SC.loud = {
  bg: 'neon', caps: false, trans: 'cut', lead: 0.02, dark: true, uiAlpha: 0.35,
  draw(g, t, b) {
    const i = b.first, t0 = T0(i, '喧'), end = Lend(i) + 0.25;
    const hits = [t0, T0(i, '嚣'), T0(i, '烂'), T0(i, '东'), T0(i, '造势')];
    // CRT power-off at the tape stop
    const off = P(t, end, 0.5, E.in3);
    if (off >= 1) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); return; }
    g.save(); g.translate(W / 2, H / 2); g.scale(1 + off * 0.1, lerp(1, 0.005, off)); g.translate(-W / 2, -H / 2);
    shakeAt(g, t, hits, 22, 0.18);
    const stick = [['秒杀', C.yellow, -0.2], ['爆款', C.pink, 0.15], ['限时!!', C.cyan, -0.1], ['¥9.9', C.yellow, 0.2], ['全网最低', C.pink, -0.25], ['仅剩3件', '#fff', 0.1], ['冲!!!', C.yellow, -0.15], ['买一送三', C.cyan, 0.22], ['清仓', C.pink, -0.05], ['今日特价', C.yellow, 0.12]];
    const r = rng(5), beat = 60 / 140 / 2;
    stick.forEach((s, k) => {
      const tk = t0 + k * beat * 1.5, p = P(t, tk, 0.16, E.outBack);
      if (p <= 0) return;
      const x = 140 + r() * 800, y = 280 + r() * 1300, flick = Math.floor(t * 14 + k) % 5 === 0 ? 0.4 : 1;
      g.globalAlpha = flick; sticker(g, x, y, s[0], { bg: s[1], rot: s[2], scale: p * (0.8 + r() * 0.5), size: 66 }); g.globalAlpha = 1;
    });
    const p1 = P(t, t0, 0.2, E.outBack);
    if (p1 > 0) rgbText(g, '喧嚣', W / 2, 760, 260 * p1, t, 10);
    if (t > T0(i, '的')) rgbText(g, '的烂东西', W / 2, 1010, 110, t, 6);
    const p2 = P(t, T0(i, '太'), 0.22, E.outBack);
    if (p2 > 0) { g.save(); g.translate(W / 2, 1250); g.scale(lerp(1.6, 1, p2), lerp(1.6, 1, p2)); txt(g, '太会造势了', 0, 0, { size: 150, font: F.sans, weight: 900, color: C.yellow, shadow: C.pink, blur: 40 }); g.restore(); }
    // scanlines
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = (t * 120) % 6; y < H; y += 6) g.fillRect(0, y, W, 2);
    g.restore();
    if (off > 0) { g.fillStyle = `rgba(255,255,255,${off * 0.8})`; g.fillRect(0, H / 2 - 3, W, 6); }
  },
};

// ============================================================ 01 THE LIVESTREAM
SC.night = {
  bg: 'night', trans: 'cut',
  draw(g, t, b) {
    const i = b.first, tp = Lstart(i + 1), up = P(t, tp - 0.2, 1.1, E.inOut3);
    g.save(); g.translate(0, -up * 500); g.globalAlpha = 1 - up;
    moonWindow(g, W / 2, 560, 300, t, 1);
    const colon = Math.floor(t * 2) % 2 ? 1 : 0.25;
    const k = P(t, Lstart(i) - 0.3, 0.8);
    txt(g, '00', W / 2 - 150, 1080, { size: 200, font: F.mono, weight: 400, color: C.white, alpha: k });
    txt(g, ':', W / 2, 1070, { size: 200, font: F.mono, color: C.white, alpha: k * colon });
    txt(g, '12', W / 2 + 150, 1080, { size: 200, font: F.mono, weight: 400, color: C.white, alpha: k });
    txt(g, 'AM · 深夜', W / 2, 1210, { size: 34, font: F.mono, color: 'rgba(246,241,232,0.5)', ls: 8, alpha: k });
    g.restore();
    // phone rises, feed scrolls and stops on the livestream
    if (up > 0) {
      const py = lerp(2500, 960, up), tstop = T0(i + 1, '停');
      const scroll = (1 - P(t, tp, tstop - tp, E.out3)) * 2600;
      phone(g, W / 2, py, 720, 1300, (c, w, h) => {
        streamScreen(c, w, h, t, { tool: true });
        if (scroll > 1) {
          c.save(); c.translate(0, -scroll);
          for (let k = 1; k <= 8; k++) {
            const y = k * h * 0.42 - h * 0.42 + h; const hue = (k * 47) % 360;
            c.fillStyle = `hsl(${hue},45%,${k % 2 ? 72 : 60}%)`; c.fillRect(0, y - h * 0.42 + h, w, h * 0.42 - 8);
            c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(30, y + h * 0.3, w * 0.6, 22); c.fillRect(30, y + h * 0.36, w * 0.4, 18);
          }
          c.restore();
        }
      });
    }
  },
};
SC.stream = {
  bg: 'night', trans: 'fade', tdur: 0.3, lead: 0.2,
  draw(g, t, b) {
    const i = b.first, s = lerp(1, 1.05, P(t, Lstart(i), 6, E.lin));
    g.save(); g.translate(W / 2, 960); g.scale(s, s); g.translate(-W / 2, -960);
    phone(g, W / 2, 960, 720, 1300, (c, w, h) => streamScreen(c, w, h, t, { tool: true, voice: t > T0(i, '声音') ? 1 : 0.15 }));
    g.restore();
    const a1 = T0(i, '沙哑'), a2 = T0(i, '调试');
    hand(g, '声音沙哑', 210, 1300, t, a1, { color: C.lamp, size: 54 });
    leader(g, 210, 1260, 330, 1180, P(t, a1, 0.5), C.lamp);
    hand(g, '调试笛子', 860, 600, t, a2, { color: C.lamp, size: 54 });
    leader(g, 860, 640, 700, 930, P(t, a2, 0.5), C.lamp);
  },
};
SC.quote = {
  bg: 'night', caps: false, trans: 'fade', tdur: 0.6,
  draw(g, t, b) {
    const i = b.first;
    g.save(); g.globalAlpha = 0.16; phone(g, W / 2, 960, 720, 1300, (c, w, h) => streamScreen(c, w, h, t, { tool: false, warm: 0.6 }), { shadow: false }); g.restore();
    txt(g, '他说', W / 2, 300, { size: 44, font: F.serif, color: 'rgba(246,241,232,0.6)', ls: 20, alpha: P(t, Lstart(i), 0.6) });
    const cols = [[i + 1, '今天喝了点酒', 850], [i + 1, '每天坐在这里调笛子', 680], [i + 2, '但是你们却不懂我', 510], [i + 2, '这每一刀一刻的价值', 340]];
    const red = new Set(['一', '刀', '刻']);
    cols.forEach(([li, s, x]) => vtext(g, s, x, 420, 96, spokenTimes(li, s), { t, font: F.brush, color: C.white, colorAt: k => (s.startsWith('这每') && k >= 2 && k <= 5 && red.has(s[k])) ? C.red2 : null }));
    // knife cuts
    for (const [ch, seed] of [['刀', 1], ['刻', 2]]) {
      const tk = T0(i + 2, ch), p = P(t, tk, 0.12, E.out3), fadeK = 1 - P(t, tk + 0.25, 0.9);
      if (p > 0 && fadeK > 0) {
        const y = seed === 1 ? 760 : 1180;
        handLine(g, [[60, y + 180], [1020, y - 180]], p, { color: '#fff', lw: 5, alpha: fadeK, shadow: '#fff', blur: 22 });
      }
    }
  },
};
SC.stay = {
  bg: 'night', trans: 'fade', tdur: 0.6,
  draw(g, t, b) {
    const i = b.first, push = P(t, Lstart(i + 2), 5.5, E.inOut3);
    const s = lerp(1, 1.35, push), tv = T0(i, '停留');
    g.save(); g.translate(W / 2, 960 + push * 120); g.scale(s, s); g.translate(-W / 2, -960);
    phone(g, W / 2, 960, 720, 1300, (c, w, h) => streamScreen(c, w, h, t, { tool: true, warm: 1, viewers: t >= tv ? 8 : 7 }));
    g.restore();
    const pv = P(t, tv, 0.5, E.outBack);
    if (pv > 0 && pv < 1 || (t > tv && t < tv + 1.6)) { const a = 1 - P(t, tv + 1.1, 0.5); txt(g, '+1', 520, 260 - pv * 30, { size: 64, font: F.mono, weight: 700, color: C.lamp, alpha: a }); txt(g, '是我', 640, 262 - pv * 30, { size: 40, font: F.brush, color: C.lamp, alpha: a }); }
    const a1 = T0(i + 1, '手艺人'), a2 = T0(i + 1, '艺术者'), fade = 1 - P(t, Lstart(i + 2), 0.6);
    g.save(); g.globalAlpha = fade;
    hand(g, '手艺人', 190, 520, t, a1, { color: C.lamp, size: 70 });
    handLine(g, wobbleEllipse(190, 522, 120, 62, 3), P(t, a1 + 0.1, 0.5), { color: C.lamp, lw: 4 });
    hand(g, '艺术者', 890, 1420, t, a2, { color: C.lamp, size: 70 });
    handLine(g, wobbleEllipse(890, 1422, 120, 62, 5), P(t, a2 + 0.1, 0.5), { color: C.lamp, lw: 4 });
    g.restore();
    glow(g, W / 2, 800, 900, hexA(C.lamp, 0.18 * push));
  },
};
SC.craft3 = {
  bg: 'paper', trans: 'fade', tdur: 0.8,
  draw(g, t, b) {
    const i = b.first;
    const rows = [['数年阴干', '老竹', 'FIG.01  BAMBOO', T0(i, '数年')], ['手工打磨', '内径', 'FIG.02  BORE', T0(i, '手工')], ['逐支精调', '音色', 'FIG.03  TONE', T0(i, '逐支')]];
    rows.forEach(([a, bb, en, tk], k) => {
      const p = P(t, tk - 0.15, 0.6, E.out5); if (p <= 0) return;
      const y = 300 + k * 380, x = 110 + (1 - p) * 120;
      g.save(); g.globalAlpha = p;
      cardBox(g, x, y, 860, 330);
      txt(g, en, x + 40, y + 46, { size: 24, font: F.mono, color: C.mute, align: 'left', ls: 4 });
      txt(g, a, x + 830, y + 150, { size: 66, font: F.serif, weight: 900, color: C.ink, align: 'right', ls: 6 });
      txt(g, bb, x + 830, y + 240, { size: 46, font: F.serif, color: C.green, align: 'right', ls: 16 });
      const cx = x + 230, cy = y + 180, u = t - tk;
      if (k === 0) { // bamboo segment drying in shade
        g.fillStyle = '#A88C55'; rrect(g, cx - 170, cy - 26, 340, 52, 26); g.fill();
        for (const f of [-0.6, 0, 0.6]) { g.fillStyle = '#7B6232'; g.fillRect(cx + f * 170 - 3, cy - 26, 6, 52); }
        for (let r = 0; r < 4; r++) { g.strokeStyle = hexA(C.ink2, 0.25); g.lineWidth = 2; g.beginPath(); g.arc(cx + 120, cy - 90, 22 + r * 14 + (u * 10) % 14, Math.PI, Math.PI * 2); g.stroke(); }
        txt(g, 'YEARS', cx - 120, cy + 90, { size: 26, font: F.mono, color: C.mute, ls: 6 });
      } else if (k === 1) { // bore cross-section, sanding
        for (let r = 0; r < 5; r++) { g.strokeStyle = hexA(C.bambooD, 0.25 + r * 0.12); g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 110 - r * 16, 0, Math.PI * 2); g.stroke(); }
        g.fillStyle = '#1d140c'; g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.fill();
        g.strokeStyle = C.red; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, 52, u * 4, u * 4 + 1.2); g.stroke();
      } else { // noisy wave settling into a pure tone
        const clean = P(t, tk + 0.3, 1.6, E.inOut3);
        g.strokeStyle = C.ink; g.lineWidth = 3; g.beginPath();
        for (let x2 = -170; x2 <= 170; x2 += 3) { const yy = Math.sin(x2 / 18 + u * 6) * 40 + noise1(x2 / 6 + u * 20, 3) * 50 * (1 - clean); x2 === -170 ? g.moveTo(cx + x2, cy + yy) : g.lineTo(cx + x2, cy + yy); }
        g.stroke();
        txt(g, clean > 0.9 ? 'IN TUNE' : 'TUNING…', cx, cy + 105, { size: 24, font: F.mono, color: clean > 0.9 ? C.green : C.mute, ls: 4 });
      }
      g.restore();
    });
  },
};
SC.devotion = {
  bg: 'paper', trans: 'fade',
  draw(g, t, b) {
    const i = b.first, t1 = T0(i, '笨拙'), t2 = T0(i, '虔诚');
    flute(g, W / 2, 1250, 900, { glow: 0.8, alpha: P(t, Lstart(i) - 0.2, 0.8) });
    g.save(); shakeAt(g, t, [t1, t2], 6, 0.12);
    typeChars(g, '最笨拙', 420, 560, t, spokenTimes(i, '最笨拙'), { size: 150, weight: 900, color: C.ink, ls: 10 });
    typeChars(g, '最虔诚', 660, 860, t, spokenTimes(i, '最虔诚'), { size: 150, weight: 900, color: C.ink, ls: 10 });
    seal(g, '拙', 760, 470, 130, t, t1 + 0.25, { rot: 0.08 });
    seal(g, '诚', 300, 950, 130, t, t2 + 0.25, { rot: -0.1 });
    g.restore();
  },
};
SC.nolist = {
  bg: 'paper', trans: 'fade',
  draw(g, t, b) {
    const i = b.first;
    txt(g, '他 没 有', 150, 400, { size: 44, font: F.serif, weight: 700, color: C.red, align: 'left', ls: 8, alpha: P(t, Lstart(i) - 0.2, 0.5) });
    g.fillStyle = hexA(C.ink, 0.15); g.fillRect(150, 440, 780 * P(t, Lstart(i) - 0.2, 0.8), 2);
    const items = [[i, '花哨话术'], [i, '秒杀套路'], [i, '捆绑速成教学'], [i + 1, '任何装饰']];
    items.forEach(([li, s], k) => {
      const y = 540 + k * 130, ta = T0(li, s), te = T1(li, s);
      const p = P(t, ta - 0.1, 0.4); if (p <= 0) return;
      g.save(); g.globalAlpha = p;
      g.strokeStyle = C.ink2; g.lineWidth = 3; g.strokeRect(150, y - 28, 56, 56);
      txt(g, s, 250, y + 2, { size: 64, font: F.serif, weight: 600, color: C.ink, align: 'left' });
      const w = measure(g, s, 64, F.serif, 600);
      strike(g, 250, 250 + w, y + 4, P(t, te, 0.35), { seed: k + 2 });
      handLine(g, [[158, y - 20], [198, y + 20]], P(t, te + 0.1, 0.15), { color: C.red, lw: 6 });
      handLine(g, [[198, y - 20], [158, y + 20]], P(t, te + 0.2, 0.15), { color: C.red, lw: 6 });
      g.restore();
    });
    const last = i + 2;
    if (t > Lstart(last) - 0.3) {
      typeChars(g, '只安静吹笛', W / 2, 1180, t, spokenTimes(last, '只安静吹笛'), { size: 92, weight: 900, color: C.green, ls: 12 });
      typeChars(g, '踏实制器', W / 2, 1320, t, spokenTimes(last, '踏实制器'), { size: 92, weight: 900, color: C.green, ls: 12 });
      handLine(g, [[160, 1240], [200, 1290], [280, 1150]], P(t, T1(last, '制器'), 0.4), { color: C.green, lw: 9 });
    }
  },
};
SC.cruel = {
  bg: '#000', caps: false, trans: 'cut', lead: 0.05,
  draw(g, t, b) {
    const i = b.first, t0 = Lstart(i);
    shakeAt(g, t, [t0], 16, 0.2);
    typeChars(g, '可现实', W / 2, 820, t, spokenTimes(i, '可现实'), { size: 90, color: 'rgba(246,241,232,0.75)', ls: 20, rise: 0 });
    const p = P(t, T0(i, '格外'), 0.5, E.out5);
    if (p > 0) { g.save(); g.translate(W / 2, 1020); g.scale(lerp(1.15, 1, p), lerp(1.15, 1, p)); txt(g, '格外残酷', 0, 0, { size: 190, font: F.serif, weight: 900, color: C.white, alpha: p, ls: 14 }); g.restore(); }
    handLine(g, [[200, 1150], [420, 1162], [520, 1140], [700, 1170], [880, 1150]], P(t, T0(i, '残酷'), 0.4), { color: C.red, lw: 5 });
  },
};
SC.empty = {
  bg: 'night', trans: 'fade',
  draw(g, t, b) {
    const i = b.first, d1 = T0(i + 1, '驻足'), d3 = T0(i + 1, '却不多');
    const viewers = t < d1 ? 8 : t < d1 + 0.5 ? 5 : t < d3 ? 4 : 3;
    const cold = P(t, Lstart(i + 1), 3);
    phone(g, W / 2, 960, 720, 1300, (c, w, h) => streamScreen(c, w, h, t, { tool: true, warm: lerp(0.9, 0.35, cold), viewers }));
    label(g, '岁月沉淀', W / 2 - 200, 240, t, T0(i, '岁月'), { color: C.gold, size: 50, font: F.brush, weight: 400 });
    label(g, '反复细品', W / 2 + 200, 240, t, T0(i, '反复'), { color: C.gold, size: 50, font: F.brush, weight: 400 });
    const p = P(t, d3, 0.6, E.outBack);
    if (p > 0) {
      g.save(); g.translate(820, 380); g.scale(p, p);
      g.fillStyle = 'rgba(255,255,255,0.95)'; rrect(g, -120, -70, 240, 140, 30); g.fill();
      txt(g, '3', -30, 0, { size: 110, font: F.mono, weight: 700, color: C.ink });
      txt(g, '人', 50, 14, { size: 40, font: F.sans, color: C.ink2 });
      g.restore();
    }
    g.fillStyle = `rgba(20,24,30,${0.35 * cold})`; g.fillRect(0, 0, W, H);
  },
};
SC.flood = {
  bg: 'neon', trans: 'flash', tdur: 0.25, dark: true,
  draw(g, t, b) {
    const i = b.first;
    // 3x3 wall of loud livestreams
    for (let k = 0; k < 9; k++) {
      const p = P(t, Lstart(i) + k * 0.12, 0.3, E.outBack); if (p <= 0) continue;
      const x = 120 + (k % 3) * 290, y = 260 + Math.floor(k / 3) * 330;
      g.save(); g.translate(x + 130, y + 150); g.scale(p, p);
      g.fillStyle = k % 2 ? '#2a0f2a' : '#14102c'; rrect(g, -130, -150, 260, 300, 20); g.fill();
      g.strokeStyle = k % 3 === 0 ? C.pink : C.cyan; g.lineWidth = 3; g.stroke();
      flute(g, 0, 0, 200, { cheap: true, rot: -0.3 + k * 0.07 });
      const fl = Math.floor(t * 8 + k) % 3 === 0;
      sticker(g, 0, -95, ['秒杀', '9.9', '爆款', '限时'][k % 4], { size: 34, bg: fl ? C.pink : C.yellow, rot: -0.1 });
      txt(g, '● LIVE ' + (1000 + k * 731 + Math.floor(t * 97) % 999), 0, 120, { size: 20, font: F.mono, color: '#fff' });
      g.restore();
    }
    // conveyor of identical toy flutes
    g.fillStyle = '#222'; g.fillRect(0, 1290, W, 70); g.fillStyle = '#444';
    for (let x = -((t * 400) % 80); x < W; x += 80) g.fillRect(x, 1360, 40, 12);
    for (let x = -((t * 400) % 270); x < W + 300; x += 270) flute(g, x, 1270, 230, { cheap: true });
    // warning tags
    [['玩具笛', 260, 1200], ['虚标竹材', 560, 1180], ['噱头笛', 860, 1210]].forEach(([s, x, y], k) => {
      const p = P(t, T0(i, s), 0.2, E.outBack); if (p > 0) sticker(g, x, y, '⚠ ' + s, { size: 40, bg: C.yellow, rot: (k - 1) * 0.12, scale: p });
    });
    // order notifications on every ding
    const dings = sfxTimes('ding', b.t0, Lend(i + 1) + 0.5);
    dings.forEach((td, k) => {
      if (t < td) return;
      const age = t - td, y = 1500 - age * 260 - (k % 2) * 20;
      if (y < 900) return;
      const a = clamp(age / 0.08) * clamp((y - 900) / 200);
      g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(255,255,255,0.92)'; rrect(g, 90 + (k % 3) * 40, y, 560, 64, 32); g.fill();
      txt(g, `用户${'ABCDEFGHJKLMNPQRSTUVWXYZ'[k % 24]}*** 刚刚下单`, 130 + (k % 3) * 40, y + 33, { size: 30, font: F.sans, weight: 700, color: '#222', align: 'left' });
      g.restore();
    });
    const sold = Math.floor(Math.pow(clamp((t - Lstart(i + 1)) / 5), 2) * 100000);
    if (t > Lstart(i + 1) - 0.2) {
      g.fillStyle = C.pink; rrect(g, 640, 1420, 360, 110, 22); g.fill();
      txt(g, '已售 ' + (sold >= 100000 ? '10万+' : sold.toLocaleString()), 820, 1476, { size: 46, font: F.sans, weight: 900, color: '#fff' });
    }
  },
};
SC.mismatch = {
  bg: '#121212', trans: 'cut', lead: 0.05, dark: true,
  draw(g, t, b) {
    const i = b.first, t0 = Lstart(i), tc = T0(i + 1, '错位');
    // frozen ghost of the noise, draining away
    const ghost = 1 - P(t, t0, 1.6);
    if (ghost > 0) { g.save(); g.globalAlpha = ghost * 0.5; for (let k = 0; k < 9; k++) { g.fillStyle = '#3a3a3a'; rrect(g, 120 + (k % 3) * 290, 260 + Math.floor(k / 3) * 330, 260, 300, 20); g.fill(); } g.restore(); }
    typeChars(g, '这从来不是手艺的落败', W / 2, 460, t, spokenTimes(i, '这从来不是手艺的落败'), { size: 56, color: 'rgba(246,241,232,0.85)', ls: 6 });
    const ap = P(t, Lstart(i + 1) - 0.3, 0.8);
    const glitch = t > tc ? (1 - P(t, tc, 1.2)) : 0, off = t > tc ? 120 : 0;
    // two time rulers
    const lanes = [['慢打磨', 760, 30, C.lamp, F.serif], ['快流量', 1060, 900, C.cyan, F.mono]];
    lanes.forEach(([name, y, speed, col, fam], k) => {
      g.save(); g.globalAlpha = ap;
      if (k === 1) g.translate(off * E.outBack(clamp((t - tc) / 0.3)) + (Math.random() - 0.5) * 0 + noise1(t * 30, 4) * 40 * glitch, 0);
      g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(80, y); g.lineTo(1000, y); g.stroke();
      for (let x = 80 - ((t * speed) % 60); x < 1000; x += 60) { if (x < 80) continue; g.beginPath(); g.moveTo(x, y - (Math.round((x + t * speed) / 60) % 5 === 0 ? 30 : 14)); g.lineTo(x, y); g.stroke(); }
      txt(g, name, 80, y - 70, { size: 54, font: fam, weight: 700, color: col, align: 'left', ls: 6 });
      g.restore();
    });
    const pc = P(t, tc, 0.25, E.outBack);
    if (pc > 0) {
      txt(g, '时代错位', W / 2 - 8, 1330, { size: 150, font: F.serif, weight: 900, color: 'rgba(255,45,120,0.8)', alpha: pc });
      txt(g, '时代错位', W / 2 + 8, 1336, { size: 150, font: F.serif, weight: 900, color: 'rgba(54,238,255,0.8)', alpha: pc });
      txt(g, '时代错位', W / 2, 1333, { size: 150, font: F.serif, weight: 900, color: C.white, alpha: pc });
    }
  },
};
SC.wonder = {
  bg: 'night', trans: 'fade', tdur: 0.8,
  draw(g, t, b) {
    const i = b.first;
    moonWindow(g, W / 2, 470, 230, t, P(t, b.t0, 1));
    typeChars(g, '那晚我一直在想', W / 2, 820, t, spokenTimes(i, '那晚我一直在想'), { size: 52, color: 'rgba(246,241,232,0.8)', ls: 12 });
    const h1 = T0(i + 1, '听见'), h2 = T0(i + 1, '听见', 1);
    for (const [th, n, big] of [[h1, 4, 0.6], [h2, 7, 1.4]]) {
      for (let k = 0; k < n; k++) {
        const d = t - th - k * 0.35; if (d < 0) continue;
        const r = 60 + d * 260 * big, a = clamp(1 - d / (2.2 * big + 0.6));
        g.strokeStyle = `rgba(243,180,102,${0.6 * a})`; g.lineWidth = 3; g.beginPath(); g.arc(W / 2, 1110, r, 0, Math.PI * 2); g.stroke();
      }
    }
    const ph = P(t, h1, 0.6);
    if (ph > 0) { glow(g, W / 2, 1110, 220, hexA(C.lamp, 0.35 * ph)); txt(g, '听见', W / 2, 1110, { size: 120, font: F.serif, weight: 900, color: C.white, alpha: ph, ls: 12 }); }
    hand(g, '?', 760, 990, t, T1(i + 1, '听见', 1) - 0.1, { color: C.red2, size: 120, font: F.serif });
  },
};

// ============================================================ 02 TWO TRACKS
function halves(g, t, a, sep = 0) {
  g.save(); g.globalAlpha *= a;
  g.fillStyle = hexA(C.green, 0.12); g.fillRect(0, 230 - sep, W, 720);
  g.fillStyle = hexA(C.gold, 0.14); g.fillRect(0, 970 + sep, W, 520);
  txt(g, '竹笛', 110, 300 - sep, { size: 56, font: F.serif, weight: 900, color: C.green, align: 'left', ls: 10 });
  txt(g, 'BAMBOO FLUTE', 110, 360 - sep, { size: 24, font: F.mono, color: C.mute, align: 'left', ls: 4 });
  flute(g, W / 2, 640 - sep, 820, { glow: 0.3 });
  txt(g, '游戏美术', 110, 1040 + sep, { size: 56, font: F.serif, weight: 900, color: C.bambooD, align: 'left', ls: 10 });
  txt(g, 'GAME ART', 110, 1100 + sep, { size: 24, font: F.mono, color: C.mute, align: 'left', ls: 4 });
  painting(g, 560, 1050 + sep, 400, 273, 1);
  g.restore();
}
SC.tracks = {
  bg: 'paper',
  draw(g, t, b) {
    const i = b.first, pa = P(t, T0(i, '游戏美术') - 0.2, 0.6), tear = T0(i, '割裂');
    const out = P(t, Lstart(i + 1) - 0.3, 0.6);
    g.save(); g.globalAlpha = 1 - out;
    // top half arrives with the chapter, bottom half with 游戏美术
    g.save(); g.beginPath(); g.rect(0, 0, W, 960); g.clip(); halves(g, t, 1); g.restore();
    if (pa > 0) { g.save(); g.beginPath(); g.rect(W * (1 - pa), 960, W, H); g.clip(); halves(g, t, 1); g.restore(); }
    // the tear
    const pt = P(t, tear, 0.5);
    if (pt > 0) { const pts = []; for (let k = 0; k <= 20; k++) pts.push([k * W / 20, 960 + (k % 2 ? 14 : -14) * (1 + noise1(k, 3) * 0.5)]); handLine(g, pts, pt, { color: C.ink, lw: 3 }); }
    g.restore();
    // two lanes converging to one shadow
    if (out > 0) {
      g.save(); g.globalAlpha = out;
      const vx = W / 2, vy = 470, pl = P(t, Lstart(i + 1), 1.4, E.inOut3);
      handLine(g, [[180, 1460], [vx - 12, vy]], pl, { color: C.green, lw: 10 });
      handLine(g, [[900, 1460], [vx + 12, vy]], pl, { color: C.bambooD, lw: 10 });
      txt(g, '竹笛', 260, 1400, { size: 46, font: F.serif, weight: 700, color: C.green, alpha: pl });
      txt(g, '美术', 820, 1400, { size: 46, font: F.serif, weight: 700, color: C.bambooD, alpha: pl });
      const ps = P(t, T0(i + 1, '一模一样'), 1.0);
      glow(g, vx, vy, 360 * ps + 1, `rgba(40,36,32,${0.5 * ps})`);
      label(g, '同一种时代悲哀', W / 2, 340, t, T0(i + 1, '一模一样'), { size: 56, weight: 900, color: C.ink, ls: 8 });
      g.restore();
    }
  },
};
SC.twin_flute = {
  bg: 'paper', tint: [C.green, 0.06],
  draw(g, t, b) {
    const i = b.first;
    txt(g, '竹笛手艺人', 110, 330, { size: 72, font: F.serif, weight: 900, color: C.green, align: 'left', ls: 8, alpha: P(t, b.t0, 0.5) });
    g.fillStyle = C.green; g.fillRect(110, 385, 300 * P(t, b.t0 + 0.2, 0.6), 4);
    const steps = [['阴干老竹', '01'], ['修孔', '02'], ['调音', '03'], ['纯粹', '04']];
    steps.forEach(([s, n], k) => {
      const tk = T0(i, s), p = P(t, tk - 0.1, 0.5, E.out5); if (p <= 0) return;
      const x = 110 + (k % 2) * 450, y = 480 + Math.floor(k / 2) * 480, u = t - tk;
      g.save(); g.globalAlpha = p; g.translate(0, (1 - p) * 40);
      cardBox(g, x, y, 410, 420);
      txt(g, n, x + 30, y + 50, { size: 30, font: F.mono, color: C.mute, align: 'left' });
      txt(g, k === 3 ? '一丝音色的纯粹' : s, x + 205, y + 360, { size: k === 3 ? 40 : 52, font: F.serif, weight: 700, color: C.ink });
      const cx = x + 205, cy = y + 190;
      if (k === 0) { g.drawImage(SPR.bamboo, 0, 0, 420, 700, cx - 90, cy - 150, 180, 300); }
      else if (k === 1) { flute(g, cx, cy, 380); g.strokeStyle = C.red; g.lineWidth = 4; g.beginPath(); g.arc(cx + 30, cy - 8, 30 + 6 * Math.sin(u * 8), 0, Math.PI * 2); g.stroke(); }
      else if (k === 2) { g.strokeStyle = C.ink; g.lineWidth = 3; g.beginPath(); for (let x2 = -150; x2 <= 150; x2 += 3) { const yy = Math.sin(x2 / 14 + u * 8) * 50 * Math.exp(-Math.abs(x2) / 120) * (1 + noise1(x2 / 8 + u * 9) * 0.3 * Math.exp(-u)); x2 === -150 ? g.moveTo(cx + x2, cy + yy) : g.lineTo(cx + x2, cy + yy); } g.stroke(); }
      else { handLine(g, [[cx - 160, cy], [cx + 160, cy]], P(t, tk, 1.2), { color: C.green, lw: 2 }); glow(g, cx, cy, 80, hexA(C.green, 0.25)); }
      g.restore();
    });
  },
};
SC.twin_art = {
  bg: 'paper', tint: [C.gold, 0.06],
  draw(g, t, b) {
    const i = b.first, j = i + 1;
    txt(g, '美术创作者', 110, 330, { size: 72, font: F.serif, weight: 900, color: C.bambooD, align: 'left', ls: 8, alpha: P(t, b.t0, 0.5) });
    g.fillStyle = C.bambooD; g.fillRect(110, 385, 300 * P(t, b.t0 + 0.2, 0.6), 4);
    const pp = clamp((t - Lstart(i)) / (Lend(i) - Lstart(i)));
    const light = P(t, T0(j, '氛围'), 1.2), grid = P(t, T0(i, '构图'), 0.4) * (1 - P(t, Lstart(j), 0.5));
    painting(g, 160, 470, 760, 520, pp, { light, grid });
    const tv = T0(i, '几十版');
    const v = Math.min(36, Math.max(1, Math.floor(1 + Math.max(0, t - tv) / 1.4 * 35)));
    txt(g, 'v' + String(v).padStart(2, '0'), 900, 440, { size: 40, font: F.mono, weight: 700, color: C.red, align: 'right', alpha: P(t, tv - 0.2, 0.3) });
    [['手绘笔触', 200, 1090, '手绘笔触'], ['推敲光影', 540, 1090, '推敲光影'], ['构图细节', 880, 1090, '构图']].forEach(([s, x, y, key]) => hand(g, s, x, y, t, T0(i, key), { color: C.ink2, size: 46 }));
    hand(g, '无数个深夜', 760, 335, t, T0(i, '深夜'), { color: C.mute, size: 42 });
    // viewfinder at 完美
    const pf = P(t, T0(j, '完美'), 0.4, E.outBack);
    if (pf > 0) {
      g.save(); g.strokeStyle = C.red; g.lineWidth = 6; const m = lerp(80, 0, pf), x0 = 160 - 30 + m, y0 = 470 - 30 + m, x1 = 920 + 30 - m, y1 = 990 + 30 - m, l = 70;
      for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { g.beginPath(); g.moveTo(x, y + sy * l); g.lineTo(x, y); g.lineTo(x + sx * l, y); g.stroke(); }
      g.restore();
      label(g, '力求完美', W / 2, 1230, t, T0(j, '力求'), { size: 70, weight: 900, color: C.ink, ls: 10 });
    }
  },
};
SC.four = {
  bg: 'paper', nocap: [35],
  draw(g, t, b) {
    const i = b.first, j = i + 1;
    typeChars(g, '真正沉下心做东西', W / 2, 380, t, spokenTimes(i, '真正沉下心做东西'), { size: 56, color: C.ink2, ls: 8 });
    typeChars(g, '本质都是一样的', W / 2, 470, t, spokenTimes(i, '本质都是一样的'), { size: 56, weight: 700, color: C.ink, ls: 8 });
    const words = [['耗时间', '耗'], ['耐寂寞', '耐'], ['慢打磨', '慢'], ['不讨巧', '拙']];
    const hits = words.map(([w]) => T0(j, w));
    g.save(); shakeAt(g, t, hits, 8, 0.1);
    words.forEach(([w, s], k) => {
      const tk = hits[k], p = P(t, tk, 0.28, E.outBack); if (p <= 0) return;
      const cx = 300 + (k % 2) * 480, cy = 760 + Math.floor(k / 2) * 400;
      g.save(); g.translate(cx, cy); g.scale(lerp(1.4, 1, p), lerp(1.4, 1, p)); g.globalAlpha = clamp(p * 1.5);
      g.strokeStyle = hexA(C.ink, 0.2); g.lineWidth = 2; g.strokeRect(-210, -170, 420, 340);
      txt(g, w, 0, 10, { size: 104, font: F.serif, weight: 900, color: C.ink, ls: 6 });
      g.restore();
      seal(g, s, cx + 160, cy - 120, 90, t, tk + 0.12, { rot: 0.1 });
    });
    g.restore();
  },
};
SC.noreward = {
  bg: 'paper',
  draw(g, t, b) {
    const i = b.first, tx = T0(i, '不再'), drop = P(t, tx + 0.2, 0.8, E.out3);
    g.save(); g.translate(W / 2, 880 + drop * 40); g.rotate(drop * -0.06);
    const p = P(t, b.t0 + 0.1, 0.6, E.out5); g.globalAlpha = p;
    g.fillStyle = '#F8F1E0'; g.fillRect(-400, -330, 800, 660);
    g.strokeStyle = C.gold; g.lineWidth = 6; g.strokeRect(-370, -300, 740, 600); g.lineWidth = 2; g.strokeRect(-352, -282, 704, 564);
    txt(g, '嘉  奖', 0, -200, { size: 72, font: F.serif, weight: 900, color: C.red, ls: 20 });
    txt(g, 'AWARD FOR', 0, -110, { size: 26, font: F.mono, color: C.mute, ls: 8 });
    txt(g, '慢慢做好一件事', 0, 10, { size: 74, font: F.serif, weight: 900, color: C.ink, ls: 6 });
    txt(g, '— 市场 敬上', 220, 170, { size: 36, font: F.serif, color: C.ink2 });
    g.restore();
    // the market says no: a red cross
    const px = P(t, tx, 0.18, E.out3);
    if (px > 0) {
      g.save(); g.translate(W / 2, 880); g.globalAlpha = 0.9;
      handLine(g, [[-300, -260], [300, 260]], px, { color: C.red, lw: 26 });
      handLine(g, [[300, -260], [-300, 260]], P(t, tx + 0.1, 0.18), { color: C.red, lw: 26 });
      g.restore();
    }
  },
};

function productCard(g, x, y, w, h, o) {
  cardBox(g, x, y, w, h, { fill: '#fff' });
  g.save(); rrect(g, x, y, w, h * 0.55, 18); g.clip(); g.fillStyle = o.cheap ? '#F3F0FF' : '#EFE9DD'; g.fillRect(x, y, w, h * 0.55); g.restore();
  flute(g, x + w / 2, y + h * 0.28, w * 0.85, { cheap: o.cheap, rot: -0.15 });
  txt(g, o.title, x + 30, y + h * 0.64, { size: 42, font: F.sans, weight: 700, color: C.ink, align: 'left' });
  txt(g, o.price, x + 30, y + h * 0.77, { size: 56, font: F.sans, weight: 900, color: '#E5323A', align: 'left' });
  txt(g, o.sold, x + 30, y + h * 0.9, { size: 32, font: F.sans, color: C.mute, align: 'left' });
}
SC.market_flute = {
  bg: 'paper', trans: 'slide', tdur: 0.5,
  draw(g, t, b) {
    const i = b.first, j = i + 1, push = P(t, T0(j, '占领市场'), 0.7, E.inOut3);
    txt(g, '竹笛市场', 110, 300, { size: 60, font: F.serif, weight: 900, color: C.ink, align: 'left', ls: 8 });
    // the handmade flute: nobody asks
    g.save(); g.translate(-push * 700, push * 120); g.globalAlpha = 1 - push * 0.6;
    productCard(g, 90, 420, 430, 620, { title: '手工竹笛', price: '¥ ———', sold: '已售 0' });
    const pd = P(t, T0(i, '无人问津'), 1.5);
    if (pd > 0) { const r = rng(4); for (let k = 0; k < 70; k++) { g.fillStyle = `rgba(120,110,95,${0.35 * pd * r()})`; g.beginPath(); g.arc(90 + r() * 430, 420 + r() * 620, 1 + r() * 3, 0, Math.PI * 2); g.fill(); } hand(g, '无人问津', 305, 1110, t, T0(i, '无人问津'), { color: C.mute, size: 50 }); }
    g.restore();
    // the toy flute: sells
    const pt = P(t, Lstart(j) - 0.2, 0.5, E.outBack);
    if (pt > 0) {
      const sc = lerp(1, 1.25, push);
      g.save(); g.translate(790 - push * 250, 730); g.scale(pt * sc, pt * sc); g.translate(-790, -730);
      const sold = Math.floor(Math.pow(clamp((t - Lstart(j)) / 4.5), 2) * 100000);
      productCard(g, 560, 420, 430, 620, { cheap: true, title: '玩具笛 爆款', price: '¥9.9', sold: '已售 ' + (sold >= 100000 ? '10万+' : sold.toLocaleString()) });
      if (Math.floor(t * 6) % 2) sticker(g, 940, 450, 'HOT', { size: 34, bg: '#E5323A', color: '#fff', rot: 0.2 });
      g.restore();
      [['速成', 640, 1150], ['掺假', 830, 1180], ['音准模糊', 700, 1260]].forEach(([s, x, y], k) => { const p = P(t, T0(j, s), 0.2, E.outBack); if (p > 0) sticker(g, x - push * 200, y, s, { size: 38, bg: C.yellow, rot: (k - 1) * 0.1, scale: p }); });
    }
  },
};
SC.market_art = {
  bg: 'paper',
  draw(g, t, b) {
    const i = b.first, j = i + 1;
    txt(g, '游戏美术行业', 110, 300, { size: 60, font: F.serif, weight: 900, color: C.ink, align: 'left', ls: 8 });
    const pp = clamp((t - Lstart(i)) / (Lend(i) - Lstart(i)));
    painting(g, 160, 420, 760, 520, 0.25 + pp * 0.75, { light: P(t, T0(i, '光影场景'), 1) });
    [['一笔一笔', 250, 1010], ['层层渲染', 540, 1010], ['反复打磨', 830, 1010]].forEach(([s, x, y]) => hand(g, s, x, y, t, T0(i, s), { color: C.ink2, size: 46 }));
    // the client replies
    const tc = Lstart(j) - 0.3;
    if (t > tc) {
      const p = P(t, tc, 0.4);
      g.save(); g.globalAlpha = p;
      g.fillStyle = '#ECE7DE'; rrect(g, 90, 1080, 900, 400, 30); g.fill();
      g.fillStyle = '#5B6B7A'; g.beginPath(); g.arc(160, 1160, 40, 0, Math.PI * 2); g.fill();
      txt(g, '甲', 160, 1162, { size: 40, font: F.sans, weight: 900, color: '#fff' });
      txt(g, '甲方', 220, 1142, { size: 30, font: F.sans, weight: 700, color: C.ink2, align: 'left' });
      g.restore();
      [['太慢了', T0(j, '嫌慢'), 1190], ['太贵了', T0(j, '嫌贵'), 1320]].forEach(([s, tk, y]) => { const q = P(t, tk, 0.3, E.outBack); if (q > 0) { g.save(); g.translate(220, y); g.scale(q, q); chatBubble(g, 0, 0, 330, 96, s, { color: '#D03A30' }); g.restore(); } });
    }
  },
};
SC.aigrid = {
  bg: '#0E0E12', trans: 'cut', dark: true,
  draw(g, t, b) {
    const i = b.first, t0 = Lstart(i) - 0.05, cols = 8, rows = 12, s = 112, gap = 12;
    const n = Math.floor(Math.pow(2, clamp((t - t0) / 3.2) * Math.log2(cols * rows)));
    const x0 = (W - (cols * s + (cols - 1) * gap)) / 2, y0 = 240;
    for (let k = 0; k < Math.min(n, cols * rows); k++) aiTile(g, x0 + (k % cols) * (s + gap), y0 + Math.floor(k / cols) * (s + gap), s, (k % 3) * 2, { label: k % 7 === 0 });
    const sy = y0 + ((t * 700) % (rows * (s + gap)));
    g.fillStyle = 'rgba(54,238,255,0.45)'; g.fillRect(0, sy, W, 4); glow(g, W / 2, sy, 400, 'rgba(54,238,255,0.12)');
    [['模板量产', 360], ['AI速成', 700], ['流水线套图', 1040]].forEach(([s2, y], k) => {
      const p = P(t, T0(i, s2), 0.15); if (p <= 0) return;
      g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(0, y - 70, W * p, 140);
      txt(g, s2, W / 2, y, { size: 96, font: F.sans, weight: 900, color: k === 1 ? C.cyan : '#fff', ls: 6, alpha: p });
    });
  },
};
SC.irony = {
  bg: 'paper', nocap: [42],
  draw(g, t, b) {
    const i = b.first, tc = T0(i + 1, '收割流量'), ts = T0(i + 2, '吃亏');
    typeChars(g, '这个时代', W / 2, 330, t, spokenTimes(i, '这个时代'), { size: 52, color: C.ink2, ls: 10 });
    typeChars(g, '最讽刺的共性', W / 2, 440, t, spokenTimes(i, '最讽刺的共性'), { size: 90, weight: 900, color: C.ink, ls: 10 });
    const ang = -0.28 * P(t, tc, 1.0, E.outBack) - 0.06 * P(t, ts, 1.2);
    const cx = W / 2, cy = 820;
    g.strokeStyle = C.ink; g.lineWidth = 8; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, 1380); g.stroke();
    g.fillStyle = C.ink; g.fillRect(cx - 140, 1372, 280, 16);
    g.save(); g.translate(cx, cy); g.rotate(ang);
    g.fillStyle = C.ink; g.fillRect(-380, -6, 760, 12); g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.fill();
    g.restore();
    const ends = [-1, 1].map(s => [cx + Math.cos(ang) * 380 * s, cy + Math.sin(ang) * 380 * s]);
    ends.forEach(([ex, ey], k) => {
      g.strokeStyle = C.ink2; g.lineWidth = 2; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - 110, ey + 240); g.moveTo(ex, ey); g.lineTo(ex + 110, ey + 240); g.stroke();
      g.fillStyle = C.ink; g.beginPath(); g.ellipse(ex, ey + 245, 130, 22, 0, 0, Math.PI * 2); g.fill();
      if (k === 0 && t > Lstart(i + 1) - 0.2) {
        sticker(g, ex, ey + 180, '速成品', { size: 44, bg: C.pink, color: '#fff', rot: -0.05, scale: P(t, Lstart(i + 1) - 0.2, 0.3, E.outBack) });
        const coins = sfxTimes('coins', tc - 0.1, tc + 0.1).length ? 9 : 0;
        for (let c = 0; c < coins; c++) { const tcn = tc + c * 0.07, q = P(t, tcn, 0.35, E.out2); if (q <= 0) continue; g.fillStyle = C.yellow; g.beginPath(); g.ellipse(ex - 80 + (c % 5) * 40, lerp(ey - 400, ey + 222 - Math.floor(c / 5) * 14, q), 22, 8, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#B8960A'; g.lineWidth = 2; g.stroke(); }
        label(g, '收割流量', ex, ey + 320, t, tc, { size: 46, weight: 900, color: C.pink });
      }
      if (k === 1 && t > Lstart(i + 2) - 0.2) {
        flute(g, ex, ey + 222, 200, { glow: 0.5, alpha: P(t, Lstart(i + 2) - 0.2, 0.4) });
        label(g, '用心作', ex, ey + 320, t, Lstart(i + 2) - 0.2, { size: 46, weight: 900, color: C.green });
        label(g, '默默吃亏', ex, ey + 390, t, ts, { size: 40, weight: 700, color: C.ink2 });
      }
    });
  },
};

// ============================================================ 03 TWENTY YEARS
SC.painter = {
  bg: 'paper',
  draw(g, t, b) {
    const i = b.first, ty = T0(i + 1, '二十年');
    label(g, '画师 · 四十多岁', 110, 330, t, Lstart(i), { size: 44, align: 'left', color: C.ink2, weight: 700 });
    // years ruler
    const pr = P(t, ty - 0.2, 1.2, E.inOut3);
    g.save(); g.globalAlpha = pr; g.strokeStyle = C.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(110, 1320); g.lineTo(110 + 860 * pr, 1320); g.stroke();
    for (let k = 0; k <= 20; k++) { const x = 110 + k * 43; if (x > 110 + 860 * pr) break; g.beginPath(); g.moveTo(x, 1320); g.lineTo(x, k % 5 ? 1305 : 1290); g.stroke(); }
    txt(g, '0', 110, 1365, { size: 28, font: F.mono, color: C.mute }); txt(g, '20 YEARS', 970, 1365, { size: 28, font: F.mono, color: C.mute, align: 'right' });
    g.restore();
    // sketchbooks stacking, one per year
    const cols = ['#7A4E2D', '#2F4A5C', '#8C3B2E', '#556B4A', '#B08A4A', '#3D3A4E'];
    for (let k = 0; k < 20; k++) {
      const tk = ty + k * 0.16, p = P(t, tk, 0.25, E.out3); if (p <= 0) continue;
      const y = 1280 - k * 38 - (1 - p) * 200;
      g.fillStyle = cols[k % cols.length]; g.globalAlpha = p; rrect(g, 150 + (k % 3) * 8, y, 300, 34, 4); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(170 + (k % 3) * 8, y + 13, 120, 4); g.globalAlpha = 1;
    }
    const glowA = P(t, Lstart(i + 2), 1.0);
    glow(g, 300, 900, 380, hexA(C.gold, 0.35 * glowA));
    // the sketch
    const ps = P(t, T0(i + 1, '手绘功底'), 2.4, E.lin);
    if (ps > 0) { g.save(); g.globalAlpha = 0.9; painting(g, 560, 560, 400, 273, ps * 0.6); g.restore(); }
    hand(g, '手绘功底', 760, 900, t, T0(i + 1, '手绘功底'), { color: C.ink2, size: 48 });
    hand(g, '审美沉淀', 760, 980, t, T0(i + 1, '审美沉淀'), { color: C.ink2, size: 48 });
    label(g, '安身立命', 760, 1120, t, T0(i + 2, '安身立命'), { size: 64, weight: 900, color: C.ink, ls: 8 });
    seal(g, '底气', 900, 1200, 110, t, T0(i + 2, '底气') + 0.1);
  },
};
SC.aicome = {
  bg: '#0B0B0E', trans: 'cut', dark: true,
  draw(g, t, b) {
    const i = b.first, ta = T0(i, 'AI'), td = T0(i, '彻底');
    g.save(); shakeAt(g, t, [td], 18, 0.25);
    // the stack dissolves into pixels
    const pd = P(t, ta, 1.8, E.in3), r = rng(9);
    for (let k = 0; k < 20; k++) for (let px = 0; px < 10; px++) {
      const x = 150 + (k % 3) * 8 + px * 30, y = 1280 - k * 38;
      const dx = pd * (300 + r() * 900), dy = pd * (r() - 0.5) * 400;
      g.globalAlpha = 1 - pd * 0.9; g.fillStyle = ['#7A4E2D', '#2F4A5C', '#8C3B2E', '#556B4A', '#B08A4A', '#3D3A4E'][k % 6];
      g.fillRect(x + dx, y + dy, 26, 30);
    }
    g.globalAlpha = 1;
    const p = P(t, ta, 0.2, E.outBack);
    if (p > 0) rgbText(g, 'AI 时代', W / 2, 600, 150 * p, t, 6 * (1 - P(t, ta + 0.4, 1)));
    label(g, '骤然来临', W / 2, 800, t, T0(i, '骤然'), { size: 90, weight: 900, color: C.white, ls: 14 });
    label(g, '市场彻底变了', W / 2, 1000, t, T0(i, '市场'), { size: 64, color: 'rgba(246,241,232,0.75)', ls: 8 });
    g.restore();
  },
};
SC.swap = {
  bg: '#0B0B0E', dark: true, trans: 'fade',
  draw(g, t, b) {
    const i = b.first, j = i + 1;
    g.fillStyle = '#E9E1D3'; g.fillRect(0, 0, W / 2, H);
    txt(g, '不再需要', W / 4, 330, { size: 48, font: F.serif, weight: 900, color: C.ink2, ls: 10 });
    txt(g, '只需要', W * 3 / 4, 330, { size: 48, font: F.mono, weight: 700, color: C.cyan, ls: 6, alpha: P(t, Lstart(j) - 0.3, 0.4) });
    [['细腻的笔触', '细腻的笔触'], ['耐心的打磨', '耐心的打磨'], ['光影塑造', '层层递进的光影塑造']].forEach(([key, s], k) => {
      const tk = T0(i, key), y = 560 + k * 300;
      const p = P(t, tk - 0.2, 0.5), gone = P(t, tk + 0.9, 1.4);
      const lines = s.length > 6 ? [s.slice(0, 4), s.slice(4)] : [s];
      lines.forEach((ln, n) => txt(g, ln, W / 4, y + n * 70, { size: 58, font: F.serif, weight: 700, color: C.ink, alpha: p * (1 - gone * 0.75) }));
      if (gone > 0) strike(g, 70, 470, y + (lines.length - 1) * 35, gone, { seed: k + 5, color: hexA(C.ink, 0.6), lw: 4 });
    });
    [['快速的产能', '快速的产能'], ['批量的出图', '批量的出图'], ['无限的迭代', '无限的迭代']].forEach(([key, s], k) => {
      const tk = T0(j, key), y = 560 + k * 300, p = P(t, tk, 0.18, E.outBack); if (p <= 0) return;
      g.save(); g.translate(W * 3 / 4, y); g.scale(lerp(1.5, 1, p), lerp(1.5, 1, p));
      txt(g, s, 0, 0, { size: 56, font: F.sans, weight: 900, color: '#fff', shadow: C.cyan, blur: 18 });
      g.restore();
      if (k === 2) txt(g, '∞', W * 3 / 4, y + 150, { size: 160, font: F.en, color: C.cyan, alpha: P(t, tk + 0.2, 0.4), shadow: C.cyan, blur: 30 });
    });
  },
};
SC.misfit = {
  bg: '#14171D', dark: true,
  draw(g, t, b) {
    const i = b.first, r = rng(12), tf = T0(i, '格格不入');
    label(g, '二十年的积累', W / 2, 330, t, Lstart(i), { size: 54, color: C.gold, ls: 10, weight: 700 });
    const sx = W / 2, sy = 940;
    for (let k = 0; k < 160; k++) {
      const lane = 520 + r() * 840, sp = 500 + r() * 700, ph = r() * W * 2;
      let x = ((ph + t * sp) % (W + 200)) - 100, y = lane + Math.sin(t * 2 + k) * 6;
      const d = Math.hypot(x - sx, y - sy); if (d < 150) y += (y < sy ? -1 : 1) * (150 - d) * 0.8;
      g.fillStyle = `rgba(150,170,190,${0.35 + r() * 0.4})`; g.beginPath(); g.arc(x, y, 9 + r() * 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(150,170,190,0.08)'; g.fillRect(x - 60, y - 2, 60, 4);
    }
    const j = noise1(t * 6, 3) * 5;
    glow(g, sx, sy, 220, hexA(C.gold, 0.4));
    g.fillStyle = C.gold; g.save(); g.translate(sx + j, sy); g.rotate(noise1(t * 3, 7) * 0.08); g.fillRect(-55, -55, 110, 110); g.restore();
    label(g, '格格不入', W / 2, 1330, t, tf, { size: 110, weight: 900, color: C.white, ls: 16 });
  },
};
SC.rules = {
  bg: 'paper',
  draw(g, t, b) {
    const i = b.first, ts = T0(i, '换了规则'), sw = P(t, ts, 0.5, E.inOut3);
    const col = C.ink;
    const rail = (pts, a) => { g.save(); g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.restore(); };
    for (let y = 1420; y > 500; y -= 46) { g.fillStyle = hexA(C.ink, 0.25); g.fillRect(W / 2 - 110 - (1420 - y) * 0.06, y, 220 + (1420 - y) * 0.12, 10); }
    rail([[W / 2 - 90, 1420], [W / 2 - 90, 900], [W / 2 - 200, 480]], 1 - sw * 0.7);
    rail([[W / 2 + 90, 1420], [W / 2 + 90, 900], [W / 2 - 20, 480]], 1 - sw * 0.7);
    rail([[W / 2 - 90, 1420], [W / 2 - 90, 900], [W / 2 + 40, 480]], sw);
    rail([[W / 2 + 90, 1420], [W / 2 + 90, 900], [W / 2 + 220, 480]], sw);
    label(g, '手艺', W / 2 - 290, 450, t, Lstart(i), { size: 54, weight: 900, color: C.green });
    label(g, '没有退步', W / 2 - 290, 530, t, T0(i, '没有退步'), { size: 36, color: C.ink2 });
    label(g, '新规则', W / 2 + 300, 450, t, ts, { size: 54, weight: 900, color: C.red });
    txt(g, '悄悄', W / 2, 340, { size: 44, font: F.brush, color: C.mute, alpha: P(t, T0(i, '悄悄'), 0.5) });
  },
};
SC.me = {
  bg: 'night', trans: 'fade', tdur: 0.8,
  draw(g, t, b) {
    const i = b.first, j = i + 1, th = T0(j, '白发');
    label(g, '我格外能共情', W / 2, 620, t, T0(i, '我格外'), { size: 64, color: C.white, ls: 12, out: Lstart(j) });
    label(g, '游戏美术外包 · 老人', W / 2, 520, t, T0(j, '游戏美术'), { size: 44, color: 'rgba(246,241,232,0.6)', ls: 8 });
    // a single white hair
    const p = P(t, Lstart(j) - 0.2, th - Lstart(j) + 0.6, E.inOut3);
    const pts = []; for (let k = 0; k <= 60; k++) { const f = k / 60; pts.push([lerp(140, 940, f), 960 + Math.sin(f * 5.5) * 90 * (1 - f * 0.4) + noise1(f * 8, 2) * 14]); }
    handLine(g, pts, p, { color: '#E8E6E1', lw: 3, shadow: 'rgba(255,255,255,0.8)', blur: 14 });
    sparkle(g, lerp(140, 940, p), pts[Math.floor(p * 60)][1], 22, p > 0 && p < 1 ? 1 : 0);
    label(g, '竞争的惨烈', W / 2, 1250, t, T0(j, '竞争'), { size: 72, weight: 900, color: C.red2, ls: 10 });
  },
};
SC.me_run = {
  bg: 'night',
  draw(g, t, b) {
    const i = b.first, beats = sfxTimes('heartbeat', b.t0, b.t1 + 1);
    for (let k = 0; k < 40; k++) { const r = rng(k), y = 300 + r() * 1300, x = ((r() * W - t * (900 + r() * 900)) % W + W) % W; g.fillStyle = `rgba(246,241,232,${0.06 + r() * 0.1})`; g.fillRect(x, y, 120 + r() * 200, 2); }
    // ECG: spikes on the heartbeat cues, scrolling left
    const speed = 420, y0 = 900;
    g.save(); g.strokeStyle = C.red2; g.lineWidth = 4; g.shadowColor = C.red2; g.shadowBlur = 14; g.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const tt = t - (W - 140 - x) / speed; let y = y0;
      if (tt > t) break;
      for (const hb of beats) { const d = tt - hb; if (d > 0 && d < 0.25) y += d < 0.05 ? -d / 0.05 * 220 : d < 0.1 ? -220 + (d - 0.05) / 0.05 * 300 : 80 - (d - 0.1) / 0.15 * 80; }
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke(); g.restore();
    glow(g, W - 140, y0, 60, hexA(C.red2, 0.6));
    label(g, '不停向前', W / 2, 560, t, T0(i, '不停向前'), { size: 72, weight: 900, color: C.white, ls: 12 });
    label(g, '不敢停下', W / 2, 1280, t, T0(i, '不敢停下'), { size: 96, weight: 900, color: C.red2, ls: 14 });
  },
};
SC.anxiety = {
  bg: '#0E1015', dark: true,
  draw(g, t, b) {
    const i = b.first;
    label(g, '我也曾深深焦虑', W / 2, 420, t, Lstart(i), { size: 60, color: C.white, ls: 10, out: Lstart(i + 1) + 0.5 });
    const ty = T0(i + 1, '三年前');
    if (t > ty - 0.2) {
      const p = P(t, ty - 0.2, 0.4);
      g.save(); g.globalAlpha = p;
      sticker(g, 240, 520, '2023', { size: 46, bg: C.white, color: C.ink, rot: -0.06 });
      g.fillStyle = '#1D2029'; rrect(g, 100, 640, 880, 260, 26); g.fill(); g.strokeStyle = '#353a48'; g.lineWidth = 2; g.stroke();
      const prompt = '/imagine  山水 · 氛围 · 光影 · 8k  --v 6';
      const tt = T0(i + 1, '使用'), n = Math.floor(clamp((t - tt) / 1.4) * prompt.length);
      txt(g, '> ' + prompt.slice(0, n) + (Math.floor(t * 3) % 2 ? '▍' : ''), 140, 770, { size: 34, font: F.mono, color: '#A7F3D0', align: 'left' });
      g.restore();
    }
    const tq = T0(i + 2, '取代');
    if (t > tq - 0.3) {
      const r = rng(5), q = P(t, tq, 1.6);
      txt(g, '我的价值', W / 2, 1120, { size: 110, font: F.serif, weight: 900, color: C.white, alpha: P(t, tq - 0.3, 0.3) });
      for (let k = 0; k < 140 * q; k++) { g.fillStyle = `rgba(${r() * 255 | 0},${r() * 255 | 0},${r() * 255 | 0},0.85)`; g.fillRect(260 + r() * 560, 1050 + r() * 140, 18, 18); }
    }
    // fog of confusion
    const fog = P(t, Lstart(i + 3) - 1.2, 2.2);
    if (fog > 0) {
      for (let k = 0; k < 14; k++) { const r = rng(k + 30); glow(g, (r() * W + t * 20 * (r() - 0.5)) % W, 500 + r() * 1100, 260 + r() * 200, `rgba(170,180,195,${0.18 * fog})`); }
      const tm = T0(i + 3, '迷茫');
      for (let k = 0; k < 6; k++) txt(g, '迷茫', W / 2 + Math.cos(k) * 10 * fog, 1350 + Math.sin(k) * 8 * fog, { size: 150, font: F.serif, weight: 900, color: C.white, alpha: 0.18 * P(t, tm, 0.8) });
    }
  },
};

// ============================================================ 04 STEPPING OUTSIDE
SC.march = {
  bg: 'paper',
  draw(g, t, b) {
    const i = b.first, tm = T0(i, '三月'), tj = T0(i, '跳出');
    // calendar page flips
    const fl = P(t, tm, 0.6, E.inOut3);
    g.save(); g.translate(W / 2, 480);
    cardBox(g, -170, -150, 340, 300, { fill: '#fff' });
    g.fillStyle = C.red; g.fillRect(-170, -150, 340, 80);
    txt(g, fl < 0.5 ? 'FEB' : 'MARCH', 0, -110, { size: 40, font: F.mono, weight: 700, color: '#fff', ls: 8 });
    txt(g, fl < 0.5 ? '二月' : '三月', 0, 40, { size: 100, font: F.serif, weight: 900, color: C.ink });
    if (fl > 0 && fl < 1) { g.save(); g.scale(1, Math.abs(Math.cos(fl * Math.PI))); g.fillStyle = '#fff'; g.fillRect(-170, -70 - 220 * (fl < 0.5 ? 0 : 1), 340, 220); g.restore(); }
    g.restore();
    // the box of "just art" breaks open
    const pb = P(t, tj, 0.7, E.out3), bx = W / 2, by = 1000, s = 260;
    const sides = [[[-s, -s], [s, -s], 0, -1], [[s, -s], [s, s], 1, 0], [[s, s], [-s, s], 0, 1], [[-s, s], [-s, -s], -1, 0]];
    g.save(); g.strokeStyle = C.ink; g.lineWidth = 6;
    sides.forEach(([a, c, dx, dy], k) => { const o = pb * 380; g.save(); g.globalAlpha = 1 - pb * 0.85; g.translate(bx + dx * o, by + dy * o); g.rotate(pb * (k % 2 ? 0.6 : -0.6)); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.stroke(); g.restore(); });
    g.restore();
    txt(g, '美术', bx, by - 40, { size: 90, font: F.serif, weight: 900, color: C.ink, alpha: 1 - pb });
    txt(g, '单纯', bx, by + 70, { size: 44, font: F.serif, color: C.mute, alpha: 1 - pb });
    // new worlds
    const icons = [['音乐', iconNote, 260], ['学习竹笛', null, 540], ['自媒体', iconPhonePlay, 820]];
    icons.forEach(([w, fn, x], k) => {
      const p = P(t, T0(i + 1, w), 0.35, E.outBack); if (p <= 0) return;
      g.save(); g.translate(x, 1000); g.scale(p, p);
      g.fillStyle = ['#F2C94C', '#9BC08A', '#F28B82'][k]; g.beginPath(); g.arc(0, 0, 120, 0, Math.PI * 2); g.fill();
      if (fn) fn(g, 0, -10, 130, C.ink); else flute(g, 0, -10, 190, { rot: -0.5 });
      txt(g, w.replace('学习', ''), 0, 180, { size: 46, font: F.serif, weight: 700, color: C.ink });
      g.restore();
    });
    const pw = P(t, T0(i + 2, '更多世界'), 1.6);
    for (let k = 0; k < 60 * pw; k++) { const r = rng(k + 70), a = r() * Math.PI * 2, d = 300 + r() * 500 * pw; g.fillStyle = ['#F2C94C', '#9BC08A', '#F28B82', C.red][k % 4]; g.globalAlpha = 0.8; g.beginPath(); g.arc(W / 2 + Math.cos(a) * d, 1000 + Math.sin(a) * d * 0.7, 6 + r() * 6, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  },
};
SC.boss = {
  bg: 'night', trans: 'fade',
  draw(g, t, b) {
    const i = b.first, j = i + 1;
    glow(g, 220, 260, 700, hexA(C.lamp, 0.35));
    label(g, '老板 · 也在疯狂熬夜', W / 2, 330, t, Lstart(i), { size: 50, color: C.white, ls: 8, weight: 700 });
    g.fillStyle = '#6B4F35'; rrect(g, 90, 460, 900, 980, 20); g.fill();
    g.fillStyle = '#8A6A4A'; rrect(g, 110, 480, 860, 940, 14); g.fill();
    const r = rng(3); for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(60,40,20,${r() * 0.25})`; g.fillRect(110 + r() * 860, 480 + r() * 940, 3, 3); }
    const notes = [['AI', '#F7E27A'], ['运营', '#F7A8B8'], ['培训', '#A8D8F0'], ['OA', '#B8E0A0'], ['研发游戏', '#F7E27A'], ['文旅项目', '#F7C08A']];
    notes.forEach(([w, col], k) => {
      const tk = T0(j, w), p = P(t, tk, 0.16, E.outBack); if (p <= 0) return;
      const x = 270 + (k % 2) * 420 + (r() - 0.5) * 40, y = 640 + Math.floor(k / 2) * 290, rot = (rng(k + 9)() - 0.5) * 0.2;
      g.save(); g.translate(x, y); g.rotate(rot); g.scale(lerp(1.3, 1, p), lerp(1.3, 1, p));
      g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 16; g.shadowOffsetY = 8; g.fillStyle = col; g.fillRect(-150, -110, 300, 220); g.shadowColor = 'transparent';
      g.fillStyle = 'rgba(200,40,40,0.9)'; g.beginPath(); g.arc(0, -96, 10, 0, Math.PI * 2); g.fill();
      txt(g, w, 0, 10, { size: w.length > 2 ? 54 : 72, font: F.sans, weight: 900, color: '#2a2420' });
      g.restore();
    });
  },
};
SC.wave = {
  bg: 'paper',
  draw(g, t, b) {
    const i = b.first, tp = T0(i, '铺开'), tw = T0(i + 1, '浪潮');
    const pa = P(t, tp, 0.8, E.out3) * (1 - P(t, Lstart(i + 1), 0.8));
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, l = 380 * pa;
      if (l < 2) break;
      g.save(); g.globalAlpha = pa; g.strokeStyle = k % 3 ? C.ink2 : C.red; g.lineWidth = 4; g.translate(W / 2, 900); g.rotate(a);
      g.beginPath(); g.moveTo(60, 0); g.lineTo(60 + l, 0); g.lineTo(40 + l, -14); g.moveTo(60 + l, 0); g.lineTo(40 + l, 14); g.stroke(); g.restore();
    }
    label(g, '这么多方向', W / 2, 900, t, tp, { size: 56, weight: 900, color: C.ink, out: Lstart(i + 1) });
    const pw = P(t, tw - 0.8, 2.4, E.out3);
    if (pw > 0) {
      for (let L = 0; L < 5; L++) {
        g.fillStyle = `rgba(${40 + L * 20},${70 + L * 22},${90 + L * 20},${0.75 - L * 0.1})`; g.beginPath(); g.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) { const y = lerp(1700, 760 + L * 90, pw) + Math.sin(x / 140 + t * 1.6 + L) * 40 + Math.sin(x / 60 - t * 2.3) * 12; g.lineTo(x, y); }
        g.lineTo(W, H); g.fill();
      }
      label(g, '时代浪潮', W / 2, 520, t, tw, { size: 120, weight: 900, color: C.ink, ls: 16 });
      label(g, '总要试着做点什么', W / 2, 650, t, T0(i + 1, '总要'), { size: 52, color: C.ink2, ls: 8 });
    }
  },
};
SC.path = {
  bg: 'paper',
  draw(g, t, b) {
    const i = b.first;
    const pts = []; for (let k = 0; k <= 80; k++) { const f = k / 80; pts.push([W / 2 + Math.sin(f * 7) * 260 * (1 - f * 0.6), 1480 - f * 1150]); }
    handLine(g, pts, P(t, Lstart(i) - 0.2, 12, E.inOut3), { color: C.ink, lw: 5 });
    label(g, '慢慢走下去', W / 2, 1460, t, Lstart(i), { size: 50, color: C.ink2, ls: 10 });
    const tl = T1(i + 1, '失去了');
    label(g, '失去了价值', W / 2, 760, t, T0(i + 1, '失去'), { size: 90, weight: 900, color: C.ink, ls: 8 });
    strike(g, W / 2 - 240, W / 2 + 240, 765, P(t, tl, 0.4), { seed: 9, lw: 9 });
    label(g, '创造全新的价值', W / 2, 1000, t, T0(i + 2, '创造'), { size: 96, weight: 900, color: C.red, ls: 8 });
    seal(g, '新', 900, 1100, 120, t, T0(i + 2, '全新的价值') + 0.15);
  },
};
SC.connect = {
  bg: 'paper',
  draw(g, t, b) {
    const i = b.first, tg = T0(i, '贯通'), tr = T0(i + 1, '同一条路');
    const names = ['音乐', '竹笛', '自媒体', 'AI', '运营', '培训', 'OA', '研发', '文旅', '画画'];
    const r = rng(17);
    const pts = names.map((n, k) => [140 + r() * 800, 420 + r() * 900]);
    const conv = P(t, tr, 1.4, E.inOut3);
    const pos = pts.map(([x, y], k) => [lerp(x, 120 + k * 93, conv), lerp(y, 980, conv)]);
    const pc = P(t, tg, 1.0);
    for (let k = 1; k < pos.length; k++) { const q = clamp(pc * pos.length - k); if (q > 0) handLine(g, [pos[k - 1], pos[k]], q, { color: C.red, lw: 3 }); }
    pos.forEach(([x, y], k) => {
      const a = P(t, Lstart(i) + k * 0.15, 0.4);
      g.fillStyle = C.ink; g.globalAlpha = a; g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      txt(g, names[k], x, y - 40, { size: 32, font: F.serif, weight: 700, color: C.ink2, alpha: a * (1 - conv) });
    });
    if (conv > 0) { g.fillStyle = C.ink; g.fillRect(100, 976, (W - 200) * conv, 8); }
    const pf = P(t, T0(i + 1, '更好的自己'), 0.6, E.outBack);
    if (pf > 0) {
      g.save(); g.translate(W / 2, 700); g.scale(pf, pf);
      g.fillStyle = '#FBF7EF'; g.fillRect(-300, -120, 600, 240); g.strokeStyle = C.gold; g.lineWidth = 10; g.strokeRect(-300, -120, 600, 240);
      txt(g, '更好的自己', 0, 4, { size: 76, font: F.serif, weight: 900, color: C.ink, ls: 8 }); g.restore();
    }
    label(g, '于个人', 300, 1180, t, T0(i + 2, '个人'), { size: 56, weight: 700, color: C.ink });
    label(g, '于公司', 780, 1180, t, T0(i + 2, '公司'), { size: 56, weight: 700, color: C.ink });
  },
};
SC.core = {
  bg: 'night',
  draw(g, t, b) {
    const i = b.first, tz = T0(i, '真实'), tm = T0(i, '命题');
    const pl = P(t, b.t0 + 0.2, 1.2);
    g.save(); g.globalAlpha = 0.5 * pl; const gr = g.createLinearGradient(0, 0, 0, 1300); gr.addColorStop(0, 'rgba(255,230,180,0.6)'); gr.addColorStop(1, 'rgba(255,230,180,0)'); g.fillStyle = gr;
    g.beginPath(); g.moveTo(W / 2 - 60, 0); g.lineTo(W / 2 + 60, 0); g.lineTo(W / 2 + 380, 1300); g.lineTo(W / 2 - 380, 1300); g.fill(); g.restore();
    g.strokeStyle = hexA(C.gold, pl); g.lineWidth = 8; g.strokeRect(W / 2 - 280, 640, 560, 420);
    label(g, '如何让别人看见', W / 2, 520, t, T0(i, '如何'), { size: 56, color: C.white, ls: 8 });
    label(g, '真实、', W / 2, 790, t, tz, { size: 96, weight: 900, color: C.white, ls: 8 });
    label(g, '有价值的自己', W / 2, 920, t, T0(i, '有价值'), { size: 76, weight: 900, color: C.lamp, ls: 6 });
    const pm = P(t, tm, 0.5, E.outBack);
    if (pm > 0) { txt(g, '「 命题 」', W / 2, 1260, { size: 130 * lerp(1.3, 1, pm), font: F.serif, weight: 900, color: C.white, alpha: clamp(pm * 1.5), ls: 10 }); glow(g, W / 2, 1260, 400, hexA(C.lamp, 0.25 * pm)); }
  },
};

// ============================================================ 05 ROOTS
function artPlate(g, kind, x, y, w, h, t) {
  cardBox(g, x, y, w, h, { fill: '#FBF8F1' });
  g.save(); g.beginPath(); g.rect(x + 16, y + 16, w - 32, h - 90); g.clip();
  const cx = x + w / 2, cy = y + (h - 74) / 2;
  if (kind === 0) { g.fillStyle = '#EFE9DC'; g.fillRect(x, y, w, h); g.save(); g.translate(x - 60, y + 30); g.scale(0.32, 0.32); SPR.mountains.forEach((m, L) => g.drawImage(m, 0, L * 40)); g.restore(); }
  else if (kind === 1) { g.fillStyle = '#F4EAD8'; g.fillRect(x, y, w, h); for (let k = 0; k < 5; k++) { g.save(); g.translate(cx, cy); g.rotate(k * Math.PI * 2 / 5); g.strokeStyle = '#B5372C'; g.lineWidth = 2; g.fillStyle = 'rgba(214,90,68,0.25)'; g.beginPath(); g.ellipse(0, -48, 24, 46, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); } g.fillStyle = C.gold; g.beginPath(); g.arc(cx, cy, 14, 0, Math.PI * 2); g.fill(); }
  else if (kind === 2) { g.fillStyle = '#8C2F25'; g.fillRect(x, y, w, h); g.strokeStyle = '#D9B262'; g.lineWidth = 3; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(cx, cy, 20 + k * 18, Math.PI * (0.1 + k * 0.1), Math.PI * (1.1 + k * 0.1)); g.stroke(); } }
  else { ['#2E6B6A', '#C1442E', '#D7A64A', '#4B3B6B', '#E3D3B1', '#7A8B5A'].forEach((c, k) => { g.fillStyle = c; g.fillRect(x + 16 + (k % 3) * ((w - 32) / 3), y + 16 + Math.floor(k / 3) * ((h - 90) / 2), (w - 32) / 3, (h - 90) / 2); }); }
  g.restore();
}
SC.books = {
  bg: 'paper', nocap: [],
  draw(g, t, b) {
    const i = b.first, to = T0(i, '开箱'), tl = T0(i, '一摞');
    // top-down cardboard box opening
    const po = P(t, to, 0.6, E.out3), bx = W / 2, by = 620;
    g.fillStyle = '#B98B5A'; g.fillRect(bx - 260, by - 200, 520, 400);
    g.fillStyle = '#8E6640'; g.fillRect(bx - 240, by - 180, 480, 360);
    const flap = (dx, dy, w, h, a) => { g.save(); g.translate(bx + dx, by + dy); g.scale(1, Math.cos(a)); g.fillStyle = '#C99A68'; g.fillRect(-w / 2, -h / 2, w, h); g.restore(); };
    flap(0, -200 - po * 60, 520, 120, po * 1.25); flap(0, 200 + po * 60, 520, 120, po * 1.25);
    g.fillStyle = '#C8A26A'; g.fillRect(bx - 20, by - 200, 40, 400 * (1 - po));
    // stack of books rises
    const cols = ['#2F4A5C', '#8C3B2E', '#556B4A', '#B08A4A', '#3D3A4E', '#7A4E2D', '#9A3F3A'];
    const ps = P(t, tl, 0.8, E.out3);
    for (let k = 0; k < 7; k++) { const q = clamp(ps * 7 - k); if (q <= 0) continue; const y = by + 120 - k * 46 - q * 30; g.globalAlpha = q; g.fillStyle = cols[k]; rrect(g, bx - 200 + (k % 2) * 16, y, 400 - (k % 3) * 20, 42, 4); g.fill(); g.fillStyle = 'rgba(255,230,180,0.6)'; g.fillRect(bx - 150, y + 18, 90, 5); g.globalAlpha = 1; }
    hand(g, '厚厚一摞画册', W / 2, 950, t, tl, { color: C.ink2, size: 54 });
    // plates
    const plates = [['艺术流派', 0], ['经典画风', 1], ['传统美术', 2], ['历史美学', 3]];
    plates.forEach(([s, kind], k) => {
      const tk = T0(i + 1, s), p = P(t, tk, 0.5, E.out5); if (p <= 0) return;
      const x = 100 + (k % 2) * 450, y = 1020 + Math.floor(k / 2) * 250;
      g.save(); g.globalAlpha = p; g.translate(x + 205, y + 115); g.rotate((k % 2 ? 0.03 : -0.03) * (1 - p) * 4); g.translate(-x - 205, -y - 115);
      artPlate(g, kind, x, y, 410, 230, t);
      txt(g, s, x + 205, y + 198, { size: 36, font: F.serif, weight: 700, color: C.ink });
      g.restore();
    });
    const dim = P(t, Lstart(i + 3) - 0.2, 1.0);
    if (dim > 0) { g.fillStyle = `rgba(14,13,11,${dim * 0.92})`; g.fillRect(0, 0, W, H); txt(g, '他说', W / 2, 900, { size: 60, font: F.serif, color: C.white, alpha: dim, ls: 24 }); }
  },
};
SC.roots = {
  bg: '#12110E', caps: false, trans: 'fade', tdur: 0.8, dark: true,
  draw(g, t, b) {
    const i = b.first, tg = T0(i, '扎根'), tl = T0(i, '生命力');
    txt(g, '未来', W / 2, 250, { size: 44, font: F.serif, color: 'rgba(246,241,232,0.6)', ls: 20, alpha: P(t, Lstart(i), 0.6) });
    typeChars(g, '唯有扎根本源', W / 2, 400, t, spokenTimes(i, '唯有扎根本源'), { size: 104, font: F.brush, color: C.white, ls: 10 });
    typeChars(g, '独一无二的事物', W / 2, 540, t, spokenTimes(i, '独一无二的事物'), { size: 84, font: F.brush, color: 'rgba(246,241,232,0.85)', ls: 8 });
    // seed, roots, sprout
    const sx = W / 2, sy = 800, grown = P(t, tg, Lend(i) - tg + 0.6, E.inOut3) * 1700;
    g.save(); g.translate(sx, sy); drawRoots(g, SPR.roots, grown, { color: 'rgba(214,196,160,0.9)', scale: 0.8 }); g.restore();
    glow(g, sx, sy, 90, hexA(C.lamp, 0.5 * P(t, Lstart(i), 0.8)));
    g.fillStyle = '#C9A062'; g.beginPath(); g.ellipse(sx, sy, 18, 26, 0, 0, Math.PI * 2); g.fill();
    const pl = P(t, tl - 0.2, 0.9, E.outBack);
    if (pl > 0) {
      g.strokeStyle = '#8DB36A'; g.lineWidth = 6; g.beginPath(); g.moveTo(sx, sy - 20); g.quadraticCurveTo(sx - 6, sy - 60 * pl, sx, sy - 110 * pl); g.stroke();
      g.fillStyle = '#9CC46F';
      for (const s of [-1, 1]) { g.save(); g.translate(sx, sy - 100 * pl); g.rotate(s * 0.7); g.beginPath(); g.ellipse(s * 34 * pl, 0, 38 * pl, 15 * pl, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      glow(g, sx, sy - 100, 240, hexA('#9CC46F', 0.35 * pl));
    }
    typeChars(g, '才有生命力', W / 2, 1620, t, spokenTimes(i, '才有生命力'), { size: 110, font: F.brush, color: C.gold, ls: 14, shadow: 'rgba(194,154,85,0.6)', blur: 30 });
  },
};
SC.copy = {
  bg: '#E9EEF0', trans: 'flash', tdur: 0.2,
  draw(g, t, b) {
    const i = b.first;
    txt(g, 'AI 可以复制', W / 2, 330, { size: 70, font: F.sans, weight: 900, color: '#1F2A33', ls: 6, alpha: P(t, b.t0, 0.4) });
    const words = ['复制技法', '量产画面', '拼接风格', '堆砌效果'];
    words.forEach((s, k) => {
      const tk = T0(i, s), y = 560 + k * 250; if (t < tk - 0.1) return;
      const w = s.slice(2), n = Math.floor(clamp((t - tk) / 0.8) * 6);
      txt(g, w, 220, y, { size: 96, font: F.serif, weight: 900, color: '#1F2A33' });
      for (let c = 1; c <= n; c++) txt(g, w, 220 + c * 140, y, { size: 96, font: F.serif, weight: 900, color: `rgba(31,42,51,${0.5 - c * 0.07})` });
      const sx = P(t, tk, 0.5, E.lin) * W;
      if (sx < W) { g.fillStyle = 'rgba(0,200,255,0.5)'; g.fillRect(sx, y - 80, 8, 160); glow(g, sx, y, 160, 'rgba(0,200,255,0.25)'); }
    });
  },
};
SC.cannot = {
  bg: '#101012', dark: true, trans: 'cut',
  draw(g, t, b) {
    const objs = [['审美底蕴', 0], ['文化内核', 1], ['温度与执念', 2]];
    let k = 0; for (let n = 0; n < 3; n++) if (t >= Lstart(b.first + n) - 0.2) k = n;
    const li = b.first + k, ts = T0(li, '复制不了'), tb = T0(li, '不了'), u = t - (Lstart(li) - 0.2);
    g.save(); shakeAt(g, t, [tb], 10 + k * 8, 0.18);
    const zoom = 1 + k * 0.06 + u * 0.01; g.translate(W / 2, 900); g.scale(zoom, zoom); g.translate(-W / 2, -900);
    const ox = W / 2, oy = 760;
    // the original, glowing
    glow(g, ox, oy, 380, hexA(C.lamp, 0.35 + 0.15 * Math.sin(t * 3)));
    if (k === 0) { g.fillStyle = '#EFE6D2'; g.fillRect(ox - 170, oy - 300, 340, 600); g.fillStyle = '#5A3A22'; g.fillRect(ox - 190, oy - 318, 380, 22); g.fillRect(ox - 190, oy + 296, 380, 22); g.save(); g.beginPath(); g.rect(ox - 150, oy - 280, 300, 560); g.clip(); g.translate(ox - 300, oy - 120); g.scale(0.5, 0.5); SPR.mountains.forEach((m, L) => g.drawImage(m, 0, L * 60)); g.restore(); seal(g, '印', ox + 110, oy + 230, 50, t, 0); }
    else if (k === 1) { seal(g, '文脉', ox, oy, 300, t, 0, { rot: 0 }); }
    else { glow(g, ox, oy, 260, 'rgba(255,170,80,0.7)'); g.fillStyle = '#FFB45A'; g.beginPath(); g.moveTo(ox, oy - 170 - Math.sin(t * 9) * 12); g.bezierCurveTo(ox + 120, oy - 40, ox + 90, oy + 120, ox, oy + 130); g.bezierCurveTo(ox - 90, oy + 120, ox - 120, oy - 40, ox, oy - 170 - Math.sin(t * 9) * 12); g.fill(); g.fillStyle = '#FFE3A0'; g.beginPath(); g.ellipse(ox, oy + 50, 45, 70, 0, 0, Math.PI * 2); g.fill(); }
    txt(g, objs[k][0], ox, 300, { size: 76, font: F.serif, weight: 900, color: C.white, ls: 10, alpha: P(t, Lstart(li) - 0.2, 0.4) });
    // the scan
    const ps = P(t, ts, 0.7, E.inOut3);
    if (ps > 0 && ps < 1) { const y = lerp(oy - 330, oy + 330, ps); g.fillStyle = 'rgba(54,238,255,0.7)'; g.fillRect(ox - 260, y, 520, 6); glow(g, ox, y, 300, 'rgba(54,238,255,0.25)'); }
    // the copy comes out empty
    const pc = P(t, tb, 0.35, E.out3);
    if (pc > 0) {
      const cy = 1330;
      g.save(); g.globalAlpha = pc; g.setLineDash([14, 10]); g.strokeStyle = 'rgba(180,190,200,0.7)'; g.lineWidth = 3; g.strokeRect(ox - 200, cy - 120, 400, 240); g.setLineDash([]);
      const r = rng(Math.floor(t * 20)); for (let n = 0; n < 30; n++) { g.fillStyle = `rgba(54,238,255,${r() * 0.4})`; g.fillRect(ox - 200 + r() * 400, cy - 120 + r() * 240, 30 + r() * 80, 4); }
      txt(g, '无法复制', ox, cy, { size: 60, font: F.mono, weight: 700, color: C.red2, ls: 6 });
      g.restore();
    }
    if (k === 2) { burst(g, ox - 300, 1080, t, T0(li, '一锤'), { seed: 4, n: 20, color: C.lamp }); label(g, '一锤一磨', ox - 300, 1080, t, T0(li, '一锤'), { size: 48, color: C.lamp, font: F.brush, weight: 400 }); label(g, '一笔一画', ox + 300, 1080, t, T0(li, '一笔'), { size: 48, color: C.lamp, font: F.brush, weight: 400 }); }
    g.restore();
  },
};
SC.merge = {
  bg: 'paper', trans: 'fade',
  draw(g, t, b) {
    const i = b.first, tm = T0(i + 1, '高度相通'), pj = P(t, Lstart(i + 1), tm - Lstart(i + 1), E.inOut3);
    // light leak for "通透"
    const pl = P(t, Lstart(i), 1.4) * (1 - P(t, Lstart(i + 1), 1));
    glow(g, W * 0.8, 300, 900, `rgba(255,210,150,${0.45 * pl})`);
    label(g, '这一刻 · 彻底通透', W / 2, 330, t, Lstart(i), { size: 56, weight: 700, color: C.ink, ls: 10 });
    const sep = (1 - pj) * 260;
    g.fillStyle = hexA(C.green, 0.12); g.fillRect(0, 960 - 440 - sep, W, 440);
    g.fillStyle = hexA(C.gold, 0.14); g.fillRect(0, 960 + sep, W, 440);
    txt(g, '民乐竹笛', W / 2, 600 - sep, { size: 64, font: F.serif, weight: 900, color: C.green, ls: 12, alpha: P(t, T0(i + 1, '民乐竹笛'), 0.4) });
    txt(g, '游戏美术', W / 2, 1320 + sep, { size: 64, font: F.serif, weight: 900, color: C.bambooD, ls: 12, alpha: P(t, T0(i + 1, '游戏美术'), 0.4) });
    flute(g, W / 2, 900 - sep * 0.8, 860, { glow: 0.4 + pj });
    // brush stroke under it
    g.save(); g.strokeStyle = hexA(C.ink, 0.85); g.lineCap = 'round';
    for (let k = 0; k < 7; k++) { g.lineWidth = 6 + k * 1.5; g.globalAlpha = 0.12 + k * 0.05; g.beginPath(); g.moveTo(110, 1020 + sep * 0.8 + k * 3); g.bezierCurveTo(400, 1000 + sep * 0.8, 700, 1040 + sep * 0.8, 970, 1015 + sep * 0.8 + k * 2); g.stroke(); }
    g.restore();
    const pf = P(t, tm, 0.6, E.out3);
    if (pf > 0) { glow(g, W / 2, 960, 700, `rgba(255,220,160,${0.55 * pf * (1 - P(t, tm + 0.6, 1.6))})`); label(g, '高度相通', W / 2, 1180, t, tm, { size: 110, weight: 900, color: C.red, ls: 16 }); }
  },
};
function rootDiagram(g, t, li, kind, items) {
  const bx = 280, top = 300;
  if (kind === 'flute') g.drawImage(SPR.bamboo, bx - 150, top, 420, 900 * P(t, Lstart(li) - 0.2, 0.8, E.out3));
  else { const p = P(t, Lstart(li) - 0.2, 0.8, E.out3); g.fillStyle = '#5A3A22'; rrect(g, bx - 18, top, 36, 620 * p, 14); g.fill(); g.fillStyle = '#B08A4A'; g.fillRect(bx - 22, top + 620 * p, 44, 40 * p); g.fillStyle = '#1E1C1A'; g.beginPath(); g.moveTo(bx - 26, top + 660 * p); g.quadraticCurveTo(bx - 30, top + 800 * p, bx, top + 880 * p); g.quadraticCurveTo(bx + 30, top + 800 * p, bx + 26, top + 660 * p); g.fill(); }
  const grown = P(t, Lstart(li), Lend(li) - Lstart(li), E.inOut3) * 1100;
  g.save(); g.translate(bx, 1200); drawRoots(g, kind === 'flute' ? SPR.rootsFlute : SPR.rootsArt, grown, { color: kind === 'flute' ? hexA(C.green, 0.9) : hexA(C.bambooD, 0.9), scale: 0.7 }); g.restore();
  g.fillStyle = hexA(C.ink, 0.2); g.fillRect(90, 1200, 900, 3);
  txt(g, kind === 'flute' ? '竹笛的根' : '美术的根', 600, 330, { size: 70, font: F.serif, weight: 900, color: kind === 'flute' ? C.green : C.bambooD, ls: 10, alpha: P(t, Lstart(li), 0.5) });
  items.forEach(([s, show], k) => {
    const tk = T0(li, s), y = 470 + k * (kind === 'flute' ? 170 : 140);
    leader(g, 560, y, bx + 40, 1220 + k * 40, P(t, tk, 0.5), hexA(C.ink, 0.35));
    label(g, show || s, 580, y, t, tk, { size: show && show.length > 7 ? 44 : 50, weight: 700, color: C.ink, align: 'left' });
  });
}
SC.root_flute = { bg: 'paper', draw(g, t, b) { rootDiagram(g, t, b.first, 'flute', [['老竹', '经年风干的老竹'], ['制笛工艺', '代代相传的制笛工艺'], ['国风音律', '沉淀千年的国风音律'], ['文化传承', '文化传承']]); } };
SC.root_art = { bg: 'paper', draw(g, t, b) { rootDiagram(g, t, b.first, 'art', [['传统美学'], ['历史沉淀'], ['艺术底蕴'], ['手绘温度'], ['创作感知', '独一无二的创作感知']]); } };
SC.unique_flute = {
  bg: 'paper',
  draw(g, t, b) {
    const i = b.first, tl = T0(i, '每一根'), stop = P(t, tl - 0.3, 0.8, E.out3);
    const off = (Lstart(i) + (tl - Lstart(i)) * 0.5) * 300 * 0 + (t < tl ? (t - Lstart(i)) * 380 : (tl - Lstart(i)) * 380 + (t - tl) * 380 * (1 - stop));
    g.fillStyle = '#2B2B2B'; g.fillRect(0, 960, W, 60);
    for (let k = -2; k < 7; k++) { const x = ((k * 300 + off) % (W + 600)) - 300, real = k === 2; if (real) continue; flute(g, x, 920, 260, { cheap: true }); }
    const rx = W / 2; flute(g, rx, 920, 260, {});
    label(g, '流水线 · 批量生产', W / 2, 640, t, Lstart(i), { size: 50, weight: 700, color: C.ink2, ls: 6 });
    const pl = P(t, tl, 0.6, E.outBack);
    if (pl > 0) {
      const lx = rx, ly = 1200, R = 210 * pl;
      g.save(); g.beginPath(); g.arc(lx, ly, R, 0, Math.PI * 2); g.clip(); g.fillStyle = '#F7F1E4'; g.fillRect(lx - R, ly - R, 2 * R, 2 * R);
      flute(g, lx + 100, ly, 1500, {}); g.restore();
      g.strokeStyle = C.ink; g.lineWidth = 12; g.beginPath(); g.arc(lx, ly, R, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 22; g.beginPath(); g.moveTo(lx + R * 0.72, ly + R * 0.72); g.lineTo(lx + R * 1.25, ly + R * 1.25); g.stroke();
      g.strokeStyle = hexA(C.ink, 0.4); g.lineWidth = 2; g.beginPath(); g.moveTo(rx, 945); g.lineTo(lx, ly - R); g.stroke();
    }
    hand(g, '肌理', 230, 1180, t, T0(i, '肌理'), { size: 60 });
    hand(g, '独有的音色', 860, 1430, t, T0(i, '独有'), { size: 54 });
  },
};
SC.unique_art = {
  bg: '#16151A', dark: true,
  draw(g, t, b) {
    const i = b.first;
    for (let k = 0; k < 16; k++) { g.save(); g.globalAlpha = 0.55 * P(t, Lstart(i) + k * 0.05, 0.3); aiTile(g, 90 + (k % 4) * 110, 380 + Math.floor(k / 4) * 110, 100, 0); g.restore(); }
    txt(g, '批量生成', 300, 860, { size: 44, font: F.mono, color: 'rgba(255,255,255,0.6)', alpha: P(t, Lstart(i), 0.5) });
    const pw = P(t, T0(i, '却造不出'), 0.8);
    glow(g, 760, 640, 420, hexA(C.lamp, 0.35 * pw));
    g.save(); g.globalAlpha = pw; g.translate(560, 420); g.scale(0.55, 0.55); painting(g, 0, 0, 760, 520, 1, { light: pw }); g.restore();
    [['审美积淀', 1060], ['情绪温度', 1190], ['文化内核', 1320]].forEach(([s, y]) => label(g, s, 760, y, t, T0(i, s), { size: 56, weight: 900, color: C.lamp, ls: 8 }));
    label(g, '作品', 760, 960, t, T0(i, '作品'), { size: 80, weight: 900, color: C.white, ls: 20 });
  },
};
SC.rare = {
  bg: '#15110C', dark: true,
  draw(g, t, b) {
    const i = b.first;
    label(g, '越是速成泛滥的时代', W / 2, 380, t, Lstart(i), { size: 52, color: 'rgba(246,241,232,0.7)', ls: 8 });
    const words = ['沉淀', '根基', '独一无二', '有温度'];
    words.forEach((s, k) => {
      const tk = T0(i, s), p = P(t, tk, 0.6, E.out3), y = 600 + k * 180; if (p <= 0) return;
      const gr = g.createLinearGradient(0, y - 60, 0, y + 60); gr.addColorStop(0, '#F6DFA0'); gr.addColorStop(0.5, '#C99A48'); gr.addColorStop(1, '#8A6224');
      g.save(); g.globalAlpha = p; font(g, 120, F.serif, 900); g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '16px'; g.fillStyle = gr; g.shadowColor = 'rgba(201,154,72,0.5)'; g.shadowBlur = 30; g.fillText(s, W / 2, y + (1 - p) * 20); g.restore();
      sparkle(g, W / 2 + 180 + (k % 2) * 40, y - 50, 26, 1 - P(t, tk + 0.3, 0.8));
    });
    const pz = P(t, T0(i, '越珍贵'), 0.6);
    if (pz > 0) { glow(g, W / 2, 1050, 700, `rgba(246,223,160,${0.3 * pz})`); seal(g, '珍贵', 880, 1330, 150, t, T0(i, '越珍贵') + 0.2); }
  },
};

// ============================================================ 06 TO BE SEEN
SC.youth = {
  bg: 'night',
  draw(g, t, b) {
    const i = b.first, tg = T0(i, '涌入'), tq = T0(i + 1, '一次次');
    const n = 70, r = rng(31);
    for (let k = 0; k < n; k++) {
      const sx = r() * W, sy = H + 50 + r() * 300, a = r() * Math.PI * 2, d = 120 + r() * 320;
      const tx = W / 2 + Math.cos(a) * d, ty = 900 + Math.sin(a) * d * 0.9;
      const p = P(t, tg - 0.3 + r() * 1.2, 1.8, E.out3);
      const quit = k % 3 === 0 || k < 7 ? P(t, tq + (k % 7) * 0.28 + (k < 7 ? 0 : 1.2), 0.8) : 0;
      const x = lerp(sx, tx, p), y = lerp(sy, ty, p) + quit * 400;
      const warm = 1 - quit;
      glow(g, x, y, 30, `rgba(255,200,130,${0.5 * warm * clamp(p * 2)})`);
      g.fillStyle = quit > 0 ? `rgba(140,140,150,${0.8 * (1 - quit)})` : `rgba(255,226,170,${clamp(p * 2)})`; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
    }
    label(g, '纯粹的热爱', W / 2, 420, t, T0(i + 1, '纯粹'), { size: 64, weight: 900, color: C.lamp, ls: 10 });
    const pc = P(t, T0(i + 1, '劣币'), 0.6);
    for (let k = 0; k < 5; k++) { if (pc <= 0) break; g.save(); g.globalAlpha = pc; g.fillStyle = '#6F6F78'; g.beginPath(); g.ellipse(360 + k * 90, 1440 - (k % 2) * 10, 50, 16, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#4a4a52'; g.lineWidth = 3; g.stroke(); g.restore(); }
    label(g, '劣币环境', W / 2, 1360, t, T0(i + 1, '劣币'), { size: 48, weight: 700, color: '#9A9AA5', ls: 8 });
  },
};
SC.beginner_flute = {
  bg: 'paper',
  draw(g, t, b) {
    const i = b.first, tm = T0(i, '音色浑浊');
    label(g, '想学笛的人', W / 2, 330, t, Lstart(i), { size: 54, weight: 700, color: C.ink2, ls: 8 });
    flute(g, W / 2, 760, 760, { cheap: true, rot: -0.04, alpha: P(t, Lstart(i), 0.5) });
    label(g, '工业玩具', 850, 660, t, T0(i, '工业玩具'), { size: 40, color: C.mute });
    const pm = P(t, tm, 0.4);
    if (pm > 0) {
      g.save(); g.globalAlpha = pm; g.strokeStyle = '#7C7468'; g.lineWidth = 3; g.beginPath();
      for (let x = 100; x <= 980; x += 3) { const y = 1030 + noise1(x / 7 + t * 30, 3) * 70 + noise1(x / 31 + t * 5, 8) * 40; x === 100 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke(); g.restore();
      label(g, '音色浑浊', W / 2, 1160, t, tm, { size: 48, weight: 700, color: '#7C7468' });
    }
    const pq = P(t, T0(i, '误以为'), 0.6, E.outBack);
    if (pq > 0) {
      g.save(); g.translate(W / 2, 1330); g.scale(pq, pq);
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 360, 110, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = C.ink; g.lineWidth = 3; g.stroke();
      for (const [x, y, r] of [[-220, 140, 26], [-280, 190, 14]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke(); }
      txt(g, '是我没有天赋吗？', 0, 4, { size: 56, font: F.brush, color: C.ink });
      g.restore();
    }
  },
};
SC.beginner_art = {
  bg: 'paper',
  draw(g, t, b) {
    const i = b.first, tz = T0(i, '没有温度');
    label(g, '想学画画的人', W / 2, 330, t, Lstart(i), { size: 54, weight: 700, color: C.ink2, ls: 8 });
    for (let k = 0; k < 9; k++) { g.save(); g.globalAlpha = P(t, T0(i, '模板') + k * 0.05, 0.3); aiTile(g, 120 + (k % 3) * 200, 520 + Math.floor(k / 3) * 200, 180, 0); g.restore(); }
    label(g, '模板快餐作品', 390, 1170, t, T0(i, '模板'), { size: 46, weight: 700, color: C.ink });
    // thermometer
    const temp = lerp(36, 0, P(t, tz - 0.2, 1.2, E.inOut3));
    const tx = 860, ty0 = 520, ty1 = 1100;
    g.strokeStyle = C.ink; g.lineWidth = 6; rrect(g, tx - 30, ty0, 60, ty1 - ty0, 30); g.stroke();
    g.beginPath(); g.arc(tx, ty1 + 40, 56, 0, Math.PI * 2); g.stroke();
    const col = temp > 20 ? C.red : '#5B8DB8';
    g.fillStyle = col; g.beginPath(); g.arc(tx, ty1 + 40, 44, 0, Math.PI * 2); g.fill();
    const h = (ty1 - ty0 - 40) * temp / 40; g.fillRect(tx - 16, ty1 - h, 32, h + 20);
    txt(g, Math.round(temp) + '°', tx, 440, { size: 72, font: F.mono, weight: 700, color: col });
  },
};
SC.masters = {
  bg: 'night', isDark: (t, b) => t < Lstart(b.first + 1) - 0.1,
  draw(g, t, b) {
    const i = b.first, j = i + 1, sw = P(t, Lstart(j) - 0.4, 0.6, E.inOut3);
    if (sw < 1) {
      g.save(); g.globalAlpha = 1 - sw;
      g.save(); g.translate(0, 260); streamScreen(g, W, 1300, t, { tool: true, viewers: 3 }); g.restore();
      g.fillStyle = 'rgba(13,15,19,0.9)'; g.fillRect(0, 260, W, 150);
      label(g, '制笛师傅 · 不会营销', W / 2, 330, t, Lstart(i), { size: 50, weight: 700, color: C.white, ls: 6 });
      hand(g, '把竹材养好', 290, 1100, t, T0(i, '把竹材'), { color: C.lamp, size: 56 });
      hand(g, '把音修准', 790, 1180, t, T0(i, '把音修准'), { color: C.lamp, size: 56 });
      g.restore();
    }
    if (sw > 0) {
      g.save(); g.globalAlpha = sw;
      bgPaper(g); label(g, '资深美术 · 不会套路', W / 2, 330, t, Lstart(j) - 0.4, { size: 50, weight: 700, color: C.ink, ls: 6 });
      painting(g, 160, 520, 760, 520, 1, { grid: P(t, T0(j, '结构'), 0.5), light: P(t, T0(j, '光影'), 0.8) });
      g.strokeStyle = hexA(C.red, 0.8); g.lineWidth = 2;
      const pv = P(t, T0(j, '结构'), 0.8); handLine(g, [[160, 1040], [540, 700], [920, 1040]], pv, { color: C.red, lw: 2 });
      [['结构', 260, 1150], ['光影', 540, 1150], ['氛围细节', 820, 1150]].forEach(([s, x, y]) => hand(g, s, x, y, t, T0(j, s), { size: 50 }));
      g.restore();
    }
  },
};
SC.timbre = {
  bg: 'paper', tint: ['#D9D2C3', 0.3], trans: 'fade', tdur: 0.9,
  draw(g, t, b) {
    const i = b.first;
    glow(g, 800, 420, 260, 'rgba(255,250,235,0.9)');
    g.fillStyle = '#F8F3E6'; g.beginPath(); g.arc(800, 420, 90, 0, Math.PI * 2); g.fill();
    mountains(g, 560, t, 0.95, 1.2);
    for (let k = 0; k < 5; k++) { const x = ((t * (16 + k * 7) + k * 340) % (W + 900)) - 450, y = 860 + k * 85; g.save(); g.translate(x, y); g.scale(5, 1); glow(g, 0, 0, 120, 'rgba(242,236,225,0.75)'); g.restore(); }
    flute(g, W / 2, 1360, 760, { glow: 1, alpha: P(t, Lstart(i), 0.8) });
    vtext(g, '苍凉', 150, 600, 110, spokenTimes(i, '苍凉'), { t, font: F.brush, color: hexA(C.ink, 0.85) });
    vtext(g, '温柔', 930, 600, 110, spokenTimes(i, '温柔'), { t, font: F.brush, color: C.red });
  },
};
SC.canvas = {
  bg: 'paper',
  draw(g, t, b) {
    const i = b.first, p = clamp((t - Lstart(i)) / (T1(i, '光影沉淀') - Lstart(i)));
    painting(g, 90, 460, 900, 616, p, { light: P(t, T0(i, '氛围'), 1.4) });
    label(g, '笔触堆叠', 280, 1170, t, T0(i, '笔触'), { size: 54, weight: 700, color: C.ink });
    label(g, '光影沉淀', 800, 1170, t, T0(i, '光影'), { size: 54, weight: 700, color: C.ink });
    label(g, '氛围与意境', W / 2, 1320, t, T0(i, '氛围'), { size: 64, weight: 900, color: C.gold, ls: 10 });
  },
};
SC.heal = {
  bg: 'paper', caps: false,
  draw(g, t, b) {
    const i = b.first;
    [['能治愈人的', 520], ['能打动人的', 680], ['能传世的审美', 840]].forEach(([s, y]) => typeChars(g, s, W / 2, y, t, spokenTimes(i, s), { size: 84, weight: 900, color: C.ink, ls: 10 }));
    const tz = T0(i, '永远');
    typeChars(g, '永远', W / 2, 1060, t, spokenTimes(i, '永远'), { size: 60, color: C.ink2, ls: 20 });
    const p = P(t, T0(i, '无法速成'), 0.3, E.outBack);
    if (p > 0) txt(g, '无法速成', W / 2, 1220, { size: 150 * lerp(1.3, 1, p), font: F.serif, weight: 900, color: C.ink, alpha: clamp(p * 1.5), ls: 16 });
    seal(g, '无法速成', 880, 1370, 170, t, T1(i, '无法速成') - 0.05);
  },
};
SC.product = {
  bg: '#1D1E21', dark: true, trans: 'fade',
  draw(g, t, b) {
    const i = b.first, ts = T0(i, '商品'), stop = P(t, ts - 0.4, 0.5, E.out3);
    const off = (t < ts - 0.4 ? t : ts - 0.4 + (t - ts + 0.4) * (1 - stop) * 0.5) * 420;
    g.save(); if (t > ts - 0.4 && t < ts) g.translate(noise1(t * 50) * 6, 0);
    g.fillStyle = '#333'; g.fillRect(0, 1000, W, 70); g.fillStyle = '#4a4a4a'; for (let x = -(off % 60); x < W; x += 60) g.fillRect(x, 1070, 30, 10);
    for (let k = -1; k < 5; k++) { const x = ((k * 280 + off) % (W + 560)) - 280; g.fillStyle = '#7A7D84'; rrect(g, x - 90, 830, 180, 170, 10); g.fill(); g.fillStyle = '#5E6168'; g.fillRect(x - 90, 880, 180, 12); }
    g.restore();
    label(g, '流水线上出的', W / 2, 520, t, Lstart(i), { size: 64, weight: 700, color: 'rgba(246,241,232,0.8)', ls: 8 });
    const pt = P(t, ts, 0.8, E.outElastic);
    if (pt > 0) {
      g.save(); g.translate(W / 2, 620); g.rotate(Math.sin((t - ts) * 4) * 0.08 * Math.exp(-(t - ts))); g.strokeStyle = '#999'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 180 * pt); g.stroke();
      g.translate(0, 180 * pt); g.fillStyle = '#E8E4DA'; rrect(g, -170, 0, 340, 200, 16); g.fill();
      txt(g, '商品', 0, 80, { size: 90, font: F.serif, weight: 900, color: '#333', ls: 12 }); txt(g, 'PRODUCT', 0, 160, { size: 30, font: F.mono, color: '#777', ls: 8 });
      g.restore();
    }
  },
};
SC.work = {
  bg: '#0B0A09', dark: true, trans: 'fade', tdur: 0.7,
  draw(g, t, b) {
    const i = b.first, tw = T0(i, '作品');
    g.save(); g.globalAlpha = P(t, b.t0, 1.0);
    const gr = g.createLinearGradient(0, 0, 0, 1400); gr.addColorStop(0, 'rgba(255,225,170,0.55)'); gr.addColorStop(1, 'rgba(255,225,170,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(W / 2 - 80, 0); g.lineTo(W / 2 + 80, 0); g.lineTo(W / 2 + 460, 1400); g.lineTo(W / 2 - 460, 1400); g.fill();
    g.restore();
    painting(g, 230, 500, 620, 424, P(t, b.t0, 1.5), { light: 0.8 });
    flute(g, W / 2, 1060, 820, { glow: 1 });
    label(g, '时间与真心', W / 2, 360, t, T0(i, '时间'), { size: 60, weight: 700, color: C.white, ls: 12 });
    const pw = P(t, tw, 0.3, E.outBack);
    if (pw > 0) { glow(g, W / 2, 1250, 800, `rgba(255,200,120,${0.4 * pw})`); txt(g, '作品', W / 2, 1270, { size: 200 * lerp(1.4, 1, pw), font: F.serif, weight: 900, color: C.white, ls: 30, alpha: clamp(pw * 1.5) }); txt(g, 'A WORK', W / 2, 1400, { size: 32, font: F.mono, color: C.lamp, ls: 12, alpha: pw }); }
    seal(g, '作品', 840, 1150, 150, t, tw + 0.15, { blend: 'source-over' });
  },
};
SC.quietones = {
  bg: '#0C0D11', dark: true,
  draw(g, t, b) {
    const i = b.first, calm = P(t, Lstart(i + 1), 2.0);
    for (let k = 0; k < 70; k++) { const r = rng(k + 200), y = 260 + r() * 1350, sp = 1400 + r() * 1600, x = ((r() * 3000 - t * sp) % (W + 800) + W + 800) % (W + 800) - 400; g.fillStyle = r() < 0.5 ? hexA(C.pink, 0.55 * (1 - calm * 0.8)) : hexA(C.cyan, 0.5 * (1 - calm * 0.8)); g.fillRect(x, y, 260 + r() * 300, 3); }
    label(g, '人人追逐效率', W / 2, 420, t, T0(i, '人人'), { size: 56, font: F.mono, weight: 700, color: 'rgba(246,241,232,0.7)', ls: 4, out: Lstart(i + 1) + 0.5 });
    const pulse = 1 + 0.05 * Math.sin(t * 2.2);
    glow(g, W / 2, 960, 300 * pulse * (1 + calm), hexA(C.lamp, 0.55));
    g.fillStyle = '#FFE2B0'; g.beginPath(); g.arc(W / 2, 960, 14, 0, Math.PI * 2); g.fill();
    label(g, '踏实做事的人', W / 2, 760, t, T0(i + 1, '踏实'), { size: 60, weight: 900, color: C.white, ls: 12 });
    label(g, '始终沉默', W / 2 - 220, 1180, t, T0(i + 1, '始终沉默'), { size: 56, color: 'rgba(246,241,232,0.75)', ls: 8 });
    label(g, '始终珍贵', W / 2 + 220, 1180, t, T0(i + 1, '始终珍贵'), { size: 56, weight: 900, color: C.lamp, ls: 8 });
  },
};
SC.finale = {
  bg: '#000', caps: false, ui: false, trans: 'fade', tdur: 1.0, dark: true,
  draw(g, t, b) {
    const i = b.first, j = i + 1;
    const a1 = P(t, Lstart(i), 0.8) * (1 - P(t, Lstart(j) - 0.3, 0.6));
    txt(g, '只是', W / 2, 960, { size: 64, font: F.serif, color: C.white, ls: 30, alpha: a1 });
    typeChars(g, '我们可能一辈子', W / 2, 760, t, spokenTimes(j, '我们可能一辈子'), { size: 54, color: 'rgba(246,241,232,0.7)', ls: 8 });
    typeChars(g, '都在专注', W / 2, 850, t, spokenTimes(j, '都在专注'), { size: 54, color: 'rgba(246,241,232,0.7)', ls: 8 });
    const pf = P(t, T0(j, '做好作品'), 0.8);
    if (pf > 0) { g.strokeStyle = hexA(C.gold, pf); g.lineWidth = 3; g.strokeRect(W / 2 - 290, 950, 580, 200); txt(g, '做好作品', W / 2, 1052, { size: 104, font: F.serif, weight: 900, color: C.white, alpha: pf, ls: 14 }); }
  },
};
SC.finale2 = {
  bg: '#000', caps: false, ui: false, trans: 'fade', tdur: 0.6, dark: true,
  draw(g, t, b) {
    const i = b.first, ts = T0(i, '被看见'), end = Lend(i) + 0.4;
    typeChars(g, '但从此刻起', W / 2, 560, t, spokenTimes(i, '但从此刻起'), { size: 60, color: C.white, ls: 14 });
    typeChars(g, '必须学会这个流量时代的', W / 2, 680, t, spokenTimes(i, '必须学会这个流量时代的'), { size: 48, color: 'rgba(246,241,232,0.75)', ls: 6 });
    // the lone light grows until it floods the frame
    const grow = P(t, Lstart(i), ts - Lstart(i), E.in3), flood = P(t, ts, 1.6, E.out3);
    glow(g, W / 2, 1150, 60 + grow * 300 + flood * 1600, hexA(C.lamp, 0.6));
    g.fillStyle = '#FFE2B0'; g.beginPath(); g.arc(W / 2, 1150, 10 + grow * 10, 0, Math.PI * 2); g.fill();
    const w1 = measure(g, '如何', 110, F.serif, 900, 10), w2 = measure(g, '被看见', 150, F.serif, 900, 12), x0 = W / 2 - (w1 + 30 + w2) / 2;
    typeChars(g, '如何', x0, 900, t, spokenTimes(i, '如何'), { size: 110, weight: 900, color: C.white, ls: 10, align: 'left' });
    const pk = P(t, ts, 0.4, E.outBack);
    if (pk > 0) txt(g, '被看见', x0 + w1 + 30 + w2 / 2, 900, { size: 150 * lerp(1.3, 1, pk), font: F.serif, weight: 900, color: C.red2, alpha: clamp(pk * 1.4), ls: 12, shadow: 'rgba(214,90,68,0.6)', blur: 30 });
    // the livestream, now seen
    if (t > ts) {
      const u = t - ts, n = Math.floor(3 + Math.pow(clamp(u / 2.2), 2) * 9996);
      g.save(); g.globalAlpha = clamp(u / 0.3) * (1 - P(t, end, 0.6));
      g.fillStyle = '#FF3B50'; rrect(g, W / 2 - 230, 1330, 200, 64, 32); g.fill(); txt(g, '● 直播中', W / 2 - 130, 1363, { size: 30, font: F.sans, weight: 700, color: '#fff' });
      g.fillStyle = 'rgba(0,0,0,0.5)'; rrect(g, W / 2 - 10, 1330, 260, 64, 32); g.fill(); txt(g, (n >= 9999 ? '9999+' : n) + ' 人在看', W / 2 + 120, 1363, { size: 30, font: F.sans, weight: 700, color: '#fff' });
      for (let k = 0; k < 26; k++) { const r = rng(k + 50), d = u - r() * 2; if (d < 0) continue; heart(g, W / 2 + 330 + Math.sin(d * 3 + k) * 40, 1360 - d * 320, 34 + r() * 20, `rgba(255,${80 + (r() * 100 | 0)},${100 + (r() * 60 | 0)},${clamp(1 - d / 2.5)})`); }
      g.restore();
    }
    // end card
    const pe = P(t, end, 1.0, E.inOut3);
    if (pe > 0) {
      g.save(); g.globalAlpha = pe; bgPaper(g);
      frameUI(g, t, false, 'THE QUIET ONES', 'FIN', 1);
      typeChars(g, '千锤百炼之后', W / 2, 640, t, end + 0.4, { size: 92, weight: 900, color: C.ink, ls: 16, per: 0.07 });
      typeChars(g, '最难', W / 2, 860, t, end + 1.0, { size: 170, weight: 900, color: C.ink, ls: 30, per: 0.1 });
      typeChars(g, '是被看见', W / 2, 1080, t, end + 1.4, { size: 120, weight: 900, color: C.red, ls: 16, per: 0.1 });
      seal(g, '看见', 850, 1230, 140, t, end + 2.1);
      txt(g, '献给每一位安静做好东西的人', W / 2, 1420, { size: 40, font: F.serif, color: C.ink2, ls: 6, alpha: P(t, end + 2.3, 0.8) });
      txt(g, 'for the quiet ones', W / 2, 1490, { size: 40, font: F.en, style: 'italic', color: C.mute, alpha: P(t, end + 2.5, 0.8) });
      g.restore();
    }
  },
};
