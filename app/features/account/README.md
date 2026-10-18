# Account

Your **account page**, and signing in with Google through Firebase (project `mobile-durham`), with a **privacy notice**. Nothing is stored online yet: backing up your timetable link and seeing friends' timetables come next. The database's rules are in `firebase/` at the top of the repository.

## What it adds

- **The account page** (Folio's `account` slot): it opens from the person button at the top right and from **Account** in the menu, as a full-screen pop-up.
  - **Signed out:** a large person icon, *Not signed in*, what an account is for, that **Mobile Durham is made by students and isn't affiliated with Durham University**, and a **Sign in with Google** button. Google's sign-in window opens and, once you've chosen your account, the page shows you as signed in. A note says everything works without an account.
  - **Signed in:** your Google picture, name and email, then **Backup** and **Friends** (both *coming soon*), **Sign out**, and **Delete my account** (asks first; deletes everything you've stored online, listed by `onlineData()` in `rules.js`, then your account). The not-affiliated line is at the bottom.
  - **Privacy notice** (a link on both): what's stored, where, who can see it, how to delete it, your rights, and the contact address (`CONTACT` in `privacy.js`: mobiledurham.help@gmail.com). In `privacy.js`; update it, and its date, before anything new is stored online.
  - Problems are explained in plain words under the button: offline, the Google window was blocked, couldn't reach Google. Closing the Google window yourself says nothing.
- **The menu's top line** shows your name instead of *Not signed in*.
- **In the Android app**, the same button uses Google's own Android sign-in (the account chooser that slides up from the bottom), because Google doesn't allow its sign-in window inside apps. What it returns signs in to Firebase just like the web version, so everything after that is the same.

## How it works

- `firebase-config.js`: which Firebase project to use. It isn't a password; it only names the project, and it's in every copy of the app anyway. What keeps data safe are the project's **security rules**. The database is still fully locked, since nothing is stored there yet; its rules come with Backup.
- `firebase.js`: loads Firebase's code (`firebase-app-compat.js`, `firebase-auth-compat.js`, and `firebase-firestore-compat.js` for the database when it's needed, version 12.19.0) from jsDelivr the first time it's needed. The page starts loading it as soon as it opens while you're signed out, so tapping the button opens Google's window straight away (browsers block windows that open after a wait). The button says *Getting ready…* until then.
- **App Check** (web version only): if `APP_CHECK_SITE_KEY` in `firebase-config.js` is set, `firebase-app-check-compat.js` is loaded too and reCAPTCHA v3 vouches that requests come from the real web app. It's **monitor-only** in Firebase: the Android app is installed from GitHub, not Google Play, so it can't pass Google's check (Play Integrity) and enforcing would lock it out. The database rules are the real protection; enforce App Check once the app is on Google Play.
- `rules.js`: what the app keeps about you (`toUser`), the plain-words explanations (`explain`), including the Android sign-in's own messages, and everything stored online (`onlineData`). Tested in `tests/rules.test.js`.
- **Android:** the [Capacitor Firebase Authentication](https://github.com/capawesome-team/capacitor-firebase/tree/main/packages/authentication) plugin (`@capacitor-firebase/authentication`, in `feature.json`) with `skipNativeAuth`, so it only gets Google's sign-in and the app's Firebase code (the same as the web version) does the rest. `native/google-services.json` (from Firebase: Project settings → Your apps → Mobile Durham Android) is copied into the Android project, and `rgcfaIncludeGoogle = true` switches on the plugin's Google part (Folio's `native.android.files` and `native.android.gradle`). Like the web config, google-services.json isn't a password. If it's downloaded again, replace the file here.
- If you were signed in before, the app checks with Firebase in the background when it starts, and signs you out on the phone if Firebase says you aren't any more (for example, you deleted the account elsewhere).

## What it offers other features

- **Service `account`:** `{ user }`, the signed-in person (`{ uid, name, email, photo }`) or `null`.
- **Event `account:changed`:** sent with the user (or `null`) when someone signs in or out.

## What it needs

- **Requires:** nothing.
- **Firebase setup:** Google sign-in switched on (Authentication → Sign-in method), and `eleadlau-commits.github.io` in Authentication → Settings → Authorized domains (`localhost` is there already; the Android app uses it too). The Android app registered as `io.github.timetable.app` with the signing key's fingerprints: SHA-1 `4E:15:5B:38:BE:E5:DA:BA:FF:5F:CA:38:F5:0C:F3:66:8C:A2:13:05` and SHA-256 `F7:6E:03:22:8B:C7:62:D6:F1:02:68:B1:95:DE:4E:DD:76:05:45:CA:0D:71:F1:28:BB:A8:B4:70:74:E7:5A:AF`. Without the SHA-1, Google refuses Android sign-in and the app says sign-in *isn't set up for this version of the app yet*.

## What it saves on the phone

- `user`: `{ uid, name, email, photo }` of the signed-in person, so your name shows straight away and offline. Removed when you sign out or delete the account. Firebase also keeps its own sign-in in the browser's storage.

## How to check it works

1. **Web:** run `python build.py serve` and open http://localhost:8000 in a normal browser.
2. Tap the person button at the top right. Tap **Sign in with Google**, choose your account: the page shows your picture, name and email, and the menu shows your name.
3. Reload the page: you're still signed in.
4. Tap **Sign out**: the page says *Not signed in*.
5. **Android:** install the APK from GitHub's Releases, open the account page and tap **Sign in with Google**: Google's account chooser slides up. Pick your account: the page shows you signed in.
6. Run `python build.py test`.
