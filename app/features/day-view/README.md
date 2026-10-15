# Day view

One day at a time. A strip at the top shows the week, with a dot on days that have classes. Today's list shows what's on now and what's next. Swipe left or right, or use the arrow keys, to move a day.

- **Adds:** the **Day** tab (view id `day`).
- **Offers:** the slot `day.cards`, for cards above the day's sessions. Item: `{ order, render(day) → element, or null }`. Nothing uses it at the moment (the library card moved to Home).
- **Requires:** sessions.
- **Saves:** nothing. The selected day belongs to the sessions service, so the Week view stays in step.
