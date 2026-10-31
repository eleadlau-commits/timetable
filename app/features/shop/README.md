# Shop

For businesses on Spots. The owner of a café, pub or club looks after their own card from the app, in the business version (see the welcome feature), and every change waits for the Mobile Durham team's approval before students see it.

## What it adds

**For owners (the business version):**

- **Set up your business** (opens after choosing *I run a business*, or from Home): 1. sign in or create an account (the account page), 2. type the **shop code** the team gave them, which links the account to the place. No code? **Ask to be listed** sends the name, kind, address, a phone number or email, and the card's details to the team. 3. Done.
- **Home** (business version): a *Your shop* page at the top (what's happening, and Edit card), and three widgets: **My card** (the card exactly as Spots shows it, with a *Live*, *Waiting* or *Not live* tag), **This week** (how many phones saw the card on Spots, and tapped its Website or Menu, plus last week's) and **My deal**. Before setting up, My card says *Set up your shop*.
- **Edit your card**: short line, student deal and its last day, opening hours, website and menu link. *Send for approval* stores it as a change waiting for approval; students keep seeing the card as it was. While it waits, the owner can send a new version or withdraw it. A rejected change says so.
- **Account page**: a *Your business* section (which place, Edit card).
- **Help**: three questions in *For businesses*.

**For the team (admins):**

- **Approve changes** in the menu (with how many are waiting), for accounts in the database's `admins` collection:
  - **Changes**: each change, showing what's on the card now (crossed out) and what it becomes. *Approve* puts it on the card (students see it within 6 hours, when their app next fetches places); *Reject* leaves the card as it is.
  - **Asking to be listed**: *Approve* adds the place to Spots, published, with the business as its owner; *Reject* tells them it wasn't accepted.
  - **Shop codes**: pick a place and tap *Make code* to get a code such as `K7QM-2XPA` to write down for the owner. Each code works once. The list shows every code and whether it's been used; unused ones can be deleted.

**On every student's phone:** when Spots shows a place (in Student deals or a list), or someone taps its Website or Menu, it adds one to that place's count for the week, at most once a day per place on each phone. Only the totals are stored.

## Making yourself an admin (once)

1. Sign in to the app with the account you want to approve changes with.
2. Open https://console.firebase.google.com → **Mobile Durham** → **Authentication** → **Users**, and copy that account's **User UID**.
3. Go to **Firestore Database** → **Data** → **+ Start collection**, Collection ID `admins`. Document ID: paste the User UID. Add any field (e.g. `name`, string, your name) and **Save**. (Next time: click `admins` → **+ Add document**.)
4. Close and reopen the app: **Approve changes** is in the menu.

To add a teammate as a second approver, do the same with their User UID. To remove one, delete their document.

## What's stored online

See `store.js` for the details and `firebase/firestore.rules` for who may do what (tested in `firebase/tests/shops.test.mjs`):

| Where | What | Who can see it |
|---|---|---|
| `admins/{uid}` | made by hand in the console | each person, only their own |
| `shopCodes/{code}` | `place`, `usedBy`, `made` | anyone signed in who knows the code; admins list them |
| `shopOwners/{uid}` | `place`, `code`, `at` | the owner and admins |
| `spotChanges/{place}` | the card's parts, `by`, `status` (`waiting`, `approved`, `rejected`), `at` | the owner and admins |
| `spotRequests/{uid}` | the place's name, kind, address, `contact`, the card's parts, `status`, `at` | the business and admins |
| `spotStats/{place}_{week}` | `seen`, `taps` (totals only) | the owner and admins; anyone can add one |

Delete my account removes `shopOwners` and `spotRequests` (in `account/rules.js`'s `onlineData()`), and this feature's `account.cleanup` removes the waiting change and the used code first. The place's public card and its counts stay, as they belong to the place.

## What it needs

- **Requires:** account.
- **Uses if present:** welcome (the business version), home (its widgets and page), spots (to draw the owner's card as students see it), help.

## What it saves on the phone

- `mine` → `{ place, card, change, stats, at }`: the owner's place, its card, a change sent for approval and the week's counts, so Home shows them straight away.
- `admin` → `true` if this account approves changes.
- `counted` → `{ day, seen: [ids], taps: [ids] }`: what this phone counted today.
- `no-count` → `true` in test builds (set by `app/tests/seed.js`), so the tests never count.

## How to check it works

1. Run `python build.py test`, and `npm test` in `firebase/` for the database rules.
2. Run `python build.py serve`, open it in a private window and choose **I run a business**: Home shows *Set up your shop* and the steps open.
3. With a real account (and the new rules published): make yourself an admin (above), make a code for a place, use it from another account in the business version, edit the card, and approve the change.
