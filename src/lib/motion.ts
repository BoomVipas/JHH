import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { SplitText } from 'gsap/SplitText';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { glide } from './glide';

gsap.registerPlugin(ScrollTrigger, Draggable, InertiaPlugin, SplitText, ScrollToPlugin);

// exposed for the Playwright verification probes
declare global { interface Window { gsap: typeof gsap } }
window.gsap = gsap;

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const EASE_OUT = 'expo.out';
export const EASE_HAND = 'power3.inOut';

/**
 * Scrolling is native (ScrollTrigger reads window.scrollY directly); the feel
 * comes from the glide engine in glide.ts: input moves a target, the page
 * cruises toward it at constant speed, always interruptible. Tune GLIDE there.
 */
export function initGlide(): void {
  if (reducedMotion) return;
  glide.init();
}

export function scrollToTarget(selector: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.1;
  if (reducedMotion) {
    el.scrollIntoView();
  } else {
    glide.jumpTo(y, 1.4);
  }
}

export { gsap, ScrollTrigger, Draggable, SplitText, glide };
