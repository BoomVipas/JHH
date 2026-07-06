import { gsap, SplitText, ScrollTrigger } from './motion';
import { Wheel } from './wheel';

/** Hero entrance after the preloader gate opens. */
export function playIntro(heroWheel: Wheel): void {
  const name = document.getElementById('heroName')!;
  const split = new SplitText(name, { type: 'chars' });
  // gradient text must be applied per char: background-clip:text does not paint through child elements
  split.chars.forEach((c) => c.classList.add('gold-text'));

  const tl = gsap.timeline();
  tl.fromTo(
    split.chars,
    { opacity: 0, y: 42, filter: 'blur(8px)' },
    { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out', stagger: 0.024 },
    0.1,
  );
  tl.fromTo('#heroHanzi', { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' }, 0.35);
  tl.fromTo('#heroCaption', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' }, 0.5);
  tl.add(heroWheel.intro(), 0.45);
  tl.add(() => document.getElementById('nav')!.classList.add('is-ready'), 0.9);
}

/** As the visitor leaves the hero, the wheel sinks and keeps turning: the journey begins. */
export function heroExit(): void {
  gsap.to('#heroWheel', {
    yPercent: 26,
    rotation: 24,
    opacity: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: '#hero',
      start: 'top top',
      end: 'bottom 30%',
      scrub: 0.4,
    },
  });
  gsap.to('.hero__lockup', {
    opacity: 0,
    yPercent: -30,
    filter: 'blur(6px)',
    ease: 'none',
    scrollTrigger: {
      trigger: '#hero',
      start: 'top top',
      end: '55% top',
      scrub: 0.4,
    },
  });
  gsap.to('#wheelCardName', {
    opacity: 0,
    ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: '30% top', scrub: 0.4 },
  });
}
