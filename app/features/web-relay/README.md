# Web relay (web version only)

Some university servers stop web pages from reading the timetable link directly, because of a browser rule called CORS. You can run your own free relay: a tiny program on Cloudflare that fetches the link for the app. Its code and setup steps are in `extras/`, which is never copied into the app.

**What it adds:**
- **Downloading:** when the direct download is blocked, the timetable is fetched through the relay instead (`timetable.fetch`).
- **Error messages:** clearer explanations when the download is blocked (`timetable.explain`).
- **Settings:** an "Advanced: personal relay" setting.

**What it offers:** the service `relay`, with `address` and `setPending(address)`. Link sharing uses it to send the relay address with the QR code.

**What it needs:**
- **Requires:** timetable.
- **Platforms:** web only. The Android app doesn't need it.

**Saves:** `address`. Brings it across from version 1 (`tt.relay`).
