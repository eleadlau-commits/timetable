# To-dos in the Planner

The to-do list's to-dos on the days they're due, so the Planner shows what you have to do as well as where you have to be.

## What it adds

- **Day view: a To do card** above the day's classes (Day's slot `day.cards`). It lists the to-dos due that day, with a round tick box to tick them off right there, their tag, and **+ Add** (opens the to-do list with a new to-do already due that day). On **today**, anything overdue (not ticked, due on an earlier day) comes first, marked **Overdue · Yesterday** (or the date) in red; an overdue one you tick today stays on today, crossed out, until tomorrow. Ticked ones are crossed out at the bottom. Tap a to-do's words to open the whole list. A day with nothing due shows just a small **+ Add a to-do** line.
- **A small tick in the corner of a day** in Day's week strip (`day.marks`) and in the Month grid (`month.marks`) when something due that day isn't ticked yet: purple, or red once the day has gone by. Screen readers hear "1 to-do" or "2 to-dos overdue" after the day's name.
- **Month view: the chosen day's To do card** above its classes (`month.cards`), the same as in Day, but nothing at all on a day with no to-dos.
- **A Help question** (*Do my to-dos show in the Planner?*, in *Your timetable*).

To-dos without a due date stay in the list (Home's Plan Today page and the To-do widget).

## What it needs

- **Requires:** todo (its service `todos`). Without the to-do list it's left out.
- **Uses if present:** day-view, month-view (for their slots), help. Without one of the views, that part just doesn't show.

## What it saves on the phone

- Nothing. The to-dos belong to the to-do list; ticking one here ticks it there (`todos.setDone`).

## Files

- `PlannerTodos.js`: the card, the ticks and the Help question.
- `rules.js`: which to-dos go on which day (`forDay`), the tick on a day (`markFor`, `markLabel`) and how an overdue one says when it was due (`lateLabel`). Tested in `tests/rules.test.js`.
- `style.css`: the card and the tick, in the to-do list's own look.

## How to check it works

1. Run `python build.py serve --test` and open **Planner** on Day. The sample data has *Hand in economics essay* due yesterday, *Email tutor about the seminar* and *Read chapter 2* (ticked) due today, and *Book room for society social* in two days.
2. Today's To do card shows the essay first (Overdue · Yesterday), then the email, then the ticked chapter. Yesterday has a red tick in the strip, today and the society day a purple one.
3. Tick the essay: it stays, crossed out, and yesterday's red tick goes. Tick it again to bring it back.
4. Go to the society day and tap **+ Add**: the to-do list opens with a new to-do due that day. Go to a day with nothing due: there's just **+ Add a to-do**.
5. Tap **M**: the same ticks are on the month, and today's to-dos are above today's classes.
6. Run `python build.py test`.
