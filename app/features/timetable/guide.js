// The guide to connecting your timetable: on the setup screen, and as a page in Help. The words
// come from the university's pack (Durham's are in uni-durham/guide.js); without one, the general
// guide below is used. In the text, **bold**, _slanted_ and `code` work.

import { ui } from 'folio';

const { el } = ui;

// For a university without a pack: what most timetable sites call it.
export const GENERAL = {
  intro: 'Most universities let you export your timetable as a personal calendar link. You find it once on your university\'s timetable website, copy it, and paste it here. After that the app keeps itself up to date.',
  steps: [
    '**Open your university\'s timetable website** and sign in. This is often easiest on a laptop.',
    '**Look for an option to export or subscribe**, often called _Export_, _Subscribe_, _Calendar feed_ or _Add to calendar_ (sometimes under _Settings_).',
    '**Copy the link** it gives you. It usually starts with `webcal://` or `https://` and often ends in `.ics`.',
    '**Paste it below** and tap _Load timetable_.',
  ],
  pictures: {},
  private: 'Keep this link private, because anyone who has it can see your timetable. The app stores it only on this device.',
};

// The guide to show: the pack's, filled in where it leaves something out, or the general one.
export function guideFor(pack) {
  const g = pack || {};
  const steps = Array.isArray(g.steps) && g.steps.length ? g.steps : GENERAL.steps;
  return {
    intro: g.intro || GENERAL.intro,
    steps,
    pictures: (steps === g.steps && g.pictures) || {},
    private: g.private || GENERAL.private,
  };
}

const TAGS = { '**': 'b', _: 'i', '`': 'code' };

// Text with **bold**, _slanted_ and `code` turned into the right pieces.
export function rich(text) {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/).filter(Boolean).map((part) => {
    const mark = part.startsWith('**') ? '**' : part[0];
    const tag = TAGS[mark];
    const size = mark.length;
    return tag && part.length > size * 2 && part.endsWith(mark) ? el(tag, {}, part.slice(size, -size)) : part;
  });
}

// The numbered steps of a guide (from guideFor). `last` replaces the final step, e.g. for Help,
// where there's no box below.
export function steps(guide, last) {
  const list = last ? [...guide.steps.slice(0, -1), last] : guide.steps;
  return el('ol', { class: 'steps' }, ...list.map((step, i) => el('li', {}, el('span', {}, ...rich(step)), picture(guide.pictures[i]))));
}

// A picture under a step: { src, alt, width, height, max }.
function picture(p) {
  if (!p?.src) return null;
  return el('img', { class: 'step-picture', src: p.src, alt: p.alt || '', width: p.width, height: p.height, style: p.max ? `max-width:${p.max}px` : null, loading: 'lazy' });
}
