# Looking after a card

What shops and societies share for looking after their own card, written (and tested) once. A café looks after its card on Spots, and a society's committee looks after its card on Explore, in the same way:

1. The team gives them a **code**, which links their account to the card.
2. They send **changes**, which wait until the team approves or rejects them in **Approve changes**.
3. They see **How it's going**: four weeks of how many phones showed their card, and tapped its buttons, counted once a day per phone without knowing who.

This feature shows nothing by itself. It offers the `cardOwners` service, which the `shop` and `society-committee` features use. A third kind of card (for example Students' Union events) can use it too, and gets codes, approvals and counts almost for free: it only needs its own fields, words and screens.

## What it offers

The `cardOwners` service:

| Part | What |
|---|---|
| `store(config)` | The database steps for one kind of card (use a code, leave, send or withdraw a change, the counts, Delete my account, and for the team: changes waiting, approve, reject, every card, make and remove codes). `config` gives the names that kind keeps its things under, so nothing stored ever moves. See the top of `store.js`. |
| `isAdmin(db, uid)` | Whether this account approves changes (`admins/{uid}`, made by hand in the Firebase console). |
| `makeCode()`, `cleanCode(text)`, `showCode(code)` | Codes like `K7QM-2XPA`: 8 letters and numbers, without I, O, 0 or 1. |
| `weekOf()`, `weeksBack(n)`, `trend(stats, weeks)`, `trendSentence(points, words)`, `toCount(record, kind, ids)` | The weeks (starting on Monday), the bars' numbers, the sentence under them, and once-a-day counting. |
| `counter(feature, store, { skip })` | A `count(kind, ids)` function that counts on students' phones. What's been counted today stays in the calling feature's own saved data (`counted`), as before; test builds never count (`no-count`). |
| `explain(err)` | What went wrong, in plain words. |
| `bars(points)`, `codeField({ id, label, noun, use })`, `diffList(rows)`, `approveButtons(...)` | Screen pieces: the four bars, the box for typing a code with its Link button, and the pieces of Approve changes. |
| `new Approvals(feature, store, { differences, words })` | One kind of card's parts of Approve changes: the changes waiting (what's on the card now, and what it would become) and making codes. The shop's own window uses it, and so does the Societies part. |

Checking what people type uses Folio's `check.form()` (each kind keeps its own fields and their checks).

## Which names each kind uses

| | Shops (`shop`) | Societies (`society-committee`) |
|---|---|---|
| The cards | `spots` | `societies` |
| Codes | `shopCodes` | `societyCodes` |
| Who looks after what | `shopOwners` | `societyOwners` |
| Changes waiting | `spotChanges` | `societyChanges` |
| Counts | `spotStats` | `societyStats` |
| The card's id is called | `place` | `society` |
| A used code can be removed | no | yes (it also unlinks the person) |

These are the names the database has always used; its rules (`firebase/firestore.rules`) are unchanged.

## What it needs

- **Requires:** account. Without this feature, `shop` and `society-committee` are left out too (they require it).
- **Uses if present:** none.

## What it saves on the phone

- Nothing of its own.

## How to check it works

1. Run `python build.py test`: `tests/rules.test.js` checks the codes, weeks and counts, and `tests/store.test.js` runs every database step against a stand-in database and checks each kind keeps its own names.
2. Run `python build.py serve --test`, sign in with an account in `admins`, and open **Approve changes** from the menu: shop changes, requests, shop codes, then society changes and society codes.
