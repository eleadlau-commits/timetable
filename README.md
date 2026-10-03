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

## Updating the app

When you upload changed files to the repository, GitHub builds a new release automatically. Each build is signed differently, so to install a newer APK, **uninstall the old one first** and then paste your link again. Your timetable itself updates without this. You only need a new APK if the app's code changes.

## What's in this folder

| Path | What it is |
|---|---|
| `www/` | The app: screens, logic, calendar reader, icons and offline support |
| `.github/workflows/build.yml` | Instructions GitHub follows to build the APK and publish the web version |
| `package.json`, `capacitor.config.json` | Settings for [Capacitor](https://capacitorjs.com), which wraps the app as an Android app |
| `assets/icon-only.png` | The app icon used for the Android build |
| `relay/` | Optional relay for the web version if your university's server blocks it |

To try the web version on your computer, run `python -m http.server 8000 --directory www` in this folder and open <http://localhost:8000>.
