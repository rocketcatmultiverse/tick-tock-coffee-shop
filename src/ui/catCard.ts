// The small card that opens when you click the cat: name it or pet it.
// Its moods are cosmetic, so they use Math.random here in the UI.

import { el } from './el';

/** Chance that the cat simply does not care for your affection. */
const INDIFFERENT = 0.3;
const HEART_MS = 2000;

export class CatCard {
  readonly root = el('div', { className: 'card cat-card' });
  private name = el('input', { type: 'text', placeholder: 'Name your cat', maxLength: 20 });
  private result = el('div', { className: 'muted' });
  heartUntil = 0;

  constructor(
    private readonly host: { getName(): string; setName(n: string): void; isMad(): boolean; render(): void },
  ) {
    const pet = el('button', { textContent: 'Pet' });
    pet.onclick = () => this.pet();
    this.name.onchange = () => {
      host.setName(this.name.value.trim());
      host.render();
    };
    this.root.append(el('div', { className: 'card-name' }, 'Your cat'), this.name, pet, this.result);
    this.root.hidden = true;
  }

  open(): void {
    this.root.hidden = false;
    this.name.value = this.host.getName();
    this.result.textContent = '';
  }

  private pet(): void {
    if (this.host.isMad()) {
      this.result.textContent = 'It is still mad at you about the cold milk.';
    } else if (Math.random() < INDIFFERENT) {
      this.result.textContent = 'It does not care for your affection just now.';
    } else {
      this.result.textContent = 'Purr.';
      this.heartUntil = performance.now() + HEART_MS;
      window.setTimeout(() => this.host.render(), HEART_MS + 20);
    }
    this.host.render();
  }

  get heart(): boolean {
    return performance.now() < this.heartUntil;
  }
}
