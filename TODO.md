# Timetable app – feature to-do list

Features shown or implied by the new Home screen design (`home-light.html` / `home-dark.html`, spec in `DESIGN.md`).

_Statuses checked against the code on 15 October 2026, after the Home redesign (branch `claude/home-redesign`)._

> **Important:** the design shows features the app **does not have yet**. Many items below have no code behind them at all. Before building, check the repo and mark each item with its real status. Do not assume a feature exists because it appears in the mockup.

**Status key:** `[ ]` not started · `[~]` partly exists / needs rework · `[x]` done

---

## 1. Home screen – layout and theme

- [x] Rebuild the Home screen layout to match the mockups (header, clock, library card, date strip, lecture card, campus card, tab bar) — *`home` feature; the top bar is now the same on every tab: menu and account only*
- [x] Shared theme tokens (colours, radii, spacing, fonts) from `DESIGN.md` — *in `app/theme.css`*
- [x] Light and dark themes, switching with the system setting
- [x] Gradient page background (dark top → light/dark lower area)
- [x] Load IBM Plex Sans and IBM Plex Mono — *bundled in `app/fonts` (88 KB), so they work offline*
- [x] Line-icon set (menu, friends, account, planner, home, spots, more) — *in `ui.ICONS`, 1.8 px lines*
- [~] Layout works on small and large phones and on web — *checked at 390 × 844 in light and dark; still to check on a small phone*

## 2. Clock and "next" line

- [x] Live clock (HH:MM, updates every minute) — *on the minute; a small AM/PM on 12-hour phones*
- [x] Today's full date above the clock
- [x] "Next: <lecture> · <time> · <room>" line from timetable data — *`up-next` feature*
- [x] Countdown to the next lecture ("in 47 min"), updating live
- [ ] Free-time detection: gaps between classes ("free until 16:00") — used by the countdown and future features

## 3. Timetable / lecture card

- [x] Timetable data source — *confirmed: `timetable` downloads/saves the university .ics link (works offline, refreshes after 30 min); `sessions` gives each day's classes with name, type, time, room; `durham-rooms` + `maps` turn room codes into buildings*
- [x] Lecture card: next lecture in full (name, time, type, room, building)
- [x] Rest of the selected day below it, each later lecture progressively fainter
- [x] Handle days with no lectures, and after the last lecture of the day
- [x] Scroll or clip inside the card when there are many lectures

## 4. Date strip

- [x] Slim date strip with today first, highlighted
- [x] Tap a day to show that day's lectures in the lecture card
- [x] Arrows page through days, skipping weekends
- [x] Return-to-today behaviour — *the back arrow, and it goes back to today whenever the app is opened again*

## 5. Library card

- [x] Fetch live occupancy from Durham's published library occupancy data — *`library` feature reads the Bill Bryson occupancy page; on the web it needs the personal relay*
- [x] Show seats free and a fill bar — *orange bar, dot and dotted line, as designed*
- [x] "Busy" state above a threshold; calmer state otherwise — *green for plenty of seats, orange for fairly busy, red for busy or full*
- [x] Refresh periodically; show last-updated time or a fallback when data is unavailable — *every 5 min, keeps the last reading, explains when blocked/offline*
- [x] Tap through to library details — *opens the new **Study** tab, with free seats on each floor*
- [ ] Library map (planned separate feature)

## 6. Campus card (barcode)

- [~] Store the student's card number securely on the device — *`campus-card` saves it on the phone only (app storage), but not encrypted*
- [x] Render the real barcode from it — *draws Code 128, Code 39 and Codabar; drawn down the narrow Home card*
- [~] Tap to open full-screen at max brightness for scanning — *opens the card window and keeps the screen on; no brightness boost, not full-screen*
- [x] Setup flow to enter or scan the card number — *camera, photo, or typed*

## 7. Header

- [x] Menu button (three lines) and what it opens — *a menu with Refresh timetable, Reminders, Campus card and Settings*
- [ ] Friends button and a Friends screen (scope to be decided: share timetables? see who's free?) — *left out of the top bar so it's the same on every tab*
- [~] Account button and an Account / settings screen — *the account button opens Settings; there are no accounts*

## 8. Tab bar and other screens

- [x] Tab bar: Study · Planner · Home · Spots · More — *Study was added for the library*
- [x] Current tab filled in accent; glow line on top follows the selected tab
- [~] **Planner** screen — *a tab holding Day, Week and Upcoming with a switch; they still have their old look, not yet the Planner mockups*
- [x] **Study** screen — *the library, with free seats on each floor*
- [~] **Spots** screen — *an empty tab saying "Coming soon", on purpose for now*
- [x] **More** screen — *campus card, reminders, modules, calendar link, and sending the link to your phone (web)*

## 9. Later / ideas

- [ ] College menu card (designed earlier, removed from Home for now — could return elsewhere)
- [ ] iPhone app (after web + Android are stable; a friend has an Apple developer account) — *Folio already accepts iPhone settings in `feature.json`, but there's no iPhone build*
