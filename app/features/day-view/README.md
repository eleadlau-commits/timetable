# Day view

One day at a time. A strip at the top shows the week, with a dot on days that have classes. Today's list shows what's on now and what's next. Tap a day in the strip, or use the arrow keys, to move a day. (Swiping changes tab.)

- **Adds:** **Day** inside the Planner tab (view id `day`), or a Day tab of its own without the Planner.
- **Offers:** the slot `day.cards`, for cards above the day's sessions. Item: `{ order, render(day) → element, or null }`. Nothing uses it at the moment (the library card moved to Home and the Study tab).
- **Requires:** sessions. **Uses if present:** planner.
- **Saves:** nothing. The selected day belongs to the sessions service, so the Week view stays in step.
