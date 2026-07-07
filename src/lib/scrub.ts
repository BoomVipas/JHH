import { gsap, reducedMotion, glide } from './motion';
import { media } from './data';

interface Manifest { count: number }

type Frame = ImageBitmap | HTMLImageElement;

const isCoarse = window.matchMedia('(pointer: coarse)').matches;

const frameW = (f: Frame): number => (f instanceof HTMLImageElement ? f.naturalWidth : f.width);
const frameH = (f: Frame): number => (f instanceof HTMLImageElement ? f.naturalHeight : f.height);

const idle: (cb: () => void) => void =
  'requestIdleCallback' in window
    ? (cb) => (window as unknown as { requestIdleCallback: (c: () => void, o?: { timeout: number }) => void })
        .requestIdleCallback(cb, { timeout: 600 })
    : (cb) => window.setTimeout(cb, 1);

/** Decode a frame off the main thread when possible (createImageBitmap),
 *  falling back to an async-decoded HTMLImageElement for Safari <15. */
async function decodeFrame(url: string): Promise<Frame> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`frame ${url} ${res.status}`);
  const blob = await res.blob();
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(blob);
  }
  const img = new Image();
  img.decoding = 'async';
  img.src = URL.createObjectURL(blob);
  if (img.decode) await img.decode();
  else await new Promise<void>((ok, no) => { img.onload = () => ok(); img.onerror = () => no(new Error('img')); });
  return img;
}

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

  const frames: (Frame | null)[] = new Array(count).fill(null);
  const loaded: boolean[] = new Array(count).fill(false);
  const pending: boolean[] = new Array(count).fill(false);
  let current = -1;   // index actually painted on the canvas
  let desired = 0;    // frame the scroll position wants right now

  // Backing-store resolution is capped so we never fill more pixels than we
  // need — the hero is a soft cloud blur, so 1.5x on phones is invisible.
  const smallScreen = window.matchMedia('(max-width: 768px)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, smallScreen ? 1.5 : 2);

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    draw(desired, true);
  };

  const draw = (idx: number, force = false) => {
    // Fall back to the nearest lower frame that's decoded, rather than skip.
    let use = idx;
    while (use > 0 && !loaded[use]) use -= 1;
    if (!loaded[use]) return;
    if (use === current && !force) return; // only repaint when the frame changes
    current = use;
    const img = frames[use]!;
    const iw = frameW(img);
    const ih = frameH(img);
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  };

  // Concurrency-limited, idle-scheduled decode queue so ~160 decodes don't
  // fight the first few seconds of interaction.
  const queue: number[] = [];
  let active = 0;
  const MAX_CONCURRENT = 6;

  const load = async (idx: number) => {
    if (frames[idx] || pending[idx]) return;
    pending[idx] = true;
    try {
      frames[idx] = await decodeFrame(media.heroFrame(idx));
      loaded[idx] = true;
      // If this refines the frame the scroll currently wants, repaint.
      if (idx <= desired) draw(desired);
    } catch {
      pending[idx] = false; // allow a later wave to retry
    }
  };

  const pump = () => {
    while (active < MAX_CONCURRENT && queue.length) {
      const idx = queue.shift()!;
      if (frames[idx] || pending[idx]) continue;
      active += 1;
      void load(idx).finally(() => { active -= 1; idle(pump); });
    }
  };

  const enqueue = (indices: number[], eager = false) => {
    for (const i of indices) if (!frames[i] && !pending[i]) queue.push(i);
    if (eager) pump();          // first wave starts fetching immediately
    else idle(pump);            // later waves wait for idle time
  };

  // Frame 0 first for an instant paint, then coarse -> half -> fine waves.
  await load(0);
  resize();

  const coarse: number[] = [];
  for (let i = 4; i < count; i += 4) coarse.push(i);
  const half: number[] = [];
  for (let i = 2; i < count; i += 4) half.push(i);
  const fine: number[] = [];
  for (let i = 1; i < count; i += 2) fine.push(i);

  enqueue(coarse, true); // fast enough that early scrubbing has frames
  enqueue(half);
  enqueue(fine);

  new ResizeObserver(resize).observe(canvas);

  if (reducedMotion) return; // static first frame is enough

  const target = { frame: 0 };
  const scrubTween = gsap.to(target, {
    frame: count - 1,
    ease: 'none',
    scrollTrigger: {
      trigger: '#ascent',
      start: 'top top',
      end: '+=260%',
      pin: '#ascentStage',
      scrub: 1,
      anticipatePin: 1,
    },
    onUpdate: () => {
      desired = Math.round(target.frame);
      draw(desired);
    },
  });

  // The constant-speed glide takes over ONLY across this pinned video span
  // (plus a small approach buffer); the rest of the page scrolls natively.
  const st = scrubTween.scrollTrigger!;
  glide.setRangeProvider(() => [
    st.start - window.innerHeight * 0.5,
    st.end + window.innerHeight * 0.25,
  ]);

  // story waypoints ride the same scroll span
  const spans: Array<[number, number]> = [[0.06, 0.30], [0.38, 0.62], [0.70, 0.94]];
  document.querySelectorAll<HTMLElement>('.ascent__waypoint').forEach((wp, i) => {
    const [a, b] = spans[i];
    // Blur animated on scroll-scrub is cheap on desktop but a frame-killer on
    // phones — coarse pointers get opacity + transform only.
    const inFrom = isCoarse ? { opacity: 0, y: 26 } : { opacity: 0, y: 26, filter: 'blur(6px)' };
    const inTo = isCoarse
      ? { opacity: 1, y: 0, duration: (b - a) * 0.35 }
      : { opacity: 1, y: 0, filter: 'blur(0px)', duration: (b - a) * 0.35 };
    const out = isCoarse
      ? { opacity: 0, y: -22, duration: (b - a) * 0.3 }
      : { opacity: 0, y: -22, filter: 'blur(6px)', duration: (b - a) * 0.3 };
    gsap.timeline({
      scrollTrigger: {
        trigger: '#ascent',
        start: 'top top',
        end: '+=260%',
        scrub: 1,
      },
    })
      .to(wp, { opacity: 0, duration: a }, 0)
      .fromTo(wp, inFrom, inTo, a)
      .to(wp, out, b - (b - a) * 0.3)
      .to(wp, { opacity: 0, duration: Math.max(0.001, 1 - b) }, b);
  });
}
