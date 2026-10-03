# Personal relay (optional)

You only need this if the app says your university's server **blocked** it from reading your link.

The relay is a tiny program that runs free on Cloudflare. It fetches your calendar link for the app and passes the calendar back. Because it's your own relay, your private link doesn't go through anyone else's service.

## Set it up

1. Create a free account at <https://dash.cloudflare.com/sign-up>.
2. In the dashboard, go to **Workers & Pages → Create → Create Worker**. Name it something like `timetable-relay` and click **Deploy**.
3. Click **Edit code**, delete everything in the editor, and paste in the contents of [`worker.js`](worker.js).
4. **Lock the relay to your university.** Near the top of the code, find `ALLOWED_HOSTS` and add the host name from your timetable link. For example, if your link is
   `webcal://timetable.example.ac.uk/ical/abc123.ics`, change it to:
   ```js
   const ALLOWED_HOSTS = [
     'timetable.example.ac.uk',
   ];
   ```
   This stops anyone else from using your relay to fetch other websites.
5. Click **Deploy**. Copy the worker's address, which looks like `https://timetable-relay.yourname.workers.dev`.
6. In the app, open **Settings → Advanced: personal relay**, paste the address, and tap **Save and refresh**.

The app always tries the university's link directly first and only uses the relay when that's blocked.
