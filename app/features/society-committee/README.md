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

The steps are the `card-owners` feature's, the same as for shops; `store.js` says which names a society's things are kept under. Rules in `firebase/firestore.rules`, tested in `firebase/tests/committees.test.mjs`.

| Collection | What | Who can read it |
|---|---|---|
| `societyCodes/{code}` | `{ society, usedBy, made }` | anyone signed in, one code at a time; admins can list |
| `societyOwners/{uid}` | `{ society, code, at }`: the society this account helps run (one at a time) | that person and admins |
| `societyChanges/{society}` | `{ society, by, line, meets, fee, instagram, join, status, at }` | the society's committee and admins |
| `societyStats/{society}_{week}` | `{ society, week, seen, taps }`: totals only, nobody's name | the society's committee and admins |

A committee can also read its own society even while it's a draft (`published: false`), but never change it directly. **Delete my account** removes the person's `societyOwners` link (in `account/rules.js`), the code they used and a change they sent that's still waiting (`removeAll` in the card-owners feature's `store.js`, through `account.cleanup`). The privacy notice describes all of it.

**Counting:** on students' phones, when a society comes on screen in the Societies list (`societies:shown`) and when someone taps Instagram or Join (`societies:tapped`), each society is counted once a day per phone (the card-owners feature's `counter`). Not in the business version, and never in test builds (`no-count`, set by `app/tests/seed.js`).

## What it shares with shops

Codes, changes waiting for approval, the weekly counts, the four bars, the code box and its Approve changes parts are the `card-owners` feature's, shared with `shop`. What's the society's own: its fields and their checks (`rules.js`), its words, the card as students see it, and the Your society window.

## What it needs

- **Requires:** account, card-owners.
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
