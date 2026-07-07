/* Playwright verification for the จิงเฮียงฮั้ง POC.
 * Usage: node tests/verify.mjs [--shots-dir <dir>] [--video]
 * Assumes `vite preview` is running on http://localhost:4173 (script starts it itself).
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2);
const shotsDir = args.includes('--shots-dir')
  ? args[args.indexOf('--shots-dir') + 1]
  : path.join(ROOT, 'preview', 'shots');
const wantVideo = args.includes('--video');
mkdirSync(shotsDir, { recursive: true });
mkdirSync(path.join(ROOT, 'preview'), { recursive: true });

const BASE = 'http://localhost:4173';
const problems = [];
const notes = [];

function ok(label, cond, detail = '') {
  if (cond) notes.push(`PASS ${label}`);
  else problems.push(`FAIL ${label} ${detail}`);
}

async function waitPreview() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('preview server never came up');
}

async function collectErrors(page, bucket) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') bucket.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => bucket.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? '';
    if (failure.includes('ERR_ABORTED')) return; // lazy loads cancelled by nav are fine
    bucket.push(`requestfailed: ${req.url()} ${failure}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) bucket.push(`http ${res.status()}: ${res.url()}`);
  });
}

async function settle(page, ms = 650) {
  await page.waitForTimeout(ms);
}

async function desktopRun(browser) {
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await collectErrors(page, errors);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  // preloader completes and reveals hero
  await page.waitForFunction(
    () => {
      const p = document.getElementById('preloader');
      return p && getComputedStyle(p).display === 'none';
    },
    null,
    { timeout: 45_000 },
  );
  await settle(page, 2200); // intro
  await page.screenshot({ path: path.join(shotsDir, 'd00-hero.png') });

  // wheel: 26 cards present
  const cardCount = await page.locator('#heroDisc .wheel__card').count();
  ok('wheel has 26 cards', cardCount === 26, `got ${cardCount}`);

  // wheel drag rotates + snaps to step
  const rotBefore = await page.evaluate(() => window.gsap?.getProperty('#heroDisc', 'rotation') ?? null);
  const vp = page.viewportSize();
  const wheelBox = await page.locator('#heroWheel').boundingBox();
  const dragY = Math.min(wheelBox.y + 40, vp.height - 30);
  await page.mouse.move(vp.width / 2 - 160, dragY);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(vp.width / 2 - 160 + i * 32, dragY + Math.sin(i) * 2, { steps: 2 });
  }
  await page.mouse.up();
  await settle(page, 1600); // inertia + snap
  const rotAfter = await page.evaluate(() => window.gsap?.getProperty('#heroDisc', 'rotation') ?? null);
  ok('wheel rotates on drag', rotBefore !== null && rotAfter !== null && Math.abs(rotAfter - rotBefore) > 3, `before=${rotBefore} after=${rotAfter}`);
  const step = 360 / 26;
  const snapped = Math.abs(rotAfter / step - Math.round(rotAfter / step)) < 0.05;
  ok('wheel snaps to card step', snapped, `rotation=${rotAfter}`);
  const nameShown = await page.locator('#wheelCardName').textContent();
  ok('active card name shown', Boolean(nameShown && nameShown.trim().length > 2), `got "${nameShown}"`);
  await page.screenshot({ path: path.join(shotsDir, 'd01-wheel-drag.png') });

  // card click deep-links into the catalogue pin
  await page.locator('#heroDisc .wheel__card.is-active').click({ force: true });
  await page.waitForTimeout(2100);
  const afterClickY = await page.evaluate(() => window.scrollY);
  ok('card click scrolls to catalogue', afterClickY > 2000, `scrollY=${afterClickY}`);
  await page.screenshot({ path: path.join(shotsDir, 'd02-card-deeplink.png') });

  // back to top, then step-scroll the whole page with screenshots
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 900);
  const docH = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const STEPS = 24;
  let canvasPainted = false;
  let railSeen = false;
  for (let i = 0; i <= STEPS; i++) {
    const y = Math.round((docH * i) / STEPS);
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await settle(page, 620);
    await page.screenshot({ path: path.join(shotsDir, `d1${String(i).padStart(2, '0')}-scroll.png`) });
    if (!canvasPainted) {
      canvasPainted = await page.evaluate(() => {
        const c = document.getElementById('ascentCanvas');
        if (!c || c.width === 0) return false;
        const ctx = c.getContext('2d');
        const d = ctx.getImageData(c.width / 2 - 2, c.height / 2 - 2, 4, 4).data;
        return d.some((v, idx) => idx % 4 !== 3 && v > 8);
      });
    }
    if (!railSeen) railSeen = await page.locator('#rail.is-on').count().then((n) => n > 0);
  }
  ok('scrub canvas painted', canvasPainted);
  ok('progress rail appears in catalogue', railSeen);

  // paged glide: one wheel gesture advances exactly one stop, speed hard-capped
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 900);
  const paging = await page.evaluate(async () => {
    const g = window.__glide;
    if (!g) return { ok: false, why: 'no glide handle' };
    const stops = g.debugStops();
    let last = window.scrollY;
    let lastT = performance.now();
    let maxV = 0;
    const t0 = lastT;
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 1400, cancelable: true }));
    await new Promise((resolve) => {
      const tick = () => {
        const n = performance.now();
        // measure over >=90ms windows: single-frame estimates are dominated
        // by scroll quantization noise, not real velocity
        if (n - lastT >= 90) {
          maxV = Math.max(maxV, Math.abs(window.scrollY - last) / ((n - lastT) / 1000));
          last = window.scrollY;
          lastT = n;
        }
        if (n - t0 < 2600) requestAnimationFrame(tick);
        else resolve(null);
      };
      requestAnimationFrame(tick);
    });
    return { ok: Math.abs(window.scrollY - stops[1]) < 10, at: window.scrollY, stop1: stops[1], maxV: Math.round(maxV) };
  });
  ok('one wheel gesture pages to next stop', paging.ok === true, JSON.stringify(paging));
  ok('travel speed hard-capped', typeof paging.maxV === 'number' && paging.maxV <= 2600 * 1.3, `maxV=${paging.maxV}`);
  await page.screenshot({ path: path.join(shotsDir, 'd03-paged-stop1.png') });

  // frame manifest sanity
  const manifest = await page.evaluate(async () => (await (await fetch('/media/frames/hero/manifest.json')).json()).count);
  ok('frame manifest count > 100', manifest > 100, `count=${manifest}`);

  // FPS sample during a steady auto-scroll through the catalogue
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 800);
  const fps = await page.evaluate(async () => {
    const start = performance.now();
    let frames = 0;
    const target = document.documentElement.scrollHeight * 0.55;
    const tick = () => { frames += 1; if (performance.now() - start < 3000) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const scrollStep = () => {
      const t = (performance.now() - start) / 3000;
      window.scrollTo(0, target * Math.min(1, t));
      if (t < 1) setTimeout(scrollStep, 16);
    };
    scrollStep();
    await new Promise((r) => setTimeout(r, 3100));
    return (frames / 3);
  });
  ok('scroll FPS >= 38', fps >= 38, `fps=${fps.toFixed(1)}`);

  await ctx.close();
  return errors;
}

async function mobileRun(browser) {
  const errors = [];
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await collectErrors(page, errors);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const p = document.getElementById('preloader');
    return p && getComputedStyle(p).display === 'none';
  }, null, { timeout: 45_000 });
  await settle(page, 1800);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('mobile: no horizontal overflow', overflow <= 1, `overflow=${overflow}px`);

  const docH = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let i = 0; i <= 10; i++) {
    await page.evaluate((top) => window.scrollTo(0, top), Math.round((docH * i) / 10));
    await settle(page, 550);
    await page.screenshot({ path: path.join(shotsDir, `m${String(i).padStart(2, '0')}-scroll.png`) });
  }
  await ctx.close();
  return errors;
}

async function reducedMotionRun(browser) {
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await collectErrors(page, errors);
  await page.goto(BASE, { waitUntil: 'load' });
  await settle(page, 1200);
  const pins = await page.locator('.pin-spacer').count();
  ok('reduced motion: no pins', pins === 0, `pins=${pins}`);
  const heroVisible = await page.locator('#heroName').isVisible();
  ok('reduced motion: hero text visible', heroVisible);
  const scenesVisible = await page.evaluate(() => {
    const s = document.querySelector('.scene');
    return s && getComputedStyle(s).opacity === '1';
  });
  ok('reduced motion: scenes visible statically', Boolean(scenesVisible));
  await page.screenshot({ path: path.join(shotsDir, 'rm00-top.png') });
  await ctx.close();
  return errors;
}

async function recordScrollVideo(browser) {
  const dir = path.join(ROOT, 'preview');
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const p = document.getElementById('preloader');
    return p && getComputedStyle(p).display === 'none';
  }, null, { timeout: 45_000 });
  await page.waitForTimeout(2600);
  await page.evaluate(async () => {
    const total = document.documentElement.scrollHeight - innerHeight;
    const dur = 42_000;
    const t0 = performance.now();
    await new Promise((resolve) => {
      const step = () => {
        const t = (performance.now() - t0) / dur;
        window.scrollTo(0, total * Math.min(1, t));
        if (t < 1) requestAnimationFrame(step);
        else resolve(null);
      };
      requestAnimationFrame(step);
    });
  });
  await page.waitForTimeout(1500);
  const video = page.video();
  await ctx.close();
  const file = await video.path();
  notes.push(`video: ${file}`);
  return file;
}

const preview = spawn('npm', ['run', 'preview'], { cwd: ROOT, stdio: 'ignore', detached: false });
try {
  await waitPreview();
  const browser = await chromium.launch();
  const dErr = await desktopRun(browser);
  const mErr = await mobileRun(browser);
  const rErr = await reducedMotionRun(browser);
  if (wantVideo) await recordScrollVideo(browser);
  await browser.close();

  for (const e of [...dErr, ...mErr, ...rErr]) problems.push(e);
  const summary = { problems, notes, shotsDir };
  writeFileSync(path.join(ROOT, 'preview', 'verify-summary.json'), JSON.stringify(summary, null, 2));
  console.log(notes.join('\n'));
  if (problems.length) {
    console.error('\nPROBLEMS:\n' + problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('\nALL CHECKS PASSED');
  }
} finally {
  preview.kill();
}
