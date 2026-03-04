import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import {
  cancelScheduledAlarmById,
  rescheduleCurrentUserNotifications,
} from "@/services/alarmScheduler";
import { appointmentsApi } from "@/services/appointmentsApi";
import { historyApi, HistoryStatus, HistoryType } from "@/services/historyApi";
import { medicationsApi } from "@/services/medicationsApi";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Params = {
  kind?: "MEDICATION" | "APPOINTMENT";
  userId?: string;
  medId?: string;
  apptId?: string;
  alarmId?: string;
  name?: string;
  dose?: string;
  title?: string;
  notes?: string;
  date?: string;
  time?: string;
  reminderOffsetMinutes?: string;
  reAlarmAfterMinutes?: string;
  isReAlarm?: string;
};

const ACTIVE_REMINDER_WINDOW_MS = 3 * 60 * 1000;

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatTime12h = (value?: string) => {
  if (!value) return "--";
  const [hhRaw, mmRaw] = value.split(":");
  const hh = Number(hhRaw);
  const mm = mmRaw ?? "00";
  if (Number.isNaN(hh)) return value;

  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${mm} ${period}`;
};

const normalizeTime = (value?: string) => {
  const raw = String(value ?? "").trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(raw);
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
};

const toYmd = (value: Date) =>
  `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;

const toIsoDate = (value?: string) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return toYmd(date);
};

const parseYmd = (value?: string) => {
  const normalized = toIsoDate(value);
  if (!normalized) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  const next = new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
  return Number.isNaN(next.getTime()) ? null : next;
};

const atLocalDateTime = (ymd?: string, hhmm?: string) => {
  const normalizedDate = toIsoDate(ymd);
  const normalizedTime = normalizeTime(hhmm);
  if (!normalizedDate || !normalizedTime) return null;

  const [year, month, day] = normalizedDate.split("-").map(Number);
  const [hours, minutes] = normalizedTime.split(":").map(Number);
  const next = new Date(
    year,
    (month ?? 1) - 1,
    day ?? 1,
    hours ?? 0,
    minutes ?? 0,
    0,
    0,
  );

  return Number.isNaN(next.getTime()) ? null : next;
};

const startOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

const daysBetween = (a: Date, b: Date) =>
  Math.floor(
    (startOfLocalDay(b).getTime() - startOfLocalDay(a).getTime()) / 86400000,
  );

const weeksBetween = (a: Date, b: Date) => Math.floor(daysBetween(a, b) / 7);

