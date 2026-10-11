// Small line icons for the buttons: the tool bar, the clock's controls and the
// menu. Drawn on a 24-unit square in the button's own text colour, with the
// round caps and joins of the sprites' ink line.

const PATHS = {
  turn: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M18.5 3.5v4h-4"/>',
  flip: '<path d="M12 3v18" stroke-dasharray="2 3"/><path d="M9 7 3 17h6z"/><path d="m15 7 6 10h-6z"/>',
  drop: '<path d="M6 6l12 12M18 6 6 18"/>',
  older: '<path d="m14.5 5-7 7 7 7"/>',
  newer: '<path d="m9.5 5 7 7-7 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.1" stroke-width="2.6"/>',
  select: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3.5 3"/>',
  delete: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1.2 13h9.6L18 7M10 11v5.5M14 11v5.5"/>',
  cut: '<circle cx="6.5" cy="17.5" r="3"/><circle cx="17.5" cy="17.5" r="3"/><path d="M8.6 15.4 18 4M15.4 15.4 6 4"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9.5a1 1 0 0 0 1 1h3.5"/>',
  paste: '<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
  undo: '<path d="M9 13.5 4 8.5l5-5"/><path d="M4 8.5h10a5.5 5.5 0 0 1 0 11h-3"/>',
  redo: '<path d="m15 13.5 5-5-5-5"/><path d="M20 8.5H10a5.5 5.5 0 0 0 0 11h3"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  step: '<path d="M5 5v14l10-7z"/><path d="M19 5v14"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  prev: '<path d="m14.5 5-7 7 7 7"/>',
  next: '<path d="m9.5 5 7 7-7 7"/>',
} as const;

export type IconName = keyof typeof PATHS;

/** An inline icon, `size` CSS pixels square, hidden from screen readers (its button has the words). */
export function icon(name: IconName, size = 24): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  svg.innerHTML = PATHS[name];
  return svg;
}
