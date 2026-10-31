# Customise Home

Lets people choose **Home's widgets and photo**. Home itself stays the same at the top: the dark area with the clock and the pages you swipe between is always there.

## What it adds

- **A pencil** on Home, at the right of the dots under the clock (Home's `home.tools` slot), and a **Home** section in Settings with a **Customise** button. Both open the **Customise Home** pop-up:
  - **Photo:** Durham (Home's own) or **your own**. Tap *Choose your own* to pick a photo from the phone. It's shrunk (at most 1400 px across, a JPEG) and saved on this phone only. *Choose a different photo* swaps it.
  - **Your Home:** a small picture of Home's grid, with the widgets where they go and the **free space** left (worked out for this phone's height). Then each widget on Home with its **sizes** (Wide, Tall, Large, each with a little drawing of its shape; tap one to change size), **up and down** buttons to move it and **×** to remove it.
  - **Add a widget:** the widgets not on Home, each with its sizes, including ones from other tabs that start off Home (the study timer, the to-do list and student deals). Tap a size to add it at the end.
  - If a change won't fit, nothing changes and it says **"No room for this. Remove a widget or pick a smaller size."** Sizes that won't fit are shown faded.
  - **Back to the original** puts the usual widgets and the Durham photo back.
- Home asks for the choices through its `home.layout` slot. Without this feature, Home shows its usual widgets and photo.

## What it needs

- **Requires:** home (it's left out without it)
- **Uses if present:** welcome (to keep the business version's choice apart)

## What it saves on the phone

- `widgets`: the widgets on Home, in order, `[{ id, size }]`. Nothing saved means Home's usual ones.
- `business-widgets`: the same for the business version of the app (the welcome feature), kept apart so switching doesn't mix them up. Home only offers each version its own widgets.
- `photo`: `durham` (the default) or `own`.
- `own-photo`: the photo chosen from the phone, shrunk, as a `data:` address.

## Files

- `CustomiseHome.js`: the pop-up, the pencil, the Settings row and the photo picking.
- `rules.js`: adding, removing, moving and resizing widgets, and how small to make a photo, tested in `tests/rules.test.js`. Whether things fit is Home's rule (`home/grid.js`), asked through the `home` service.

## How to check it works

1. Run `python build.py serve --test` and open Home.
2. Tap the pencil. Change the lectures to **Tall** and the campus card to **Wide**; close the pop-up and check Home.
3. Remove a widget, add it back in another size, and move one up and down.
4. Choose your own photo, then Durham again. Tap **Back to the original**.
5. Run `python build.py test`.
