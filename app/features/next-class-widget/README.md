# Next class widget

A widget for the **phone's own home screen** (Android for now), next to the app icons. It shows the class on now or the next one, its time and room, and the class after it, without opening the app. Tap it to open Mobile Durham.

It's different from the widgets on the app's Home tab, which you only see inside the app.

## What it looks like

A dark purple card (the app icon's colour, in the app's "knife" shape), about 3 by 2 squares, which people can stretch:

- a small label: **Now · until 11:00**, **Up next · 14:00**, **Tomorrow · 09:00** or **Thu 19 Nov · 09:00**
- the class's name (as renamed in Modules), up to two lines
- what kind it is and where (Lecture · Calman Learning Centre)
- **Then 15:00 · Seminar**, the class after it

Otherwise it says *Open the app to see your next class* (the app hasn't given it anything yet), *Add your timetable in the app*, *No classes in the next two weeks*, or *Open the app to see your classes* (nothing given for over 12 days).

## How it works

Two parts:

1. **In the app** (`NextClassWidget.js`): whenever the timetable or how sessions look changes, and each time the app opens or comes back, it gives the widget every class from today to two weeks ahead, as the app shows them (renamed, hidden modules left out, your own events in; cancelled and all-day ones left out). They're kept on the phone with Capacitor's **Preferences** plugin, which on Android is SharedPreferences (`CapacitorStorage`), where Android code can read them.
2. **The widget itself** (`native/`), Android code that the build copies into the Android project: `NextClassWidget.java` reads the classes and works out what to show right now, so it stays right between visits to the app. It sets an alarm for the next change (a class starting or ending, or midnight), and Android redraws it at least every 30 minutes. The alarm never wakes a sleeping phone. It also redraws when the clock or time zone changes and after the app is updated.

The app can't tell the widget to redraw straight away, so after changing your timetable or modules the widget can take up to half an hour to catch up.

## What it adds

- **The widget** (Android), through Folio's `native.android.application` (the `<receiver>` in `native/receiver.xml`) and `native.android.files`.
- **A Help question** (*Can I see my next class without opening the app?*, in *Home and the tabs*), in the Android app only.

## What it needs

- **Requires:** sessions.
- **Uses if present:** timetable (to tell "no timetable" from "no classes"), help.
- **Platforms:** Android only. On the web there are no home-screen widgets. The iPhone version needs a separate widget extension written in Swift, which is a later step.

## What it saves

- Nothing in `this.storage`.
- On the phone, Preferences key **`mobile-durham.next-classes`** (never rename it; the Java code reads it): `{ v: 1, made, has, classes: [{ s: start, e: end (milliseconds), n: name, w: where }] }`, at most 120 classes.

Nothing goes online.

## Files

- `NextClassWidget.js`: gives the widget its classes.
- `rules.js`: what the widget is given (`widgetData`). Tested in `tests/rules.test.js`.
- `native/NextClassWidget.java`: the widget.
- `native/next_class_widget.xml`: its layout. `native/next_class_widget_bg.xml`: the card. `native/next_class_widget_info.xml`: its size and how often it redraws. `native/next_class_widget_strings.xml`: its name and description in the widget list. `native/receiver.xml`: the part of the Android manifest that tells Android about it.

## How to check it works

1. Install the APK from a build, open the app once with a timetable added.
2. Press and hold an empty space on the home screen → **Widgets** → **Mobile Durham** → drag **Next class** onto the home screen.
3. It should show your next class. Wait until a class starts: the label changes to *Now · until …* within a minute or so of the phone being in use.
