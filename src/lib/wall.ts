import { gsap, ScrollTrigger, reducedMotion } from './motion';
import { wallItems, media } from './data';

export function buildWall(): void {
  const grid = document.getElementById('wallGrid')!;
  const frag = document.createDocumentFragment();
  wallItems.forEach((p) => {
    const item = document.createElement('article');
    item.className = 'wall__item';
    item.id = `wall-${p.id}`;
    item.innerHTML = `
      <div class="wall__imgwrap"><img src="${media.wall(p)}" alt="${p.nameTh}" /></div>
      <p class="wall__num">${p.num} · ${p.nameEn}</p>
      <p class="wall__name" lang="th">${p.nameTh}</p>
      <p class="wall__spec" lang="th">${p.specTh}${p.promoTh ? ` · ${p.promoTh}` : ''}</p>
    `;
    frag.appendChild(item);
  });
  grid.appendChild(frag);
}

export function initWall(): void {
  if (reducedMotion) return;
  const items = gsap.utils.toArray<HTMLElement>('.wall__item');
  gsap.set(items, { opacity: 0, y: 34 });
  ScrollTrigger.batch(items, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06 }),
  });
}
