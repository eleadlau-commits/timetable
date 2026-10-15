# Link sharing (web version only)

Two ways to get the timetable link from one device to another:

- **QR code:** paste the link on a computer, tap *Show QR code for my phone*, then scan it with the phone's camera. The app opens on the phone with the link filled in.
- **Android share sheet:** once the web app is installed, *Share* a link from any app and pick *Timetable*. This is set up by `web.manifest.share_target` in `feature.json`.

**What it adds:**
- **Setup screen:** two blocks under "Other ways to get the link in" (`timetable.setup`).
- **Settings:** a "Send to phone" button (`timetable.settings`).

**What it needs:**
- **Requires:** timetable.
- **Uses if present:** web-relay, so a relay address travels with the QR code.
- **Platforms:** web only.

**Saves:** nothing.
