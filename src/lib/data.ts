import raw from '../data/products.json';

export interface Product {
  id: string;
  num: string;
  tier: 'scene' | 'wall';
  nameTh: string;
  specTh: string;
  promoTh: string;
  nameEn: string;
  theme: string;
  accent: string;
  video?: boolean;
}

export interface Brand {
  th: string;
  hanzi: string;
  en: string;
  caption: string;
  company: string;
}

export const brand = raw.brand as Brand;
export const products = raw.products as Product[];
export const scenes = products.filter((p) => p.tier === 'scene');
export const wallItems = products.filter((p) => p.tier === 'wall');

export const media = {
  scene: (p: Product) => `/media/scene/${p.id}.webp`,
  wall: (p: Product) => `/media/wall/${p.id}.webp`,
  card: (p: Product) => `/media/cards/${p.id}.webp`,
  heroFrame: (i: number) => `/media/frames/hero/f_${String(i + 1).padStart(4, '0')}.webp`,
  kimhuayVideo: '/media/video/kimhuay.mp4',
};

/** Short display name for tight spots (wheel chip): first two Thai tokens. */
export function shortName(p: Product): string {
  const tokens = p.nameTh.split(' ');
  return tokens.length <= 2 ? p.nameTh : tokens.slice(0, 2).join(' ');
}
