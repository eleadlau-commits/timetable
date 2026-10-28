# Study timer

A study timer on the **Study** tab. Build a pattern of study and rest blocks, run it, and see how much you've studied this week.

## What it adds

- **A card on the Study tab** (`study.cards`, under the library bar): *Study timer*, how long you've studied today, how far you are towards your weekly goal (if you've set one) and a **Start** button. While a timer runs, it shows the time left and whether it's study or rest. Tap it to open the pop-up.
- **A widget for Home** (`home.widgets`, off until someone adds it with Customise Home), in two sizes: **wide** (the same card as on Study) or **tall** (the title, the Start or Open button and the time stacked). While a timer runs it counts down there too.
- **The pop-up** (full screen):
  1. **Build a pattern.** A strip of blocks whose widths show their lengths: study blocks in the accent colour (or the module's colour), rest blocks pale. **+ Study** and **+ Rest** add blocks. Drag a block's right edge to make it longer or shorter, in 5-minute steps; tap a block to type an exact length (1–240 minutes) or delete it. **Repeat ×N** repeats the whole strip. Start from a preset (*Simple hour*: study 60; *Pomodoro*: study 25, rest 5, ×4; *Long focus*: study 50, rest 10) or a pattern you saved with **Save this pattern**. Choose a **module** from your timetable, or none. Then **Start**.
  2. **The running timer.** A big countdown, and the strip with a marker moving along it. **Pause** / **Resume**, **Skip** (to the next block) and **Stop**. Blocks carry on into the next one by themselves.
  3. **This week.** A bar for each day, Monday to Sunday, split by module colour; the total against the goal, the difference from last week, the number of sessions and the time for each module.
- **Weekly goal** (hours a week, optional): at the bottom of the pop-up, and in **Settings → Study timer**.

**Keeping time:** it saves when the timer started and each pause, resume and skip, and works out where it is from the clock. So it stays right with the phone locked or the app closed, and when you come back to a finished session, it's saved as it would have been.

**Notifications:** the phone apps schedule one for each change of block ("Time for a break", "Back to studying", "Session done"), with vibration, and cancel and redo them on Pause, Resume, Skip and Stop. The web version can only show a message and vibrate while the app is open; the pop-up says so.

**What counts:** only study time. Rest, paused and skipped time don't count. Stopping early still counts what you did.

## What it needs

- **Requires:** nothing.
- **Uses if present:** `study` (for its card; without it, there's nowhere to show the timer), `sessions` (the module list, names and colours; without it, you can still time study, just without modules).
- **Phone package:** `@capacitor/local-notifications` (also used by Reminders), for the notifications.

## What it saves on the phone

Only on this phone, nothing online:

- `draft` → `{ blocks: [{ kind: 'study' | 'rest', min }], repeat, from }`: the pattern being built (`from` is the id of the preset or saved pattern it started as).
- `patterns` → `[{ id, name, blocks, repeat }]`: patterns saved with a name. The presets aren't saved.
- `module` → the module code for the next session, or `null`.
- `run` → `{ pattern, module, startedAt, events: [{ type: 'pause' | 'resume' | 'skip', at }] }`: the running timer, or `null`.
- `history` → `[{ start, end, module, session }]`: finished study time (times in milliseconds; `session` is the start time of the run it came from). The week view is worked out from this.
- `goal` → hours a week to aim for (0 = no goal).

## The files

- `StudyTimer.js`: the feature: card, pop-up, notifications.
- `rules.js`: the rules without the screen (patterns, where a running timer is, notifications to come, totals per day, week and module, Monday as the start of the week, study that crosses midnight), tested in `tests/rules.test.js`.
- `strip.js`: the pattern strip and its dragging. It's marked `data-own-swipe`, so dragging it doesn't change tabs.
- `style.css`: its look, using the app's colours and shapes.

## How to check it works

1. Run `python build.py serve --test` and tap **Study**. The sample data has some study time this week and a 10-hour goal.
2. Tap the card, drag the end of a block, tap one to type a length, change **Repeat**, pick a module and tap **Start**. Try **Pause**, **Skip** and **Stop**, and close and reopen the app while it runs.
3. Try it in light and dark (**Settings → Appearance**).
4. Run `python build.py test`.
