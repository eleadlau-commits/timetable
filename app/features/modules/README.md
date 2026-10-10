# Modules

Sessions are grouped into modules by their code, e.g. ECON1011. For each module you can choose:
- a **display name**, e.g. "Microeconomics"
- a **colour**
- whether to **hide** it, for modules you don't go to

**What it adds:**
- **Rules for sessions:** names (`session.name`), colours (`session.colour`) and hiding (`session.filter`). Hidden sessions show as "2 hidden sessions · Manage modules".
- **Buttons:** "Colour, name or hide this module" in session details, and "Modules: colours, names and hiding" in Settings.
- **Windows:** the modules list and the module editor.

**Requires:** sessions.

**Saves:** `names`, `colours` and `hidden`, each per module. Brings these across from version 1 on first start, and forgets them when the timetable is removed.
