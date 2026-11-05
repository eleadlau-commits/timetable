// Storefront: the business version's "Your shop" tab. The whole shop on one page, as cards that
// other features add: the shop feature's card on Spots, student deal and how it's going, and
// later others such as bookings. Every card has the same frame (a title, an optional tag such as
// Live, what's inside, and one button), so the page reads as one storefront. At the bottom, a
// link to choose which of them also sit on Home (the customise-home feature, if it's there).
//
// The tab only shows in the business version (the welcome feature's 'audience' service).
//
// Slot 'storefront.cards': the cards on the page.
//   Item: { id, order, title, render() → element (what's inside the card), heading?() → the
//   shop's name for the top of the page, tag?() → { text, tone?: 'live' | 'wait' | 'off' } or null,
//   action?() → { label, onClick, primary? } or null (the card's button), visible?() → false to hide it }.
//
// Service 'storefront': the same frame for a page of cards somewhere else, such as the
// society-committee feature's Your society window.
//   cards(items) → [elements]: the items (shaped like 'storefront.cards' items) that are visible,
//   in order, each in the shared frame. An item that fails to draw is left out.
//
// Saved data: none.

import { Feature, ui } from 'folio';
import { cardsToShow, headingOf } from './rules.js';

const { el } = ui;

// A shop front with an awning, for the tab.
const ICON = '<path d="M4 9.5V20h16V9.5"/><path d="M3 9l1.6-5h14.8L21 9a2.6 2.6 0 0 1-4.5 1.6A2.6 2.6 0 0 1 12 10.6 2.6 2.6 0 0 1 7.5 10.6 2.6 2.6 0 0 1 3 9z"/><path d="M9.5 20v-5h5v5"/>';

export default class Storefront extends Feature {
  start() {
    this.defineSlot('storefront.cards',
      "Cards on the business version's Your shop tab. Item: { id, order, title, render() → element, heading?() → the shop's name, tag?() → { text, tone?: 'live' | 'wait' | 'off' } or null, action?() → { label, onClick, primary? } or null, visible?() → false to hide it }.");
    this.provide('storefront', { cards: (items) => this.cards(items) });
    this.add('views', {
      id: 'storefront',
      label: 'Your shop',
      icon: ICON,
      order: 30,
      visible: () => !!this.use('audience')?.isBusiness(),
      subtitle: () => headingOf(this.slot('storefront.cards').items),
      mount: (container) => {
        this.box = el('div', { class: 'storefront' });
        container.append(this.box);
      },
      render: () => this.render(),
    });
  }

  render() {
    if (!this.box) return;
    const drawn = this.cards(this.slot('storefront.cards').items, this.slot('storefront.cards'));
    const customise = this.slot('home.tools').items.find((tool) => tool.id === 'customise');
    this.box.replaceChildren(
      ...(drawn.length ? drawn : [ui.missing('Your shop\'s details')]),
      customise && el('button', {
        type: 'button', class: 'link-btn storefront-home',
        onclick: () => { this.app.shell.selectView('home'); this.slot('home.tools').run(customise, (t) => t.onClick()); },
      }, 'Choose which of these are on Home'));
  }

  // The visible cards, in order, each in the shared frame. `slot` reports a card that fails
  // against the feature that added it; without one (cards from the service), it's just left out.
  cards(items, slot = null) {
    return cardsToShow(items).map((card) => this.card(card, slot)).filter(Boolean);
  }

  // One card in the shared frame. A card that fails to draw is left out.
  card(card, slot = null) {
    let inside;
    let tag;
    let action;
    const draw = (c) => {
      inside = c.render();
      tag = c.tag?.() || null;
      action = c.action?.() || null;
    };
    if (slot) slot.run(card, draw);
    else {
      try { draw(card); } catch (err) { console.error(err); inside = null; }
    }
    if (!inside) return null;
    return el('section', { class: 'storefront-card', 'aria-label': card.title },
      el('div', { class: 'storefront-card-head' },
        el('h2', {}, card.title),
        tag?.text && el('span', { class: `storefront-tag is-${tag.tone || 'live'}` }, tag.text)),
      inside,
      action && el('button', { type: 'button', class: `btn storefront-action${action.primary ? ' primary' : ''}`, onclick: action.onClick }, action.label));
  }
}
