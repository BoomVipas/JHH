/* Stress journey: pages through every stop like a real user (wheel gestures),
 * checking at each rest point for unloaded images, overlapping scene copy,
 * long tasks, layout shifts and console errors. Screenshots every stop;
 * optional full video.
 *
 * Usage: node tests/journey.mjs [--record] [--fast] [--shots-dir <dir>]
 * Requires a build (`npm run build`); starts its own `vite preview`.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2);
const record = args.includes('--record');
const fast = args.includes('--fast');
const shotsDir = args.includes('--shots-dir')
  ? args[args.indexOf('--shots-dir') + 1]
  : path.join(ROOT, 'preview', 'journey');
mkdirSync(shotsDir, { recursive: true });
mkdirSync(path.join(ROOT, 'preview'), { recursive: true });

const BASE = 'http://localhost:4173';
const problems = [];
const notes = [];

async function waitPreview() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('preview server never came up');
}

const preview = spawn('npm', ['run', 'preview'], { cwd: ROOT, stdio: 'ignore' });
try {
  await waitPreview();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...(record ? { recordVideo: { dir: path.join(ROOT, 'preview'), size: { width: 1440, height: 900 } } } : {}),
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    const f = r.failure()?.errorText ?? '';
    if (!f.includes('ERR_ABORTED')) errors.push(`requestfailed: ${r.url()} ${f}`);
  });

  await page.addInitScript(() => {
    window.__perf = { longTasks: 0, longTaskMs: 0, cls: 0, shifts: [] };
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__perf.longTasks += 1;
          window.__perf.longTaskMs += e.duration;
        }
      }).observe({ type: 'longtask', buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.hadRecentInput) continue;
          window.__perf.cls += e.value;
          if (e.value > 0.02 && window.__perf.shifts.length < 60) {
            window.__perf.shifts.push({
              v: Number(e.value.toFixed(3)),
              t: Math.round(e.startTime),
              src: (e.sources || []).slice(0, 3).map((s) => {
                const n = s.node;
                if (!n) return '?';
                const cls = typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : '';
                return (n.tagName || '?') + cls + (n.id ? '#' + n.id : '');
              }),
            });
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const p = document.getElementById('preloader');
    return p && getComputedStyle(p).display === 'none';
  }, null, { timeout: 45_000 });
  await page.waitForTimeout(2400);

  const stops = await page.evaluate(() => window.__glide.debugStops());
  notes.push(`stops: ${stops.length}`);

  const perStop = [];
  for (let i = 1; i < stops.length; i++) {
    // a user gesture: one deliberate wheel swipe (fast mode fires two quickly)
    await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 700, cancelable: true })));
    if (fast && i % 3 === 0) {
      // a hard follow-through: enough accumulated input to charge one extra page
      await page.waitForTimeout(90);
      await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 1300, cancelable: true })));
      i += 1;
    }
    const target = stops[Math.min(i, stops.length - 1)];
    // watch for image pop-in DURING the travel, not just at rest
    const transitWatch = page.evaluate(async (t) => {
      let worst = 0;
      for (let k = 0; k < 40; k++) {
        if (Math.abs(window.scrollY - t) < 8) break;
        const inView = (el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > 0 && r.top < innerHeight;
        };
        const bad = Array.from(document.images).filter((img) => {
          if (!inView(img) || getComputedStyle(img).visibility === 'hidden') return false;
          const host = img.closest('.scene');
          if (host && Number(getComputedStyle(host).opacity) < 0.05) return false;
          return !img.complete || img.naturalWidth === 0;
        }).length;
        worst = Math.max(worst, bad);
        await new Promise((r) => setTimeout(r, 140));
      }
      return worst;
    }, target);
    const arrived = await page.waitForFunction(
      (t) => Math.abs(window.scrollY - t) < 8,
      target,
      { timeout: 9000 },
    ).then(() => true).catch(() => false);
    const transitBad = await transitWatch;
    await page.waitForTimeout(420); // rest at the stop
    if (fast) await page.waitForTimeout(120);

    const state = await page.evaluate(() => {
      const inView = (el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      };
      const badImgs = Array.from(document.images)
        .filter((img) => inView(img) && getComputedStyle(img).visibility !== 'hidden')
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => img.currentSrc || img.src);
      const restingCopies = Array.from(document.querySelectorAll('.scene'))
        .filter((s) => {
          const st = getComputedStyle(s);
          return Number(st.opacity) > 0.25 && st.visibility !== 'hidden' && inView(s);
        }).length;
      return {
        y: Math.round(window.scrollY),
        badImgs,
        restingCopies,
        perf: window.__perf,
      };
    });
    perStop.push({ stop: i, arrived, transitBad, ...state, badImgs: state.badImgs.slice(0, 3), badImgCount: state.badImgs.length });
    if (!arrived) problems.push(`stop ${i}: never arrived (y=${state.y}, target=${Math.round(target)})`);
    if (state.badImgCount > 0) problems.push(`stop ${i} y=${state.y}: ${state.badImgCount} unloaded image(s) in view: ${state.badImgs[0] ?? ''}`);
    if (transitBad > 0) problems.push(`stop ${i}: ${transitBad} image(s) popped in during travel`);
    if (state.restingCopies > 1) problems.push(`stop ${i} y=${state.y}: ${state.restingCopies} scenes visible at rest (overlap)`);
    await page.screenshot({ path: path.join(shotsDir, `j${String(i).padStart(2, '0')}.png`) });
  }

  const perf = await page.evaluate(() => window.__perf);
  notes.push(`longTasks=${perf.longTasks} totalLongTaskMs=${Math.round(perf.longTaskMs)} CLS=${perf.cls.toFixed(4)}`);
  const bySrc = {};
  for (const s of perf.shifts) {
    const key = s.src.join('|') || '?';
    bySrc[key] = (bySrc[key] ?? 0) + s.v;
  }
  notes.push('shift sources: ' + JSON.stringify(Object.entries(bySrc).sort((a, b) => b[1] - a[1]).slice(0, 8)));
  if (perf.cls > 0.1) problems.push(`CLS too high: ${perf.cls.toFixed(4)}`);
  for (const e of errors) problems.push(e);

  const video = record ? page.video() : null;
  await ctx.close();
  if (video) notes.push(`video: ${await video.path()}`);
  await browser.close();

  writeFileSync(path.join(ROOT, 'preview', 'journey-summary.json'), JSON.stringify({ notes, problems, perStop }, null, 2));
  console.log(notes.join('\n'));
  if (problems.length) {
    console.error('\nPROBLEMS (' + problems.length + '):\n' + problems.slice(0, 30).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('\nJOURNEY CLEAN');
  }
} finally {
  preview.kill();
}
