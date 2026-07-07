import { gsap, ScrollTrigger, reducedMotion, glide } from './motion';
import { scenes, media, Product } from './data';

let sceneTrigger: ScrollTrigger | null = null;

function sceneDom(p: Product, i: number): HTMLElement {
  const el = document.createElement('article');
  el.className = 'scene';
  el.id = `scene-${p.id}`;
  el.dataset.idx = String(i);

  const img = document.createElement('img');
  img.className = 'scene__bg';
  img.src = media.scene(p);
  img.alt = `${p.nameTh} ในฉากสวรรค์`;
  img.loading = i === 0 ? 'eager' : 'lazy';
  el.appendChild(img);

  const scrim = document.createElement('div');
  scrim.className = 'scene__scrim';
  el.appendChild(scrim);

  const copy = document.createElement('div');
  copy.className = 'scene__copy';
  copy.innerHTML = `
    <p class="scene__numeral">${p.num}</p>
    <h3 class="scene__title" lang="th">${p.nameTh}</h3>
    <p class="scene__en" lang="en">${p.nameEn}</p>
    <div class="scene__meta">
      <span class="scene__chip" lang="th">${p.specTh}</span>
      ${p.promoTh ? `<span class="scene__promo" lang="th">${p.promoTh}</span>` : ''}
    </div>
  `;
  if (p.video) {
    const fig = document.createElement('figure');
    fig.className = 'scene__live';
    fig.innerHTML = `
      <video muted loop playsinline preload="none" data-src="${media.kimhuayVideo}"></video>
      <figcaption lang="th">ภาพจริงจากหน้าร้าน</figcaption>
    `;
    copy.appendChild(fig);
  }
  el.appendChild(copy);
  return el;
}

export function buildScenes(): void {
  const stage = document.getElementById('catalogueStage')!;
  scenes.forEach((p, i) => stage.appendChild(sceneDom(p, i)));
}

function buildRail(onPick: (i: number) => void): (idx: number) => void {
  const rail = document.getElementById('rail')!;
  scenes.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'rail__dot';
    b.type = 'button';
    b.textContent = p.num;
    b.setAttribute('aria-label', p.nameTh);
    b.addEventListener('click', () => onPick(i));
    rail.appendChild(b);
  });
  const dots = Array.from(rail.querySelectorAll<HTMLElement>('.rail__dot'));
  return (idx: number) => dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
}

/** progress point (0..1 of the pin) where scene i is fully on stage */
function sceneProgress(i: number): number {
  return (i + 0.5) / scenes.length;
}

/** page stops: one per catalogue scene, at its fully-on-stage position */
export function sceneStops(): number[] {
  if (!sceneTrigger) return [];
  const span = sceneTrigger.end - sceneTrigger.start;
  return scenes.map((_, i) => sceneTrigger!.start + span * sceneProgress(i));
}

export function scrollToScene(i: number): void {
  if (!sceneTrigger) {
    document.getElementById('catalogue')?.scrollIntoView();
    return;
  }
  const y = sceneTrigger.start + (sceneTrigger.end - sceneTrigger.start) * sceneProgress(i);
  if (reducedMotion) {
    window.scrollTo({ top: y });
  } else {
    glide.jumpTo(y, 1.6);
  }
}

export function initScenes(): void {
  const els = Array.from(document.querySelectorAll<HTMLElement>('.scene'));
  const setRail = buildRail((i) => scrollToScene(i));
  const rail = document.getElementById('rail')!;

  // lazy-attach the real shop video just before the catalogue arrives
  const vid = document.querySelector<HTMLVideoElement>('.scene__live video');
  if (vid) {
    ScrollTrigger.create({
      trigger: '#catalogue',
      start: 'top 140%',
      once: true,
      onEnter: () => {
        vid.src = vid.dataset.src!;
        vid.addEventListener('playing', () => vid.closest('.scene__live')?.classList.add('is-live'), { once: true });
        vid.play().catch(() => {});
      },
    });
  }

  if (reducedMotion) {
    document.documentElement.classList.add('rm');
    return;
  }

  // Scrubbed filter: blur() on full-screen background images is a frame-killer
  // on phones. Coarse pointers get transform + opacity only.
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;

  const n = scenes.length;
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#catalogue',
      start: 'top top',
      end: `+=${n * 90}%`,
      pin: '#catalogueStage',
      scrub: 0.6,
      anticipatePin: 1,
      onUpdate(self) {
        const idx = Math.min(n - 1, Math.floor(self.progress * n));
        setRail(idx);
      },
      onToggle(self) {
        rail.classList.toggle('is-on', self.isActive);
      },
    },
  });

  els.forEach((el, i) => {
    const dir = i % 2 === 0 ? 1 : -1;
    const bg = el.querySelector('.scene__bg');
    const copyBits = el.querySelectorAll('.scene__copy > *');
    const at = i;

    if (i === 0) {
      tl.set(el, { opacity: 1 }, 0);
      tl.fromTo(bg, { scale: 1.06 }, { scale: 1, duration: 1 }, 0);
      tl.fromTo(copyBits, { opacity: 0, x: 26 }, { opacity: 1, x: 0, duration: 0.22, stagger: 0.035 }, 0.02);
    } else {
      tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.32 }, at - 0.16);
      tl.fromTo(
        bg,
        isCoarse
          ? { scale: 1.09, xPercent: dir * 2.5 }
          : { scale: 1.09, xPercent: dir * 2.5, filter: 'blur(5px)' },
        isCoarse
          ? { scale: 1, xPercent: 0, duration: 0.55 }
          : { scale: 1, xPercent: 0, filter: 'blur(0px)', duration: 0.55 },
        at - 0.16,
      );
      tl.fromTo(
        copyBits,
        { opacity: 0, x: dir * 34 },
        { opacity: 1, x: 0, duration: 0.24, stagger: 0.03 },
        at + 0.02,
      );
    }

    // slow Ken Burns while the scene owns the stage
    tl.to(bg, { scale: 1.045, xPercent: dir * -1.5, duration: 0.9 }, at + 0.05);

    if (i < n - 1) {
      const next = i + 1;
      tl.to(el.querySelectorAll('.scene__copy > *'), { opacity: 0, x: dir * -30, duration: 0.16, stagger: 0.02 }, next - 0.2);
      if (!isCoarse) tl.to(bg, { filter: 'blur(4px)', duration: 0.3 }, next - 0.16);
      tl.to(el, { opacity: 0, duration: 0.3 }, next - 0.1);
    }
  });

  // hold the last scene for a beat
  tl.to({}, { duration: 0.5 });

  sceneTrigger = tl.scrollTrigger!;
}

export function sceneIndexOf(p: Product): number {
  return scenes.findIndex((s) => s.id === p.id);
}
