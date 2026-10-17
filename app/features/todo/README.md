# To-do list

A list of things to do, with tags and due dates. Saved on this phone only.

## What it adds

- **A big "Plan Today" button on Home**, on the left under the "Next: …" line (slot `home.next`), in Home's big outlined button style (`home-button`). Inside it, in small text under *Plan Today*, how many unticked to-dos are due today: *Nothing due today*, *1 thing due today*, *3 things due today*. It changes as soon as a to-do is added, ticked or changed, and when the day changes.
- **A "To-do list" row on the More tab** (group *On the go*), showing how many are left.
- Both open the **To-do list pop-up**:
  - **Due today** at the top: the unticked to-dos due today, whichever tag is chosen. Tick or delete them right there. (They're in the full list below too.)
  - **Tags along the top** to filter by: *All*, then each tag (*Academic* and *Society* to start with), then **+ Add tag**. Pick a tag to see **Rename tag** and **Delete tag** under the tags. Deleting a tag keeps its to-dos, just without a tag.
  - **The list:** a round tick box, the to-do, its tag as a small pill, and its due date (*Today*, *Tomorrow*, a weekday, or the date). Ticked to-dos are crossed out. The bin deletes one. Sorted by due date, soonest first, with to-dos without a date last. Overdue ones (not ticked, and the date has gone by) say **Overdue** in red.
  - **+ Add a to-do:** the text, an optional tag (the tag you're looking at is picked for you) and an optional due date. The form stays open so you can add several; **Done** closes it.

## What it needs

- **Requires:** nothing.
- **Uses if present:** `home` (for the button) and `more` (for the row). Without both, there's no way to open the list, but nothing breaks.

## What it saves on the phone

| Key | What |
|---|---|
| `items` | The to-dos: `[{ id, text, tag, due, done, added }]`. `tag` is a tag's id or `null`; `due` is `'YYYY-MM-DD'` or `null`. |
| `tags` | The tags: `[{ id, name }]`. Until you change them, the starting tags (Academic and Society). Renaming a tag keeps its id, so its to-dos keep it. |

Nothing is sent anywhere.

## The rules

Sorting, overdue, due today (`dueToday`, and `dueTodayText` for the words), filtering and adding, renaming and deleting tags are in `rules.js`, without any screen code, and tested in `tests/rules.test.js`.

## How to check it works

1. Run `python build.py serve --test` and open the app. The sample data has five to-dos: one overdue, one ticked, and one due today, so Home says *1 thing due today*.
2. Tap **Plan Today** under the clock. *Email tutor about the seminar* is under **Due today**; tick it, and Home says *Nothing due today*. Tick and untick one, delete one, add one with a tag and a date.
3. Pick **Society**, tap **Rename tag**, rename it; then add a tag and delete it. Its to-dos stay, without a tag.
4. Reload the page: everything you changed is still there (in the test build the sample to-dos come back, because the sample data is loaded again).
5. Run `python build.py test`.
