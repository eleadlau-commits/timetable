# The database rules

Mobile Durham's online data lives in Firebase's database (Firestore, project `mobile-durham`, stored in London). **The rules in `firestore.rules` decide who may read or change what.** Anything they don't allow is refused, even for someone using the app.

They allow:

- **Your private area** (`users/<you>/private/main` and `…/profile`): only you. `main` holds your timetable link (backup); `profile` your name for friends, friend code and the people you've asked or accepted (at most 50).
- **Friend codes** (`codes/<code>`): anyone signed in can look up a code they've been given, but nobody can list them. Only you can make your code, and only the one in your profile.
- **Friendships** (`friendships/<a>_<b>`): only the two people can read one. Only the asker can create it, with a real code belonging to the other person; only the person asked can accept it; each can only change their own name; either can delete it.
- **Shared timetables** (`shared/<you>`): only you can write yours. You, people you've asked, and friends can read it.
- **Places on Spots** (`spots/<place>`): everyone can read the published ones (`published` is `true`), signed in or not, at most 100 at a time. Nobody can change them from the app. The team edits them in the Firebase console, which these rules don't apply to; see `app/features/listings/README.md` for how.

Only Google sign-ins and email sign-ins whose address has been confirmed count, and everything must have exactly the right shape (names of 1–30 characters, links of at most 2,048 starting with `https://` or `webcal://`, times set by Firebase itself). The tests in `tests/` (`rules.test.mjs` for your private area, `friends.test.mjs` for friends, `spots.test.mjs` for the places on Spots) check each of these, including what must be refused.

## Other defences

Without App Check (it waits until the app is on Google Play), anyone could use the app's public settings from their own script, but they'd still be held to these rules: they can only ever touch their own private area. Other layers: only Google sign-ins and confirmed email sign-ins count (so nobody can use a made-up address); the project is on the free plan with no card, so misuse can't cost money (online parts just pause until the next day); every account can be seen, disabled or deleted in Firebase → Authentication. A further step is restricting the two API keys to the website and the Android app in the Google Cloud console.

## Publishing the rules (after they change)

The rules in this folder don't reach Firebase on their own. After a change is merged:

1. Open https://console.firebase.google.com → **Mobile Durham** → **Firestore Database** (under *Databases and storage*) → the **Rules** tab.
2. Select everything in the editor and delete it.
3. Open `firebase/firestore.rules` on GitHub, click the **Copy raw file** button, and paste it into the editor.
4. Click **Publish**.

The Rules tab keeps a history of earlier versions, so you can go back if something goes wrong.

## The tests

`tests/rules.test.mjs` checks the rules against Google's own database emulator: you can use your private area; strangers, people who aren't signed in, other kinds of sign-in and emails that haven't been confirmed can't; and badly shaped data is refused. **GitHub runs them before every release** (the *Database rules* step), and if one fails nothing is released.

To run them on a computer (needs Node.js and Java 21):

```
cd firebase
npm ci
npm test
```

## When something new is stored online

1. Add its rules to `firestore.rules`, and tests for who can and can't use it.
2. Add its path to `onlineData()` in `app/features/account/rules.js`, so *Delete my account* removes it.
3. Update the privacy notice (`app/features/account/privacy.js`) before it's released.
4. After merging, publish the rules as above.
