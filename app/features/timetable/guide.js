// The guide to connecting your timetable: on the setup screen, and as a page in Help.
// Change the words here and both change. In the text, **bold**, _slanted_ and `code` work.

import { ui } from 'folio';

const { el } = ui;

export const INTRO = 'Your university can export your timetable as a personal calendar link. You switch the export on once, copy the link, and paste it here. After that the app keeps itself up to date.';

export const STEPS = [
  '**Open your timetable** on the university website and sign in. This is often easiest on a laptop.',
  '**Find the export option.** It may be called _Export_, _Subscribe_, _Sync to calendar_, _iCal_ or _Add to Google/Outlook_, and is often behind a calendar or share icon.',
  '**Confirm the export** when it asks you to. This creates your personal link.',
  '**Copy the link.** It usually starts with `webcal://` or `https://` and often ends in `.ics`. On a phone, press and hold the link and choose _Copy link_.',
  '**Paste it below** and tap _Load timetable_.',
];

export const PRIVATE = 'Keep this link private, because anyone who has it can see your timetable. The app stores it only on this device.';

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

// The numbered steps. `last` replaces the final step, e.g. for Help, where there's no box below.
export function steps(last) {
  const list = last ? [...STEPS.slice(0, -1), last] : STEPS;
  return el('ol', { class: 'steps' }, ...list.map((step) => el('li', {}, el('span', {}, ...rich(step)))));
}
