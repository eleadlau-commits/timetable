# Account

Your **account page**. For now nobody can sign in; signing in with Google (through Firebase) comes next, then backing up your things and seeing friends' timetables.

## What it adds

- **The account page** (Folio's `account` slot): it opens from the person button at the top right and from **Account** in the menu, as a full-screen pop-up. Until you're signed in it shows:
  - a large person icon and *Not signed in*
  - what an account is for (backing up your to-dos, notes and module colours, and seeing your friends' timetables), and that **Mobile Durham is made by students and isn't affiliated with Durham University**
  - a **Sign in with Google** button, which says *Signing in is coming soon*
  - a note that everything works without an account, and your things stay on the phone
- **The menu's top line** shows the signed-in person's name instead of *Not signed in*, once signing in works.

## What it needs

- **Requires:** nothing.

## What it saves on the phone

Nothing yet.

## How to check it works

1. Run `python build.py serve --test` and open the app.
2. Tap the person button at the top right: the account page fills the screen. Tap **Sign in with Google**: a message says it's coming soon.
3. Open the menu (top left) and tap **Account**: the same page opens.
4. Delete this folder and build again: the account button and the Account row say *Account is coming soon*, as before.
5. Run `python build.py test`.
