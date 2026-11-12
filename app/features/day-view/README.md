# Day view

One day at a time, as a timeline of hours, so the gaps between classes show. A strip at the top shows the week, with a dot on days that have classes. Sessions that clash sit side by side, a red line marks the time, and today's sessions say "Now" or "Next · in 20 min". Notes and other `session.card` lines show on each session when there's room. Tap a day in the strip, or use the arrow keys, to move. The arrows by the strip jump to the **Monday** of the next or previous week (`weeks.js`, tested). Swiping moves a day at a time.

- **Adds:** **Day** inside the Planner tab (view id `day`, zoom level 40, letter D: the closest level, which the Planner opens on), or a Day tab of its own without the Planner.
- **Offers:** the slot `day.cards`, for cards above the day's sessions. Item: `{ order, render(day) → element, or null }`. To-dos in the Planner (`planner-todos`) puts its To do card here. And the slot `day.marks`, for small marks in the top right corner of a day in the week strip, such as the to-do tick. Item: `{ order, render(day) → small element or null, label?(day) → words added to the day's spoken name, or null }`. Marks are purple (white on the chosen day) unless they set their own colour.
- **Requires:** sessions. **Uses if present:** planner.
- **Saves:** nothing. The selected day belongs to the sessions service, so the Week view stays in step.

- **Friends' classes** (Sessions' `onDay(day, { others: true })`, from the Friends button in the Planner) are drawn faintly with a dashed edge in their colour, next to yours.
