# Mobile Durham – feature to-do list

_The app was called **Timetable** until version 3.1._

Features shown or implied by the new Home screen design (`home-light.html` / `home-dark.html`, spec in `DESIGN.md`).

_Statuses checked against the code on 16 October 2026, after the sliding menu and Plan Today (branch `claude/sliding-menu-plan-today`)._

> **Important:** the design shows features the app **does not have yet**. Many items below have no code behind them at all. Before building, check the repo and mark each item with its real status. Do not assume a feature exists because it appears in the mockup.

**Status key:** `[ ]` not started · `[~]` partly exists / needs rework · `[x]` done

---

## 1. Home screen – layout and theme

- [x] Rebuild the Home screen layout to match the mockups (header, clock, library card, date strip, lecture card, campus card, tab bar) — *`home` feature; the top bar is now the same on every tab: menu and account only*
- [x] Shared theme tokens (colours, radii, spacing, fonts) from `DESIGN.md` — *in `app/theme.css`*
- [x] "Knife" corner shape on cards, pop-ups, buttons, text boxes, the switch, the selected tab and tags — *`--knife` in `app/theme.css`; date-strip day buttons and round things keep their shape*
- [x] Rename the app to **Mobile Durham** — *same app id, so updates install over the old Timetable app*
- [x] Light and dark themes, switching with the system setting
- [x] Gradient page background (dark top → light/dark lower area)
- [x] Load IBM Plex Sans and IBM Plex Mono — *bundled in `app/fonts` (88 KB), so they work offline*
- [x] Line-icon set (menu, friends, account, planner, home, spots, more) — *in `ui.ICONS`, 1.8 px lines*
- [~] Layout works on small and large phones and on web — *checked at 390 × 844 in light and dark; still to check on a small phone*

## 2. Clock and "next" line

- [x] Live clock (HH:MM, updates every minute) — *on the minute; a small AM/PM on 12-hour phones*
- [x] Today's full date above the clock — *14 px date, 80 px clock, moved up*
- [x] "Next: <lecture> · <time> · <room>" line from timetable data — *`up-next` feature*
- [x] Countdown to the next lecture ("in 47 min"), updating live
- [x] **Plan Today** button under the "Next:" line, on the left, opening the to-do list — *`todo` feature; was "To-do list"; now a big outlined button with the count inside*
- [x] Clock smaller (40 px), so Plan Today fits as a big button
- [x] Swipeable pages on the dark area, with small knife-shaped dots: Today · Explore (opens Spots) · Plan your journey (coming soon) — *`home` slot `home.pages`, `spots`, new `journey` feature*
- [~] Durham photo behind the pages, half see-through, clearest at the bottom right — *the place is ready (`app/features/home/photos/durham.jpg`, see the README there); the photo itself is still to be added*
- [ ] Plan your journey: the real thing (directions to your next class?)
- [x] Under it, how many things are due today ("Nothing due today" / "1 thing due today" / "3 things due today"), updating as to-dos change and when the day changes
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
- [x] Reading a photo of the card works with a table or hand around it, a small, tilted or sideways card — *fixed two bugs in the ZXing reader (Code 128 and Codabar) on 17 October 2026; `zxing-fixes.js`*
- [x] Durham cards use **Telepen** (number mode), which no barcode library in the app read — *the app now reads and draws Telepen itself (`telepen.js`, `scan.js`); checked with a real Durham card photo*
- [ ] Check at the library that its scanner reads the Telepen barcode drawn on the phone

## 7. Header

- [x] Menu button (three lines) and what it opens — *a panel sliding in from the left (85% of the width, the rest dimmed; closes by tapping outside, swiping left, back or Escape) with "Not signed in", the status line, then Account, Reminders, Settings, Help, About, Feedback. Folio 1.4.0*
- [ ] Help and Feedback pages — *the menu rows (`help` feature) say "coming soon" for now*
- [~] Friends button and a Friends screen (scope to be decided: share timetables? see who's free?) — *the button is in the top bar on every tab (`friends` feature) and says "coming soon"; no Friends screen yet*
- [~] Account button and an Account screen — *the account button and the menu's Account row say "coming soon"; Settings is in the menu. A future accounts feature fills Folio's `account` slot (name for the menu, and the account page)*
- [x] Features can add buttons to the top bar — *Folio 1.3.0, slot `header.actions`*

## 8. Tab bar and other screens

- [x] Tab bar: Study · Planner · Home · Spots · More — *Study was added for the library*
- [x] Current tab filled in accent; glow line on top follows the selected tab — *the highlight now slides between tabs*
- [x] Swipe left or right on the tab bar to change tabs, stopping at the ends; the bar follows the finger a little — *Folio 1.4.0*
- [~] **Planner** screen — *a tab holding Day, Week and Upcoming with a switch, and a round refresh button by the title (slot `planner.actions`); they still have their old look, not yet the Planner mockups*
- [x] **Study** screen — *the library, with free seats on each floor*
- [~] **Spots** screen — *an empty tab saying "Coming soon", on purpose for now*
- [x] **More** screen — *to-do list, campus card, reminders, modules, calendar link, and sending the link to your phone (web)*

## 9. To-do list

- [x] Pop-up with tags to filter by: All, Academic, Society, + Add tag — *`todo` feature*
- [x] "Due today" section at the top of the pop-up — *counting rule in `rules.js`, tested*
- [x] Add, rename and delete tags; deleting a tag keeps its to-dos, without a tag
- [x] Round tick box, text, tag pill and due date; ticked ones crossed out; delete
- [x] Sorted by due date, no date last; overdue ones marked in red
- [x] Add a to-do with an optional tag and due date
- [x] Saved on the phone only; rules tested in `app/features/todo/tests`
- [ ] Reminders for to-dos that are due (could use the `reminders` feature)

## 10. Later / ideas

- [ ] College menu card (designed earlier, removed from Home for now — could return elsewhere)
- [ ] Line drawing behind the clock on Home (talked about; not now)
- [ ] iPhone app (after web + Android are stable; a friend has an Apple developer account) — *Folio already accepts iPhone settings in `feature.json`, but there's no iPhone build*
