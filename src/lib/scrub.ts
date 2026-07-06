import { gsap, ScrollTrigger, reducedMotion } from './motion';
import { media } from './data';

interface Manifest { count: number }

/** Canvas frame scrubber: scroll drives the hero cloud sequence frame by frame. */
export async function initScrub(): Promise<void> {
  const canvas = document.getElementById('ascentCanvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  let count = 0;
  try {
    const res = await fetch('/media/frames/hero/manifest.json');
    count = ((await res.json()) as Manifest).count;
  } catch {
    count = 0;
  }
  if (count === 0) return;

  const frames: (HTMLImageElement | null)[] = new Array(count).fill(null);
  const loaded: boolean[] = new Array(count).fill(false);
  let current = 0;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    draw(current, true);
  };

  const draw = (idx: number, force = false) => {
    let use = idx;
    while (use > 0 && !loaded[use]) use -= 1;
    if (!loaded[use]) return;
    if (use === current && !force) return;
    current = use;
    const img = frames[use]!;
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  };

  const load = (idx: number, onload?: () => void) => {
    if (frames[idx]) return;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      loaded[idx] = true;
      onload?.();
    };
    img.src = media.heroFrame(idx);
    frames[idx] = img;
  };

  // frame 0 first for instant paint, then the rest in waves
  load(0, () => { resize(); });
  for (let i = 1; i < count; i += 4) load(i);
  setTimeout(() => { for (let i = 1; i < count; i += 2) load(i); }, 800);
  setTimeout(() => { for (let i = 1; i < count; i += 1) load(i); }, 2000);

  new ResizeObserver(resize).observe(canvas);

  if (reducedMotion) return; // static first frame is enough

  const target = { frame: 0 };
  gsap.to(target, {
    frame: count - 1,
    ease: 'none',
    scrollTrigger: {
      trigger: '#ascent',
      start: 'top top',
      end: '+=260%',
      pin: '#ascentStage',
      scrub: 0.5,
      anticipatePin: 1,
    },
    onUpdate: () => draw(Math.round(target.frame)),
  });

  // story waypoints ride the same scroll span
  const spans: Array<[number, number]> = [[0.06, 0.30], [0.38, 0.62], [0.70, 0.94]];
  document.querySelectorAll<HTMLElement>('.ascent__waypoint').forEach((wp, i) => {
    const [a, b] = spans[i];
    gsap.timeline({
      scrollTrigger: {
        trigger: '#ascent',
        start: 'top top',
        end: '+=260%',
        scrub: 0.5,
      },
    })
      .to(wp, { opacity: 0, duration: a }, 0)
      .fromTo(wp, { opacity: 0, y: 26, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: (b - a) * 0.35 }, a)
      .to(wp, { opacity: 0, y: -22, filter: 'blur(6px)', duration: (b - a) * 0.3 }, b - (b - a) * 0.3)
      .to(wp, { opacity: 0, duration: Math.max(0.001, 1 - b) }, b);
  });
}
