import { gsap } from 'gsap';

/* ────────────────────────────────────────────────────────────────────────
   PAGED SCROLL FORMULA — tune the whole feel of the page right here.

   The page moves like a lantern pulled along a rope:

   • CRUISE is a HARD SPEED CAP (px/s). Scrolling harder never moves the
     page faster — each extra swipe queues one more stop, so excess speed
     becomes extra travel TIME, never extra velocity.
   • One gesture = one stop. A wheel/trackpad swipe or a touch flick
     advances exactly one page: hero → each story beat of the cloud video
     → each product scene → each screen of the collection wall → finale.
     The same constant speed carries you through video and photos alike.
   • Always interruptible: swipe the other way mid-flight to turn back,
     or touch the screen to freeze it under your finger.

   Per frame:
       remain   = stops[target] - current
       speed    = CRUISE * min(1, |remain| / ARRIVE)
       current += sign(remain) * min(|remain|, speed * dt)
   ──────────────────────────────────────────────────────────────────────── */
export const GLIDE = {
  /** px/s hard cap — the one constant travel speed of the page */
  CRUISE: 1700,
  /** px soft-landing zone before each stop; 0 = dead-constant stop */
  ARRIVE: 240,
  /** ms of wheel silence that ends a swipe (trackpad inertia grouping) */
  GESTURE_GAP: 240,
  /** during inertia decay, a wheel delta this × above the decayed floor
   *  counts as a NEW deliberate swipe (queues one more page) */
  RISE_FACTOR: 2.4,
  /** wheel deltas below this are ignored as noise */
  MIN_DELTA: 10,
  /** px of finger travel that counts as a page swipe on release */
  TOUCH_MIN: 42,
};

const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
const clampY = (v: number) => Math.max(0, Math.min(v, maxScroll()));

class GlidePager {
  private stopsProvider: (() => number[]) | null = null;
  private stops: number[] = [0];
  private targetIdx = 0;
  private current = 0;
  private applied = 0;
  /** set after external scrolls/jumps: hold this exact position instead of
   *  snapping to a stop; any new gesture clears it */
  private holdAt: number | null = null;

  // wheel gesture state
  private inGesture = false;
  private gestureDir = 0;
  private peak = 0;
  private floor = 0;
  private decaying = false;
  private gestureTimer = 0;

  // touch state
  private touching = false;
  private lastTouchY = 0;
  private totalDrag = 0;

  private jumpTween: gsap.core.Tween | null = null;

  init(): void {
    this.current = this.applied = window.scrollY;
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    gsap.ticker.add(this.tick);
    (window as unknown as { __glide: GlidePager }).__glide = this; // test/debug handle
  }

  setStopsProvider(fn: () => number[]): void {
    this.stopsProvider = fn;
  }

  /** recompute + sort + dedupe the stop list (cheap; called per gesture) */
  private refreshStops(): void {
    const raw = this.stopsProvider ? this.stopsProvider() : [0];
    const max = maxScroll();
    const sorted = [...raw.map((v) => clampY(v)), 0, max].sort((a, b) => a - b);
    const out: number[] = [];
    for (const v of sorted) {
      if (out.length === 0 || v - out[out.length - 1] > 40) out.push(v);
    }
    this.stops = out;
  }

  debugStops(): number[] {
    this.refreshStops();
    return [...this.stops];
  }

