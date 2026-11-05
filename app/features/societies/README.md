# Societies

Student societies, on the **Explore** tab. The Societies card opens a full-screen window with:

- a **search box** (any word in the name or the short line),
- a switch for each **type** that has societies (All, Sport, Academic, Arts and music, Culture, Faith, Volunteering, Other),
- a card for each society: its photo or logo, name, short line, **when and where it meets**, its **joining fee**, and **Instagram** and **Join** buttons.

With no societies yet, the card says *Coming soon*. Help has two questions in *Around Durham*.

## Where the societies come from

The database's `societies` collection, one document per society. Everyone can read the published ones, signed in or not; nobody can change them from the app (see `firebase/firestore.rules`, tested in `firebase/tests/societies.test.mjs`). They're kept on the phone and fetched again after 12 hours (`FRESH_FOR` in `rules.js`), at most 300 (one read each).

### Adding a society (in the Firebase console)

1. Open https://console.firebase.google.com → **Mobile Durham** → **Firestore Database** → **Data**.
2. The first time only: **+ Start collection**, Collection ID `societies`. After that, click `societies` and **+ Add document**.
3. Leave **Document ID** on *Auto-ID*, add these fields, and click **Save**:

| Field | Type | Needed? | Example |
|---|---|---|---|
| `published` | boolean | yes | `true` (`false` keeps it as a draft nobody sees) |
| `name` | string | yes | `Hiking Society` (up to 60 letters) |
| `type` | string | no | `sport`, `academic`, `arts`, `culture`, `faith`, `volunteering` or `other` (anything else counts as other) |
| `line` | string | no | `Day walks in the Dales, all levels welcome` (up to 140) |
| `meets` | string | no | `Saturdays 8:30am, Market Place` |
| `fee` | string | no | `£5 a year`, `Free` |
| `instagram` | string | no | `@durhamhiking`, or the full https address |
| `join` | string | no | `https://…`, the society's sign-up page (only `https://` links show) |
| `photo` | string | no | a file in `app/features/societies/photos/` (e.g. `hiking.jpg`, comes with the app) or an `https://` address |
| `order` | number | no | `1` comes first; without it, 50; then by name |

People see changes the next time their app asks, within 12 hours.

Committees can keep their own card up to date: the team makes a society code in **Approve changes**, and the committee member types it under **I run a society** on their account page (the society-committee feature). Their changes wait for the team's approval.

## For other features

- Service `societies`: `card(society)` (the card as students see it, with buttons that don't count), `tidy(id, data)` (a database document, tidied like the list), `TYPES`, `typeName(id)`.
- Events: `societies:shown` with the ids drawn in the list, `societies:tapped` with an id when Instagram or Join is tapped (the society-committee feature counts them).

## What it needs

- **Requires:** account (for the connection to the database).
- **Uses if present:** explore (the card; without it there's nowhere to open societies from), help.

## What it saves on the phone

- `saved` → `{ at, list }`: when the societies were last fetched, and the societies (tidied by `toSociety()` in `rules.js`).

## How to check it works

1. Run `python build.py test`, and `npm test` in `firebase/`.
2. Run `python build.py serve --test`, tap **Explore** → **Societies**: four sample societies. Tap **Sport**, and search for "choir".
