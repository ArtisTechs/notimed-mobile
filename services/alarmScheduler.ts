// src/services/alarmScheduler.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { appointmentsApi } from "@/services/appointmentsApi";
import { androidAlarm } from "@/services/androidAlarm";
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

function parseYmd(ymd: string) {
  const [y, mo, da] = String(ymd).split("-").map(Number);
  return new Date(y, (mo ?? 1) - 1, da ?? 1);
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
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];

    await Promise.all(
      ids.map(async (id) => {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch {}

        if (Platform.OS === "android" && androidAlarm.isAvailable) {
          try {
            await androidAlarm.cancelAlarm(id);
          } catch {}
        }
      }),
    );
  } catch {}

  await AsyncStorage.removeItem(SCHEDULED_IDS_KEY);
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
  return `appt:${toIdPart(a?.id)}:${toIdPart(a?.appointmentDate)}:${toIdPart(a?.appointmentTime)}`;
}

function buildMedicationAlarmId(
  m: any,
  dayYmd: string,
  isReAlarm: boolean,
  reAlarmAfterMinutes = 0,
) {
  const suffix = isReAlarm ? `re:${reAlarmAfterMinutes}` : "main";
  return `med:${toIdPart(m?.id)}:${toIdPart(dayYmd)}:${toIdPart(m?.schedule?.time)}:${suffix}`;
}

function matchesMedicationOnDay(m: any, day: Date) {
  const startDate = String(m?.startDate ?? "").trim();
  if (!startDate) return false;

  const start = parseYmd(startDate);
  const target = startOfLocalDay(day);

  if (target < startOfLocalDay(start)) return false;

  const endDate = String(m?.repeat?.endDate ?? "").trim();
  if (endDate) {
    const end = startOfLocalDay(parseYmd(endDate));
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

async function scheduleAppointmentAlarm(
  a: any,
  dt: Date,
  useNativeAndroidAlarm: boolean,
  ids: string[],
) {
  const alarmId = buildAppointmentAlarmId(a);
  const data = {
    kind: "APPOINTMENT",
    userId: a.userId,
    apptId: a.id,
    title: a.title,
    notes: a.notes ?? "",
    date: a.appointmentDate,
    time: a.appointmentTime,
    alarmId,
  };

  if (useNativeAndroidAlarm) {
    await androidAlarm.scheduleExactAlarm({
      alarmId,
      triggerAtMillis: dt.getTime(),
      title: `Appointment: ${a.title}`,
      body: a.notes ?? "Open NotiMed to view details.",
      channelId: "appointment",
      soundName: "appointment.wav",
      data,
    });
    ids.push(alarmId);
    return;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Appointment: ${a.title}`,
      body: a.notes ?? "Tap to view details.",
      sound: "appointment.wav",
      data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: dt,
      channelId: "appointment",
    },
  });

  ids.push(id);
}

async function scheduleMedicationAlarm(opts: {
  medication: any;
  dayYmd: string;
  triggerAt: Date;
  isReAlarm: boolean;
  reAlarmAfterMinutes: number;
  useNativeAndroidAlarm: boolean;
  ids: string[];
}) {
  const { medication: m, dayYmd, triggerAt, isReAlarm, reAlarmAfterMinutes } =
    opts;
  const alarmId = buildMedicationAlarmId(
    m,
    dayYmd,
    isReAlarm,
    reAlarmAfterMinutes,
  );
  const body = `${m.dose}${m.notes ? ` - ${m.notes}` : ""}`;
  const title = isReAlarm ? `Take ${m.name} (Re-alarm)` : `Take ${m.name}`;
  const data = {
    kind: "MEDICATION",
    userId: m.userId,
    medId: m.id,
    name: m.name,
    dose: m.dose,
    notes: m.notes ?? "",
    date: dayYmd,
    time: m.schedule.time,
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
      channelId: "medication",
      soundName: "medication.wav",
      data,
    });
    opts.ids.push(alarmId);
    return;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "medication.wav",
      data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerAt,
      channelId: "medication",
    },
  });

  opts.ids.push(id);
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

  const ids: string[] = [];

  for (const a of opts.appointments ?? []) {
    const dt = atLocalDateTime(a.appointmentDate, a.appointmentTime);
    if (dt.getTime() <= Date.now() + 1000) continue;
    if (dt.getTime() > end.getTime()) continue;

    await scheduleAppointmentAlarm(a, dt, useNativeAndroidAlarm, ids);
  }

  for (const m of opts.medications ?? []) {
    if (!isOngoingMedication(m.status)) continue;

    for (let i = 0; i <= horizonDays; i++) {
      const day = addDays(startOfLocalDay(now), i);
      const dayYmd = toYmd(day);
      if (!matchesMedicationOnDay(m, day)) continue;

      const scheduledAt = atLocalDateTime(dayYmd, m.schedule.time);
      if (scheduledAt.getTime() > Date.now() + 1000 && scheduledAt <= end) {
        await scheduleMedicationAlarm({
          medication: m,
          dayYmd,
          triggerAt: scheduledAt,
          isReAlarm: false,
          reAlarmAfterMinutes: 0,
          useNativeAndroidAlarm,
          ids,
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
        ids,
      });
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
