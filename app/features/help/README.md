# Help and feedback

The **Help** and **Feedback** rows in the menu. Help is a page of questions and answers in groups; Feedback isn't built yet, so it shows a short *coming soon* message.

## What it adds

- **Help** (question-mark icon) in the menu (slot `header.buttons`, order 70), between Settings and About. It opens a full-screen pop-up:
  - **Groups** with a small heading each, in this order (from `groups.js`): Getting started, Your timetable, Home and the tabs, Studying, Around Durham, Friends, Your account, Privacy and your data, About the app. Questions naming a group that isn't listed go in *Other questions* at the end. Empty groups aren't shown.
  - **Each question** is a row with an arrow. Tap it and the answer opens under it (the arrow turns); tap again to fold it. A few questions, such as *How do I connect my timetable?*, open a **page of their own** instead, with the question as its title.
  - Some answers have a **button** under them, e.g. *Set up my timetable* or *Read the privacy notice*. It closes Help and does the thing.
  - Without any questions it shows **Missing content**.
- **Feedback** (speech-bubble icon) in the menu (order 90), at the bottom: *Feedback is coming soon.*

## Where the questions come from

- **Help's own** (`questions.js`): about the whole app. *What can Mobile Durham do?*, *Who makes Mobile Durham?*, *Does it cost anything?*, *Does it work without the internet?*, *Something isn't working. Who do I tell?* (with the email address, `CONTACT`, the same as in the privacy notice). In an answer, `{contact}` becomes the email link.
- **Other features'** (slot `help.questions`), so a feature's questions go when the feature does: Timetable (the setup guide page, updating, a wrong timetable, who can see the link), Account, Link backup, Friends, Library, Study timer, To-do list, Campus card, Reminders, Modules, Notes, Maps, Spots and Customise Home. Each keeps them in its own `addHelp()`.

## What it offers other features

- **Slot `help.questions`:** Item: `{ group, order, question, answer() → text, a list of paragraphs (text or elements) or an element, page?, action? }`. `group` is an id from `groups.js` (`start`, `timetable`, `home`, `study`, `around`, `friends`, `account`, `privacy`, `app`). Lower `order` comes first within a group. `page: true` opens the answer as its own page. `action: { label, run() }` adds a button under the answer; Help closes first, then `run()` is called. The answer is drawn when it's opened, so it can show what's true now.

## What it needs

- **Requires:** nothing.

## What it saves on the phone

Nothing.

## Files

- `Help.js`: the menu rows and the pop-up.
- `groups.js`: the groups and `arrange()`, which sorts questions into them. Tested in `tests/groups.test.js`.
- `questions.js`: Help's own questions and the contact address.
- `help.css`: the look.

## How to check it works

1. Run `python build.py serve --test` and open the app.
2. Open the menu (top left) and tap **Help**: the groups and their questions show. Tap a question: its answer opens under it. Tap it again: it folds.
3. Tap **How do I connect my timetable?**: a page with the steps opens. Tap **Change my timetable link** at the bottom: Help closes and the setup screen shows.
4. Tap **Feedback** in the menu: a message says it's coming soon.
5. Delete this folder and build again: the two rows go, and the rest of the menu stays. Delete another feature, such as `friends`: its questions go from Help.
