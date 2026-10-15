// Link sharing (web version only): two ways to get the timetable link from one device to another.
//   - A QR code: paste the link on a computer, scan the code with the phone's camera, and the app
//     opens on the phone with the link filled in (#setup=… in the address).
//   - Android's share sheet: once the web app is installed, "Share" a link to Timetable
//     (?url=… or ?text=… in the address, set up by "share_target" in feature.json).

import { Feature, ui } from 'folio';

const { el } = ui;
const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

export default class LinkSharing extends Feature {
  start() {
    this.timetable = this.use('timetable');
    this.relay = this.use('relay'); // null unless the web relay is installed

    this.add('timetable.setup', {
      order: 10,
      render: () => el('div', {},
        el('b', {}, 'Pasted it on a computer?'),
        ' Open this app on the computer as well, paste the link into the box above, then tap below and scan the code with your phone\'s camera.',
        el('button', { type: 'button', class: 'btn block', onclick: () => this.showQR(this.timetable.typedLink) }, 'Show QR code for my phone')),
    });
    this.add('timetable.setup', {
      order: 20,
      render: () => el('div', {},
        el('b', {}, 'On Android?'), ' Once the app is on your home screen, you can tap ', el('i', {}, 'Share'),
        ' on the link in any app and pick ', el('i', {}, 'Timetable'), '.'),
    });
    this.add('timetable.settings', {
      order: 10,
      render: (context) => el('button', { type: 'button', class: 'btn', onclick: () => this.showQR(context.link()) }, 'Send to phone'),
    });

    this.takeIncoming();
  }

  // A link that arrived in the address (from the QR code or the share sheet).
  takeIncoming() {
    const hash = new URLSearchParams(location.hash.slice(1));
    const query = new URLSearchParams(location.search);
    let link = hash.get('setup');
    const relay = hash.get('relay');
    if (!link) {
      const shared = ['url', 'text', 'title'].map((k) => query.get(k)).filter(Boolean).join(' ');
      link = this.timetable.normaliseLink(shared);
    }
    if (location.hash || location.search) history.replaceState(null, '', location.pathname);
    if (relay) this.relay?.setPending(relay);
    if (link) this.timetable.prefill(link);
  }

  async showQR(raw) {
    const link = this.timetable.normaliseLink(raw);
    if (!link) {
      this.toast('Paste your timetable link first.');
      return;
    }
    if (!this.window) {
      this.box = el('div', { class: 'qr' });
      this.window = ui.dialog({ title: 'Send to your phone' });
      this.window.setContent(
        ui.hint('Point your phone\'s camera at this code. It opens the app with your link filled in.'),
        this.box,
        ui.hint('Only scan this with your own phone, because the code contains your private timetable link.', { small: true }));
    }
    if (location.protocol === 'file:') {
      this.box.textContent = 'The QR code only works once the app is online at a web address.';
      this.window.open();
      return;
    }
    const target = new URL(location.pathname, location.origin);
    const params = new URLSearchParams({ setup: link });
    if (this.relay?.address) params.set('relay', this.relay.address);
    target.hash = params.toString();

    this.box.textContent = 'Making code…';
    this.window.open();
    try {
      await ui.loadScript(QR_LIB);
      this.box.textContent = '';
      new window.QRCode(this.box, { text: target.href, width: 240, height: 240, correctLevel: window.QRCode.CorrectLevel.L });
    } catch {
      this.box.textContent = "Couldn't create the QR code (are you offline?). Email the link to yourself instead.";
    }
  }
}
