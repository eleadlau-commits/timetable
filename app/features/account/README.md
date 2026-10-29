# Account

Your **account page**, and signing in through Firebase (project `mobile-durham`) with **Google** or with an **email and password**, with a **privacy notice**. Backup (`link-backup`) and Friends (`friends`) store things online for signed-in people. The database's rules are in `firebase/` at the top of the repository.

## What it adds

- **The account page** (Folio's `account` slot): it opens from the person button at the top right and from **Account** in the menu, as a full-screen pop-up.
  - **Signed out:** a large person icon, *Not signed in*, what an account is for, that **Mobile Durham is made by students and isn't affiliated with Durham University**, a **Sign in with Google** button, then *or with your email* and the email form. Google's sign-in window opens and, once you've chosen your account, the page shows you as signed in. A note says everything works without an account.
  - **The email form** has three parts, switched with the links under it:
    - **Sign in:** Email, Password, **Sign in**; links *Forgot password?* and *New here? Create an account*.
    - **Create an account:** Your first name (friends see it; up to 30 letters), Email, Password (at least 8 characters, no spaces at either end), **Create account**. Firebase then emails a link to confirm the address.
    - **Forgot password:** Email, **Send the link**. It always says *If there's an account with that email, we've sent it a link*, so nobody can find out who has an account. The link opens Firebase's own page to choose a new password.
    - Wrong email or password says only *That email and password don't match* (it doesn't say which). An email that already has an account (for example one made with Google) says to sign in that way instead.
  - **Signed in:** your Google picture (or the person icon), name and email, *Signed in with Google* or *Signed in with your email*. Until an email account's address is confirmed, a **Confirm your email** box says backup and friends don't work yet, with **I've confirmed it** (asks Firebase again) and **Send it again**. Then then other features' parts (slot `account.sections`: **Backup** from `link-backup`, **Friends** from `friends`), **Sign out**, and **Delete my account** (asks first; deletes everything you've stored online, listed by `onlineData()` in `rules.js`, then your account; if Firebase wants you to sign in again first, Google's sign-in opens, or for an email account it asks for your password). The not-affiliated line is at the bottom.
  - **Privacy notice** (a link on both): what's stored, where, who can see it, how to delete it, your rights, and the contact address (`CONTACT` in `privacy.js`: mobiledurham.help@gmail.com). In `privacy.js`; update it, and its date, before anything new is stored online.
  - Problems are explained in plain words under the button: offline, the Google window was blocked, couldn't reach Google. Closing the Google window yourself says nothing.
- **The menu's top line** shows your name instead of *Not signed in*.
- **In the Android app**, the same button uses Google's own Android sign-in (the account chooser that slides up from the bottom), because Google doesn't allow its sign-in window inside apps. What it returns signs in to Firebase just like the web version, so everything after that is the same.

## Why an email has to be confirmed

Anyone could type someone else's address, or a made-up one. So the database's rules (`firebase/firestore.rules`) only let an email account in once Firebase says its address is confirmed, and `database()` refuses with `unverified` before that (Friends explains it; Backup waits). Firebase only notices the confirmation when asked, so the app asks again (`reload()`, then a fresh pass with `getIdToken(true)`) when **I've confirmed it** is tapped and whenever something needs the database. Passwords are kept by Firebase, scrambled; the app never saves them, and clears the box after signing in.

## How it works

