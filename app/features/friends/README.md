# Friends

The **Friends** button in the top bar, on every tab. There's no Friends screen yet, so tapping it shows a short *Friends is coming soon* message.

## What it adds

- **A button in the top bar** (slot `header.actions`), with the two-people icon, just left of the account button.

## What it needs

- **Requires:** nothing.

## What it saves on the phone

Nothing.

## How to check it works

1. Run `python build.py serve --test` and open the app.
2. Tap the two-people button at the top right. A message at the bottom says Friends is coming soon.
3. Delete this folder and build again: the button goes, and the account button stays.
