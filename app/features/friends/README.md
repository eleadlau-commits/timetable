# Friends

Swap timetables with friends. The **Friends** button (two people) in the top bar opens it.

## How it works

- **Your friend code** (like `MD-7K3Q-9P2X`), with **Send invite** and **Show my QR code**. There's no searching for people by name or email: you need someone's code, invite or QR code.
- **The invite link and the QR code** are the same link, `https://eleadlau-commits.github.io/timetable/#friend=MD-…` (`WEB_ADDRESS` in `rules.js`): it opens the web version with **Add a friend** filled in. It always points at the web version, because inside the phone apps the page's own address is `localhost`, which meant old QR codes only worked on the phone that showed them. If you're not signed in, the code is kept (`invite`) and Add a friend opens once you are. The QR code is black on a white border in dark mode too, so cameras can read it. **Send invite** uses the phone's share menu (WhatsApp, Messages…), or copies the link.
- **Add a friend:** **Scan their QR code** (the camera, inside the app: the phone's own QR reader where there is one, otherwise jsQR, downloaded the first time; `scanner.js`), or type their code or paste their invite link (any case, with or without dashes; `codeFrom` finds the code in a link or message) → **Find** shows their name → choose **Everything** or **Only free or busy** → **Send request**, after it says plainly that this lets them see your timetable straight away.
- Tapping an invite link in WhatsApp opens the web version, not the phone app (that needs app links, which need files on the website's root; maybe later). In the app, scanning or pasting the link does the same.
- **Asking you:** **Accept** or **Decline**. Tap the person to see their timetable first: you can already see theirs, because asking shares.
- **Friends:** each with **Free** or **Busy** right now (e.g. *In MATH2031 Lecture until 11:00*, *Free until 14:00*). Tap one to see their timetable.
- **Waiting for them:** your requests, with **Cancel**.
- **Your name for friends:** your first name to start with (from Google, or the name you gave when creating an email account); **Change** it on the Friends page. It's updated everywhere friends see it.
- **What each person sees:** tap someone, then **Everything** (your classes, times and rooms) or **Only free or busy** (just the times you're busy, joined together, without what or where). It works for requests too, before you accept.
- **Share my timetable** (at the bottom): switch it off to pause sharing with everyone. Friends see *Has paused sharing* until you switch it back on.

## Groups

**Groups** (on the Friends page, under your friends): **New group**, a name (up to 30 letters) and who's in it (friends only). Open one to see **When you're all free** for the next 7 days (09:00–18:00, at least 30 minutes, from everyone's shared classes and your own classes and events; anyone not sharing, or paused, is left out and named), **Show in the Planner** (its first 4 people), **Change** and **Delete**. Groups are saved on this phone only (`groups`), and nobody is told they're in one. Up to 20.

## Friends in the Planner

The two-people button next to the Planner's level switch (`planner.buttons`, with how many are shown) opens **Friends in the Planner**: tick up to 4 friends (`MAX_SHOWN`), or tap a group; **Pin** keeps a friend at the top; a search box appears with more than 6 friends; **Clear** hides them all. Their classes are added through Sessions' `session.others` slot, so they show **only in the Day and Week views**, faint with a dashed edge, named "Sam · MATH1001 Lecture" (or "Sam · Busy" for friends who share only free or busy), in the friend's tint or, without one, the next of `PLANNER_HUES`. They never count as yours: not in Up next, reminders, calendar dots or Free together, hiding a module doesn't hide them, and the details window leaves out notes, reminders and the module button. The shown friends' classes are kept on the phone (`overlay`), refreshed whenever friends are loaded.

## The Home widget

**Friends**, on Home as the app comes (wide; tall too), for students. It shows how many friends are free right now and their faces with a green (free) or orange (busy) dot; tall, a list with *Free till 14:00* or *Busy till 11:00*. Tap it to open Friends. It works from what was last loaded (`circle`: your friends' next two days), and loads friends again in the background when the app opens or comes back, at most every 20 minutes, only for people who have opened Friends before (so it never makes a friend code by itself). Signed out, or with no friends yet, it says so.

| | You see theirs? | They see yours? |
|---|---|---|
| You've asked them | No | Yes |
| They've accepted | Yes | Yes |
| Declined, cancelled or removed | No | No |

"Sees yours" means your classes, or only when you're busy if you chose that for them.

## A friend's timetable

Their classes for the **next 4 weeks**, day by day, with times and rooms, and **Free together today** (gaps of 30 minutes or more between 09:00 and 18:00 when neither of you has a class). Shown in **grey**, or a tint you choose for that friend (the **Colour** dots; saved on your phone only). From here you can **Remove** a friend (both stop seeing each other's) or, for someone asking you, **Accept and share mine**.

## What's shared

`rules.js`'s `sharedClasses`: your classes from the start of today for 4 weeks (at most 400), not cancelled, not all-day, **not in modules you've hidden**, with the **university's own names** (not your renames) and rooms. Nothing else: no notes, reminders, to-dos, link, email or picture. A second copy has only the busy times (`busyTimes`), for people who see only free or busy. Both are sent when you open Friends, ask or accept someone, and whenever your timetable or hidden modules change (at most every 12 hours if nothing changed), only while you have friends or requests. With none left, they're deleted. Paused, both are sent empty with `paused: true`.

## Where it's kept

| Database | What | Who can read it |
|---|---|---|
| `users/<you>/private/profile` | your name for friends, code, people you've asked or accepted (at most 50), and whether you've paused | you |
| `codes/<code>` | whose code it is, and their name | anyone signed in who has the code (no listing) |
| `friendships/<a>_<b>` | who asked whom, pending or accepted, both names, and `busyOnly`: who shares only free or busy with the other | the two of you |
| `shared/<you>` | your classes for the next 4 weeks | you, people you've asked, friends, except those you share only free or busy with |
| `busy/<you>` | only the times you're busy, for the next 4 weeks | you, people you've asked, friends |

`firebase/firestore.rules` enforces all of this, including that each person can only put themselves on `busyOnly` or take themselves off, that only the asker can create a request (with a real code belonging to the other person), only the person asked can accept, nobody can change anyone else's name, and nobody can go over 50. `firebase/tests/friends.test.mjs` tests it. `store.js` makes the writes the rules expect. **Delete my account** removes friendships and your code (`account.cleanup`), then your profile and both shared copies (account's `onlineData`). People who removed you are taken off your list next time you open Friends (`stalePeople`).

## What it needs

- **Phone permissions:** the camera (Android `CAMERA`, iPhone `NSCameraUsageDescription`, shared with the campus card), for scanning QR codes.

- **Requires:** `account`. **Uses if present:** `sessions` (your classes, which modules are hidden, and `session.others` for the Planner), `planner` (its button). Without sessions you can still see friends' timetables, but don't share your own.

## What it saves on the phone

- `profile`: `{ uid, name, code, people }`, a copy of your online profile.
- `shared`: `{ uid, print, at }`, what was last shared, so it isn't sent again.
- `tints`: `{ [friend]: hue }`, colours you chose for friends' timetables (none means grey).
- `circle`: `{ uid, at, people: [{ uid, name, classes, paused }] }`, friends' next two days, for the Home widget.
- `invite`: a friend code from an invite link, kept while you sign in.
- `groups`: `[{ id, name, members }]`, your groups.
- `planner`: `{ shown, pinned }`, friends shown in the Planner, and pinned to the top of its list.
- `overlay`: `{ uid, at, people: { [uid]: { name, classes } } }`, the shown friends' classes.
- `profile` also has `paused`.

## How to check it works

1. Run `python build.py test`, and `npm test` in `firebase/` for the rules.
2. Two people (or two browsers) sign in. One opens Friends and shares their code; the other adds it and sends a request. The first sees them under *Asking you* and can open their timetable; **Accept**. Both now see each other under *Friends*.
3. Pick a colour for a friend's timetable. Change your name: the other person sees the new one. Choose **Only free or busy** for them: they see only *Busy* blocks. Switch off **Share my timetable**: they see *Has paused sharing*. Remove the friend: both lists empty.
4. Show your QR code and scan it from the other phone with **Add a friend → Scan their QR code**, or send the invite and open it there.

Version 3 (invites, QR scanning, free or busy, pausing, the Home widget) was checked end to end with four people against Google's emulators: the QR code reads back as the invite link, opening the invite fills in Add a friend, sending a request with Only free or busy, accepting, choosing Only free or busy for a friend (they then see only Busy blocks), pausing (they see Has paused sharing), the scanner opening the camera, and the widget wide and tall. Version 2 was checked end to end with two people against Google's emulators (see `link-backup/README.md` for how): codes, finding by code, the warning before sending, seeing the asker's timetable before accepting, accepting, Free/Busy, grey and tinted timetables, renaming, removing (and the database then refusing), and Delete my account removing the code.
