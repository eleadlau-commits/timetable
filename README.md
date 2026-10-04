# Timetable

This app shows your university timetable on your phone. It reads the personal calendar link your university can export, keeps a copy so it works offline, and updates itself whenever you open it.

GitHub builds the app for you, so you don't need to install anything on your computer. You get:

- **an Android app** (`Timetable.apk`) that you download and install, and
- **a web version** (GitHub Pages) that you add to your home screen. Use this on an iPhone.

## Build it on GitHub (one-off, about 10 minutes)

1. **Create a free GitHub account** at <https://github.com/signup> if you don't have one.
2. **Create a repository.** Click **+** (top right), then **New repository**. Name it `timetable`, choose **Public**, and click **Create repository**.
3. **Upload the files.** On the new repository page, click **uploading an existing file**. Unzip the download, open the `timetable-app` folder, select **everything inside it** (including the `.github` folder), and drag it all onto the page. Click **Commit changes**.
4. **Check the build file arrived.** The file list should include a `.github` folder. If it's missing (some browsers skip it), click **Add file → Create new file**, type `.github/workflows/build.yml` as the name, paste in the contents of that file from this folder, and click **Commit changes**.
5. **Wait for the build.** Open the **Actions** tab. A run called *Build app* takes about 5 minutes. A green tick on **Android app (APK)** means it worked.

### Install on Android

1. On your phone, go to `https://github.com/YOUR-USERNAME/timetable/releases`.
2. Tap **Timetable.apk** to download it, then open the downloaded file.
3. If Android asks, allow installing apps from this source (your browser or Files app), then tap **Install**. If Play Protect warns about an unknown app, tap **More details → Install anyway**. It warns because the app didn't come from the Play Store.

### Use on iPhone (or any phone) via the web version

1. In your repository, go to **Settings → Pages**. Under **Source**, choose **GitHub Actions**.
2. Go to **Actions → Build app → Run workflow** and wait for it to finish.
3. On your phone, open `https://YOUR-USERNAME.github.io/timetable/`.
4. **iPhone:** in Safari, tap Share, then **Add to Home Screen**. **Android:** tap ⋮, then **Install app**.

Until you switch Pages on, the *Web version* step in Actions shows a warning. That's expected, and the Android app still builds.

## Connect your timetable

When the app opens for the first time, it walks you through these steps:

1. Open your timetable on the university website and sign in.
2. Find the export option. It might be called *Export*, *Subscribe*, *Sync to calendar*, *iCal* or *Add to Google/Outlook*.
3. **Confirm the export** when it asks. This creates your personal link.
4. Copy the link. It usually starts with `webcal://` or `https://` and often ends in `.ics`.
5. Paste it into the app and tap **Load timetable**.

If you copied the link on a computer, email or message it to yourself and copy it on your phone. The web version also has a **Show QR code for my phone** button. If the export gave you an `.ics` file instead of a link, use **Import .ics file**.

Keep the link private, because anyone who has it can see your timetable. The app stores it only on your phone. The repository holds only the app's code, never your link or timetable.

## If the web version says the server "blocked" it

This only affects the web version, not the Android app. Browsers only let a web page read data from another website if that website allows it, and some university servers don't. You can either import the `.ics` file, or set up the free personal relay in [relay/README.md](relay/README.md).

## Features

- **Day, Week and Upcoming views.** Swipe left or right to move between days or weeks. Tap a day in the week grid to open it.
- **Session details.** Tap any session to see its time, room and description.
- **Notes.** Add your own notes to any session, for example "bring laptop". The first line shows on the card.
- **Durham room codes.** The app has a built-in list of Durham University room codes (in `www/places.js`), so `CLC013` shows as *Calman Learning Centre*, and its details show *Arnold Wolfendale Lecture Theatre*. It covers 45 buildings and was built from [AccessAble's Durham guides](https://www.accessable.co.uk/durham-university/learning-spaces) in October 2026.
- **Maps.** Session details show a small map with a pin on the building. Tapping a room, or **Directions**, opens Google Maps with a pin at the building's exact position (from OpenStreetMap). For a location the app doesn't recognise, open the session and type the building's full name under *Unknown building?*. It's remembered for every session there. You can also use this to correct a building the list gets wrong.
- **Modules.** In **Settings → Modules**, or via *Colour, name or hide this module* on a session, you can rename a module (for example "ECON1011" to "Microeconomics"), pick its colour, or hide it.
- **Reminders.** Tap the bell to get a notification before every class (5 minutes to 2 hours before), and to add your own reminders, such as essay deadlines. To change the reminder for one session only, open that session. The Android app sends reminders even when it's closed. The web version can only show them while it's open.
- **Campus card.** Tap the card icon and scan the barcode on your campus card with the camera, from a photo, or by typing the number. The app then shows the barcode on screen in case you lose the card.

Notes, module settings, reminders, the campus card and building names you type are stored only on your phone.

## Updating the app

When you upload changed files to the repository, GitHub builds a new release automatically. Your timetable itself updates without this. You only need a new APK if the app's code changes.

Since build 2, every build is signed with the same key, which the first build saves in the repository's `signing` folder. So you can **install a new APK over the old one** and keep your notes and settings. The one exception is the first time you install a build that has this signing key: if your installed app is older than that, uninstall it once first.

## What's in this folder

| Path | What it is |
|---|---|
| `www/` | The app: screens, logic, calendar reader, icons and offline support |
| `.github/workflows/build.yml` | Instructions GitHub follows to build the APK and publish the web version |
| `package.json`, `capacitor.config.json` | Settings for [Capacitor](https://capacitorjs.com), which wraps the app as an Android app |
| `assets/icon-only.png` | The app icon used for the Android build |
| `relay/` | Optional relay for the web version if your university's server blocks it |

To try the web version on your computer, run `python -m http.server 8000 --directory www` in this folder and open <http://localhost:8000>.
