// src/services/alarmScheduler.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { appointmentsApi } from "@/services/appointmentsApi";
import { medicationsApi } from "@/services/medicationsApi";

const SCHEDULED_IDS_KEY = "scheduledNotificationIds:v1";
let scheduleQueue: Promise<void> = Promise.resolve();

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

export async function clearScheduledNotifications() {
  await cancelPreviouslyScheduled();
}

function shouldScheduleForPatientOnly(userRole?: string) {
  // accept "PATIENT" or "patient"
  return String(userRole ?? "").toLowerCase() === "patient";
}

function isOngoingMedication(status?: string) {
  return String(status ?? "").toLowerCase() === "ongoing";
}

function getReAlarmAfterMinutes(m: any): number {
  // backward compatible:
  // - old field: reminderOffsetMinutes (previously treated as "before")
  // - new semantics: reAlarmAfterMinutes (after the scheduled time)
  const v =
    m?.schedule?.reAlarmAfterMinutes ??
    m?.schedule?.realarmAfterMinutes ??
    m?.schedule?.reminderOffsetMinutes ??
    0;

  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

async function rescheduleAllFromCacheInternal(opts: {
  medications: any[];
  appointments: any[];
  horizonDays?: number;
  userRole?: "PATIENT" | "CAREGIVER" | string;
}) {
  // HARD GATE: only patients get local scheduled notifications
  if (!shouldScheduleForPatientOnly(opts.userRole)) {
    await cancelPreviouslyScheduled();
    return;
  }

  const horizonDays = opts.horizonDays ?? 14;
  const now = new Date();
  const end = addDays(now, horizonDays);

  await cancelPreviouslyScheduled();

  const ids: string[] = [];

  // Appointments (single fire at appointment time)
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
          userId: a.userId,
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
    if (!isOngoingMedication(m.status)) continue;

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

      // 1) MAIN alarm at scheduled time
      if (scheduledAt.getTime() > Date.now() + 1000 && scheduledAt <= end) {
        const idMain = await Notifications.scheduleNotificationAsync({
          content: {
            title: `Take ${m.name}`,
            body: `${m.dose}${m.notes ? ` • ${m.notes}` : ""}`,
            sound: "medication.wav",
            data: {
              kind: "MEDICATION",
              userId: m.userId,
              medId: m.id,
              name: m.name,
              dose: m.dose,
              notes: m.notes ?? "",
              date: dayYmd,
              time: m.schedule.time,
              isReAlarm: false,
              reminderOffsetMinutes: m.schedule?.reminderOffsetMinutes ?? 0,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: scheduledAt,
            channelId: "medication",
          },
        });

        ids.push(idMain);
      }

      // 2) RE-ALARM after N minutes (NOT "remind before")
      const reAlarmAfterMinutes = getReAlarmAfterMinutes(m);
      if (reAlarmAfterMinutes > 0) {
        const reAlarmAt = new Date(
          scheduledAt.getTime() + reAlarmAfterMinutes * 60000,
        );

        if (reAlarmAt.getTime() <= Date.now() + 1000) continue;
        if (reAlarmAt.getTime() > end.getTime()) continue;

        const idRe = await Notifications.scheduleNotificationAsync({
          content: {
            title: `Take ${m.name} (Re-alarm)`,
            body: `${m.dose}${m.notes ? ` • ${m.notes}` : ""}`,
            sound: "medication.wav",
            data: {
              kind: "MEDICATION",
              userId: m.userId,
              medId: m.id,
              name: m.name,
              dose: m.dose,
              notes: m.notes ?? "",
              date: dayYmd,
              time: m.schedule.time,
              isReAlarm: true,
              reminderOffsetMinutes: m.schedule?.reminderOffsetMinutes ?? 0,
              reAlarmAfterMinutes,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reAlarmAt,
            channelId: "medication",
          },
        });

        ids.push(idRe);
      }
    }
  }

  await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(ids));
}

function enqueueSchedule(task: () => Promise<void>) {
  const next = scheduleQueue.then(task, task);
  scheduleQueue = next.catch(() => {});
  return next;
}

export function rescheduleAllFromCache(opts: {
  medications: any[];
  appointments: any[];
  horizonDays?: number;
  userRole?: "PATIENT" | "CAREGIVER" | string;
}) {
  return enqueueSchedule(() => rescheduleAllFromCacheInternal(opts));
}

export function rescheduleCurrentUserNotifications(horizonDays = 14) {
  return enqueueSchedule(async () => {
    const entries = await AsyncStorage.multiGet(["userId", "userRole"]);
    const values = Object.fromEntries(entries);
    const userId = values.userId ?? "";
    const userRole = values.userRole ?? "";

    if (!userId) {
      await cancelPreviouslyScheduled();
      return;
    }

    const [medications, appointments] = await Promise.all([
      medicationsApi.getCached(userId),
      appointmentsApi.getCached(userId),
    ]);

    await rescheduleAllFromCacheInternal({
      medications,
      appointments,
      horizonDays,
      userRole,
    });
  });
}
