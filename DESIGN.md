# Mobile Durham – Home screen design handoff

_The app was called **Timetable** until version 3.1; it's now **Mobile Durham**._

The agreed Home (front) screen, in two themes, designed on a 390 × 844 phone frame:

| File | What it is |
|---|---|
| `home-light.html` | **Light theme (v12)** — dark gradient top, light cards below, white tab bar. |
| `home-dark.html` | **Dark theme (v12)** — same layout, dark throughout. |

They are **one screen with two themes**: build one layout and switch colours with theme tokens (follow the system light/dark setting).

Open either file in a browser to see it. They are static mockups: every number, lecture and the barcode is **sample content**, to be replaced by real data.

> **Many features in this design do not exist in the app's code yet** (live library data, campus barcode, friends, account, the Planner/Spots/More screens, and more). The full list is in `TODO.md`. Check the repo before assuming anything shown here is already implemented.

---

## Agreed changes since the mockups

- **Home redesign (October 2026), replacing the Home parts below where they differ:**
  - The dark area at the top is small, about as tall as the date and clock (64 px pages, dots under them). Four pages to swipe: **the date and clock**; **Plan Today** (how many things are due today, *Open* button); **Explore** (*Open Spots*); **Plan a journey** (*Soon*). Each page after the clock is one row: title and line on the left, an outlined knife button on the right. No *Next:* line.
  - Home doesn't scroll: the cards fill the screen down to the tab bar.
  - The **library** is one thin row: *Library*, the free seats, then the bar (no busy tag; the bar's colour says how busy it is).
  - The **lecture card** shows today only, with no date strip, and fits every lecture left today without scrolling (later ones go on one line each when needed).
  - The **campus card** has no *Card* label; under the barcode and its number there's a purple **Tap** button (knife shape). The barcode is a fixed height, and the card ends just under the button.
- **The knife shape (October 2026):** most rounded shapes have three slightly rounded corners (about 4 px) and a clearly rounded **bottom-right** corner: about 26 px on cards and pop-ups, about 15 px on buttons, text boxes, the Day/Week/Upcoming switch and the selected tab, and about 9 px on small tags, pills and More's icon tiles. It's defined once in `app/theme.css` (`--knife`, `--knife-btn`, `--knife-sm`). It's used on every card (library, lecture card, campus card, Study, More groups, Day view sessions, *Missing content*), Settings and every other pop-up, the menu and the to-do list.
  - **Kept as they were:** the day buttons in the date strips (Home's strip, the Day view's week strip, the Week view's day headers) are normal rounded squircles, and anything meant to be round stays round (tick circles, dots, on/off switches, the barcode's white inset).
  - **No coloured edges or outlines on cards:** session cards and Week view blocks show their module colour as the fill only.
- **One top bar on every tab:** the menu on the left. On the right, the **Friends** button (two people, in a squircle at white 14% opacity, knife shape), then the account button (opens Settings) as just the icon, no background. Friends isn't built yet, so it says *coming soon*.
- **Home's clock block** sits higher and is a little smaller: date 14 px, clock 80 px. Under the *Next:* line, a **To-do list** button: white outline and white text, no fill, knife shape. It opens the **To-do list** pop-up: tags along the top (All, Academic, Society, + Add tag), then the to-dos with a round tick box, the text, a small tag pill and the due date; ticked ones are crossed out, overdue ones say *Overdue* in red.
- **Five tabs:** Study · Planner · **Home** · Spots · More. **Study** holds the library (free seats on each floor); tapping the library card on Home opens it. **Spots** is empty for now ("Coming soon").
- **Dark area:** on Home it runs down behind the clock. On the other tabs only the top bar (menu and account) is dark; the title sits on the page.
- **Library colours:** green for plenty of seats, orange for fairly busy, red for busy or full.
- **Missing data** shows a dashed **Missing content** box saying what's missing, so the screen keeps its shape.
- The colours below are in `app/theme.css`; the fonts are in `app/fonts`.

## Layout, top to bottom

1. **Header row** (on the dark top area)
   - Left: menu button, three lines, white, no background.
   - Right: Friends in a squircle (44 × 44, knife shape, white at 14% opacity), then the Account icon (white, no background). *(Swapped round from the mockup, see above.)*
2. **Date line**: "Thursday 15 October", 14 px, centred, `#cbc4d1`.
3. **Clock**: "15:13", IBM Plex Mono 500, 80 px, white, centred. Under it: "Next: Linear Algebra II · 16:00 · CG85" (14 px, `#cbc4d1`), then the **To-do list** button (white outline, white text).
4. *Flexible space* — the clock block stays at the top, everything below sits at the bottom.
5. **Library card** (radius 14): "Library" + orange **Busy** tag, "195 seats free" on the right. Thin orange bar (`#ec7a12`) with a dot at the fill level, dotted line for the free remainder.
6. **Two-column block** (320 px tall, 12 px gap):
   - **Left column**
     - **Date strip**, slim (30 px), left-aligned: ‹ **Thu 15** · Fri 16 · Mon 19 ›. Today is first, filled accent with white text (radius 8). Other days: muted day name, bold number. No borders.
     - **Lecture card** — fills the rest of the column:
       - Label "UP NEXT · IN 47 MIN" (12 px caps, muted).
       - Next lecture: name 20 px semibold, time, type + room.
       - Then the **rest of today's lectures**, each as name (15 px) + time · room (13 px), separated by 1 px dividers, and **each one fainter than the one before** (three steps, see tokens). No "Then" heading. If there are more than fit, the list clips or scrolls inside the card.
   - **Right column (104 px)**: **Campus card** — label "CARD", vertical barcode filling the card, `[STUDENT ID]` under it.
7. **Tab bar**: Study · Planner · **Home** · Spots · More.
   - Current tab (Home) is a filled accent rounded block (radius 14) with white icon + label.
   - Other tabs: icon + label in the "tab inactive" colour, weight 500.
   - A 3 px line along the top edge of the bar: a loose horizontal gradient, strongest above the current tab, fading out to both edges. It moves with the selected tab.

## Theme tokens

| Token | Light | Dark |
|---|---|---|
| Page background | `linear-gradient(180deg, #1f1c23 0%, #29242f 37%, #e2dfe7 45%)` | `linear-gradient(180deg, #110f14 0%, #16131a 37%, #1f1c23 45%)` |
| Card / tab bar | `#ffffff` | `#2c2831` |
| Text | `#1d1a21` | `#f2eff5` |
| Text, secondary | `#3a3540` | `#d6d0db` |
| Text, muted | `#57515e` | `#b3abb9` |
| Later lectures, fade step 1 / 2 / 3 (each still 4.5:1 or more on the card, so readable) | `#5f5966` / `#68626f` / `#75707c` | `#b3acb9` / `#a49dab` / `#968f9d` |
| Divider | `#ebe8ef` | `#3d3842` |
| Accent fill (today, Home tab) — white text on it | `#6b3fa0` | `#8457c0` |
| Tab inactive icons/labels | `#2e2440` | `#c9aee6` |
| Tab glow line | `#2e2440` | `#b48ad6` |
| Library busy bar | `#ec7a12` | `#ec7a12` |
| Busy tag | text `#a34c00` on `#fdebd9` | text `#ffb877` on `rgba(236,122,18,0.18)` |
| Library "free" dotted line | `#cfcad6` | `#5a5361` |
| Barcode | dark bars on the white card | dark bars on a white inset (stays scannable) |
| Header text on dark top (both themes) | date/next `#cbc4d1`, clock + icons `#ffffff` | same |
| Corner shape (knife), top-left / top-right / bottom-right / bottom-left | cards 4 / 4 / 26 / 4 px · buttons 4 / 4 / 15 / 4 px · small tags 3 / 3 / 9 / 3 px | same |
| Screen side padding | 20 px | same |
| Fonts | IBM Plex Sans (UI), IBM Plex Mono (clock, times) | same |

Icons are simple 1.8 px stroke line icons (menu, people, person, calendar, house, map pin, three dots). Any matching line-icon set works (e.g. Lucide).

## Behaviour to build (not in the mockup)

- Clock and "Next:" line update live; "in 47 min" counts down.
- Date strip: today first; tapping a day switches the lecture card to that day; arrows page through days, skipping weekends.
- Lecture card: the next lecture in full, the rest of the selected day below it, fading progressively.
- Library card: live occupancy from Durham's published library occupancy data. Show **Busy** (orange) above a threshold, otherwise a calmer state.
- Campus card: render the student's real card barcode; tapping it could open it full-screen at max brightness for scanning.
- Tab bar: the glow line follows the selected tab.
- Theme: light and dark are the same screen; switch with the system setting.
