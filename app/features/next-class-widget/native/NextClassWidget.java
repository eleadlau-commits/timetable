// Mobile Durham's next-class widget for the Android home screen (feature next-class-widget).
//
// The app gives it the next two weeks of classes (NextClassWidget.js, through Capacitor's
// Preferences plugin, which keeps them in the "CapacitorStorage" SharedPreferences). From those,
// this works out what to show right now: the class on now, or the next one, and the one after.
// It sets an alarm for the next time that changes (a class starting or ending, or midnight,
// when "Tomorrow" becomes today), and Android also redraws it every 30 minutes.
// Tapping it opens the app.

package io.github.timetable.app.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class NextClassWidget extends AppWidgetProvider {
    static final String PREFS = "CapacitorStorage";
    static final String KEY = "mobile-durham.next-classes"; // the same as KEY in rules.js
    static final String REFRESH = "io.github.timetable.app.widget.REFRESH";
    static final long MINUTE = 60_000L;
    static final long DAY = 24 * 60 * MINUTE;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        draw(context, manager, ids);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (REFRESH.equals(action) || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            draw(context, manager, manager.getAppWidgetIds(new ComponentName(context, NextClassWidget.class)));
        }
    }

    @Override
    public void onDisabled(Context context) {
        // The last widget was removed: no more alarms.
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.cancel(refreshIntent(context));
    }

    static void draw(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) return;
        long now = System.currentTimeMillis();
        String label = "Mobile Durham";
        String name;
        String where = "";
        String then = "";
        long change = now + 30 * MINUTE;

        JSONObject data = null;
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
        if (raw != null) {
            try {
                data = new JSONObject(raw);
            } catch (JSONException e) {
                data = null;
            }
        }

        if (data == null) {
            name = "Open the app to see your next class";
        } else if (!data.optBoolean("has")) {
            name = "Add your timetable in the app";
        } else {
            JSONArray classes = data.optJSONArray("classes");
            JSONObject lead = null;
            JSONObject after = null;
            for (int i = 0; classes != null && i < classes.length(); i++) {
                JSONObject c = classes.optJSONObject(i);
                if (c == null || c.optLong("e") <= now) continue;
                if (lead == null) lead = c;
                else { after = c; break; }
            }
            if (lead == null) {
                // The app gives two weeks at a time, so after a long time away it may just be old.
                boolean old = now - data.optLong("made") > 12 * DAY;
                name = old ? "Open the app to see your classes" : "No classes in the next two weeks";
            } else {
                long start = lead.optLong("s");
                long end = lead.optLong("e");
                if (start <= now) {
                    label = "Now · until " + time(context, end);
                    change = Math.min(change, end);
                } else {
                    label = day(start, now, "Up next") + " · " + time(context, start);
                    change = Math.min(change, start);
                }
                name = lead.optString("n", "Class");
                where = lead.optString("w", "");
                if (after != null) {
                    long next = after.optLong("s");
                    String when = sameDay(next, start) ? time(context, next)
                            : day(next, now, "today").replace("Tomorrow", "tomorrow") + " " + time(context, next);
                    then = "Then " + when + " · " + after.optString("n", "Class");
                }
            }
        }
        change = Math.min(change, startOfDay(now) + DAY); // at midnight "Tomorrow" becomes today

        String pkg = context.getPackageName();
        RemoteViews views = new RemoteViews(pkg, id(context, "next_class_widget", "layout"));
        views.setTextViewText(id(context, "ncw_label", "id"), label);
        views.setTextViewText(id(context, "ncw_name", "id"), name);
        views.setTextViewText(id(context, "ncw_where", "id"), where);
        views.setViewVisibility(id(context, "ncw_where", "id"), where.isEmpty() ? View.GONE : View.VISIBLE);
        views.setTextViewText(id(context, "ncw_then", "id"), then);
        views.setViewVisibility(id(context, "ncw_then", "id"), then.isEmpty() ? View.GONE : View.VISIBLE);

        Intent open = context.getPackageManager().getLaunchIntentForPackage(pkg);
        if (open != null) {
            views.setOnClickPendingIntent(id(context, "ncw_root", "id"), PendingIntent.getActivity(
                    context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        manager.updateAppWidget(ids, views);

        // Redraw when it next changes. RTC (not RTC_WAKEUP): it never wakes a sleeping phone, it
        // just waits until the phone is next in use.
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.set(AlarmManager.RTC, change + 1000, refreshIntent(context));
    }

    static PendingIntent refreshIntent(Context context) {
        Intent intent = new Intent(context, NextClassWidget.class).setAction(REFRESH);
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // The app's resources are looked up by name, so this file doesn't depend on the app's id.
    static int id(Context context, String name, String type) {
        return context.getResources().getIdentifier(name, type, context.getPackageName());
    }

    // 10:00 (or 10:00 am), as the phone is set to show times.
    static String time(Context context, long at) {
        DateFormat format = android.text.format.DateFormat.getTimeFormat(context);
        return format.format(new Date(at));
    }

    // "Up next" (or another word) for today, "Tomorrow", then "Thu 19 Nov".
    static String day(long at, long now, String today) {
        long days = (startOfDay(at) - startOfDay(now) + DAY / 2) / DAY; // rounded, for clock changes
        if (days <= 0) return today;
        if (days == 1) return "Tomorrow";
        return new SimpleDateFormat("EEE d MMM", Locale.getDefault()).format(new Date(at));
    }

    static boolean sameDay(long a, long b) {
        return startOfDay(a) == startOfDay(b);
    }

    static long startOfDay(long at) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(at);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }
}
