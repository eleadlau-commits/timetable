// The privacy notice, shown from the account page. Plain words, and true to what the app does
// now: update it (and UPDATED) before anything new is stored online.

import { ui } from 'folio';

const { el } = ui;

export const UPDATED = '18 October 2026';

// Where people write about their data. Public: it's shown in the app.
export const CONTACT = 'mobiledurham.help@gmail.com';

const part = (title, ...lines) => el('section', { class: 'privacy-part' }, el('h3', {}, title), ...lines.map((l) => el('p', {}, l)));

export function privacyNotice() {
  return el('div', { class: 'privacy' },
    el('p', { class: 'privacy-lead' },
      'Mobile Durham is made by students. It isn\'t affiliated with Durham University, and the university doesn\'t run it or see anything in it.'),
    part('Without an account',
      'Everything you add (your timetable, to-dos, notes, reminders, module colours and campus card) stays on your phone. Nothing is sent to us.',
      'To do its job, the app talks directly to your university\'s calendar link, the library\'s page of free seats, and OpenStreetMap for maps. We don\'t see any of that.'),
    part('With an account',
      'You sign in with Google. Google tells us your name, email address and profile picture, and gives you an account number. We use these only to show who is signed in and to keep your things yours.',
      'While you\'re signed in, your timetable link is backed up to your private area, which only you can read, so your timetable comes back on a new phone. You can switch this off on the account page, which deletes the online copy. Nothing else from your timetable is stored online.',
      'Friends and timetable sharing aren\'t here yet. Before they are, this notice will say exactly what friends can see.'),
    part('Where it\'s kept',
      'With Google\'s Firebase service. Your private area is stored in London. Sign-in is handled by Google.'),
    part('Who can see it',
      'Only you. The database\'s rules refuse everyone else, and they are tested automatically before every new version of the app. The people who run Mobile Durham could reach the database to fix a problem, but don\'t look at what\'s in it unless the law requires it.'),
    part('What we don\'t do',
      'No adverts, no selling or sharing your data, no tracking of what you do in the app.'),
    part('How long it\'s kept, and deleting it',
      'Until you delete it. Delete my account, on the account page, removes everything stored online straight away and then your account. What\'s on your phone stays until you remove the app.'),
    part('Your rights',
      'You can ask to see, correct or delete what\'s stored about you, and you can delete it all yourself at any time. If you\'re unhappy with how your data is handled, you can complain to the Information Commissioner\'s Office (ico.org.uk).'),
    el('section', { class: 'privacy-part' }, el('h3', {}, 'Contact'),
      el('p', {}, 'For questions or requests about your data, email ', el('a', { href: `mailto:${CONTACT}` }, CONTACT), '.')),
    ui.hint(`Last updated ${UPDATED}.`, { small: true }));
}
