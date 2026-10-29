# Friends

Swap timetables with friends. The **Friends** button (two people) in the top bar opens it.

## How it works

- **Your friend code** (like `MD-7K3Q-9P2X`), with **Share** and **Show QR code**. There's no searching for people by name or email: you need someone's code. The QR code is a link that opens the app's web version with **Add a friend** filled in (`#friend=MD-…`).
- **Add a friend:** type their code (any case, with or without dashes) → **Find** shows their name → **Send request**, after it says plainly that this lets them see your timetable straight away.
- **Asking you:** **Accept** or **Decline**. Tap the person to see their timetable first: you can already see theirs, because asking shares.
- **Friends:** each with **Free** or **Busy** right now (e.g. *In MATH2031 Lecture until 11:00*, *Free until 14:00*). Tap one to see their timetable.
- **Waiting for them:** your requests, with **Cancel**.
- **Your name for friends:** your first name to start with (from Google, or the name you gave when creating an email account); **Change** it on the Friends page. It's updated everywhere friends see it.

| | You see theirs? | They see yours? |
|---|---|---|
| You've asked them | No | Yes |
| They've accepted | Yes | Yes |
| Declined, cancelled or removed | No | No |

## A friend's timetable

Their classes for the **next 4 weeks**, day by day, with times and rooms, and **Free together today** (gaps of 30 minutes or more between 09:00 and 18:00 when neither of you has a class). Shown in **grey**, or a tint you choose for that friend (the **Colour** dots; saved on your phone only). From here you can **Remove** a friend (both stop seeing each other's) or, for someone asking you, **Accept and share mine**.

## What's shared

`rules.js`'s `sharedClasses`: your classes from the start of today for 4 weeks (at most 400), not cancelled, not all-day, **not in modules you've hidden**, with the **university's own names** (not your renames) and rooms. Nothing else: no notes, reminders, to-dos, link, email or picture. It's sent when you open Friends, ask or accept someone, and whenever your timetable or hidden modules change (at most every 12 hours if nothing changed), only while you have friends or requests. With none left, it's deleted.

## Where it's kept

| Database | What | Who can read it |
|---|---|---|
| `users/<you>/private/profile` | your name for friends, code, and people you've asked or accepted (at most 50) | you |
| `codes/<code>` | whose code it is, and their name | anyone signed in who has the code (no listing) |
| `friendships/<a>_<b>` | who asked whom, pending or accepted, both names | the two of you |
| `shared/<you>` | your classes for the next 4 weeks | you, people you've asked, friends |

`firebase/firestore.rules` enforces all of this, including that only the asker can create a request (with a real code belonging to the other person), only the person asked can accept, nobody can change anyone else's name, and nobody can go over 50. `firebase/tests/friends.test.mjs` tests it. `store.js` makes the writes the rules expect. **Delete my account** removes friendships and your code (`account.cleanup`), then your profile and shared timetable (account's `onlineData`). People who removed you are taken off your list next time you open Friends (`stalePeople`).

## What it needs

- **Requires:** `account`. **Uses if present:** `sessions` (your classes, and which modules are hidden). Without sessions you can still see friends' timetables, but don't share your own.

## What it saves on the phone

- `profile`: `{ uid, name, code, people }`, a copy of your online profile.
- `shared`: `{ uid, print, at }`, what was last shared, so it isn't sent again.
- `tints`: `{ [friend]: hue }`, colours you chose for friends' timetables (none means grey).

## How to check it works

1. Run `python build.py test`, and `npm test` in `firebase/` for the rules.
2. Two people (or two browsers) sign in. One opens Friends and shares their code; the other adds it and sends a request. The first sees them under *Asking you* and can open their timetable; **Accept**. Both now see each other under *Friends*.
3. Pick a colour for a friend's timetable. Change your name: the other person sees the new one. Remove the friend: both lists empty.

It was checked end to end with two people against Google's emulators (see `link-backup/README.md` for how): codes, finding by code, the warning before sending, seeing the asker's timetable before accepting, accepting, Free/Busy, grey and tinted timetables, renaming, removing (and the database then refusing), and Delete my account removing the code.
