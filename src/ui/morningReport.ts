// The morning report: shown once on load when the player has been away.

import type { MorningReport } from '../game/offline';
import { el } from './panel';

function duration(loops: number): string {
  const minutes = Math.floor((loops * 12) / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${Math.floor(hours / 24)} days`;
}

export function showMorningReport(report: MorningReport, loyalty: Map<string, number>, onClose: () => void): void {
  const close = el('button', { textContent: 'Open the shop' });
  const rows = report.regulars.map((r) =>
    el(
      'li',
      {},
      r.served > 0
        ? `${r.name} was served ${r.served.toLocaleString()} time${r.served === 1 ? '' : 's'} (${(loyalty.get(r.id) ?? 0).toLocaleString()} mornings in all).`
        : `${r.name} went without.`,
    ),
  );
  const gears =
    report.gearsEarned > 0
      ? `The clockmaker left ${report.gearsEarned.toLocaleString()} gears by the till (${report.gears.toLocaleString()} in all).`
      : `Gears by the till: ${report.gears.toLocaleString()}.`;
  const card = el(
    'div',
    { className: 'report' },
    el('h2', {}, 'Good morning'),
    el('p', {}, `You were away about ${duration(report.loops)}: ${report.loops.toLocaleString()} loops of the clock. The till has not moved.`),
    el('ul', {}, ...rows),
    el('p', {}, gears),
    close,
  );
  const overlay = el('div', { className: 'overlay' }, card);
  close.onclick = () => {
    overlay.remove();
    onClose();
  };
  document.body.append(overlay);
  close.focus();
}
