import { gsap } from 'gsap';

/* ────────────────────────────────────────────────────────────────────────
   THE SCROLL FORMULA — tune the whole feel of the page right here.

   Every input (wheel tick, trackpad, finger) only ever moves `target`.
   Each frame, `current` travels toward `target` at a CONSTANT cruise
   speed, easing off only inside the final ARRIVE pixels:

       remain   = target - current
       speed    = CRUISE * min(1, |remain| / ARRIVE)        (px per second)
       current += sign(remain) * min(|remain|, speed * dt)

   Because new input just moves `target`, a glide in progress is always
   interruptible: swipe again and it keeps cruising, swipe the other way
   and it reverses instantly, touch the screen and it stops under your
   finger.
   ──────────────────────────────────────────────────────────────────────── */
export const GLIDE = {
  /** cruise speed of the page in px/s — bigger = travels faster */
  CRUISE: 2400,
  /** soft-landing zone in px — inside this distance the cruise slows down;
   *  set to 0 for a hard constant-speed stop */
  ARRIVE: 320,
  /** how far one wheel/trackpad delta pushes the target (1 = native distance) */
  WHEEL_GAIN: 1.0,
  /** a touch flick projects `velocity × FLICK_TIME` px of travel */
  FLICK_TIME: 0.5,
};

const clampTarget = (v: number) =>
  Math.max(0, Math.min(v, document.documentElement.scrollHeight - window.innerHeight));

class Glide {
  private target = 0;
  private current = 0;
  private applied = 0;
  private touching = false;
  private lastTouchY = 0;
  private lastTouchT = 0;
  private flickV = 0;
  private jumpTween: gsap.core.Tween | null = null;

  init(): void {
    this.target = this.current = this.applied = window.scrollY;

    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });

    gsap.ticker.add(this.tick);
  }

  /** user input always cancels a programmatic jump */
  private interruptJump(): void {
    if (this.jumpTween) {
      this.jumpTween.kill();
      this.jumpTween = null;
      this.target = this.current = this.applied = window.scrollY;
    }
  }

  private onWheel = (e: WheelEvent): void => {
    if (e.ctrlKey) return; // pinch-zoom stays native
    e.preventDefault();
    this.interruptJump();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    this.target = clampTarget(this.target + e.deltaY * unit * GLIDE.WHEEL_GAIN);
  };

  private onTouchStart = (e: TouchEvent): void => {
    this.interruptJump();
    this.touching = true;
    this.flickV = 0;
    this.lastTouchY = e.touches[0].clientY;
    this.lastTouchT = performance.now();
    this.target = this.current; // stop dead under the finger
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.touching) return;
    e.preventDefault();
    const y = e.touches[0].clientY;
    const t = performance.now();
    const dy = this.lastTouchY - y;
    const dt = Math.max(1, t - this.lastTouchT) / 1000;
    this.flickV = 0.85 * (dy / dt) + 0.15 * this.flickV; // px/s, lightly smoothed
    this.lastTouchY = y;
    this.lastTouchT = t;
    this.target = clampTarget(this.target + dy);
  };

  private onTouchEnd = (): void => {
    this.touching = false;
    if (performance.now() - this.lastTouchT > 90) this.flickV = 0; // finger rested: no flick
    this.target = clampTarget(this.target + this.flickV * GLIDE.FLICK_TIME);
    this.flickV = 0;
  };

  private tick = (_t: number, dtMs: number): void => {
    if (this.jumpTween) return; // programmatic jump owns the scroll for now

    // adopt scrolls we didn't make (scrollbar drag, keyboard, anchors, tests)
    const actual = window.scrollY;
    if (Math.abs(actual - this.applied) > 1.5) {
      this.target = this.current = this.applied = actual;
      return;
    }

    if (this.touching) {
      this.current = this.target; // 1:1 under the finger
    } else {
      // ── the formula ──
      const dt = dtMs / 1000;
      const remain = this.target - this.current;
      const speed = GLIDE.CRUISE * (GLIDE.ARRIVE > 0 ? Math.min(1, Math.abs(remain) / GLIDE.ARRIVE) : 1);
      const step = Math.sign(remain) * Math.min(Math.abs(remain), Math.max(speed * dt, 0));
      this.current += step;
      if (Math.abs(this.target - this.current) < 0.4) this.current = this.target;
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
      p: clampTarget(y),
      duration,
      ease: 'power3.inOut',
      onUpdate: () => {
        this.target = this.current = this.applied = Math.round(proxy.p);
        window.scrollTo(0, this.applied);
      },
      onComplete: () => {
        this.jumpTween = null;
      },
    });
  }
}

export const glide = new Glide();
