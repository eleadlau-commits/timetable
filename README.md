# Mobile Durham

**Mobile Durham** (it used to be called *Timetable*) shows your Durham University timetable on your phone, with a to-do list, how busy the library is and your campus card. It reads the personal calendar link your university can export, keeps a copy so it works offline, and updates itself whenever you open it.

GitHub builds the app for you, so you don't need to install anything. You get:
- **An Android app** (`MobileDurham.apk`) to download and install.
- **A web version** (GitHub Pages) to add to your home screen. Use this on an iPhone.

## Features

The app has five tabs along the bottom: **Study · Planner · Home · Spots · More**. It opens on Home. Tap a tab, or swipe left or right on the tab bar to move to the next one. The menu (top left) slides in from the left: it shows whether you're signed in (not yet: accounts are coming) and when the timetable was last updated, then **Account, Reminders, Settings, Help, About** and **Feedback**. Tap outside it, swipe it away or press back to close it. At the top right, the two-people button is for **Friends** and the person icon opens your **Account** page, where you can sign in with Google and read the **privacy notice** (what's stored online, who can see it, and how to delete it). Friends is coming soon. Mobile Durham is made by students and isn't affiliated with Durham University. It follows your phone's light or dark setting.

| Feature | What it does |
|---|---|
| **Home** | At the top, three pages to swipe between over a photo of Durham: the date, the clock, your next class and a big **Plan Today** button saying how many things are due today; **Explore** (opens Spots); and **Plan your journey** (coming soon). Below them, how busy the library is, the day's lectures (tap the date strip for other days) and your campus card. Anything that isn't set up yet shows **Missing content**. |
| **To-do list** | Things to do, with tags (Academic and Society to start with; add, rename or delete your own) and due dates. What's due today is at the top. Sorted by due date, overdue ones in red. Tap the circle to tick one off. Opens from **Plan Today** on Home. |
| **Friends** | A button at the top right, kept for later. For now it says *coming soon*. |
| **Planner: Day, Week and Upcoming** | Three ways to see your timetable. Swipe to move between days or weeks. The round button by the title downloads your timetable again. The **Modules: colours and names** button under the switch lets you rename, recolour or hide modules. |
| **Session details** | Tap any session for its time, room, description and more. |
| **Notes** | Your own notes on a session, e.g. "bring laptop". The first line shows on the card. |
| **Modules** | Rename a module ("ECON1011" → "Microeconomics"), pick its colour, or hide it. |
| **Maps** | Durham room codes show as buildings (`CLC013 · Calman Learning Centre`), with a map and directions. |
| **Reminders** | A notification before each class, plus your own reminders. |
| **Library** | How busy Bill Bryson Library is: a small bar on Home and on the **Study** tab. Tap it for free seats on each floor. |
| **Campus card** | Scan your card's barcode (camera or photo), or type the number, and show it on your phone if you lose the card. Reads Durham's Telepen barcode as well as the common types. |
| **Link sharing** | A QR code to send your timetable link from a computer to your phone (web version). |
| **More** | Everything else, as cards. For now, the campus card. |
| **Spots** | Cards for **Cafés**, **Pubs** and **Clubs** around Durham, coming soon. The Explore page on Home opens it. |
| **Help and feedback** | In the menu, kept for later. For now they say *coming soon*. |

You can switch any feature off for yourself in **Settings → Features**. Everything you add (notes, to-dos, colours, reminders, the card) stays on your own phone.

## Install it

**Android:**
1. On your phone, open `https://github.com/YOUR-USERNAME/timetable/releases`.
2. Tap **MobileDurham.apk** (older releases call it **Timetable.apk**) and open the downloaded file.
3. Allow installing from this source if asked, then tap **Install**. If Play Protect warns about an unknown app, tap **More details → Install anyway**.

**iPhone (or any phone), using the web version:**
1. *One-off, on GitHub:* go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Open `https://YOUR-USERNAME.github.io/timetable/` in Safari, then tap **Share → Add to Home Screen**.

**Updating:** install a newer APK straight over the old one. Your notes and settings stay.

**One-off, if you installed build 18 or earlier:** those builds were each signed with a different key by mistake, so Android refuses to install a newer one over them ("App not installed"). Uninstall the old app once, then install the newest APK. Uninstalling deletes what was saved on the phone (notes, to-dos, colours, the card), so note down anything you need first. From then on, updates install over the app as normal.

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
