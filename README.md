# Mobile Durham

**Mobile Durham** (it used to be called *Timetable*) shows your Durham University timetable on your phone, with a to-do list, a study timer, how busy the library is and your campus card. It reads the personal calendar link your university can export, keeps a copy so it works offline, and updates itself whenever you open it.

GitHub builds the app for you, so you don't need to install anything. You get:
- **An Android app** (`MobileDurham.apk`) to download and install.
- **A web version** (GitHub Pages) to add to your home screen. Use this on an iPhone.

## Features

The app has five tabs along the bottom: **Study · Planner · Home · Spots · More**. It opens on Home. Tap a tab, or swipe left or right anywhere on the screen (or on the tab bar) to move to the next one. Pull a full-screen pop-up down to close it. The menu (top left) slides in from the left: it shows who is signed in and when the timetable was last updated, then **Account, Reminders, Settings, Help, About** and **Feedback**. Tap outside it, swipe it away or press back to close it. At the top right, the two-people button opens **Friends** and the person icon opens your **Account** page, where you can sign in with Google (your timetable link is then backed up privately, so it comes back on a new phone) and read the **privacy notice** (what's stored online, who can see it, and how to delete it). Mobile Durham is made by students and isn't affiliated with Durham University. It follows your phone's light or dark setting, or choose **Light** or **Dark** under **Settings → Appearance**.

| Feature | What it does |
|---|---|
| **Home** | At the top, four small pages to swipe between over a photo of Durham: the date and clock; **Plan Today** (how many things are due today, and a button to open the to-do list); **Explore** (opens Spots); and **Plan a journey** (coming soon). Below them, a thin bar showing how busy the library is, all of today's lectures (no scrolling) and your campus card with a **Tap** button. Anything that isn't set up yet shows **Missing content**. |
| **To-do list** | Things to do, with tags (Academic and Society to start with; add, rename or delete your own) and due dates. What's due today is at the top. Sorted by due date, overdue ones in red. Tap the circle to tick one off. Opens from the **Plan Today** page on Home. |
| **Friends** | The two-people button at the top. Give friends your friend code, or add theirs, to swap timetables: when you ask someone they can see yours, and you see theirs once they accept. See who's free right now, when you're both free today, and each friend's next 4 weeks of classes (in grey, or a colour you pick). Remove a friend at any time. Needs signing in. |
| **Planner: Day, Week and Upcoming** | Three ways to see your timetable. Use the date strip or the arrows to move between days or weeks. The round button by the title downloads your timetable again. The **Modules: colours and names** button under the switch lets you rename, recolour or hide modules. |
| **Session details** | Tap any session for its time, room, description and more. |
| **Notes** | Your own notes on a session, e.g. "bring laptop". The first line shows on the card. |
| **Modules** | Rename a module ("ECON1011" → "Microeconomics"), pick its colour, or hide it. |
| **Maps** | Durham room codes show as buildings (`CLC013 · Calman Learning Centre`), with a map and directions. |
| **Reminders** | A notification before each class, plus your own reminders. |
| **Library** | How busy Bill Bryson Library is: a thin bar on Home and a small one on the **Study** tab. Tap it for free seats on each floor. |
| **Study timer** | A card on the **Study** tab: how long you've studied today, your weekly goal and a **Start** button. Build a pattern of study and rest blocks (drag a block's end to change its length, or use *Simple hour*, *Pomodoro* or *Long focus*), repeat it, pick a module and start. A big countdown with **Pause**, **Skip** and **Stop**; it keeps time with the phone locked, and the phone app sends a notification when each block ends. **This week** shows hours per day by module, against your goal and last week. Saved on your phone only. |
| **Campus card** | Scan your card's barcode (camera or photo), or type the number, and show it on your phone if you lose the card. Reads Durham's Telepen barcode as well as the common types. |
| **Link sharing** | A QR code to send your timetable link from a computer to your phone (web version). |
| **More** | Everything else, as cards. For now, the campus card. |
| **Spots** | **Student deals** at the top, then cards for **Cafés**, **Pubs** and **Clubs** around Durham: tap one for its places (name, deal, where it is, website). Kinds with no places yet say coming soon. Places and deals come from the online database, so they change without a new version of the app; the team adds them in the Firebase console (see `app/features/listings/README.md`). The Explore page on Home opens it. |
| **Help and feedback** | In the menu, kept for later. For now they say *coming soon*. |