- `firebase-config.js`: which Firebase project to use. It isn't a password; it only names the project, and it's in every copy of the app anyway. What keeps data safe are the project's **security rules**. The database is still fully locked, since nothing is stored there yet; its rules come with Backup.
- `firebase.js`: loads Firebase's code (`firebase-app-compat.js`, `firebase-auth-compat.js`, and `firebase-firestore-compat.js` for the database when it's needed, version 12.19.0) from jsDelivr the first time it's needed. The page starts loading it as soon as it opens while you're signed out, so tapping the button opens Google's window straight away (browsers block windows that open after a wait). The button says *Getting ready…* until then.
- **No App Check yet.** App Check would let Firebase turn away requests that don't come from the real app. Firebase now needs Google Cloud's Fraud Defense (reCAPTCHA Enterprise) for the web and Play Integrity for Android, and Play Integrity only accepts apps installed from Google Play; ours comes from GitHub. So it waits until the app is on Google Play, when it can be enforced for both. Until then the database rules are the protection (see `firebase/README.md`).
- `rules.js`: what the app keeps about you (`toUser`, including `via`, how you signed in, and `verified`), the checks for Create account (`checkNewAccount`, `checkEmail`, `checkPassword`), the plain-words explanations (`explain`), including the Android sign-in's own messages, and everything stored online (`onlineData`). Tested in `tests/rules.test.js`.
- **Android:** the [Capacitor Firebase Authentication](https://github.com/capawesome-team/capacitor-firebase/tree/main/packages/authentication) plugin (`@capacitor-firebase/authentication`, in `feature.json`) with `skipNativeAuth`, so it only gets Google's sign-in and the app's Firebase code (the same as the web version) does the rest. `native/google-services.json` (from Firebase: Project settings → Your apps → Mobile Durham Android) is copied into the Android project, and `rgcfaIncludeGoogle = true` switches on the plugin's Google part (Folio's `native.android.files` and `native.android.gradle`). Like the web config, google-services.json isn't a password. If it's downloaded again, replace the file here.
- If you were signed in before, the app checks with Firebase in the background when it starts, and signs you out on the phone if Firebase says you aren't any more (for example, you deleted the account elsewhere).

## What it offers other features

- **Service `account`:** `user` (the signed-in person, `{ uid, name, email, photo, via, verified }`, or `null`; `via` is `google` or `email`), `database()` (Firebase's database once Firebase knows who's signed in; fails with `signed-out` otherwise, and with `unverified` for an email account that isn't confirmed yet), `publicDatabase()` (the database without needing anyone signed in, for what the rules let everyone read, such as the places on Spots), `serverTime()` (the database's own clock, for `updatedAt`), `open()` and `redraw()` (the account page).
- **Slot `account.sections`:** parts of the signed-in account page, under your name. Item: `{ order, render(user) → element or null }`. Link backup adds **Backup**, Friends adds **Friends**.
- **Slot `account.cleanup`:** online data other features keep that **Delete my account** must remove first. Item: `{ order, remove(db, uid) → Promise }`. Friends removes your friendships and friend code. Then `onlineData()` (your private area and shared timetable) goes, then the account.
- `fields` on the service: Firestore's `FieldValue` (`arrayUnion`, `arrayRemove`), once `database()` has run.
- **Event `account:changed`:** sent with the user (or `null`) when someone signs in or out.

## What it needs

- **Requires:** nothing.
- **Firebase setup:** Google sign-in and **Email/Password** switched on (Authentication → Sign-in method; leave *Email link* off), and `eleadlau-commits.github.io` in Authentication → Settings → Authorized domains (`localhost` is there already; the Android app uses it too). The Android app registered as `io.github.timetable.app` with the signing key's fingerprints: SHA-1 `4E:15:5B:38:BE:E5:DA:BA:FF:5F:CA:38:F5:0C:F3:66:8C:A2:13:05` and SHA-256 `F7:6E:03:22:8B:C7:62:D6:F1:02:68:B1:95:DE:4E:DD:76:05:45:CA:0D:71:F1:28:BB:A8:B4:70:74:E7:5A:AF`. Without the SHA-1, Google refuses Android sign-in and the app says sign-in *isn't set up for this version of the app yet*.

## What it saves on the phone

- `user`: `{ uid, name, email, photo, via, verified }` of the signed-in person (older saves have no `via`, which means Google), so your name shows straight away and offline. Removed when you sign out or delete the account. Firebase also keeps its own sign-in in the browser's storage.

## How to check it works

1. **Web:** run `python build.py serve` and open http://localhost:8000 in a normal browser.
2. Tap the person button at the top right. Tap **Sign in with Google**, choose your account: the page shows your picture, name and email, and the menu shows your name.
3. Reload the page: you're still signed in.
4. Tap **Sign out**: the page says *Not signed in*.
5. **Email:** tap *New here? Create an account*, fill it in and tap **Create account**. You're signed in, with the **Confirm your email** box. Open the email, tap the link, come back and tap **I've confirmed it**: the box goes. Sign out, then sign in with the email and password. Try *Forgot password?* too.
6. **Android:** install the APK from GitHub's Releases, open the account page and tap **Sign in with Google**: Google's account chooser slides up. Pick your account: the page shows you signed in.
7. Run `python build.py test`.

## Help

Adds its questions to Help (`help.questions`): *Do I need an account?*, *How do I sign in?*, *I've forgotten my password*, *Why do I need to confirm my email?*, *How do I delete my account?*, and *What do you do with my data?* (with a button that opens the privacy notice).