const monthsBetween = (a: Date, b: Date) =>
  (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

const weekdayCode = (value: Date) => {
  const map = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
  return map[value.getDay()];
};

const matchesMedicationOnDay = (medication: any, day: Date) => {
  const startDate = toIsoDate(medication?.startDate);
  if (!startDate) return false;

  const start = parseYmd(startDate);
  if (!start) return false;
  const target = startOfLocalDay(day);

  if (target < startOfLocalDay(start)) return false;

  const endDate = toIsoDate(medication?.repeat?.endDate);
  if (endDate) {
    const parsedEnd = parseYmd(endDate);
    if (!parsedEnd) return false;
    if (target > startOfLocalDay(parsedEnd)) return false;
  }

  const type = String(medication?.repeat?.type ?? "once").toLowerCase();
  const interval = Math.max(1, Number(medication?.repeat?.interval ?? 1));
  const unit = String(
    medication?.repeat?.unit ?? (type === "monthly" ? "month" : "day"),
  ).toLowerCase();
  const daysOfWeek = Array.isArray(medication?.repeat?.daysOfWeek)
    ? medication.repeat.daysOfWeek
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
};

const toAlarmIdPart = (value: unknown) =>
  String(value ?? "").trim().replace(/[^a-zA-Z0-9:_-]/g, "_") || "na";

const buildAppointmentAlarmId = (apptId?: string, date?: string, time?: string) =>
  `appt:${toAlarmIdPart(apptId)}:${toAlarmIdPart(toIsoDate(date))}:${toAlarmIdPart(normalizeTime(time))}`;

const buildMedicationAlarmId = (
  medId?: string,
  date?: string,
  time?: string,
  suffix: "main" | `re:${number}` = "main",
) =>
  `med:${toAlarmIdPart(medId)}:${toAlarmIdPart(toIsoDate(date))}:${toAlarmIdPart(normalizeTime(time))}:${suffix}`;

const getReAlarmAfterMinutes = (medication: any) => {
  const raw =
    medication?.schedule?.reAlarmAfterMinutes ??
    medication?.schedule?.realarmAfterMinutes ??
    medication?.schedule?.reminderOffsetMinutes ??
    0;

  const next = Number(raw);
  return Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0;
};

const buildHistorySlotKey = (
  kind: HistoryType,
  name: string,
  dose: string,
  date: string,
  time: string,
) =>
  [
    kind,
    name.trim().toLowerCase(),
    dose.trim().toLowerCase(),
    date,
    time,
  ].join("|");

const normalizeRouteReminder = (params: Params): Params | null => {
  const hasReminderPayload = Boolean(
    params.alarmId ||
      params.medId ||
      params.apptId ||
      (params.kind && params.date && params.time),
  );

  if (!hasReminderPayload) return null;

  return {
    kind: params.kind === "APPOINTMENT" ? "APPOINTMENT" : "MEDICATION",
    userId: String(params.userId ?? "").trim(),
    medId: String(params.medId ?? "").trim(),
    apptId: String(params.apptId ?? "").trim(),
    alarmId: String(params.alarmId ?? "").trim(),
    name: String(params.name ?? "").trim(),
    dose: String(params.dose ?? "").trim(),
    title: String(params.title ?? "").trim(),
    notes: String(params.notes ?? "").trim(),
    date: toIsoDate(String(params.date ?? "")),
    time: normalizeTime(String(params.time ?? "")),
    reminderOffsetMinutes: String(params.reminderOffsetMinutes ?? "").trim(),
    reAlarmAfterMinutes: String(params.reAlarmAfterMinutes ?? "").trim(),
    isReAlarm: String(params.isReAlarm ?? "").trim(),
  };
};

const isReminderActiveNow = (scheduledAt: Date, now: Date) => {
  const delta = now.getTime() - scheduledAt.getTime();
  return delta >= 0 && delta < ACTIVE_REMINDER_WINDOW_MS;
};

type ReminderCandidate = {
  params: Params;
  triggerAt: number;
};

export default function ReminderScreen() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];

  const routeParams = useLocalSearchParams<Params>();
  const incomingReminder = React.useMemo(
    () => normalizeRouteReminder(routeParams),
    [
      routeParams.alarmId,
      routeParams.apptId,
      routeParams.date,
      routeParams.dose,
      routeParams.isReAlarm,
      routeParams.kind,
      routeParams.medId,
      routeParams.name,
      routeParams.notes,
      routeParams.reAlarmAfterMinutes,
      routeParams.reminderOffsetMinutes,
      routeParams.time,
      routeParams.title,
      routeParams.userId,
    ],
  );

  const [accessChecked, setAccessChecked] = React.useState(false);
  const [hasAccess, setHasAccess] = React.useState(false);
  const [resolvedReminder, setResolvedReminder] = React.useState<Params | null>(
    incomingReminder,
  );
  const [loadingReminder, setLoadingReminder] = React.useState(!incomingReminder);

  const reminder = resolvedReminder;
  const kind = (reminder?.kind ?? "MEDICATION") as HistoryType;
  const isReAlarm = String(reminder?.isReAlarm ?? "").toLowerCase() === "true";
  const reAlarmAfterMinutes = React.useMemo(() => {
    const next = Number(
      reminder?.reAlarmAfterMinutes ?? reminder?.reminderOffsetMinutes ?? 0,
    );
    return Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0;
  }, [reminder?.reAlarmAfterMinutes, reminder?.reminderOffsetMinutes]);

  const alarmSource =
    kind === "MEDICATION"
      ? require("../../assets/sounds/medication_v2.wav")
      : require("../../assets/sounds/appointment.mp3");

  const player = useAudioPlayer(alarmSource, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  const title =
    kind === "MEDICATION"
      ? (reminder?.name ?? "Medicine")
      : (reminder?.title ?? "Appointment");
  const subtitle =
    kind === "MEDICATION" ? (reminder?.dose ?? "") : (reminder?.notes ?? "");
  const hasMedicationRetry =
    kind === "MEDICATION" && reAlarmAfterMinutes > 0;
  const showSecondChanceNotice = hasMedicationRetry && !isReAlarm;

  const spokenText =
    kind === "MEDICATION"
      ? `Time to take your medicine. ${reminder?.name ?? ""}. ${reminder?.dose ?? ""}.`
      : `Appointment reminder. ${reminder?.title ?? ""}.`;

  const speakingRef = React.useRef(false);
  const stopRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const [saving, setSaving] = React.useState(false);
  const autoResolveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const alarmActiveRef = React.useRef(false);
  const resolvedRef = React.useRef(false);

  const clearTimers = React.useCallback(() => {
    if (autoResolveTimerRef.current) {
      clearTimeout(autoResolveTimerRef.current);
      autoResolveTimerRef.current = null;
    }
  }, []);

  const stopAlarmOnly = React.useCallback(() => {
    alarmActiveRef.current = false;
    stopRef.current = true;
    speakingRef.current = false;
    Speech.stop();
    try {
      player.pause();
    } catch {}
  }, [player]);

  const startSpeakingLoop = React.useCallback(() => {
    if (speakingRef.current) return;

    speakingRef.current = true;
    stopRef.current = false;

    const speakOnce = () => {
      if (stopRef.current) {
        speakingRef.current = false;
        return;
      }

      Speech.speak(spokenText, {
        language: "en",
        rate: 0.95,
        pitch: 1,
        onDone: () => {
          setTimeout(() => {
            speakOnce();
          }, 700);
        },
        onStopped: () => {
          speakingRef.current = false;
        },
        onError: () => {
          speakingRef.current = false;
        },
      });
    };

    Speech.stop();
    speakOnce();
  }, [spokenText]);

  const startAlarmOnly = React.useCallback(() => {
    alarmActiveRef.current = true;
    stopRef.current = false;

    startSpeakingLoop();

    try {
      (player as any).loop = true;
    } catch {}

    try {
      player.play();
    } catch {}
  }, [player, startSpeakingLoop]);

  const stopAllAudio = React.useCallback(() => {
    clearTimers();
    stopAlarmOnly();
  }, [clearTimers, stopAlarmOnly]);

  const navigateToDashboard = React.useCallback(async () => {
    const role = await AsyncStorage.getItem("userRole");

    if (role === "caregiver") {
      router.replace("/(drawer)/dashboard-caregiver-view");
      return;
    }

    if (role === "patient") {
      router.replace("/(drawer)/dashboard-patient-view");
      return;
    }

    router.replace("/(auth)/get-started");
  }, []);

  React.useEffect(() => {
    mountedRef.current = true;
    let mounted = true;

    const ensurePatientAccess = async () => {
      const [role, userId] = await Promise.all([
        AsyncStorage.getItem("userRole"),
        AsyncStorage.getItem("userId"),
      ]);
      const allowed = role === "patient";

      if (!mounted) return;

      setHasAccess(allowed);
      setAccessChecked(true);

      if (!allowed) {
        if (userId && role === "caregiver") {
          router.replace("/(drawer)/dashboard-caregiver-view");
          return;
        }

        router.replace("/(auth)/get-started");
      }
    };

    void ensurePatientAccess();

    return () => {
      mountedRef.current = false;
      mounted = false;
    };
  }, []);

  const resolveCurrentReminder = React.useCallback(async (): Promise<Params | null> => {
    const userId = String((await AsyncStorage.getItem("userId")) ?? "").trim();
    if (!userId) return null;

    const now = new Date();
    const todayYmd = toYmd(now);

    let [medications, appointments, history] = await Promise.all([
      medicationsApi.getCached(userId),
      appointmentsApi.getCached(userId),
      historyApi.getCached({ userId, date: todayYmd }),
    ]);

    if (medications.length === 0 && appointments.length === 0) {
      try {
        [medications, appointments] = await Promise.all([
          medicationsApi.listByUser(userId),
          appointmentsApi.list(userId),
        ]);
      } catch {}
    }

    const completedSlots = new Set(
      history.map((entry) =>
        buildHistorySlotKey(
          entry.type,
          entry.name,
          entry.dose ?? "",
          entry.date,
          normalizeTime(entry.time ?? ""),
        ),
      ),
    );

    const candidates: ReminderCandidate[] = [];

    for (const appointment of appointments) {
      const appointmentDate = toIsoDate(appointment?.appointmentDate);
      const appointmentTime = normalizeTime(appointment?.appointmentTime);
      if (appointmentDate !== todayYmd || !appointmentTime) continue;

      const slotKey = buildHistorySlotKey(
        "APPOINTMENT",
        String(appointment?.title ?? ""),
        "",
        appointmentDate,
        appointmentTime,
      );
      if (completedSlots.has(slotKey)) continue;

      const scheduledAt = atLocalDateTime(appointmentDate, appointmentTime);
      if (!scheduledAt || !isReminderActiveNow(scheduledAt, now)) continue;

      candidates.push({
        triggerAt: scheduledAt.getTime(),
        params: {
          kind: "APPOINTMENT",
          userId,
          apptId: String(appointment?.id ?? ""),
          alarmId: buildAppointmentAlarmId(
            String(appointment?.id ?? ""),
            appointmentDate,
            appointmentTime,
          ),
          title: String(appointment?.title ?? ""),
          notes: String(appointment?.notes ?? ""),
          date: appointmentDate,
          time: appointmentTime,
        },
      });
    }

    for (const medication of medications) {
      const medicationTime = normalizeTime(medication?.schedule?.time);
      const medicationDate = todayYmd;
      const medicationStatus = String(medication?.status ?? "").toLowerCase();

      if (medicationStatus !== "ongoing") continue;
      if (!medicationTime) continue;
      if (!matchesMedicationOnDay(medication, now)) continue;

      const slotKey = buildHistorySlotKey(
        "MEDICATION",
        String(medication?.name ?? ""),
        String(medication?.dose ?? ""),
        medicationDate,
        medicationTime,
      );
      if (completedSlots.has(slotKey)) continue;

      const scheduledAt = atLocalDateTime(medicationDate, medicationTime);
      if (!scheduledAt) continue;

      if (isReminderActiveNow(scheduledAt, now)) {
        candidates.push({
          triggerAt: scheduledAt.getTime(),
          params: {
            kind: "MEDICATION",
            userId,
            medId: String(medication?.id ?? ""),
            alarmId: buildMedicationAlarmId(
              String(medication?.id ?? ""),
              medicationDate,
              medicationTime,
              "main",
            ),
            name: String(medication?.name ?? ""),
            dose: String(medication?.dose ?? ""),
            notes: String(medication?.notes ?? ""),
            date: medicationDate,
            time: medicationTime,
            isReAlarm: "false",
            reminderOffsetMinutes: String(
              medication?.schedule?.reminderOffsetMinutes ?? 0,
            ),
            reAlarmAfterMinutes: String(getReAlarmAfterMinutes(medication)),
          },
        });
      }

      const reAlarmMinutes = getReAlarmAfterMinutes(medication);
      if (reAlarmMinutes <= 0) continue;

      const reAlarmAt = new Date(
        scheduledAt.getTime() + reAlarmMinutes * 60000,
      );
      if (!isReminderActiveNow(reAlarmAt, now)) continue;

      candidates.push({
        triggerAt: reAlarmAt.getTime(),
        params: {
          kind: "MEDICATION",
          userId,
          medId: String(medication?.id ?? ""),
          alarmId: buildMedicationAlarmId(
            String(medication?.id ?? ""),
            medicationDate,
            medicationTime,
            `re:${reAlarmMinutes}`,
          ),
          name: String(medication?.name ?? ""),
          dose: String(medication?.dose ?? ""),
          notes: String(medication?.notes ?? ""),
          date: medicationDate,
          time: medicationTime,
          isReAlarm: "true",
          reminderOffsetMinutes: String(
            medication?.schedule?.reminderOffsetMinutes ?? 0,
          ),
          reAlarmAfterMinutes: String(reAlarmMinutes),
        },
      });
    }

    candidates.sort((a, b) => b.triggerAt - a.triggerAt);
    return candidates[0]?.params ?? null;
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (!accessChecked || !hasAccess) return;

      let cancelled = false;
      resolvedRef.current = false;
      stopAllAudio();
      setSaving(false);

      const loadReminder = async () => {
        setLoadingReminder(true);

        if (incomingReminder) {
          if (!cancelled) {
            setResolvedReminder(incomingReminder);
            setLoadingReminder(false);
          }
          return;
        }

        const nextReminder = await resolveCurrentReminder();

        if (!cancelled) {
          setResolvedReminder(nextReminder);
          setLoadingReminder(false);
        }
      };

      void loadReminder();

      return () => {
        cancelled = true;
        stopAllAudio();
      };
    }, [
      accessChecked,
      hasAccess,
      incomingReminder,
      resolveCurrentReminder,
      stopAllAudio,
    ]),
  );

  const postHistory = React.useCallback(
    async (nextStatus: HistoryStatus) => {
      const userId = reminder?.userId ?? "";
      const dateIso = toIsoDate(reminder?.date);
      const time = reminder?.time ?? null;

      if (!userId || !dateIso) return;

      await historyApi.create({
        userId,
        name:
          kind === "MEDICATION"
            ? (reminder?.name ?? "Medicine")
            : (reminder?.title ?? "Appointment"),
        type: kind,
        dose: kind === "MEDICATION" ? (reminder?.dose ?? null) : null,
        date: dateIso,
        time,
        status: nextStatus,
        notes: reminder?.notes ?? null,
      });
    },
    [
      reminder?.date,
      reminder?.dose,
      reminder?.name,
      reminder?.notes,
      reminder?.time,
      reminder?.title,
      reminder?.userId,
      kind,
    ],
  );

  const syncResolvedItem = React.useCallback(
    async (nextStatus: HistoryStatus) => {
      if (nextStatus !== "COMPLETED" && nextStatus !== "SKIPPED") return;

      const userId = String(reminder?.userId ?? "").trim();
      if (!userId) return;

      if (kind === "MEDICATION") {
        const medId = String(reminder?.medId ?? "").trim();
        if (!medId) return;

        let medication = (await medicationsApi.getCached(userId)).find(
          (item) => String(item.id) === medId,
        );

        if (!medication) {
          try {
            medication = await medicationsApi.getById(medId);
          } catch {}
        }

        const repeatType = String(medication?.repeat?.type ?? "").toLowerCase();
        if (repeatType !== "once") return;

        await medicationsApi.updateStatus(medId, "COMPLETED");
        await rescheduleCurrentUserNotifications();
        return;
      }

      if (kind === "APPOINTMENT") {
        const apptId = String(reminder?.apptId ?? "").trim();
        if (!apptId) return;

        await appointmentsApi.delete(userId, apptId);
        await rescheduleCurrentUserNotifications();
      }
    },
    [kind, reminder?.apptId, reminder?.medId, reminder?.userId],
  );

  const buildSiblingMedicationAlarmId = React.useCallback(
    (suffix: "main" | `re:${number}`) => {
      const medId = String(reminder?.medId ?? "").trim();
      const dayYmd = String(reminder?.date ?? "").trim();
      const time = String(reminder?.time ?? "").trim();
      if (!medId || !dayYmd || !time) return "";

      return buildMedicationAlarmId(medId, dayYmd, time, suffix);
    },
    [reminder?.date, reminder?.medId, reminder?.time],
  );

  const cancelAlarmById = React.useCallback(async (alarmId?: string) => {
    if (!alarmId) return;

    try {
      await cancelScheduledAlarmById(alarmId);
    } catch {}
  }, []);

  const finalizeReminder = React.useCallback(
    async (nextStatus: HistoryStatus) => {
      if (!reminder || resolvedRef.current) return;

      resolvedRef.current = true;
      setSaving(true);
      stopAllAudio();

      await cancelAlarmById(reminder.alarmId);

      if (kind === "MEDICATION" && reAlarmAfterMinutes > 0) {
        const pairedAlarmId = isReAlarm
          ? buildSiblingMedicationAlarmId("main")
          : buildSiblingMedicationAlarmId(`re:${reAlarmAfterMinutes}`);
        await cancelAlarmById(pairedAlarmId);
      }

      try {
        await postHistory(nextStatus);
      } catch {}

      try {
        await syncResolvedItem(nextStatus);
      } catch {}

      if (mountedRef.current) {
        setSaving(false);
      }

      await navigateToDashboard();
    },
    [
      buildSiblingMedicationAlarmId,
      cancelAlarmById,
      isReAlarm,
      kind,
      navigateToDashboard,
      postHistory,
      reAlarmAfterMinutes,
      reminder,
      stopAllAudio,
      syncResolvedItem,
    ],
  );

  const handleUnattendedAlarm = React.useCallback(async () => {
    const shouldMarkMissed =
      kind === "APPOINTMENT" || !hasMedicationRetry || isReAlarm;

    if (shouldMarkMissed) {
      await finalizeReminder("MISSED");
      return;
    }

    resolvedRef.current = true;
    stopAllAudio();
    await cancelAlarmById(reminder?.alarmId);
    await navigateToDashboard();
  }, [
    cancelAlarmById,
    finalizeReminder,
    hasMedicationRetry,
    isReAlarm,
    kind,
    navigateToDashboard,
    reminder?.alarmId,
    stopAllAudio,
  ]);

  const startAlarmSession = React.useCallback(() => {
    if (!reminder || resolvedRef.current) return;

    clearTimers();
    startAlarmOnly();

    autoResolveTimerRef.current = setTimeout(() => {
      void handleUnattendedAlarm();
    }, ACTIVE_REMINDER_WINDOW_MS);
  }, [
    clearTimers,
    handleUnattendedAlarm,
    reminder,
    startAlarmOnly,
  ]);

  React.useEffect(() => {
    if (!hasAccess || !reminder || loadingReminder) return;

    startAlarmSession();
    return () => stopAllAudio();
  }, [hasAccess, loadingReminder, reminder, startAlarmSession, stopAllAudio]);

  React.useEffect(() => {
    if (!hasAccess || !reminder) return;
    if ((status as any)?.isLoaded === false) return;
    if ((status as any)?.loading === true) return;
    if (!alarmActiveRef.current) return;
    if (stopRef.current) return;

    try {
      if (!(status as any)?.playing) player.play();
    } catch {}
  }, [hasAccess, reminder, status, player]);

  const handleTaken = async () => {
    if (saving) return;
    await finalizeReminder("COMPLETED");
  };

  const handleSkipped = async () => {
    if (saving) return;
    await finalizeReminder("SKIPPED");
  };

  if (!accessChecked || (hasAccess && loadingReminder)) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
      </SafeAreaView>
    );
  }

  if (!hasAccess) {
    return null;
  }

  if (!reminder) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View
          style={[
            styles.emptyCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.tint }]}>
            <Ionicons name="alarm-outline" size={40} color="#fff" />
          </View>

          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
            No active reminder right now
          </ThemedText>

          <ThemedText style={[styles.emptyBody, { color: colors.icon }]}>
            This page will show a medication or appointment alarm when its
            scheduled time is currently active.
          </ThemedText>

          <Pressable
            style={[
              styles.refreshButton,
              { backgroundColor: colors.tint },
            ]}
            onPress={() => {
              setLoadingReminder(true);
              void resolveCurrentReminder().then((nextReminder) => {
                if (!mountedRef.current) return;
                setResolvedReminder(nextReminder);
                setLoadingReminder(false);
              });
            }}
          >
            <Ionicons name="refresh" size={18} color={colors.buttonText} />
            <ThemedText style={styles.refreshButtonText}>Check Again</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor:
              resolvedScheme === "dark"
                ? "rgba(59,130,246,0.22)"
                : "rgba(59,130,246,0.14)",
          },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.tint }]}>
          <Ionicons name="alarm" size={42} color="#fff" />
        </View>

        <ThemedText
          style={[
            styles.time,
            {
              color: colors.text,
              fontSize: 52 * fontScale,
              lineHeight: Math.ceil(62 * fontScale),
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {formatTime12h(reminder.time)}
        </ThemedText>

        <ThemedText style={[styles.date, { color: colors.icon }]}>
          {reminder.date ?? ""}
        </ThemedText>

        <View
          style={[
            styles.typePill,
            {
              backgroundColor:
                resolvedScheme === "dark"
                  ? "rgba(255,255,255,0.12)"
                  : "rgba(15,23,42,0.08)",
            },
          ]}
        >
          <ThemedText style={[styles.typeText, { color: colors.text }]}>
            {kind === "MEDICATION" ? "Medication" : "Appointment"}
          </ThemedText>
        </View>

        <ThemedText style={[styles.title, { color: colors.text }]}>
          {title}
        </ThemedText>

        {subtitle ? (
          <ThemedText style={[styles.subtitle, { color: colors.text }]}>
            {subtitle}
          </ThemedText>
        ) : null}

        {showSecondChanceNotice ? (
          <ThemedText style={[styles.helperText, { color: colors.icon }]}>
            If this medication alarm is unanswered, NotiMed will ring again
            after {reAlarmAfterMinutes} minutes and only mark it missed if that
            retry is also unanswered.
          </ThemedText>
        ) : null}

        <View style={styles.buttonRow}>
          <Pressable
            style={[
              styles.button,
              styles.takenButton,
              saving && styles.buttonDisabled,
            ]}
            onPress={handleTaken}
            disabled={saving}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
            <ThemedText style={styles.buttonText}>Taken</ThemedText>
          </Pressable>

          <Pressable
            style={[
              styles.button,
              styles.skippedButton,
              saving && styles.buttonDisabled,
            ]}
            onPress={handleSkipped}
            disabled={saving}
          >
            <Ionicons name="close" size={20} color="#fff" />
            <ThemedText style={styles.buttonText}>Skipped</ThemedText>
          </Pressable>
        </View>

        <Pressable
          style={[styles.stopRow, { borderColor: colors.border }]}
          onPress={stopAlarmOnly}
        >
          <Ionicons name="volume-mute-outline" size={18} color={colors.icon} />
          <ThemedText style={{ color: colors.icon, fontWeight: "600" }}>
            Stop Sound
          </ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 28,
    borderWidth: 1,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  time: {
    fontWeight: "600",
    width: "100%",
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
    paddingVertical: 2,
  },
  date: { fontSize: 16, marginTop: 6, opacity: 0.85 },
  typePill: {
    marginTop: 18,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  typeText: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: { marginTop: 6, fontSize: 18, textAlign: "center" },
  helperText: {
    marginTop: 10,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 320,
  },
  buttonRow: { flexDirection: "row", gap: 16, marginTop: 32 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  takenButton: { backgroundColor: "#22C55E" },
  skippedButton: { backgroundColor: "#EF4444" },
  buttonText: { color: "#fff", fontWeight: "600" },
  buttonDisabled: { opacity: 0.6 },
  stopRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 10,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  refreshButton: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  refreshButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
