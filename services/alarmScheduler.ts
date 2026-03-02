import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

const SCHEDULED_IDS_KEY = "scheduledNotificationIds:v1";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseHHmm(time: string) {
  const [h, m] = time.split(":");
  return { h: Number(h), m: Number(m ?? "0") };
}

function atLocalDateTime(ymd: string, hhmm: string) {
  const [y, mo, da] = ymd.split("-").map(Number);
  const { h, m } = parseHHmm(hhmm);
  return new Date(y, (mo ?? 1) - 1, da ?? 1, h, m, 0, 0);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function weekdayCode(d: Date) {
  const map = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
  return map[d.getDay()];
}

async function cancelPreviouslyScheduled() {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    await Promise.all(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );
  } catch {}
  await AsyncStorage.removeItem(SCHEDULED_IDS_KEY);
}

export async function rescheduleAllFromCache(opts: {
  medications: any[];
  appointments: any[];
  horizonDays?: number;
}) {
  const horizonDays = opts.horizonDays ?? 14;
  const now = new Date();
  const start = now;
  const end = addDays(now, horizonDays);

  await cancelPreviouslyScheduled();

  const ids: string[] = [];

  // Appointments
  for (const a of opts.appointments ?? []) {
    const dt = atLocalDateTime(a.appointmentDate, a.appointmentTime);
    if (dt.getTime() <= Date.now() + 1000) continue;
    if (dt.getTime() > end.getTime()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Appointment: ${a.title}`,
        body: a.notes ?? "Tap to view details.",
        sound: "appointment.wav",
        data: {
          kind: "APPOINTMENT",
          apptId: a.id,
          title: a.title,
          notes: a.notes ?? "",
          date: a.appointmentDate,
          time: a.appointmentTime,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: dt,
        channelId: "appointment",
      },
    });

    ids.push(id);
  }

  // Medications (expand repeat rules)
  for (const m of opts.medications ?? []) {
    if (m.status !== "ongoing") continue;

    for (let i = 0; i <= horizonDays; i++) {
      const day = addDays(
        new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        i,
      );
      const dayYmd = toYmd(day);

      if (dayYmd < m.startDate) continue;
      if (m.repeat?.endDate && dayYmd > m.repeat.endDate) continue;

      let matches = false;

      if (m.repeat.type === "once") {
        matches = dayYmd === m.startDate;
      } else if (m.repeat.type === "daily") {
        const base = atLocalDateTime(m.startDate, "00:00");
        const diffDays = Math.floor(
          (day.getTime() - base.getTime()) / 86400000,
        );
        matches =
          diffDays >= 0 && diffDays % Math.max(1, m.repeat.interval) === 0;
      } else if (m.repeat.type === "weekly") {
        const wd = weekdayCode(day);
        if (m.repeat.daysOfWeek?.includes(wd)) {
          const base = atLocalDateTime(m.startDate, "00:00");
          const diffDays = Math.floor(
            (day.getTime() - base.getTime()) / 86400000,
          );
          const diffWeeks = Math.floor(diffDays / 7);
          matches =
            diffWeeks >= 0 && diffWeeks % Math.max(1, m.repeat.interval) === 0;
        }
      } else if (m.repeat.type === "monthly") {
        const [, , sd] = String(m.startDate).split("-").map(Number);
        if (sd === day.getDate()) {
          const [sy, sm] = String(m.startDate).split("-").map(Number);
          const monthDiff =
            (day.getFullYear() - sy) * 12 + (day.getMonth() - (sm - 1));
          matches =
            monthDiff >= 0 && monthDiff % Math.max(1, m.repeat.interval) === 0;
        }
      }

      if (!matches) continue;

      const scheduledAt = atLocalDateTime(dayYmd, m.schedule.time);
      const fireAt = new Date(
        scheduledAt.getTime() - (m.schedule.reminderOffsetMinutes ?? 0) * 60000,
      );

      if (fireAt.getTime() <= Date.now() + 1000) continue;
      if (fireAt.getTime() > end.getTime()) continue;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Take ${m.name}`,
          body: `${m.dose}${m.notes ? ` • ${m.notes}` : ""}`,
          sound: "medication.wav",
          data: {
            kind: "MEDICATION",
            medId: m.id,
            name: m.name,
            dose: m.dose,
            notes: m.notes ?? "",
            date: dayYmd,
            time: m.schedule.time,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: "medication",
        },
      });

      ids.push(id);
    }
  }

  await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(ids));
}
