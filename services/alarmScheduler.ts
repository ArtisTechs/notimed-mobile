// src/services/alarmScheduler.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  APPOINTMENT_CHANNEL_ID,
  MEDICATION_CHANNEL_ID,
} from "@/constants/notifications";
import { appointmentsApi } from "@/services/appointmentsApi";
import { androidAlarm } from "@/services/androidAlarm";
import { medicationsApi } from "@/services/medicationsApi";

const SCHEDULED_ALARMS_KEY = "scheduledAlarmEntries:v2";
const LEGACY_SCHEDULED_IDS_KEY = "scheduledNotificationIds:v1";
let scheduleQueue: Promise<void> = Promise.resolve();

type ScheduledAlarmEntry = {
  alarmId: string;
  notificationId: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function normalizeYmdInput(value: unknown) {
  const raw = String(value ?? "").trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match?.[1] ?? "";
}

function normalizeTimeInput(value: unknown) {
  const raw = String(value ?? "").trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(raw);
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseHHmm(time: string) {
  const normalized = normalizeTimeInput(time);
  if (!normalized) {
    return null;
  }

  const [h, m] = normalized.split(":");
  return { h: Number(h), m: Number(m ?? "0") };
}

function atLocalDateTime(ymd: string, hhmm: string) {
  const normalizedYmd = normalizeYmdInput(ymd);
  if (!normalizedYmd) return null;

  const [y, mo, da] = normalizedYmd.split("-").map(Number);
  const timeParts = parseHHmm(hhmm);
  if (!timeParts) return null;

  const { h, m } = timeParts;
  if (![y, mo, da, h, m].every(Number.isFinite)) return null;

  const next = new Date(y, (mo ?? 1) - 1, da ?? 1, h, m, 0, 0);
  return Number.isNaN(next.getTime()) ? null : next;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function parseYmd(ymd: string) {
  const normalized = normalizeYmdInput(ymd);
  if (!normalized) return null;

  const [y, mo, da] = normalized.split("-").map(Number);
  const next = new Date(y, (mo ?? 1) - 1, da ?? 1);
  return Number.isNaN(next.getTime()) ? null : next;
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a: Date, b: Date) {
  const a0 = startOfLocalDay(a).getTime();
  const b0 = startOfLocalDay(b).getTime();
  return Math.floor((b0 - a0) / 86400000);
}

function weeksBetween(a: Date, b: Date) {
  return Math.floor(daysBetween(a, b) / 7);
}

function monthsBetween(a: Date, b: Date) {
  return (
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  );
}

function weekdayCode(d: Date) {
  const map = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
  return map[d.getDay()];
}

async function cancelPreviouslyScheduled() {
  const entries = await readScheduledAlarmEntries();

  try {
    await Promise.all(
      entries.map(async ({ alarmId, notificationId }) => {
        try {
          await Notifications.dismissNotificationAsync(notificationId);
        } catch {}

        try {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
        } catch {}

        if (notificationId !== alarmId) {
          try {
            await Notifications.dismissNotificationAsync(alarmId);
          } catch {}

          try {
            await Notifications.cancelScheduledNotificationAsync(alarmId);
          } catch {}
        }

        if (Platform.OS === "android" && androidAlarm.isAvailable) {
          try {
            await androidAlarm.cancelAlarm(alarmId);
          } catch {}
        }
      }),
    );
  } catch {}

  await AsyncStorage.multiRemove([SCHEDULED_ALARMS_KEY, LEGACY_SCHEDULED_IDS_KEY]);
}

export async function clearScheduledNotifications() {
  await cancelPreviouslyScheduled();
}

function shouldScheduleForPatientOnly(userRole?: string) {
  return String(userRole ?? "").toLowerCase() === "patient";
}

function isOngoingMedication(status?: string) {
  return String(status ?? "").toLowerCase() === "ongoing";
}

function getReAlarmAfterMinutes(m: any): number {
  const v =
    m?.schedule?.reAlarmAfterMinutes ??
    m?.schedule?.realarmAfterMinutes ??
    m?.schedule?.reminderOffsetMinutes ??
    0;

  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function toIdPart(value: unknown) {
  return String(value ?? "").trim().replace(/[^a-zA-Z0-9:_-]/g, "_") || "na";
}

function buildAppointmentAlarmId(a: any) {
  return `appt:${toIdPart(a?.id)}:${toIdPart(normalizeYmdInput(a?.appointmentDate))}:${toIdPart(normalizeTimeInput(a?.appointmentTime))}`;
}

function buildMedicationAlarmId(
  m: any,
  dayYmd: string,
  isReAlarm: boolean,
  reAlarmAfterMinutes = 0,
) {
  const suffix = isReAlarm ? `re:${reAlarmAfterMinutes}` : "main";
  return `med:${toIdPart(m?.id)}:${toIdPart(normalizeYmdInput(dayYmd))}:${toIdPart(normalizeTimeInput(m?.schedule?.time))}:${suffix}`;
}

function matchesMedicationOnDay(m: any, day: Date) {
  const startDate = normalizeYmdInput(m?.startDate);
  if (!startDate) return false;

  const start = parseYmd(startDate);
  if (!start) return false;
  const target = startOfLocalDay(day);

  if (target < startOfLocalDay(start)) return false;

  const endDate = normalizeYmdInput(m?.repeat?.endDate);
  if (endDate) {
    const parsedEnd = parseYmd(endDate);
    if (!parsedEnd) return false;
    const end = startOfLocalDay(parsedEnd);
    if (target > end) return false;
  }

  const type = String(m?.repeat?.type ?? "once").toLowerCase();
  const interval = Math.max(1, Number(m?.repeat?.interval ?? 1));
  const unit =
    String(
      m?.repeat?.unit ?? (type === "monthly" ? "month" : "day"),
    ).toLowerCase();
  const daysOfWeek = Array.isArray(m?.repeat?.daysOfWeek)
    ? m.repeat.daysOfWeek
    : [];

  if (type === "once") return toYmd(target) === startDate;

  if (type === "daily" || (type === "custom" && unit === "day")) {
    const diff = daysBetween(start, target);
    return diff >= 0 && diff % interval === 0;
  }

  if (type === "weekly" || (type === "custom" && unit === "week")) {
    const diffWeeks = weeksBetween(start, target);
    if (diffWeeks < 0 || diffWeeks % interval !== 0) return false;
    if (daysOfWeek.length === 0) return true;
    return daysOfWeek.includes(weekdayCode(target));
  }

  if (type === "monthly" || (type === "custom" && unit === "month")) {
    const diffMonths = monthsBetween(start, target);
    if (diffMonths < 0 || diffMonths % interval !== 0) return false;
    return target.getDate() === start.getDate();
  }

  return false;
}

function normalizeScheduledAlarmEntry(value: unknown): ScheduledAlarmEntry | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const alarmId = String(record.alarmId ?? "").trim();
  const notificationId = String(
    record.notificationId ?? record.alarmId ?? "",
  ).trim();

  if (!alarmId || !notificationId) return null;
  return { alarmId, notificationId };
}

async function readScheduledAlarmEntries(): Promise<ScheduledAlarmEntry[]> {
  try {
    const entries = await AsyncStorage.multiGet([
      SCHEDULED_ALARMS_KEY,
      LEGACY_SCHEDULED_IDS_KEY,
    ]);
    const values = Object.fromEntries(entries);

    const rawCurrent = values[SCHEDULED_ALARMS_KEY];
    if (rawCurrent) {
      const parsed = JSON.parse(rawCurrent);
      if (Array.isArray(parsed)) {
        return parsed
          .map(normalizeScheduledAlarmEntry)
          .filter((entry): entry is ScheduledAlarmEntry => !!entry);
      }
    }

    const rawLegacy = values[LEGACY_SCHEDULED_IDS_KEY];
    if (!rawLegacy) return [];

    const parsedLegacy = JSON.parse(rawLegacy);
    if (!Array.isArray(parsedLegacy)) return [];

    return parsedLegacy
      .map((value) => {
        const id = String(value ?? "").trim();
        return id ? { alarmId: id, notificationId: id } : null;
      })
      .filter((entry): entry is ScheduledAlarmEntry => !!entry);
  } catch {
    return [];
  }
}

async function writeScheduledAlarmEntries(entries: ScheduledAlarmEntry[]) {
  await AsyncStorage.setItem(SCHEDULED_ALARMS_KEY, JSON.stringify(entries));
  await AsyncStorage.removeItem(LEGACY_SCHEDULED_IDS_KEY);
}

async function removeScheduledAlarmEntries(alarmIds: string[]) {
  if (alarmIds.length === 0) return;

  const ids = new Set(alarmIds.map((value) => String(value).trim()).filter(Boolean));
  const entries = await readScheduledAlarmEntries();
  await writeScheduledAlarmEntries(
    entries.filter(
      (entry) =>
        !ids.has(entry.alarmId) &&
        !ids.has(entry.notificationId),
    ),
  );
}

export async function cancelScheduledAlarmById(alarmId: string) {
  const normalizedAlarmId = String(alarmId ?? "").trim();
  if (!normalizedAlarmId) return;

  const entries = await readScheduledAlarmEntries();
  const matches = entries.filter(
    (entry) =>
      entry.alarmId === normalizedAlarmId ||
      entry.notificationId === normalizedAlarmId,
  );

  const notificationIds = new Set<string>(
    matches.length > 0
      ? matches.flatMap((entry) => [entry.alarmId, entry.notificationId])
      : [normalizedAlarmId],
  );

  if (Platform.OS === "android" && androidAlarm.isAvailable) {
    try {
      await androidAlarm.cancelAlarm(normalizedAlarmId);
    } catch {}
  }

  for (const notificationId of notificationIds) {
    try {
      await Notifications.dismissNotificationAsync(notificationId);
    } catch {}

    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {}
  }

  await removeScheduledAlarmEntries([
    normalizedAlarmId,
    ...matches.flatMap((entry) => [entry.alarmId, entry.notificationId]),
  ]);
}

async function scheduleAppointmentAlarm(
  a: any,
  dt: Date,
  useNativeAndroidAlarm: boolean,
  entries: ScheduledAlarmEntry[],
) {
  const alarmId = buildAppointmentAlarmId(a);
  const appointmentDate = normalizeYmdInput(a?.appointmentDate);
  const appointmentTime = normalizeTimeInput(a?.appointmentTime);
  const data = {
    kind: "APPOINTMENT",
    userId: a.userId,
    apptId: a.id,
    title: a.title,
    notes: a.notes ?? "",
    date: appointmentDate,
    time: appointmentTime,
    alarmId,
  };

  if (useNativeAndroidAlarm) {
    await androidAlarm.scheduleExactAlarm({
      alarmId,
      triggerAtMillis: dt.getTime(),
      title: `Appointment: ${a.title}`,
      body: a.notes ?? "Open NotiMed to view details.",
      channelId: APPOINTMENT_CHANNEL_ID,
      soundName: "appointment.mp3",
      data,
    });
    entries.push({ alarmId, notificationId: alarmId });
    return;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Appointment: ${a.title}`,
      body: a.notes ?? "Tap to view details.",
      sound: "appointment.mp3",
      data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: dt,
      channelId: APPOINTMENT_CHANNEL_ID,
    },
  });

  entries.push({ alarmId, notificationId: id });
}

async function scheduleMedicationAlarm(opts: {
  medication: any;
  dayYmd: string;
  triggerAt: Date;
  isReAlarm: boolean;
  reAlarmAfterMinutes: number;
  useNativeAndroidAlarm: boolean;
  entries: ScheduledAlarmEntry[];
}) {
  const { medication: m, dayYmd, triggerAt, isReAlarm, reAlarmAfterMinutes } =
    opts;
  const alarmId = buildMedicationAlarmId(
    m,
    dayYmd,
    isReAlarm,
    reAlarmAfterMinutes,
  );
  const normalizedDayYmd = normalizeYmdInput(dayYmd);
  const normalizedTime = normalizeTimeInput(m?.schedule?.time);
  const body = `${m.dose}${m.notes ? ` - ${m.notes}` : ""}`;
  const title = isReAlarm ? `Take ${m.name} (Re-alarm)` : `Take ${m.name}`;
  const data = {
    kind: "MEDICATION",
    userId: m.userId,
    medId: m.id,
    name: m.name,
    dose: m.dose,
    notes: m.notes ?? "",
    date: normalizedDayYmd,
    time: normalizedTime,
    isReAlarm,
    reminderOffsetMinutes: m.schedule?.reminderOffsetMinutes ?? 0,
    reAlarmAfterMinutes,
    alarmId,
  };

  if (opts.useNativeAndroidAlarm) {
    await androidAlarm.scheduleExactAlarm({
      alarmId,
      triggerAtMillis: triggerAt.getTime(),
      title,
      body,
      channelId: MEDICATION_CHANNEL_ID,
      soundName: "medication_v2.wav",
      data,
    });
    opts.entries.push({ alarmId, notificationId: alarmId });
    return;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "medication_v2.wav",
      data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerAt,
      channelId: MEDICATION_CHANNEL_ID,
    },
  });

  opts.entries.push({ alarmId, notificationId: id });
}

async function rescheduleAllFromCacheInternal(opts: {
  medications: any[];
  appointments: any[];
  horizonDays?: number;
  userRole?: "PATIENT" | "CAREGIVER" | string;
}) {
  if (!shouldScheduleForPatientOnly(opts.userRole)) {
    await cancelPreviouslyScheduled();
    return;
  }

  const horizonDays = opts.horizonDays ?? 14;
  const now = new Date();
  const end = addDays(now, horizonDays);
  const useNativeAndroidAlarm =
    Platform.OS === "android" &&
    androidAlarm.isAvailable &&
    (await androidAlarm.canScheduleExactAlarms());

  await cancelPreviouslyScheduled();

  const entries: ScheduledAlarmEntry[] = [];

  for (const a of opts.appointments ?? []) {
    try {
      const dt = atLocalDateTime(a?.appointmentDate, a?.appointmentTime);
      if (!dt) continue;
      if (dt.getTime() <= Date.now() + 1000) continue;
      if (dt.getTime() > end.getTime()) continue;

      await scheduleAppointmentAlarm(a, dt, useNativeAndroidAlarm, entries);
    } catch {}
  }

  for (const m of opts.medications ?? []) {
    if (!isOngoingMedication(m?.status)) continue;

    try {
      if (!normalizeTimeInput(m?.schedule?.time)) {
        continue;
      }

      for (let i = 0; i <= horizonDays; i++) {
        const day = addDays(startOfLocalDay(now), i);
        const dayYmd = toYmd(day);
        if (!matchesMedicationOnDay(m, day)) continue;

        const scheduledAt = atLocalDateTime(dayYmd, m.schedule.time);
        if (!scheduledAt) continue;

        if (scheduledAt.getTime() > Date.now() + 1000 && scheduledAt <= end) {
          await scheduleMedicationAlarm({
            medication: m,
            dayYmd,
            triggerAt: scheduledAt,
            isReAlarm: false,
            reAlarmAfterMinutes: 0,
            useNativeAndroidAlarm,
            entries,
          });
        }

        const reAlarmAfterMinutes = getReAlarmAfterMinutes(m);
        if (reAlarmAfterMinutes <= 0) continue;

        const reAlarmAt = new Date(
          scheduledAt.getTime() + reAlarmAfterMinutes * 60000,
        );

        if (reAlarmAt.getTime() <= Date.now() + 1000) continue;
        if (reAlarmAt.getTime() > end.getTime()) continue;

        await scheduleMedicationAlarm({
          medication: m,
          dayYmd,
          triggerAt: reAlarmAt,
          isReAlarm: true,
          reAlarmAfterMinutes,
          useNativeAndroidAlarm,
          entries,
        });
      }
    } catch {}
  }

  await writeScheduledAlarmEntries(entries);
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

    let [medications, appointments] = await Promise.all([
      medicationsApi.getCached(userId),
      appointmentsApi.getCached(userId),
    ]);

    const shouldRefreshFromApi =
      shouldScheduleForPatientOnly(userRole) &&
      medications.length === 0 &&
      appointments.length === 0;

    if (shouldRefreshFromApi) {
      try {
        [medications, appointments] = await Promise.all([
          medicationsApi.listByUser(userId),
          appointmentsApi.list(userId),
        ]);
      } catch {
        // Fall back to cache if the first live refresh fails.
      }
    }

    await rescheduleAllFromCacheInternal({
      medications,
      appointments,
      horizonDays,
      userRole,
    });
  });
}
