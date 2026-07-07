import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '/private/tmp/claude-501/-Users-vipas-JHH/b0778e5a-9d4e-488a-85a9-fdbdabe1a600/scratchpad/endprobe';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text()); });
page.on('pageerror', (e) => console.log('PAGE ERR:', e.message));
await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const p = document.getElementById('preloader');
  return p && getComputedStyle(p).display === 'none';
}, null, { timeout: 45000 });
await page.waitForTimeout(2000);

const info = await page.evaluate(() => {
  const g = window.__glide;
  const stops = g ? g.debugStops() : [];
  const wall = document.getElementById('wall');
  const finale = document.getElementById('finale');
  const items = document.querySelectorAll('.wall__item');
  return {
    stops: stops.map((s) => Math.round(s)),
    wallTop: Math.round(wall.getBoundingClientRect().top + scrollY),
    wallH: Math.round(wall.getBoundingClientRect().height),
    finaleTop: Math.round(finale.getBoundingClientRect().top + scrollY),
    finaleH: Math.round(finale.getBoundingClientRect().height),
    docH: document.documentElement.scrollHeight,
    vh: innerHeight,
    itemCount: items.length,
    firstItemOpacity: items[0] ? getComputedStyle(items[0]).opacity : 'n/a',
  };
});
console.log(JSON.stringify(info, null, 1));

const last = info.stops.slice(-7);
for (let i = 0; i < last.length; i++) {
  await page.evaluate((y) => window.scrollTo(0, y), last[i]);
  await page.waitForTimeout(800);
  const state = await page.evaluate(() => {
    const items = document.querySelectorAll('.wall__item');
    const vis = Array.from(items).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > 0;
    });
    return {
      scrollY: Math.round(scrollY),
      itemsInView: vis.length,
      firstVisOpacity: vis[0] ? getComputedStyle(vis[0]).opacity : 'none',
      finaleInView: (() => { const r = document.getElementById('finale').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })(),
    };
  });
  console.log(`stop[-${last.length - i}] y=${last[i]}`, JSON.stringify(state));
  await page.screenshot({ path: `${OUT}/end_${String(i).padStart(2, '0')}_y${last[i]}.png` });
}
await browser.close();
console.log('done');
