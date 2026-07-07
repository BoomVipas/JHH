import { gsap, EASE_HAND } from './motion';

/** Load a set of image URLs, reporting incremental progress. Failures count as done (POC resilience). */
function loadImages(urls: string[], onOne: () => void): Promise<void> {
  return new Promise((resolve) => {
    let done = 0;
    if (urls.length === 0) return resolve();
    const finish = () => {
      done += 1;
      onOne();
      if (done === urls.length) resolve();
    };
    for (const url of urls) {
      const img = new Image();
      img.decoding = 'async'; // keep webp decode off the main thread behind the veil
      img.onload = finish;
      img.onerror = finish;
      img.src = url;
    }
  });
}

export async function runPreloader(criticalImages: string[], beforeReveal?: () => void): Promise<void> {
  const fill = document.getElementById('preloaderFill')!;
  const pct = document.getElementById('preloaderPct')!;
  const total = criticalImages.length + 1; // +1 for fonts
  let done = 0;

  const update = () => {
    const frac = Math.min(1, done / total);
    fill.style.width = `${Math.round(frac * 100)}%`;
    pct.textContent = String(Math.round(frac * 100));
  };
  update();

  const fonts = document.fonts.ready.then(() => {
    done += 1;
    update();
  });
  await Promise.all([fonts, loadImages(criticalImages, () => { done += 1; update(); })]);

  fill.style.width = '100%';
  pct.textContent = '100';

  // last re-measures (ScrollTrigger refresh etc.) happen behind the gate,
  // where any resulting jump is invisible
  beforeReveal?.();

  const preloader = document.getElementById('preloader')!;
  const tl = gsap.timeline();
  tl.to('.preloader__core', { opacity: 0, y: -14, duration: 0.4, ease: 'power2.out' }, 0.15);
  tl.to('.preloader__panel--top', { yPercent: -101, duration: 0.9, ease: EASE_HAND }, 0.35);
  tl.to('.preloader__panel--bottom', { yPercent: 101, duration: 0.9, ease: EASE_HAND }, 0.35);
  tl.set(preloader, { display: 'none' });
  await tl.then();
}
