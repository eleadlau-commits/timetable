// The guide to connecting your timetable: on the setup screen, and as a page in Help.
// Change the words here and both change. In the text, **bold**, _slanted_ and `code` work.

import { ui } from 'folio';

const { el } = ui;

export const INTRO = 'Durham lets you export your timetable as a personal calendar link. You switch the export on once in My Timetable, copy the link, and paste it here. After that the app keeps itself up to date.';

export const STEPS = [
  '**Open My Timetable** at `mytimetable.durham.ac.uk` and sign in with your Durham account. This is often easiest on a laptop.',
  '**Open the menu** (the three lines at the top left) and choose _Settings / Export_.',
  '**Switch the export on.** Under _Subscribe / Export Settings_, set _Publish Calendar_ to _Yes_.',
  '**Copy the link** in _Calendar Link_ with the copy button next to it. It starts with `https://mytimetable.durham.ac.uk/calendar/export/`. On a phone, you can also press and hold the box and choose _Copy_.',
  '**Paste it below** and tap _Load timetable_.',
];

// Pictures under some steps (by step number, from 0), from Durham's My Timetable with personal
// details left out. The files are in guide/.
const PICTURES = {
  1: { file: 'guide/menu.png', alt: 'The My Timetable menu, with Week View, Month View, Settings / Export, FAQ and Logout.', width: 400, height: 373, max: 240 },
  2: { file: 'guide/export.png', alt: 'Subscribe / Export Settings: Publish Calendar set to Yes, and the Calendar Link box with its copy button.', width: 925, height: 250, max: 420 },
};

export const PRIVATE = 'Keep this link private, because anyone who has it can see your timetable. If you set Publish Calendar back to No, the link stops working. The app stores it only on this device.';

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
  return el('ol', { class: 'steps' }, ...list.map((step, i) => el('li', {}, el('span', {}, ...rich(step)), picture(i))));
}

function picture(i) {
  const p = PICTURES[i];
  if (!p) return null;
  return el('img', { class: 'step-picture', src: new URL(p.file, import.meta.url).href, alt: p.alt, width: p.width, height: p.height, style: `max-width:${p.max}px`, loading: 'lazy' });
}
