# Your society

For **society committees**. Committee members are students, so they stay in the student version of the app; this feature lets them look after their society's card on **Explore → Societies**, the same way a shop looks after its card on Spots.

## What people see

- **On the account page** (signed in, student version): a **Societies** part with **I run a society**. It asks for the **society code** the team gave them, which links their account to the society. Once linked, the part says *You help run Hiking Society*, with **Open Your society** and **Stop looking after it** (for handing over to next year's committee).
- **Your society**, a full-screen window built from the same card frame as the business version's Your shop tab (the storefront feature's `storefront` service):
  - **Your society on Explore**: the card exactly as students see it, tagged *Live*, *Being checked* or *Not on Explore*, with **Change details**.
  - **How it's going**: four weeks of how many students saw the society in the list, as bars, and one sentence (also how many tapped Instagram or Join).
- **Change details**: short line, when and where you meet, joining fee, Instagram (typed as `@account`) and join link. **Send to be checked** sends it to the team; until it's approved, students see the card as it was. A waiting change can be withdrawn. The name and photo are changed by the team (people are asked to email).
- **A Your society widget** people can add to Home (wide or tall, off until added): the society's name, its tag, and how many saw it this week.
- **Help**: *How do I keep my society's card up to date?* in *Around Durham*.

## For the team

In the shop feature's **Approve changes** window (its `approve.parts` slot), two more parts:

- **Society changes**: each change, with what's on the card now (struck through) and what it would become. **Approve** puts it on the society's card; students see it within 12 hours (the societies feature's `FRESH_FOR`). **Reject** leaves the card.
- **Society codes**: pick a society (drafts too) and **Make code**. Make one for each committee member; each code works once, for one account. **Delete** an unused code to stop it working; **Remove** a used one to also stop that person looking after the society.

Without the shop feature there's no Approve changes window, so changes can only be approved in the Firebase console.

## What's stored online

All in `store.js`; rules in `firebase/firestore.rules`, tested in `firebase/tests/committees.test.mjs`.

| Collection | What | Who can read it |
|---|---|---|
| `societyCodes/{code}` | `{ society, usedBy, made }` | anyone signed in, one code at a time; admins can list |
| `societyOwners/{uid}` | `{ society, code, at }`: the society this account helps run (one at a time) | that person and admins |
| `societyChanges/{society}` | `{ society, by, line, meets, fee, instagram, join, status, at }` | the society's committee and admins |
| `societyStats/{society}_{week}` | `{ society, week, seen, taps }`: totals only, nobody's name | the society's committee and admins |

A committee can also read its own society even while it's a draft (`published: false`), but never change it directly. **Delete my account** removes the person's `societyOwners` link (in `account/rules.js`), the code they used and a change they sent that's still waiting (`removeAll` in `store.js`, through `account.cleanup`). The privacy notice describes all of it.

**Counting:** on students' phones, when the Societies list shows societies (`societies:shown`) and when someone taps Instagram or Join (`societies:tapped`), each society is counted once a day per phone (`toCount` in `rules.js`). Not in the business version, and never in test builds (`no-count`, set by `app/tests/seed.js`).

## What repeats the shop feature (for step 3)

These are nearly the same as in `shop`, and are what step 3 of the plan pulls out into one shared piece: the codes (`makeCode`, `cleanCode`, `showCode`), `cleanLink`, the weeks and counts (`weekOf`, `weeksBack`, `trend`, `toCount`), `setupStep`, the store functions (use a code, send/withdraw a change, approve/reject, counts, codes), the Approve changes parts (`approve.js`), the four-week bars, the code window and the change form, the "being checked" notes, `explain()` for errors, the styles for all of these, and the database rules (codes, owners, changes and stats are the same rules with other names). Only the fields, their checks, the words and the student-facing card are the society's own.

## What it needs

- **Requires:** account.
- **Uses if present:** societies (the card as students see it, and the events it counts; without it the window shows just the name), storefront (the card frame; without it, plain cards), shop (the Approve changes window), welcome (nothing in the business version), home (the widget), help.

## What it saves on the phone

- `mine` → `{ society, code, card, change, stats, at }`: the society, its card, a change sent for approval and the counts, so Your society shows straight away.
- `counted` → `{ day, seen, taps }`: which societies this phone counted today.
- `no-count` → true in test builds.

## How to check it works

1. Run `python build.py test`, and `npm test` in `firebase/`.
2. In the Firebase console, add a society (see the societies README), then sign in as an admin, open **Approve changes** in the menu and make a society code for it.
3. Sign in with another account, open the account page, tap **I run a society** and type the code. **Your society** opens. Tap **Change details**, change the fee and send it.
4. Back as the admin, **Approve changes** shows the change under *Society changes*. Approve it; the fee shows on Explore → Societies within 12 hours (or straight away after clearing the app's saved copy).
