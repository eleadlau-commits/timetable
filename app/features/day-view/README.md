# Day view

One day at a time. A strip at the top shows the week, with a dot on days that have classes. Today's list shows what's on now and what's next. Swipe left or right, or use the arrow keys, to move a day.

- **Adds:** the **Day** view (id `day`), inside the Planner tab (or a tab of its own if the Planner isn't installed).
- **Offers:** the slot `day.cards`, for cards above the day's sessions. Item: `{ order, render(day) → element, or null }`. Nothing uses it at the moment (the library card moved to Home).
- **Requires:** sessions. **Uses if present:** planner.
- **Saves:** nothing. The selected day belongs to the sessions service, so the Week view stays in step.
