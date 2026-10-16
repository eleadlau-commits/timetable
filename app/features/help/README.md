# Help and feedback

The **Help** and **Feedback** rows in the menu. Neither is built yet, so tapping either shows a short *coming soon* message.

## What it adds

- **Help** (question-mark icon) in the menu (slot `header.buttons`, order 70), between Settings and About.
- **Feedback** (speech-bubble icon) in the menu (order 90), at the bottom.

## What it needs

- **Requires:** nothing.

## What it saves on the phone

Nothing.

## How to check it works

1. Run `python build.py serve --test` and open the app.
2. Open the menu (top left) and tap **Help**. A message at the bottom says Help is coming soon. Do the same for **Feedback**.
3. Delete this folder and build again: the two rows go, and the rest of the menu stays.
