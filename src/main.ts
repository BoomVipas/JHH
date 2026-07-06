import '@fontsource/chonburi/400.css';
import '@fontsource/bai-jamjuree/400.css';
import '@fontsource/bai-jamjuree/500.css';
import '@fontsource/bai-jamjuree/600.css';
import '@fontsource/cinzel/500.css';
import '@fontsource/noto-serif-tc/700.css';
import './styles/main.css';

import { reducedMotion, initSmoother, scrollToTarget, ScrollTrigger } from './lib/motion';
import { products, scenes, media } from './lib/data';
import { runPreloader } from './lib/preloader';
import { Wheel, activeLabel } from './lib/wheel';
import { playIntro, heroExit } from './lib/intro';
import { initScrub } from './lib/scrub';
import { buildScenes, initScenes, scrollToScene, sceneIndexOf } from './lib/scenes';
import { buildWall, initWall } from './lib/wall';

function pickProduct(p: (typeof products)[number]): void {
  const idx = sceneIndexOf(p);
  if (idx >= 0) scrollToScene(idx);
  else scrollToTarget(`#wall-${p.id}`);
}

async function boot(): Promise<void> {
  if (reducedMotion) document.documentElement.classList.add('rm');

  // Build data-driven DOM before the smoother measures the page
  buildScenes();
  buildWall();

  const cardName = document.getElementById('wheelCardName')!;
  const heroWheel = new Wheel({
    container: document.getElementById('heroWheel')!,
    disc: document.getElementById('heroDisc')!,
    products,
    drift: 1.1,
    interactive: true,
    onActivate: (p) => { cardName.textContent = activeLabel(p); },
    onPick: pickProduct,
  });

  new Wheel({
    container: document.getElementById('finaleWheel')!,
    disc: document.getElementById('finaleDisc')!,
    products,
    drift: 2.2,
    interactive: false,
  });

  document.querySelectorAll<HTMLElement>('[data-scrollto]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToTarget(a.dataset.scrollto!);
    });
  });
  document.getElementById('finaleCta')!.addEventListener('click', (e) => e.preventDefault());

  if (reducedMotion) {
    document.getElementById('nav')!.classList.add('is-ready');
    void initScrub();
    initScenes();
    initWall();
    return;
  }

  initSmoother();
  void initScrub();
  initScenes();
  initWall();
  heroExit();

  const critical = [
    ...products.map((p) => media.card(p)),
    media.scene(scenes[0]),
    ...Array.from({ length: 24 }, (_, i) => media.heroFrame(i)),
  ];
  await runPreloader(critical);
  playIntro(heroWheel);

  window.addEventListener('load', () => ScrollTrigger.refresh());
}

void boot();
