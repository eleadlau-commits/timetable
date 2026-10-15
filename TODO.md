# Timetable app – feature to-do list

Features shown or implied by the new Home screen design (`home-light.html` / `home-dark.html`, spec in `DESIGN.md`).

_Statuses checked against the code on 15 October 2026._

> **Important:** the design shows features the app **does not have yet**. Many items below have no code behind them at all. Before building, check the repo and mark each item with its real status. Do not assume a feature exists because it appears in the mockup.

**Status key:** `[ ]` not started · `[~]` partly exists / needs rework · `[x]` done

---

## 1. Home screen – layout and theme

- [ ] Rebuild the Home screen layout to match the mockups (header, clock, library card, date strip, lecture card, campus card, tab bar)
- [~] Shared theme tokens (colours, radii, spacing, fonts) from `DESIGN.md` — *the token system exists (CSS variables in `folio/runtime/base.css`, accent from `app/app.json`), but holds the old blue palette, not the DESIGN.md values*
- [~] Light and dark themes, switching with the system setting — *already follows the system setting on web and Android; needs the new colours*
- [ ] Gradient page background (dark top → light/dark lower area)
- [ ] Load IBM Plex Sans and IBM Plex Mono
- [~] Line-icon set (menu, friends, account, planner, home, spots, more) — *`ui.ICONS` has line icons (pin, card, arrows, bell…) but not menu, people, person, calendar, house or dots, and uses a 2 px stroke not 1.8*
- [~] Layout works on small and large phones and on web — *the current app does; the new layout doesn't exist yet*

## 2. Clock and "next" line

- [ ] Live clock (HH:MM, updates every minute)
- [ ] Today's full date above the clock
- [~] "Next: <lecture> · <time> · <room>" line from timetable data — *Day view already finds today's next class (shows a "Next" pill on its card); no header line*
- [~] Countdown to the next lecture ("in 47 min"), updating live — *`time.inTime()` makes "in 47 min" and the app redraws every minute (`app:tick`); only shown as the Day view pill*
- [ ] Free-time detection: gaps between classes ("free until 16:00") — used by the countdown and future features

## 3. Timetable / lecture card

- [x] Timetable data source — *confirmed: `timetable` downloads/saves the university .ics link (works offline, refreshes after 30 min); `sessions` gives each day's classes with name, type, time, room; `durham-rooms` + `maps` turn room codes into buildings*
- [~] Lecture card: next lecture in full (name, time, type, room, building) — *every piece is available from the sessions service and Day view cards show them; no single "up next" card*
- [ ] Rest of the selected day below it, each later lecture progressively fainter
- [~] Handle days with no lectures, and after the last lecture of the day — *Day view has "No classes" / "Nothing scheduled"; nothing for after the last class*
- [ ] Scroll or clip inside the card when there are many lectures

## 4. Date strip

- [~] Slim date strip with today first, highlighted — *Day view has a Mon–Sun week strip with today marked and dots on busy days; not today-first or slim*
- [~] Tap a day to show that day's lectures in the lecture card — *works in Day view (`sessions.select(day)`, shared with Week view)*
- [~] Arrows page through days, skipping weekends — *Day view arrows jump a week; swipes move one day including weekends*
- [~] Return-to-today behaviour — *Day view has a "Back to today" button*

## 5. Library card

- [x] Fetch live occupancy from Durham's published library occupancy data — *`library` feature reads the Bill Bryson occupancy page; on the web it needs the personal relay*
- [x] Show seats free and a fill bar — *needs restyling to the orange bar + dot + dotted line*
- [~] "Busy" state (orange) above a threshold; calmer state otherwise — *four bands exist (Plenty of seats / Fairly busy / Busy / Full, green→red); needs the design's tag style*
- [x] Refresh periodically; show last-updated time or a fallback when data is unavailable — *every 5 min, keeps the last reading, explains when blocked/offline*
- [~] Tap through to library details — *tapping unfolds per-floor free seats in place; no separate screen*
- [ ] Library map (planned separate feature)

## 6. Campus card (barcode)

- [~] Store the student's card number securely on the device — *`campus-card` saves it on the phone only (app storage), but not encrypted*
- [x] Render the real barcode from it — *draws Code 128, Code 39 and Codabar; the format is detected when the card is scanned. Needs a vertical layout for the Home card*
- [~] Tap to open full-screen at max brightness for scanning — *opens a window and keeps the screen on; no brightness boost, not full-screen*
- [x] Setup flow to enter or scan the card number — *camera, photo, or typed*

## 7. Header

- [ ] Menu button (three lines) and what it opens
- [ ] Friends button and a Friends screen (scope to be decided: share timetables? see who's free?)
- [~] Account button and an Account / settings screen — *a Settings window exists (gear button); no accounts*

## 8. Tab bar and other screens

- [~] Tab bar: Planner · Home · Spots · More — *there are view tabs (Day · Week · Upcoming) as a segmented control at the top, not a bottom bar*
- [ ] Current tab filled in accent; glow line on top follows the selected tab
- [ ] **Planner** screen (not designed yet) — *Day, Week and Upcoming views already exist and could live here*
- [ ] **Spots** screen (not designed yet — e.g. study spaces, library map) — *room/building data (`durham-rooms`, `maps`) and library floors could feed it*
- [ ] **More** screen (not designed yet)

## 9. Later / ideas

- [ ] College menu card (designed earlier, removed from Home for now — could return elsewhere)
- [ ] iPhone app (after web + Android are stable; a friend has an Apple developer account) — *Folio already accepts iPhone settings in `feature.json`, but there's no iPhone build*
