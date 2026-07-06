import { gsap, Draggable } from './motion';
import { Product, media, shortName } from './data';

export interface WheelOptions {
  container: HTMLElement;
  disc: HTMLElement;
  products: Product[];
  /** degrees per second of idle drift */
  drift: number;
  interactive: boolean;
  onActivate?: (p: Product) => void;
  onPick?: (p: Product) => void;
}

/**
 * Circular card carousel (gsap.com forum topic 39530 technique):
 * cards sit on a rotated radius; the disc is Draggable type:"rotation"
 * with inertia and snapping at 360/n steps.
 */
export class Wheel {
  private step: number;
  private drag: Draggable | null = null;
  private activeIdx = -1;
  private driftOn = true;
  private lastInteraction = 0;
  private opts: WheelOptions;

  constructor(opts: WheelOptions) {
    this.opts = opts;
    this.step = 360 / opts.products.length;
    this.build();
    if (opts.interactive) this.enableDrag();
    this.enableDrift();
    this.setActiveFromRotation(true);
  }

  private build(): void {
    const { disc, products } = this.opts;
    const frag = document.createDocumentFragment();
    products.forEach((p, i) => {
      const card = document.createElement('button');
      card.className = 'wheel__card';
      card.type = 'button';
      card.setAttribute('role', 'option');
      card.setAttribute('aria-label', `${p.num} · ${p.nameTh}`);
      card.style.setProperty('--angle', `${i * this.step}deg`);
      card.dataset.idx = String(i);
      const img = document.createElement('img');
      img.src = media.card(p);
      img.alt = '';
      img.loading = 'lazy';
      img.draggable = false;
      card.appendChild(img);
      frag.appendChild(card);
    });
    disc.appendChild(frag);
  }

  private cards(): HTMLElement[] {
    return Array.from(this.opts.disc.querySelectorAll<HTMLElement>('.wheel__card'));
  }

  get rotation(): number {
    return Number(gsap.getProperty(this.opts.disc, 'rotation')) || 0;
  }

  private setActiveFromRotation(force = false): void {
    const n = this.opts.products.length;
    const idx = ((Math.round(-this.rotation / this.step) % n) + n) % n;
    if (idx === this.activeIdx && !force) return;
    this.activeIdx = idx;
    this.cards().forEach((c, i) => c.classList.toggle('is-active', i === idx));
    this.opts.onActivate?.(this.opts.products[idx]);
  }

  private enableDrag(): void {
    const self = this;
    this.drag = Draggable.create(this.opts.disc, {
      type: 'rotation',
      inertia: true,
      snap: (v: number) => gsap.utils.snap(self.step, v),
      onPress() { self.lastInteraction = performance.now(); },
      onDrag() {
        self.lastInteraction = performance.now();
        self.setActiveFromRotation();
      },
      onThrowUpdate() {
        self.lastInteraction = performance.now();
        self.setActiveFromRotation();
      },
      onClick(event: PointerEvent) {
        const card = (event.target as HTMLElement).closest<HTMLElement>('.wheel__card');
        if (!card) return;
        const p = self.opts.products[Number(card.dataset.idx)];
        self.opts.onPick?.(p);
      },
    })[0];

    this.opts.container.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      this.lastInteraction = performance.now();
      const dir = e.key === 'ArrowRight' ? -1 : 1;
      gsap.to(this.opts.disc, {
        rotation: gsap.utils.snap(this.step, this.rotation + dir * this.step),
        duration: 0.55,
        ease: 'expo.out',
        onUpdate: () => this.setActiveFromRotation(),
      });
    });
    this.opts.container.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && this.activeIdx >= 0) {
        this.opts.onPick?.(this.opts.products[this.activeIdx]);
      }
    });
  }

  private enableDrift(): void {
    gsap.ticker.add((_t, dt) => {
      if (!this.driftOn) return;
      if (this.drag && (this.drag.isDragging || this.drag.isThrowing)) return;
      if (performance.now() - this.lastInteraction < 2400) return;
      gsap.set(this.opts.disc, { rotation: this.rotation + (this.opts.drift * dt) / 1000 });
      this.setActiveFromRotation();
    });
  }

  setDrift(on: boolean): void {
    this.driftOn = on;
  }

  /** deal-in entrance used by the hero intro */
  intro(): gsap.core.Timeline {
    const tl = gsap.timeline();
    const cards = this.cards();
    tl.set(this.opts.disc, { rotation: -this.step * 2 });
    tl.fromTo(
      cards,
      { opacity: 0, scale: 0.72 },
      { opacity: 1, scale: 1, duration: 0.7, ease: 'expo.out', stagger: { each: 0.028, from: 'center' } },
      0,
    );
    tl.to(this.opts.disc, {
      rotation: 0,
      duration: 1.3,
      ease: 'expo.out',
      onUpdate: () => this.setActiveFromRotation(),
    }, 0.1);
    return tl;
  }
}

export function activeLabel(p: Product): string {
  return `${p.num} · ${shortName(p)}`;
}
