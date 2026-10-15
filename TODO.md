# Timetable app – feature to-do list

Features shown or implied by the new Home screen design (`home-light.html` / `home-dark.html`, spec in `DESIGN.md`).

> **Important:** the design shows features the app **does not have yet**. Many items below have no code behind them at all. Before building, check the repo and mark each item with its real status. Do not assume a feature exists because it appears in the mockup.

**Status key:** `[ ]` not started · `[~]` partly exists / needs rework · `[x]` done

---

## 1. Home screen – layout and theme

- [ ] Rebuild the Home screen layout to match the mockups (header, clock, library card, date strip, lecture card, campus card, tab bar)
- [ ] Shared theme tokens (colours, radii, spacing, fonts) from `DESIGN.md`
- [ ] Light and dark themes, switching with the system setting
- [ ] Gradient page background (dark top → light/dark lower area)
- [ ] Load IBM Plex Sans and IBM Plex Mono
- [ ] Line-icon set (menu, friends, account, planner, home, spots, more)
- [ ] Layout works on small and large phones and on web

## 2. Clock and "next" line

- [ ] Live clock (HH:MM, updates every minute)
- [ ] Today's full date above the clock
- [ ] "Next: <lecture> · <time> · <room>" line from timetable data
- [ ] Countdown to the next lecture ("in 47 min"), updating live
- [ ] Free-time detection: gaps between classes ("free until 16:00") — used by the countdown and future features

## 3. Timetable / lecture card

- [~] Timetable data source (existing base from the friend's app — confirm what it provides)
- [ ] Lecture card: next lecture in full (name, time, type, room, building)
- [ ] Rest of the selected day below it, each later lecture progressively fainter
- [ ] Handle days with no lectures, and after the last lecture of the day
- [ ] Scroll or clip inside the card when there are many lectures

## 4. Date strip

- [ ] Slim date strip with today first, highlighted
- [ ] Tap a day to show that day's lectures in the lecture card
- [ ] Arrows page through days, skipping weekends
- [ ] Return-to-today behaviour

## 5. Library card

- [ ] Fetch live occupancy from Durham's published library occupancy data
- [ ] Show seats free and a fill bar
- [ ] "Busy" state (orange) above a threshold; calmer state otherwise
- [ ] Refresh periodically; show last-updated time or a fallback when data is unavailable
- [ ] Tap through to library details
- [ ] Library map (planned separate feature)

## 6. Campus card (barcode)

- [ ] Store the student's card number securely on the device
- [ ] Render the real barcode from it (confirm the barcode format the university uses)
- [ ] Tap to open full-screen at max brightness for scanning
- [ ] Setup flow to enter or scan the card number

## 7. Header

- [ ] Menu button (three lines) and what it opens
- [ ] Friends button and a Friends screen (scope to be decided: share timetables? see who's free?)
- [ ] Account button and an Account / settings screen

## 8. Tab bar and other screens

- [ ] Tab bar: Planner · Home · Spots · More
- [ ] Current tab filled in accent; glow line on top follows the selected tab
- [ ] **Planner** screen (not designed yet)
- [ ] **Spots** screen (not designed yet — e.g. study spaces, library map)
- [ ] **More** screen (not designed yet)

## 9. Later / ideas

- [ ] College menu card (designed earlier, removed from Home for now — could return elsewhere)
- [ ] iPhone app (after web + Android are stable; a friend has an Apple developer account)
