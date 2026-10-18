# Link backup

While you're signed in, your **timetable link is saved to your private area online**, which only you can read. On a new phone, sign in and your timetable comes back.

## What it adds

- **Backup on the account page** (`account.sections`, when signed in): a **Back up my timetable link** switch (on to start with) and what's happening: *Saved to your account just now*, *Not saved yet*, *Off*, or that a timetable added from a file has no link to back up. Switching it off **deletes the online copy**. On a phone with no timetable there's a **Bring back my timetable** button.
- **A line on the setup screen** (`timetable.setup`): signed in, **Bring back my timetable**; signed out, **Sign in** (opens the account page) for people who used the app on another phone.

## When it saves and brings back

- **Saves** when you sign in, whenever the timetable's link changes, and when the app starts or comes back online if the last save didn't happen. Only a timetable loaded from a link (`https://…`), not one imported from a file.
- **Brings back automatically only right after you sign in on a phone with no timetable.** Otherwise removing your timetable would bring it straight back. Any other time, use **Bring back my timetable**.
- **Signing out** forgets on the phone what was saved, so the next account starts fresh. **Delete my account** (account feature) deletes the private area.

## Where it's kept

`users/<your account>/private/main` in Firestore, as `{ link, updatedAt }`. The rules in `firebase/firestore.rules` let only you read, change or delete it, and only in that shape. Rules in `rules.js` (where, whether it's already saved, what counts as a link) are tested in `tests/rules.test.js`.

## What it needs

- **Requires:** `account` (sign-in and the database) and `timetable` (the link). Without either, it's left out and nothing else changes.

## What it saves on the phone

- `on`: `false` if backup is switched off.
- `saved`: `{ uid, link, at }`, what was last saved online, so it isn't saved again.

## How to check it works

1. Sign in on the account page with a timetable loaded from a link: Backup says *Saved to your account just now*.
2. In Settings, remove the timetable: the setup screen shows, with **Bring back my timetable**. Tap it: the timetable comes back.
3. Switch backup off: it says *Off*, and the online copy is gone (Firebase console → Firestore Database → Data).
4. Run `python build.py test`.

It was checked end to end against Google's sign-in and database emulators: saving after sign-in, switching off and on, not coming back by itself after removing the timetable, bringing it back, and Delete my account removing it. For such tests, a page can set `window.FOLIO_FIREBASE_EMULATOR = { auth: 'http://127.0.0.1:9099', firestore: ['127.0.0.1', 8080] }` before the app starts (see `account/firebase.js`), with the emulators running from `firebase/` (`npx firebase emulators:start --only auth,firestore --project mobile-durham`).
