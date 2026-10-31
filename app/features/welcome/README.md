# Welcome

The first screen after installing the app: **I'm a student** or **I run a business**. Other features ask it which version of the app to show.

## What it adds

- **The welcome screen**, shown once on a new phone, before anything else. *I'm a student* goes on to the app as it always was (the timetable setup screen first). *I run a business* goes to the business version, and the shop feature opens *Set up your business*.
- People who already use the app never see it: the timetable feature finds their timetable and tells this feature they're students (`assume('student')`).
- **Settings → Using the app as**: A student or A business, to switch at any time.
- On the timetable setup screen, a **Set up your business instead** link, for a business that tapped Student by mistake.

## The business version

Features leave things out when `this.use('audience')?.isBusiness()` is true:

- **Tabs:** Planner, Study and More are hidden (each view's `visible()`), so a business has Home and Spots.
- **Buttons:** Friends (top bar) and Reminders (menu) are hidden.
- **Timetable:** no setup screen, and no Timetable section in Settings.
- **Home:** widgets and pages say who they're for with `audience`: nothing means students only, `'business'` the business version only, `'everyone'` both (Explore and Student deals). Customise Home keeps the business version's widgets apart (`business-widgets`).

## What it offers

- **Service `audience`:** `kind` ('student', 'business' or null while nobody has chosen), `isBusiness()`, `isStudent()`, `isFor(item)`, `choose(kind)`, `ask()` (shows the welcome screen again), `assume(kind)` (sets it only if nobody has chosen).
- **Event `audience:changed`:** `{ kind, first }`, sent when the choice changes; `first` is true when it was made on the welcome screen.

## What it needs

- **Requires:** nothing.
- **Uses if present:** nothing. Without this feature, everyone gets the student version, and the timetable setup screen shows first, as before.

## What it saves on the phone

- `kind` → `'student'` or `'business'`.

## How to check it works

1. Run `python build.py serve` (without `--test`), and open the app in a private window: the welcome screen shows.
2. Tap **I'm a student**: the timetable setup screen follows.
3. In a new private window, tap **I run a business**: Home has *Your shop* at the top and the shop widgets; the tabs are Home and Spots; *Set up your business* opens.
4. **Settings → Using the app as** switches back.
5. Run `python build.py test` (the test build has a timetable, so it starts as a student, as existing users do).
