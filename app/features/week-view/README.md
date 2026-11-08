# Week view

The week as a grid of hours, like a paper timetable:
- Sessions that clash are shown side by side.
- Each block shows the **module's name** (the one you chose in Modules, or the title without its code and type, e.g. "Mathematical Methods II"), wrapping onto as many lines as the block has. The type and room come underneath only when they fit whole. Side by side with a clash, there's only room for the code. Tap a session for everything.
- A red line marks the current time.
- Saturday and Sunday only appear when something is on.

Tap a day's heading to zoom in to that day. The arrows (and swiping) go to the next or previous week, on its Monday.

- **Adds:** **Week** inside the Planner tab (view id `week`, zoom level 30, letter W), or a Week tab of its own without the Planner. Its zoom-out label is **This week** or **Week**.
- **Requires:** sessions (it uses the sessions service's `layout` rules for the grid). **Uses if present:** day-view, so tapping a day can open it; planner.
- **Saves:** nothing.

- **Friends' classes** (Sessions' `onDay(day, { others: true })`, from the Friends button in the Planner) are drawn faintly with a dashed edge in their colour, next to yours.
