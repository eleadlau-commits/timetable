# Account

Your **account page**, and signing in with Google through Firebase (project `mobile-durham`). Nothing is stored online yet: backing up your things and seeing friends' timetables come later.

## What it adds

- **The account page** (Folio's `account` slot): it opens from the person button at the top right and from **Account** in the menu, as a full-screen pop-up.
  - **Signed out:** a large person icon, *Not signed in*, what an account is for, that **Mobile Durham is made by students and isn't affiliated with Durham University**, and a **Sign in with Google** button. Google's sign-in window opens and, once you've chosen your account, the page shows you as signed in. A note says everything works without an account.
  - **Signed in:** your Google picture, name and email, then **Backup** and **Friends** (both *coming soon*), **Sign out**, and **Delete my account** (asks first; deletes your sign-in with Mobile Durham, and since nothing is stored online yet, nothing else). The not-affiliated line is at the bottom.
  - Problems are explained in plain words under the button: offline, the Google window was blocked, couldn't reach Google. Closing the Google window yourself says nothing.
- **The menu's top line** shows your name instead of *Not signed in*.
- **In the Android app** the button is greyed out with *Signing in on the Android app is coming soon*: Google doesn't allow its sign-in window inside apps, so it needs Google's own Android sign-in, which comes next.

## How it works

- `firebase-config.js`: which Firebase project to use. It isn't a password; it only names the project, and it's in every copy of the app anyway. What keeps data safe are the project's **security rules**. The database is still fully locked, since nothing is stored there yet; its rules come with Backup.
- `firebase.js`: loads Firebase's sign-in code (`firebase-app-compat.js` and `firebase-auth-compat.js`, version 12.19.0) from jsDelivr the first time it's needed. The page starts loading it as soon as it opens while you're signed out, so tapping the button opens Google's window straight away (browsers block windows that open after a wait). The button says *Getting ready…* until then.
- `rules.js`: what the app keeps about you (`toUser`) and the plain-words explanations (`explain`). Tested in `tests/rules.test.js`.
- If you were signed in before, the app checks with Firebase in the background when it starts, and signs you out on the phone if Firebase says you aren't any more (for example, you deleted the account elsewhere).

## What it offers other features

- **Service `account`:** `{ user }`, the signed-in person (`{ uid, name, email, photo }`) or `null`.
- **Event `account:changed`:** sent with the user (or `null`) when someone signs in or out.

## What it needs

- **Requires:** nothing.
- **Firebase setup:** Google sign-in switched on (Authentication → Sign-in method), and `eleadlau-commits.github.io` in Authentication → Settings → Authorized domains. `localhost` is there already, for trying it out.

## What it saves on the phone

- `user`: `{ uid, name, email, photo }` of the signed-in person, so your name shows straight away and offline. Removed when you sign out or delete the account. Firebase also keeps its own sign-in in the browser's storage.

## How to check it works

1. Run `python build.py serve` and open http://localhost:8000 in a normal browser (not the Android app).
2. Tap the person button at the top right. Tap **Sign in with Google**, choose your account: the page shows your picture, name and email, and the menu shows your name.
3. Reload the page: you're still signed in.
4. Tap **Sign out**: the page says *Not signed in*.
5. Run `python build.py test`.
