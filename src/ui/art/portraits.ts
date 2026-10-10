// Portraits of the regulars, as SVG source on a 160 by 160 canvas. The
// gargoyle, clockmaker, baker and witch are the visuals canvas's own; the
// others are drawn here in the same style: a round tinted backdrop,
// shoulders, a head and one telling prop.

import { PAL } from './svg';

const shoulders = (fill: string) => `<path d="M36 160c0-30 18-44 44-44s44 14 44 44z" fill="${fill}"/>`;
const eyes = (y: number, l = 67, r = 93) =>
  `<circle cx="${l}" cy="${y}" r="3" fill="${PAL.ink}"/><circle cx="${r}" cy="${y}" r="3" fill="${PAL.ink}"/>`;
const smile = (y: number) => `<path d="M68 ${y}q12 9 24 0" fill="none" stroke="${PAL.ink}" stroke-width="3" stroke-linecap="round"/>`;

export const PORTRAITS: Record<string, string> = {
  lamplighter:
    `<circle cx="80" cy="80" r="74" fill="#2c3f5a"/>` +
    `<path d="M122 150V40" stroke="${PAL.wood}" stroke-width="5"/>` +
    `<path d="M114 40h16l-3-12h-10z" fill="${PAL.gold}"/><path d="M122 30q-5-8 0-14 5 6 0 14z" fill="#f2c94c"/>` +
    shoulders('#3f4a5a') +
    `<path d="M70 118h20l-10 16z" fill="${PAL.gold}"/>` +
    `<circle cx="80" cy="82" r="31" fill="#e8b48c"/>` +
    `<path d="M48 66q32-30 64 0z" fill="#2e3745"/><path d="M44 66h58l-6 7H50z" fill="#1f2632"/>` +
    eyes(84) +
    smile(98),
  sweep:
    `<circle cx="80" cy="80" r="74" fill="#3a3340"/>` +
    `<path d="M24 150l26-100" stroke="${PAL.wood}" stroke-width="4"/>` +
    `<path d="M50 50l-14-6 2 10-10-2 8 8-8 4 14 0z" fill="${PAL.ink}"/>` +
    shoulders('#2b2130') +
    `<circle cx="80" cy="84" r="31" fill="#e0a87e"/>` +
    `<ellipse cx="66" cy="96" rx="8" ry="5" fill="#6b5f6a" stroke="none"/>` +
    `<rect x="56" y="22" width="48" height="36" rx="3" fill="${PAL.ink}"/><rect x="44" y="54" width="72" height="8" rx="4" fill="${PAL.ink}"/>` +
    eyes(84) +
    smile(100),
  clockmaker:
    `<circle cx="80" cy="80" r="74" fill="#4a3a2c"/>` +
    `<path d="M36 160c0-30 18-44 44-44s44 14 44 44z" fill="#5b6b4a"/>` +
    `<path d="M68 118l12 16 12-16z" fill="#fbf3e4"/>` +
    `<circle cx="80" cy="78" r="33" fill="#e8b48c"/>` +
    `<path d="M46 66q34-38 68 0z" fill="#3f4a5a"/>` +
    `<rect x="40" y="62" width="56" height="8" rx="4" fill="#2e3745"/>` +
    `<circle cx="66" cy="82" r="3" fill="#2b2130"/><circle cx="95" cy="82" r="3" fill="#2b2130"/>` +
    `<circle cx="95" cy="82" r="11" fill="none" stroke="#e6b450" stroke-width="3"/>` +
    `<path d="M105 87q10 22-2 40" fill="none" stroke="#e6b450" stroke-width="1.5"/>` +
    `<path d="M60 99q10-9 20 0 10-9 20 0-10 9-20 2-10 7-20-2z" fill="#fbf3e4"/>` +
    `<circle cx="54" cy="140" r="8" fill="none" stroke="#e6b450" stroke-width="5" stroke-dasharray="4 3"/>` +
    `<circle cx="54" cy="140" r="2.5" fill="#e6b450"/>`,
  gargoyle:
    `<circle cx="80" cy="80" r="74" fill="#3d3350"/>` +
    `<path d="M36 100L8 60l22 8-4-26 26 32zM124 100l28-40-22 8 4-26-26 32z" fill="#6f688c"/>` +
    `<path d="M40 160c0-30 16-44 40-44s40 14 40 44z" fill="#8d86a8"/>` +
    `<path d="M54 58l-8-28 22 18zM106 58l8-28-22 18z" fill="#8d86a8"/>` +
    `<path d="M48 80l-18-8 14 24zM112 80l18-8-14 24z" fill="#8d86a8"/>` +
    `<ellipse cx="80" cy="80" rx="35" ry="33" fill="#a39cc0"/>` +
    `<path d="M56 66l18 6M104 66l-18 6" stroke="#5c5578" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="66" cy="80" r="7" fill="#f2c94c"/><circle cx="94" cy="80" r="7" fill="#f2c94c"/>` +
    `<circle cx="66" cy="80" r="2.5" fill="#241c26"/><circle cx="94" cy="80" r="2.5" fill="#241c26"/>` +
    `<path d="M66 98q14 8 28 0" fill="none" stroke="#5c5578" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M70 100l3 7 3-6zM84 101l3 6 3-7z" fill="#fbf3e4"/>`,
  postwoman:
    `<circle cx="80" cy="80" r="74" fill="#4a2f3a"/>` +
    shoulders('#3b5f8a') +
    `<path d="M44 118l72 38" stroke="${PAL.wood}" stroke-width="7"/>` +
    `<rect x="98" y="132" width="26" height="20" rx="3" fill="${PAL.woodTop}"/>` +
    `<path d="M50 90c-6 20 2 34 10 38M110 90c6 20-2 34-10 38" fill="none" stroke="#7a3f22" stroke-width="10"/>` +
    `<circle cx="80" cy="84" r="31" fill="#f0c9a0"/>` +
    `<path d="M46 70q34-34 68 0z" fill="#3b5f8a"/><path d="M42 70h76v7H42z" fill="#2c4a6e"/>` +
    `<circle cx="80" cy="58" r="5" fill="${PAL.gold}"/>` +
    eyes(86) +
    smile(100) +
    `<circle cx="60" cy="96" r="4" fill="#cf7a5a" stroke="none"/><circle cx="100" cy="96" r="4" fill="#cf7a5a" stroke="none"/>`,
  baker:
    `<circle cx="80" cy="80" r="74" fill="#5a3f38"/>` +
    `<path d="M36 160c0-30 18-42 44-42s44 12 44 42z" fill="#f3e6d0"/>` +
    `<path d="M66 120h28v40H66z" fill="#e0c39a"/>` +
    `<circle cx="80" cy="86" r="32" fill="#b9794f"/>` +
    `<path d="M50 62c-16-4-14-28 6-26 5-16 43-16 48 0 20-2 22 22 6 26v12H50z" fill="#fbf3e4"/>` +
    `<path d="M62 88q5-5 10 0M88 88q5-5 10 0" fill="none" stroke="#2b2130" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M68 100q12 9 24 0" fill="none" stroke="#2b2130" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="58" cy="98" r="5" fill="#cf7a5a"/><circle cx="102" cy="98" r="5" fill="#cf7a5a"/>` +
    `<ellipse cx="100" cy="90" rx="6" ry="3" fill="#fbf3e4" transform="rotate(-20 100 90)"/>`,
  apothecary:
    `<circle cx="80" cy="80" r="74" fill="#2f4a3a"/>` +
    shoulders('#5b6b4a') +
    `<path d="M112 150v-18l-6-10h20l-6 10v18z" fill="${PAL.glass}"/><path d="M107 150v-10h18v10z" fill="${PAL.leaf}"/>` +
    `<circle cx="80" cy="84" r="31" fill="#d9a07a"/>` +
    `<path d="M46 84c0-34 68-34 68 0l-6-14H52z" fill="${PAL.leafDark}"/>` +
    `<circle cx="67" cy="86" r="9" fill="none" stroke="${PAL.gold}" stroke-width="2.5"/>` +
    `<circle cx="93" cy="86" r="9" fill="none" stroke="${PAL.gold}" stroke-width="2.5"/>` +
    `<path d="M76 86h8" stroke="${PAL.gold}" stroke-width="2.5"/>` +
    eyes(86) +
    `<path d="M72 102q8 4 16 0" fill="none" stroke="${PAL.ink}" stroke-width="3" stroke-linecap="round"/>`,
  witch:
    `<circle cx="80" cy="80" r="74" fill="#24403f"/>` +
    `<path d="M36 160c0-28 18-40 44-40s44 12 44 40z" fill="#3d8f86"/>` +
    `<path d="M46 92c0-44 68-44 68 0v44h-12V96H58v40H46z" fill="#c9713a"/>` +
    `<circle cx="80" cy="94" r="30" fill="#f0c9a0"/>` +
    `<path d="M54 64L90 6l18 58z" fill="#2b2130"/>` +
    `<ellipse cx="80" cy="66" rx="50" ry="9" fill="#2b2130"/>` +
    `<path d="M58 54h47l3 8H54z" fill="#58c9b9"/>` +
    `<circle cx="68" cy="94" r="3" fill="#2b2130"/><circle cx="92" cy="94" r="3" fill="#2b2130"/>` +
    `<path d="M70 106q10 7 20 0" fill="none" stroke="#2b2130" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M124 36l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#e6b450"/>`,
  alchemist:
    `<circle cx="80" cy="80" r="74" fill="#2f2a44"/>` +
    `<path d="M28 160c0-34 22-48 52-48s52 14 52 48z" fill="#5a3f7a"/>` +
    `<path d="M42 110c0-50 16-80 38-80s38 30 38 80l-12 6H54z" fill="#6b4a8a"/>` +
    `<circle cx="80" cy="80" r="26" fill="#e8b48c"/>` +
    `<path d="M58 90q22 70 44 0q-8 10-22 10t-22-10z" fill="#fbf3e4"/>` +
    `<path d="M66 74l8 3M94 74l-8 3" stroke="${PAL.ink}" stroke-width="3"/>` +
    eyes(82, 69, 91) +
    `<path d="M80 30l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="${PAL.gold}"/>` +
    `<path d="M120 118l8 14h-16z" fill="${PAL.aqua}"/>`,
  cat:
    `<circle cx="80" cy="80" r="74" fill="#3d3350"/>` +
    `<path d="M40 160c0-30 16-46 40-46s40 16 40 46z" fill="#e89a52"/>` +
    `<path d="M46 72l-6-40 30 22zM114 72l6-40-30 22z" fill="#e89a52"/>` +
    `<path d="M50 62l-3-20 14 12zM110 62l3-20-14 12z" fill="#f2b8a0"/>` +
    `<ellipse cx="80" cy="84" rx="38" ry="34" fill="#e89a52"/>` +
    `<path d="M64 58l6 10M80 54v12M96 58l-6 10" fill="none" stroke="#b8642c" stroke-width="4"/>` +
    `<ellipse cx="66" cy="84" rx="6" ry="8" fill="#9bc96a"/><ellipse cx="94" cy="84" rx="6" ry="8" fill="#9bc96a"/>` +
    `<ellipse cx="66" cy="84" rx="2" ry="6" fill="${PAL.ink}"/><ellipse cx="94" cy="84" rx="2" ry="6" fill="${PAL.ink}"/>` +
    `<path d="M76 96h8l-4 5z" fill="#cf7a5a"/>` +
    `<path d="M80 101q-6 6-12 2M80 101q6 6 12 2" fill="none" stroke="${PAL.ink}" stroke-width="2.5"/>` +
    `<path d="M56 98l-20-4M56 104l-20 4M104 98l20-4M104 104l20 4" stroke="${PAL.cream}" stroke-width="1.5"/>`,
  innkeeper:
    `<circle cx="80" cy="80" r="74" fill="#4a3a2c"/>` +
    `<path d="M32 160c0-32 20-46 48-46s48 14 48 46z" fill="#8c3b2e"/>` +
    `<path d="M58 120h44v40H58z" fill="${PAL.cup}"/>` +
    `<circle cx="80" cy="84" r="34" fill="#e8a88c"/>` +
    `<path d="M48 70q32-30 64 0q-4-28-32-28t-32 28z" fill="#6b4a3a"/>` +
    eyes(82) +
    `<path d="M62 96q8-6 18 0 10-6 18 0-8 6-18 2-10 4-18-2z" fill="#6b4a3a"/>` +
    `<circle cx="58" cy="92" r="6" fill="#cf7a5a" stroke="none"/><circle cx="102" cy="92" r="6" fill="#cf7a5a" stroke="none"/>` +
    `<path d="M120 112h14v26h-14z" fill="${PAL.gold}"/><path d="M134 118q8 0 8 7t-8 7" fill="none" stroke="${PAL.gold}" stroke-width="3"/>` +
    `<path d="M118 112q9-8 18 0z" fill="${PAL.cup}"/>`,
  mayor:
    `<circle cx="80" cy="80" r="74" fill="#3b2a4a"/>` +
    shoulders('#2b2130') +
    `<path d="M50 124q30 30 60 0" fill="none" stroke="${PAL.gold}" stroke-width="5" stroke-dasharray="5 3"/>` +
    `<circle cx="80" cy="150" r="9" fill="${PAL.gold}"/>` +
    `<path d="M70 118l10 12 10-12z" fill="${PAL.cup}"/>` +
    `<circle cx="80" cy="86" r="30" fill="#e8b48c"/>` +
    `<rect x="56" y="18" width="48" height="44" rx="3" fill="${PAL.ink}"/><rect x="56" y="48" width="48" height="8" fill="#8c3b2e"/>` +
    `<rect x="42" y="58" width="76" height="8" rx="4" fill="${PAL.ink}"/>` +
    eyes(86) +
    `<path d="M62 100q18-10 36 0" fill="none" stroke="#9a9090" stroke-width="5" stroke-linecap="round"/>`,
};

/** A portrait's full SVG source. */
export function portraitBody(id: string): string {
  const body = PORTRAITS[id];
  if (!body) throw new Error(`No portrait for ${id}`);
  return body;
}
