# The database rules

Mobile Durham's online data lives in Firebase's database (Firestore, project `mobile-durham`, stored in London). **The rules in `firestore.rules` decide who may read or change what.** Anything they don't allow is refused, even for someone using the app.

Right now they allow one thing: **your own private area** (`users/<your account>/private/main`), which only you can read, change or delete. It holds your timetable link, if you back it up, and when it was last saved. Only Google sign-ins count, and what's saved must have exactly the right shape (a link of at most 2,048 characters starting with `https://` or `webcal://`, and a time set by Firebase itself).

## Other defences

Without App Check (it waits until the app is on Google Play), anyone could use the app's public settings from their own script, but they'd still be held to these rules: they can only ever touch their own private area. Other layers: only Google sign-ins count; the project is on the free plan with no card, so misuse can't cost money (online parts just pause until the next day); every account can be seen, disabled or deleted in Firebase → Authentication. A further step is restricting the two API keys to the website and the Android app in the Google Cloud console.

## Publishing the rules (after they change)

The rules in this folder don't reach Firebase on their own. After a change is merged:

1. Open https://console.firebase.google.com → **Mobile Durham** → **Firestore Database** (under *Databases and storage*) → the **Rules** tab.
2. Select everything in the editor and delete it.
3. Open `firebase/firestore.rules` on GitHub, click the **Copy raw file** button, and paste it into the editor.
4. Click **Publish**.

The Rules tab keeps a history of earlier versions, so you can go back if something goes wrong.

## The tests

`tests/rules.test.mjs` checks the rules against Google's own database emulator: you can use your private area; strangers, people who aren't signed in and non-Google sign-ins can't; and badly shaped data is refused. **GitHub runs them before every release** (the *Database rules* step), and if one fails nothing is released.

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