  private nearestIdx(y: number): number {
    let best = 0;
    let bestD = Infinity;
    this.stops.forEach((s, i) => {
      const d = Math.abs(s - y);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  private traveling(): boolean {
    const goal = this.holdAt ?? this.stops[this.targetIdx] ?? this.current;
    return Math.abs(goal - this.current) > 2;
  }

  /** advance the queue by one page in `dir`; excess speed = more time, not more speed */
  private pageBy(dir: number): void {
    this.refreshStops();
    const base = this.traveling() && this.holdAt === null
      ? this.targetIdx
      : this.nearestIdx(this.current);
    this.holdAt = null;
    this.targetIdx = Math.max(0, Math.min(this.stops.length - 1, base + dir));
  }

  private interruptJump(): void {
    if (this.jumpTween) {
      this.jumpTween.kill();
      this.jumpTween = null;
      this.current = this.applied = window.scrollY;
      this.holdAt = this.current;
      this.refreshStops();
      this.targetIdx = this.nearestIdx(this.current);
    }
  }

  // ── wheel: group event streams into swipes, one page per swipe ──
  private onWheel = (e: WheelEvent): void => {
    if (e.ctrlKey) return; // pinch-zoom stays native
    e.preventDefault(); // the pager owns vertical scrolling
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    const d = e.deltaY * unit;
    const abs = Math.abs(d);
    if (abs < GLIDE.MIN_DELTA && !this.inGesture) return;
    this.interruptJump();
    const dir = d > 0 ? 1 : -1;

    const startSwipe = () => {
      this.inGesture = true;
      this.gestureDir = dir;
      this.peak = abs;
      this.floor = abs;
      this.decaying = false;
      this.pageBy(dir);
    };

    if (!this.inGesture || dir !== this.gestureDir) {
      startSwipe();
    } else if (!this.decaying && abs >= this.peak) {
      this.peak = abs; // still accelerating within the same swipe
    } else {
      // inertia tail: deltas decay; a sharp rise above the floor = a new swipe
      this.decaying = true;
      if (abs > this.floor * GLIDE.RISE_FACTOR && abs > GLIDE.MIN_DELTA * 3) {
        startSwipe();
      } else {
        this.floor = Math.min(this.floor, abs);
      }
    }

    window.clearTimeout(this.gestureTimer);
    this.gestureTimer = window.setTimeout(() => { this.inGesture = false; }, GLIDE.GESTURE_GAP);
  };

  // ── touch: finger owns the page 1:1; release pages by swipe direction ──
  private onTouchStart = (e: TouchEvent): void => {
    this.interruptJump();
    this.touching = true;
    this.totalDrag = 0;
    this.lastTouchY = e.touches[0].clientY;
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.touching) return;
    e.preventDefault();
    const y = e.touches[0].clientY;
    const dy = this.lastTouchY - y;
    this.lastTouchY = y;
    this.totalDrag += dy;
    this.current = clampY(this.current + dy);
  };

  private onTouchEnd = (): void => {
    if (!this.touching) return;
    this.touching = false;
    this.refreshStops();
    this.holdAt = null;
    if (Math.abs(this.totalDrag) >= GLIDE.TOUCH_MIN) {
      const dir = this.totalDrag > 0 ? 1 : -1;
      // first stop strictly beyond the finger's resting point, in swipe direction
      let idx = this.nearestIdx(this.current);
      if (dir > 0 && this.stops[idx] <= this.current + 4) idx += 1;
      if (dir < 0 && this.stops[idx] >= this.current - 4) idx -= 1;
      this.targetIdx = Math.max(0, Math.min(this.stops.length - 1, idx));
    } else {
      this.targetIdx = this.nearestIdx(this.current); // tiny drag: settle to nearest
    }
  };

  // ── the constant-speed travel loop ──
  private tick = (_t: number, dtMs: number): void => {
    if (this.jumpTween) return;

    // adopt scrolls we didn't make (scrollbar, keyboard, tests): hold, don't snap
    const actual = window.scrollY;
    if (!this.touching && Math.abs(actual - this.applied) > 1.5) {
      this.current = this.applied = actual;
      this.holdAt = actual;
      this.refreshStops();
      this.targetIdx = this.nearestIdx(actual);
      return;
    }

    if (!this.touching) {
      const stop = this.holdAt ?? (this.stops[this.targetIdx] ?? this.current);
      const dt = dtMs / 1000;
      const remain = stop - this.current;
      if (remain !== 0) {
        const speed = GLIDE.CRUISE * (GLIDE.ARRIVE > 0 ? Math.min(1, Math.abs(remain) / GLIDE.ARRIVE) : 1);
        const step = Math.sign(remain) * Math.min(Math.abs(remain), Math.max(speed * dt, 0));
        this.current += step;
        if (Math.abs(stop - this.current) < 0.4) this.current = stop;
      }
    }

    const rounded = Math.round(this.current * 2) / 2;
    if (rounded !== this.applied) {
      window.scrollTo(0, rounded);
      this.applied = rounded;
    }
  };

  /** programmatic navigation (nav links, wheel-card picks, rail dots) */
  jumpTo(y: number, duration = 1.4): void {
    this.interruptJump();
    const proxy = { p: window.scrollY };
    this.jumpTween = gsap.to(proxy, {
      p: clampY(y),
      duration,
      ease: 'power3.inOut',
      onUpdate: () => {
        this.current = this.applied = Math.round(proxy.p);
        window.scrollTo(0, this.applied);
      },
      onComplete: () => {
        this.jumpTween = null;
        this.holdAt = this.current; // jumps may land off-grid (e.g. wall items)
        this.refreshStops();
        this.targetIdx = this.nearestIdx(this.current);
      },
    });
  }
}

export const glide = new GlidePager();
