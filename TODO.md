# Timetable app – feature to-do list

Features shown or implied by the new Home screen design (`home-light.html` / `home-dark.html`, spec in `DESIGN.md`).

_Statuses checked against the code on 15 October 2026, then updated after the Home redesign (branch `claude/home-redesign`)._

> **Important:** the design shows features the app **does not have yet**. Many items below have no code behind them at all. Before building, check the repo and mark each item with its real status. Do not assume a feature exists because it appears in the mockup.

**Status key:** `[ ]` not started · `[~]` partly exists / needs rework · `[x]` done

---

## 1. Home screen – layout and theme

- [x] Rebuild the Home screen layout to match the mockups (header, clock, library card, date strip, lecture card, campus card, tab bar) — *`home` feature; other features fill its places (`home.next/top/main/side`), and an empty place shows "Missing content"*
- [x] Shared theme tokens (colours, radii, spacing, fonts) from `DESIGN.md` — *CSS variables in `folio/runtime/base.css` (list in `folio/README.md`), accent and page colours in `app/app.json`*
- [x] Light and dark themes, switching with the system setting
- [x] Gradient page background (dark top → light/dark lower area) — *behind Home; other tabs have a dark top bar*
- [x] Load IBM Plex Sans and IBM Plex Mono — *bundled in `app/fonts/` (latin, 86 KB), so they work offline*
- [x] Line-icon set (menu, friends, account, planner, home, spots, more) — *added to `ui.ICONS`, all at 1.8 px*
- [x] Layout works on small and large phones and on web — *checked at 360×640, 390×844 and 430×932; on very short screens Home scrolls a little*

## 2. Clock and "next" line

- [x] Live clock (HH:MM, updates every minute) — *`app:tick` now comes at the start of each minute*
- [x] Today's full date above the clock
- [x] "Next: <lecture> · <time> · <room>" line from timetable data — *`up-next` feature; "Now: … · until 17:00" while a class is on*
- [x] Countdown to the next lecture ("in 47 min"), updating live
- [ ] Free-time detection: gaps between classes ("free until 16:00") — used by the countdown and future features

## 3. Timetable / lecture card

- [x] Timetable data source — *confirmed: `timetable` downloads/saves the university .ics link (works offline, refreshes after 30 min); `sessions` gives each day's classes with name, type, time, room; `durham-rooms` + `maps` turn room codes into buildings*
- [x] Lecture card: next lecture in full (name, time, type, room, building)
- [x] Rest of the selected day below it, each later lecture progressively fainter — *three steps (`--fade-1/2/3`)*
- [x] Handle days with no lectures, and after the last lecture of the day — *"No classes"; "That's all for today" with a link to the next day with classes*
- [x] Scroll or clip inside the card when there are many lectures — *scrolls inside the card, and keeps its place when the clock redraws*

## 4. Date strip

- [x] Slim date strip with today first, highlighted
- [x] Tap a day to show that day's lectures in the lecture card — *Home's strip has its own selected day, separate from the Planner's*
- [x] Arrows page through days, skipping weekends
- [x] Return-to-today behaviour — *"Today" in the card's corner; also goes back to today after midnight and when the app reopens*

## 5. Library card

- [x] Fetch live occupancy from Durham's published library occupancy data — *`library` feature reads the Bill Bryson occupancy page; on the web it needs the personal relay*
- [x] Show seats free and a fill bar — *restyled: bar + dot + dotted line for what's free*
- [x] "Busy" state (orange) above a threshold; calmer state otherwise — *Busy and Full are orange tags, Plenty of seats and Fairly busy calm*
- [x] Refresh periodically; show last-updated time or a fallback when data is unavailable — *every 5 min; with no reading from the last 2 hours Home shows "Missing content" and the reason*
- [~] Tap through to library details — *tapping unfolds per-floor free seats in place, on Home; no separate screen*
- [ ] Library map (planned separate feature)

## 6. Campus card (barcode)

- [~] Store the student's card number securely on the device — *`campus-card` saves it on the phone only (app storage), but not encrypted*
- [x] Render the real barcode from it — *draws Code 128, Code 39 and Codabar; vertical on the Home card*
- [~] Tap to open full-screen at max brightness for scanning — *tapping the Home card opens the card window and keeps the screen on; no brightness boost, not full-screen*
- [x] Setup flow to enter or scan the card number — *camera, photo, or typed*

## 7. Header

- [x] Menu button (three lines) and what it opens — *a list of the old top-bar buttons (reminders, campus card, refresh, Settings) and the "Updated …" line*
- [~] Friends button and a Friends screen (scope to be decided: share timetables? see who's free?) — *the button is ready and appears as soon as a feature offers a `friends` service with `open()`; no friends feature yet*
- [~] Account button and an Account / settings screen — *the Account button opens Settings; no accounts*

## 8. Tab bar and other screens

- [x] Tab bar: Planner · Home · Spots · More — *a bottom bar in Folio itself; Home is the default*
- [x] Current tab filled in accent; glow line on top follows the selected tab
- [~] **Planner** screen (not designed yet) — *a `planner` tab now holds Day, Week and Upcoming (each still its own feature); its own design is still to come*
- [~] **Spots** screen (not designed yet — e.g. study spaces, library map) — *a "Coming soon" tab (`spots`); room/building data (`durham-rooms`, `maps`) and library floors could feed it*
- [~] **More** screen (not designed yet) — *a "Coming soon" tab (`more`)*

## 9. Later / ideas

- [ ] College menu card (designed earlier, removed from Home for now — could return elsewhere)
- [ ] iPhone app (after web + Android are stable; a friend has an Apple developer account) — *Folio already accepts iPhone settings in `feature.json`, but there's no iPhone build*
