# Week view

The week as a grid of hours, like a paper timetable:
- Sessions that clash are shown side by side.
- Names stay on one line, cut short with "…" when there isn't room; tap a session for its full name.
- A red line marks the current time.
- Saturday and Sunday only appear when something is on.

Tap a day's heading to zoom in to that day.

- **Adds:** **Week** inside the Planner tab (view id `week`, zoom level 30, letter W), or a Week tab of its own without the Planner. Its zoom-out label is **This week** or **Week**.
- **Requires:** sessions (it uses the sessions service's `layout` rules for the grid). **Uses if present:** day-view, so tapping a day can open it; planner.
- **Saves:** nothing.
