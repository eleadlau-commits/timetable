// Next class widget: a widget for the phone's own home screen (Android for now), showing the class
// on now or the next one, with its time and room, and the one after it. The widget itself is
// a small piece of Android code in native/; this part gives it the next two weeks of classes,
// kept on the phone with Capacitor's Preferences plugin (Android's SharedPreferences, where the
// widget can read them). The widget works out which class to show itself, so it stays right
// between visits to the app; it redraws when a class starts or ends, and every 30 minutes.
//
// Saved data: none in this.storage. On the phone, Preferences key 'mobile-durham.next-classes'
// → { v: 1, made, has, classes: [{ s, e, n, w }] } (see rules.js).

import { Feature, time } from 'folio';
import { DAYS, KEY, widgetData } from './rules.js';

export default class NextClassWidget extends Feature {
  start() {
    this.addHelp();
    this.sessions = this.use('sessions');
    this.timetable = this.use('timetable');
    this.preferences = this.plugin('Preferences'); // only in the phone app
    if (!this.preferences) return;

    const save = () => this.save();
    for (const event of ['sessions:changed', 'timetable:changed', 'timetable:loaded', 'timetable:cleared', 'app:resume']) {
      this.on(event, save);
    }
    save();
  }

  // Gives the widget the classes from today to two weeks ahead, as the app would show them
  // (renamed modules, hidden ones left out, your own events in).
  async save() {
    const now = new Date();
    const sessions = [];
    for (let i = 0; i <= DAYS; i++) {
      for (const s of this.sessions.onDay(time.addDays(time.startOfDay(now), i))) {
        sessions.push({ ...s, name: this.sessions.name(s), where: this.where(s) });
      }
    }
    const data = widgetData({ hasTimetable: !!this.timetable?.hasData, sessions, now });
    try {
      await this.preferences.set({ key: KEY, value: JSON.stringify(data) });
    } catch (e) {
      console.warn('The home-screen widget could not be updated', e);
    }
  }

  where(s) {
    const kind = this.sessions.kind(s);
    const place = s.location ? (this.sessions.placeLabel(s.location) || s.location) : '';
    return [kind, place].filter(Boolean).join(' · ');
  }

  addHelp() {
    this.add('help.questions', {
      group: 'home', order: 80, question: 'Can I see my next class without opening the app?', answer: () => [
        'Yes. Mobile Durham has a widget for your phone\'s home screen. Press and hold an empty space on your home screen, tap Widgets, find Mobile Durham and drag "Next class" where you want it.',
        'It shows the class on now or the next one, with its time and room, and the one after it. It updates by itself when a class starts or ends. Tap it to open the app.',
        'After you change your timetable or modules in the app, the widget can take up to half an hour to catch up.',
      ],
    });
  }
}
