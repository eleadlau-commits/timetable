// The privacy notice, shown from the account page. Plain words, and true to what the app does
// now: update it (and UPDATED) before anything new is stored online.

import { ui } from 'folio';

const { el } = ui;

export const UPDATED = '29 October 2026';

// Where people write about their data. Public: it's shown in the app.
export const CONTACT = 'mobiledurham.help@gmail.com';

const part = (title, ...lines) => el('section', { class: 'privacy-part' }, el('h3', {}, title), ...lines.map((l) => el('p', {}, l)));

export function privacyNotice() {
  return el('div', { class: 'privacy' },
    el('p', { class: 'privacy-lead' },
      'Mobile Durham is made by students. It isn\'t affiliated with Durham University, and the university doesn\'t run it or see anything in it.'),
    part('Without an account',
      'Everything you add (your timetable, to-dos, notes, reminders, module colours and campus card) stays on your phone. Nothing is sent to us.',
      'To do its job, the app talks directly to your university\'s calendar link, the library\'s page of free seats, and OpenStreetMap for maps. We don\'t see any of that.',
      'The cafés, pubs and clubs on Spots come from our database. The app only reads them, the same list for everyone, and sends nothing about you to get them.'),
    part('With an account',
      'You sign in with Google, or with your email and a password. With Google, Google tells us your name, email address and profile picture. With an email, you give us your first name and email address, and we email you once to confirm the address (and again only if you ask for a new password). Either way you get an account number. We use these only to show who is signed in and to keep your things yours.',
      'Your password is kept by Google\'s Firebase service in a scrambled form. Nobody at Mobile Durham can see it.',
      'While you\'re signed in, your timetable link is backed up to your private area, which only you can read, so your timetable comes back on a new phone. You can switch this off on the account page, which deletes the online copy. Nothing else from your timetable is stored online.',
      'If you use Friends, you get a friend code, and people you give it to can find you by it (there\'s no searching by name or email). Your name for friends (your first name to start with, which you can change) and your list of friends and requests are stored too.'),
    part('What friends can see',
      'When you send someone a request, they can see your timetable straight away. You see theirs once they accept. Cancelling, declining or removing a friend stops it both ways, straight away.',
      'They see your name for friends and your classes for the next 4 weeks: the university\'s names for them, their times and rooms. Never modules you\'ve hidden, your own names for modules, notes, reminders, to-dos, your timetable link, your email or your picture.',
      'Your shared timetable is kept up to date while you have friends or requests, and deleted when you have none.'),
    part('Where it\'s kept',
      'With Google\'s Firebase service, in London. Sign-in, passwords and the emails about your account are handled by Google\'s Firebase.'),
    part('Who can see it',
      'Your private area and timetable link: only you. Your shared timetable: only you and the people described above. The database\'s rules refuse everyone else, and they are tested automatically before every new version of the app. The people who run Mobile Durham could reach the database to fix a problem, but don\'t look at what\'s in it unless the law requires it.'),
    part('What we don\'t do',
      'No adverts, no selling or sharing your data, no tracking of what you do in the app.'),
    part('How long it\'s kept, and deleting it',
      'Until you delete it. Delete my account, on the account page, removes everything stored online straight away (your private area, friend code, friendships, requests and shared timetable) and then your account. What\'s on your phone stays until you remove the app.'),
    part('Your rights',
      'You can ask to see, correct or delete what\'s stored about you, and you can delete it all yourself at any time. If you\'re unhappy with how your data is handled, you can complain to the Information Commissioner\'s Office (ico.org.uk).'),
    el('section', { class: 'privacy-part' }, el('h3', {}, 'Contact'),
      el('p', {}, 'For questions or requests about your data, email ', el('a', { href: `mailto:${CONTACT}` }, CONTACT), '.')),
    ui.hint(`Last updated ${UPDATED}.`, { small: true }));
}
