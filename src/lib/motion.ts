import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { SplitText } from 'gsap/SplitText';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, Draggable, InertiaPlugin, SplitText, ScrollToPlugin);

// exposed for the Playwright verification probes
declare global { interface Window { gsap: typeof gsap } }
window.gsap = gsap;

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const EASE_OUT = 'expo.out';
export const EASE_HAND = 'power3.inOut';

export let smoother: ScrollSmoother | null = null;

export function initSmoother(): void {
  if (reducedMotion) return;
  smoother = ScrollSmoother.create({
    wrapper: '#smooth-wrapper',
    content: '#smooth-content',
    smooth: 1.2,
    effects: true,
    normalizeScroll: true,
  });
}

export function scrollToTarget(selector: string): void {
  const el = document.querySelector(selector);
  if (!el) return;
  if (smoother) {
    gsap.to(smoother, {
      scrollTop: smoother.offset(el as HTMLElement, 'top 12%'),
      duration: 1.4,
      ease: EASE_HAND,
    });
  } else {
    (el as HTMLElement).scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }
}

export { gsap, ScrollTrigger, Draggable, SplitText };
