// Sharing in the UI: the share card in the Shop tab, the banner while visiting
// someone else's shop, and the spoiler warning before opening one. A shared
// shop lives only in the URL's fragment and is never saved.

import { type Progress, SHOP_NAME_MAX, type ShopStats, encodeShare, shareOf, shareText, shopTitle, statsLine } from '../game/share';
import type { Shop } from '../game/shop';
import { el } from './el';

/** The link that opens a shared shop on this site. */
function shareUrl(fragment: string): string {
  return `${location.origin}${location.pathname}#${fragment}`;
}

/** Back to the player's own shops: drop the shared one from the URL and open the page again on the save slots. */
export function leaveVisit(): void {
  history.replaceState(null, '', location.pathname + location.search);
  location.reload();
}

/** In the Shop tab of the player's own shop: name it, see its numbers, copy a link to it. */
export class ShareCard {
  readonly root = el('div', { className: 'card share-card' });
  private name = el('input', { type: 'text', placeholder: 'Name your shop', maxLength: SHOP_NAME_MAX });
  private stats = el('div', { className: 'muted' });
  private copied = el('input', { type: 'text', readOnly: true, className: 'share-link', hidden: true });
  private status = el('div', { className: 'muted' });
  private shown = '';

  constructor(
    private readonly shop: Shop,
    private readonly getStats: () => ShopStats,
  ) {
    this.name.value = shop.shopName;
    this.name.oninput = () => {
      shop.shopName = this.name.value.trim();
    };
    const link = el('button', { className: 'primary', textContent: 'Copy link' });
    const scores = el('button', { textContent: 'Copy with scores' });
    link.onclick = () => this.copy(false);
    scores.onclick = () => this.copy(true);
    this.copied.onfocus = () => this.copied.select();
    this.root.append(
      el('div', { className: 'card-name' }, 'Share your shop'),
      this.name,
      this.stats,
      el('div', { className: 'row' }, link, scores),
      this.copied,
      this.status,
      el('div', { className: 'muted' }, 'Whoever opens the link plays a copy of your shop. Nothing they do there is saved, and their own shop is left as it is.'),
    );
  }

  /** Refresh the numbers; called while the Shop tab is open. */
  update(): void {
    const line = `Your floor, in steady state: ${statsLine(this.getStats())}.`;
    if (line !== this.shown) this.stats.textContent = this.shown = line;
  }

  private async copy(withScores: boolean): Promise<void> {
    const stats = this.getStats();
    const url = shareUrl(encodeShare(shareOf(this.shop), stats));
    const text = withScores ? shareText(this.shop.shopName, stats, url) : url;
    this.copied.value = text;
    this.copied.hidden = false;
    try {
      await navigator.clipboard.writeText(text);
      this.status.textContent = withScores ? 'Copied the link with your scores.' : 'Copied the link.';
    } catch {
      this.copied.focus();
      this.status.textContent = 'Copy the selected text above.';
    }
  }
}

/** Above the clock while visiting: whose shop this is, its numbers, and the way back. */
export class VisitBanner {
  readonly root = el('div', { className: 'card visit' });
  private stats = el('div', { className: 'muted' });
  private shown = '';

  constructor(shop: Shop) {
    const back = el('button', { className: 'primary', textContent: 'Back to my shops' });
    back.onclick = () => leaveVisit();
    this.root.append(
      el('div', { className: 'visit-top' }, el('div', { className: 'card-name' }, `Visiting ${shopTitle(shop.shopName)}`), back),
      this.stats,
    );
  }

  update(stats: ShopStats): void {
    const line = `${statsLine(stats)}. It plays as usual, and nothing here is saved: your own shop is left as it is.`;
    if (line !== this.shown) this.stats.textContent = this.shown = line;
  }
}

/** Before opening a shared shop that has got further than the player's own. */
export function showSpoilerWarning(name: string, shared: ShopStats, own: Progress, choose: { open(): void; back(): void }): void {
  const back = el('button', { className: 'primary', textContent: 'Back to my shops' });
  const open = el('button', { textContent: 'Open it anyway' });
  const regulars = (n: number) => `${n} regular${n === 1 ? '' : 's'}`;
  const card = el(
    'div',
    { className: 'report' },
    el('h2', {}, 'Spoilers ahead'),
    el(
      'p',
      {},
      `${shopTitle(name)} has got further than your shop. It has ${regulars(shared.walkedIn)} in and keeps ${shared.happy} happy; ` +
        `yours has ${regulars(own.walkedIn)} in and keeps ${own.happy} happy.`,
    ),
    el('p', {}, 'It may show you solutions you have not found yet, and regulars you have not met.'),
    el('p', { className: 'muted' }, 'Your own shop is safe either way: a shared shop is never saved.'),
    el('div', { className: 'row' }, back, open),
  );
  const overlay = el('div', { className: 'overlay' }, card);
  back.onclick = () => {
    overlay.remove();
    choose.back();
  };
  open.onclick = () => {
    overlay.remove();
    choose.open();
  };
  document.body.append(overlay);
  back.focus();
}
