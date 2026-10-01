// Headless renderer. Usage:
//   node render.js preview <outdir> t1 t2 ...         -> PNG stills
//   node render.js video <out.mp4> <frame0> <frame1>  -> H.264 chunk (no audio)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const BUILD = process.env.BUILD, ROOT = __dirname, FPS = 30;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const file = u.startsWith('/build/') ? path.join(BUILD, u.slice(7)) : path.join(ROOT, u === '/' ? 'index.html' : u);
      fs.readFile(file, (err, data) => {
        if (err) { rsp.writeHead(404); rsp.end(); return; }
        rsp.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); rsp.end(data);
      });
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const [mode, out, ...rest] = process.argv.slice(2);
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--disable-gpu', '--font-render-hinting=none', '--disable-lcd-text'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
  const info = await page.evaluate(() => window.ready);
  if (mode === 'preview') {
    fs.mkdirSync(out, { recursive: true });
    await page.evaluate(d => { window.DEBUG = d; }, !!process.env.DEBUG);
    for (const ts of rest) {
      const t = parseFloat(ts);
      const data = await page.evaluate(t => { renderFrame(t); return document.getElementById('c').toDataURL('image/jpeg', 0.9); }, t);
      fs.writeFileSync(path.join(out, `f_${t.toFixed(2).padStart(7, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
    }
    console.log(JSON.stringify(info.blocks.length), 'blocks; rendered', rest.length);
  } else if (mode === 'video') {
    const f0 = parseInt(rest[0], 10), f1 = parseInt(rest[1], 10);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = f0; f < f1; f++) {
      const data = await page.evaluate(t => { renderFrame(t); return document.getElementById('c').toDataURL('image/jpeg', 0.95); }, f / FPS);
      const buf = Buffer.from(data.split(',')[1], 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - f0) % 300 === 0) console.error(`${out}: frame ${f - f0}/${f1 - f0}  ${((Date.now() - t0) / Math.max(1, f - f0)).toFixed(0)} ms/frame`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  } else if (mode === 'info') {
    console.log(JSON.stringify(info));
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