You can switch any feature off for yourself in **Settings → Features**. Everything you add (notes, to-dos, colours, reminders, the card) stays on your own phone.

## Install it

**Android, from Google Play (for invited testers):** see [The Google Play app](#the-google-play-app) below.

**Android, the APK:**
1. On your phone, open `https://github.com/YOUR-USERNAME/timetable/releases`.
2. Tap **MobileDurham.apk** (older releases call it **Timetable.apk**) and open the downloaded file.
3. Allow installing from this source if asked, then tap **Install**. If Play Protect warns about an unknown app, tap **More details → Install anyway**.

**iPhone, the app (through TestFlight):** once it's set up (see [The iPhone app](#the-iphone-app) below), every upload to `main` sends a new build to Apple's TestFlight.
1. Install **TestFlight** from the App Store.
2. Open the invitation email (or the public TestFlight link) on your iPhone and tap **Accept**, then **Install**.
3. New builds appear in TestFlight; tap **Update**. Each build works for 90 days, so keep updating.

**iPhone (or any phone), using the web version:**
1. *One-off, on GitHub:* go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Open `https://YOUR-USERNAME.github.io/timetable/` in Safari, then tap **Share → Add to Home Screen**.

**Updating:** install a newer APK straight over the old one. Your notes and settings stay.

**One-off, if you installed build 18 or earlier:** those builds were each signed with a different key by mistake, so Android refuses to install a newer one over them ("App not installed"). Uninstall the old app once, then install the newest APK. Uninstalling deletes what was saved on the phone (notes, to-dos, colours, the card), so note down anything you need first. From then on, updates install over the app as normal.

## The iPhone app

GitHub builds the iPhone app on one of its Macs and sends it to TestFlight, so you don't need a Mac. Until the steps below are done, the *iPhone app (TestFlight)* job on the Actions tab just says what's missing; the Android app and website carry on as before.

**One-off setup** (about an hour, with an Apple Developer account):

1. **Register the app's id.** At [developer.apple.com](https://developer.apple.com/account) → **Certificates, IDs & Profiles → Identifiers → +** → **App IDs → App**. Description: *Mobile Durham*. Bundle ID: **Explicit**, `io.github.timetable.app`. Leave the capabilities alone and tap **Register**. *If Apple says the id is taken, pick another, e.g. `io.github.yourname.mobiledurham`, and put it in `app/app.json` under `native.ios.appId`.*
2. **Make the app in App Store Connect.** At [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps → + → New App**: iOS, name *Mobile Durham* (it has to be unique on the App Store; if it's taken, add a word), language English (UK), the bundle id from step 1, and SKU `mobile-durham`.
3. **Make an upload key.** App Store Connect → **Users and Access → Integrations → App Store Connect API → Team Keys → +**. Name it *GitHub* and give it **Admin** access (Xcode needs that to make the signing certificates itself). **Download** the `.p8` file (Apple only lets you download it once) and note the **Key ID** and the **Issuer ID** shown above the list.
4. **Find your Team ID**: developer.apple.com → **Account → Membership details → Team ID** (10 letters and numbers).
5. **Give GitHub the four settings.** On GitHub, the repository → **Settings → Secrets and variables → Actions → New repository secret**, four times:
   - `APPLE_TEAM_ID`: the Team ID.
   - `APP_STORE_CONNECT_KEY_ID`: the Key ID.
   - `APP_STORE_CONNECT_ISSUER_ID`: the Issuer ID.
   - `APP_STORE_CONNECT_KEY`: open the `.p8` file in Notepad (or TextEdit) and paste all of it, including the `BEGIN` and `END` lines.

   These are secrets: never put them in a file in the repository, or in a chat. Keep the `.p8` file somewhere safe.
6. **Add the iPhone app to Firebase** (for signing in). In the [Firebase console](https://console.firebase.google.com) → project *mobile-durham* → **Project settings → Your apps → Add app → Apple (iOS)**. Use the same bundle id, give it the nickname *Mobile Durham iPhone*, and download **GoogleService-Info.plist**. Put it in `app/features/account/native/` (on the GitHub website: open that folder, **Add file → Upload files**). It isn't a password, just like `google-services.json` next to it. Then ask Claude to connect it: the account feature's iPhone settings need a code from inside the file (for Google sign-in to return to the app).
7. **Run it.** Upload to `main`, or press **Run workflow** on the Actions tab and pick a branch to try it first (from a branch, the APK is built but not released, and the website isn't published; those only happen from `main`). The iPhone job takes about 20–30 minutes; then Apple processes the build for a few minutes more and it appears under the app's **TestFlight** tab in App Store Connect.

**Inviting people**, in App Store Connect → the app → **TestFlight**:
- **You** (and anyone in your App Store Connect team): **Internal Testing → +**, add yourself. Builds are ready to install straight away.
- **Friends:** **External Testing → +**, make a group (e.g. *Friends*), add their emails or switch on a **public link**. Apple checks the first build of each version (usually within a day; it asks for a short "what to test" note and a contact email). Later builds of the same version usually go straight through.

## The Google Play app

Every upload to `main` also builds a Google Play version of the Android app and sends it to Google Play's **internal testing** track (Google's version of TestFlight: up to 100 people you invite, no review, ready within minutes). Until the steps below are done, the *Android app (APK)* job on the Actions tab just says what's missing; the APK on Releases carries on as before.

**One-off setup** (an hour or so, plus a few days' wait for Google to check your ID):

1. **Make a Google Play developer account** at [play.google.com/console/signup](https://play.google.com/console/signup). Choose a **personal** account. It costs **$25 once**. Google asks for photo ID, and for you to confirm you have an Android phone (through the Play Console app); the check can take a few days.
2. **Make the app.** In the [Play Console](https://play.google.com/console) → **Create app**: name *Mobile Durham*, default language English (United Kingdom), **App**, **Free**, tick the two declarations, **Create app**.
3. **Give GitHub a password for the upload key.** GitHub signs each Google Play version with an "upload key", which the first build makes and saves in the repository, locked with this password. Make up a long one (at least 20 characters; a password manager can make one) and **also save it in your password manager**. On GitHub, the repository → **Settings → Secrets and variables → Actions → New repository secret**: name `PLAY_UPLOAD_KEY_PASSWORD`, value the password.
4. **Run a build.** Upload to `main` (or press **Run workflow** on the Actions tab, on `main`). When it's finished, the new release on the Releases page has **MobileDurham-GooglePlay.aab** next to the APK. Download it to your computer.
5. **Upload the first version by hand** (Google insists the first one is). Play Console → the app → **Test and release → Testing → Internal testing**:
   - **Testers** tab → **Create email list**, call it *Testers*, add your Gmail address (and friends', if you like) → **Save**, and tick the list.
   - **Create new release**. If it asks about app signing, keep **Use Google-generated key**. Upload the `.aab` file, then **Next → Save and publish** (or **Roll out**).
   - If it first asks you to finish some setup questions (privacy policy, content rating, and so on), do those; Claude can help with the answers.
6. **Let GitHub upload the next versions.** This needs a "service account", a robot Google account that's only allowed to upload test versions:
   1. Open the [Google Cloud console](https://console.cloud.google.com) and pick the project **mobile-durham** at the top (your Firebase project is also a Google Cloud project).
   2. Search for **Google Play Android Developer API** and tap **Enable**.
   3. Go to **IAM & Admin → Service accounts → Create service account**. Name: *github-play-upload*. **Create and continue**, skip the roles, **Done**.
   4. Tap the new account and copy its email (it ends in `iam.gserviceaccount.com`). Then **Keys → Add key → Create new key → JSON → Create**. A file downloads.
   5. In the Play Console → **Users and permissions → Invite new users**. Paste the robot's email. Under **App permissions → Add app**, pick *Mobile Durham* and tick **Release apps to testing tracks**. **Invite user**.
   6. On GitHub, add another secret: name `PLAY_SERVICE_ACCOUNT_JSON`, value: open the downloaded file in Notepad (or TextEdit) and paste all of it. Then delete the file (you can always make a new key).

   These are secrets: never put them in a file in the repository, or in a chat.
7. **Make Google sign-in work in the Google Play version.** Google re-signs the app with its own key, which Firebase doesn't know yet. Play Console → **Test and release → App integrity → App signing**, and copy the **SHA-1** and **SHA-256** of the *App signing key certificate*. In the [Firebase console](https://console.firebase.google.com) → *mobile-durham* → **Project settings → Your apps → Mobile Durham Android → Add fingerprint**, add both. Then download **google-services.json** again there and replace `app/features/account/native/google-services.json` with it (on the GitHub website: open that folder, **Add file → Upload files**).

**Installing it, for you and your testers:** Play Console → **Internal testing → Testers** → **Copy link** ("Join on the web"). Open the link on the phone, tap **Accept**, then **Download it on Google Play**. From then on, every upload to `main` appears as an update in the Play Store a few minutes after the build.

**Switching from the APK:** the Google Play version is signed by Google, so Android won't install it over the APK version. Uninstall the APK version first. That deletes what was saved on the phone (notes, to-dos, colours, the card), so note down anything you need first.

**Going public later:** Google makes new personal accounts run a **closed test** with at least 12 people who stay opted in for 14 days in a row before the app can go public. It also needs a store listing (description, screenshots, a 512×512 icon, a banner), a privacy policy web page, the Data safety form and a web link for deleting an account. Claude can help with all of those.

## Connect your timetable

The app walks you through it the first time:
1. Open your timetable on the university website.
2. Find **Export** or **Subscribe**, and confirm it.
3. Copy the link and paste it into the app.

Keep the link private, because anyone with it can see your timetable.

If the web version says the university's server blocked it, either import the `.ics` file, or set up the free relay described in `app/features/web-relay/extras/README.md`.

## How it's made

The app is built with **Folio**, a small framework where every feature is a folder:

```
app/features/notes/        everything for Notes: code, styles, README, tests
app/features/reminders/    everything for Reminders
…
folio/                     the framework itself (see folio/README.md)
build.py                   the compiler: python build.py
```

Deleting a feature folder removes that feature and nothing else, and the automatic tests check exactly that.

**Adding a feature with Claude:** open this folder in Claude and describe what you want, for example *"Add a feature that shows how long it takes to walk between classes."* Claude reads `CLAUDE.md` and `folio/README.md`, makes a new feature folder, tests it, and tells you which files to upload.

**Commands** (need Python 3.9+, and Chrome or Edge for the tests):

| Command | What it does |
|---|---|
| `python build.py` | Compiles the app into `dist/`, with a report in `dist/report.html`. |
| `python build.py serve --test` | Runs the app on your computer with sample data, at http://localhost:8000. |
| `python build.py test` | Runs every test, including deleting each feature in turn. |
| `python build.py new-feature NAME` | Starts a new feature folder. |
| `python build.py list` | Lists features and what they need. |

**Releasing:** every upload to GitHub runs the tests, then builds the APK and the web version. If a test fails, nothing is released, so a broken version never reaches anyone's phone.

**The `signing` folder on GitHub:** don't delete it. It's what lets new versions install over old ones.
