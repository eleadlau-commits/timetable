# Day view

One day at a time, as a timeline of hours, so the gaps between classes show. A strip at the top shows the week, with a dot on days that have classes. Sessions that clash sit side by side, a red line marks the time, and today's sessions say "Now" or "Next · in 20 min". Notes and other `session.card` lines show on each session when there's room. Tap a day in the strip, or use the arrows or arrow keys, to move. (Swiping changes tab.)

- **Adds:** **Day** inside the Planner tab (view id `day`, zoom level 40, letter D: the closest level, which the Planner opens on), or a Day tab of its own without the Planner.
- **Offers:** the slot `day.cards`, for cards above the day's sessions. Item: `{ order, render(day) → element, or null }`. Nothing uses it at the moment (the library card moved to Home and the Study tab).
- **Requires:** sessions. **Uses if present:** planner.
- **Saves:** nothing. The selected day belongs to the sessions service, so the Week view stays in step.
