# Timetable app – Home screen design handoff

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

- **One top bar on every tab:** the menu on the left and the account button (opens Settings) on the right. The Friends button is left out for now.
- **Five tabs:** Study · Planner · **Home** · Spots · More. **Study** holds the library (free seats on each floor); tapping the library card on Home opens it. **Spots** is empty for now ("Coming soon").
- **Dark area:** on Home it runs down behind the clock. On the other tabs only the top bar (menu and account) is dark; the title sits on the page.
- **Library colours:** green for plenty of seats, orange for fairly busy, red for busy or full.
- **Missing data** shows a dashed **Missing content** box saying what's missing, so the screen keeps its shape.
- The colours below are in `app/theme.css`; the fonts are in `app/fonts`.

## Layout, top to bottom

1. **Header row** (on the dark top area)
   - Left: menu button, three lines, white, no background.
   - Right: Friends icon (white, no background), then Account in a squircle (44 × 44, radius 14, white at 14% opacity).
2. **Date line**: "Thursday 15 October", 15 px, centred, `#cbc4d1`.
3. **Clock**: "15:13", IBM Plex Mono 500, 96 px, white, centred. Under it: "Next: Linear Algebra II · 16:00 · CG85" (14 px, `#cbc4d1`).
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
| Later lectures, fade step 1 / 2 / 3 | `#77717e` / `#8f8a95` / `#a7a2ad` | `#8f8796` / `#77707e` / `#625c69` |
| Divider | `#ebe8ef` | `#3d3842` |
| Accent fill (today, Home tab) — white text on it | `#6b3fa0` | `#8457c0` |
| Tab inactive icons/labels | `#2e2440` | `#c9aee6` |
| Tab glow line | `#2e2440` | `#b48ad6` |
| Library busy bar | `#ec7a12` | `#ec7a12` |
| Busy tag | text `#a34c00` on `#fdebd9` | text `#ffb877` on `rgba(236,122,18,0.18)` |
| Library "free" dotted line | `#cfcad6` | `#5a5361` |
| Barcode | dark bars on the white card | dark bars on a white inset (stays scannable) |
| Header text on dark top (both themes) | date/next `#cbc4d1`, clock + icons `#ffffff` | same |
| Card radius / screen side padding | 14 px / 20 px | same |
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
