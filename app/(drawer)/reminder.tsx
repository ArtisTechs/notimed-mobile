// app/(drawer)/reminder.tsx
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import * as Notifications from "expo-notifications";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";

import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Speech from "expo-speech";

import { androidAlarm } from "@/services/androidAlarm";
import { rescheduleCurrentUserNotifications } from "@/services/alarmScheduler";
import { appointmentsApi } from "@/services/appointmentsApi";
import { historyApi, HistoryStatus, HistoryType } from "@/services/historyApi";
import { medicationsApi } from "@/services/medicationsApi";

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

  date?: string; // prefer YYYY-MM-DD
  time?: string; // HH:mm

  reminderOffsetMinutes?: string; // expo-router params are strings
  reAlarmAfterMinutes?: string; // expo-router params are strings
  isReAlarm?: string; // expo-router params are strings
};

const formatTime12h = (value?: string) => {
  if (!value) return "—";
  const [hhRaw, mmRaw] = value.split(":");
  const hh = Number(hhRaw);
  const mm = mmRaw ?? "00";
  if (Number.isNaN(hh)) return value;

  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${mm} ${period}`;
};

const toIsoDate = (value?: string) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function ReminderScreen() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];

  const params = useLocalSearchParams<Params>();
  const kind = (params.kind ?? "MEDICATION") as HistoryType;
  const [accessChecked, setAccessChecked] = React.useState(false);
  const [hasAccess, setHasAccess] = React.useState(false);
  const isReAlarm = String(params.isReAlarm ?? "").toLowerCase() === "true";
  const reAlarmAfterMinutes = React.useMemo(() => {
    const n = Number(
      params.reAlarmAfterMinutes ?? params.reminderOffsetMinutes ?? 0,
    );
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }, [params.reAlarmAfterMinutes, params.reminderOffsetMinutes]);

  const alarmSource =
    kind === "MEDICATION"
      ? require("../../assets/sounds/medication.wav")
      : require("../../assets/sounds/appointment.wav");

  const player = useAudioPlayer(alarmSource, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  const title =
    kind === "MEDICATION"
      ? (params.name ?? "Medicine")
      : (params.title ?? "Appointment");

  const subtitle =
    kind === "MEDICATION" ? (params.dose ?? "") : (params.notes ?? "");
  const hasMedicationRetry =
    kind === "MEDICATION" && reAlarmAfterMinutes > 0;
  const showSecondChanceNotice =
    hasMedicationRetry && !isReAlarm;

  const spokenText =
    kind === "MEDICATION"
      ? `Time to take your medicine. ${params.name ?? ""}. ${params.dose ?? ""}.`
      : `Appointment reminder. ${params.title ?? ""}.`;

  const speakingRef = React.useRef(false);
  const stopRef = React.useRef(false);
  const [saving, setSaving] = React.useState(false);

  // timer for auto-resolving unattended reminders
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
        pitch: 1.0,
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

    // voice loop
    startSpeakingLoop();

    // sound loop
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

    ensurePatientAccess();

    return () => {
      mounted = false;
    };
  }, []);

  const postHistory = React.useCallback(
    async (status: HistoryStatus) => {
      const userId = params.userId ?? "";
      const dateIso = toIsoDate(params.date);
      const time = params.time ?? null;

      if (!userId || !dateIso) return;

      await historyApi.create({
        userId,
        name:
          kind === "MEDICATION"
            ? (params.name ?? "Medicine")
            : (params.title ?? "Appointment"),
        type: kind,
        dose: kind === "MEDICATION" ? (params.dose ?? null) : null,
        date: dateIso,
        time,
        status,
        notes: params.notes ?? null,
      });
    },
    [
      params.userId,
      params.date,
      params.time,
      params.name,
      params.title,
      params.dose,
      params.notes,
      kind,
    ],
  );

  const syncResolvedItem = React.useCallback(
    async (nextStatus: HistoryStatus) => {
      if (nextStatus !== "COMPLETED" && nextStatus !== "SKIPPED") return;

      const userId = String(params.userId ?? "").trim();
      if (!userId) return;

      if (kind === "MEDICATION") {
        const medId = String(params.medId ?? "").trim();
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
        const apptId = String(params.apptId ?? "").trim();
        if (!apptId) return;

        await appointmentsApi.delete(userId, apptId);
        await rescheduleCurrentUserNotifications();
      }
    },
    [kind, params.apptId, params.medId, params.userId],
  );

  const buildMedicationAlarmId = React.useCallback(
    (suffix: "main" | `re:${number}`) => {
      const medId = String(params.medId ?? "").trim();
      const dayYmd = String(params.date ?? "").trim();
      const time = String(params.time ?? "").trim();
      if (!medId || !dayYmd || !time) return "";

      return `med:${medId}:${dayYmd}:${time}:${suffix}`;
    },
    [params.date, params.medId, params.time],
  );

  const cancelAlarmById = React.useCallback(async (alarmId?: string) => {
    if (!alarmId) return;

    try {
      await androidAlarm.cancelAlarm(alarmId);
    } catch {}

    try {
      await Notifications.dismissNotificationAsync(alarmId);
    } catch {}

    try {
      await Notifications.cancelScheduledNotificationAsync(alarmId);
    } catch {}
  }, []);

  const finalizeReminder = React.useCallback(
    async (nextStatus: HistoryStatus) => {
      if (resolvedRef.current) return;

      resolvedRef.current = true;
      setSaving(true);
      stopAllAudio();

      await cancelAlarmById(params.alarmId);

      if (kind === "MEDICATION" && reAlarmAfterMinutes > 0) {
        const pairedAlarmId = isReAlarm
          ? buildMedicationAlarmId("main")
          : buildMedicationAlarmId(`re:${reAlarmAfterMinutes}`);
        await cancelAlarmById(pairedAlarmId);
      }

      try {
        await postHistory(nextStatus);
      } catch {}

      try {
        await syncResolvedItem(nextStatus);
      } catch {}

      setSaving(false);
      await navigateToDashboard();
    },
    [
      buildMedicationAlarmId,
      cancelAlarmById,
      isReAlarm,
      kind,
      navigateToDashboard,
      params.alarmId,
      postHistory,
      reAlarmAfterMinutes,
      syncResolvedItem,
      stopAllAudio,
    ],
  );

  const handleUnattendedAlarm = React.useCallback(async () => {
    const shouldMarkMissed =
      kind === "APPOINTMENT" || !hasMedicationRetry || isReAlarm;

    if (shouldMarkMissed) {
      await finalizeReminder("MISSED");
      return;
    }

    // First unattended medication alarm only dismisses the current ring.
    // The history entry becomes MISSED only if the retry alarm is also unattended.
    resolvedRef.current = true;
    stopAllAudio();
    await cancelAlarmById(params.alarmId);
    await navigateToDashboard();
  }, [
    cancelAlarmById,
    finalizeReminder,
    hasMedicationRetry,
    isReAlarm,
    kind,
    navigateToDashboard,
    params.alarmId,
    stopAllAudio,
  ]);

  const startAlarmSession = React.useCallback(() => {
    if (resolvedRef.current) return;

    const RING_MS = 3 * 60 * 1000;

    clearTimers();
    startAlarmOnly();

    autoResolveTimerRef.current = setTimeout(() => {
      void handleUnattendedAlarm();
    }, RING_MS);
  }, [clearTimers, handleUnattendedAlarm, startAlarmOnly]);

  React.useEffect(() => {
    if (!hasAccess) return;
    startAlarmSession();
    return () => stopAllAudio();
  }, [hasAccess, startAlarmSession, stopAllAudio]);

  React.useEffect(() => {
    if (!hasAccess) return;
    // keep sound alive if loaded but not playing during the active reminder window
    if ((status as any)?.isLoaded === false) return;
    if ((status as any)?.loading === true) return;

    if (!alarmActiveRef.current) return;
    if (stopRef.current) return;

    try {
      if (!(status as any)?.playing) player.play();
    } catch {}
  }, [hasAccess, status, player]);

  const handleTaken = async () => {
    if (saving) return;
    await finalizeReminder("COMPLETED");
  };

  const handleSkipped = async () => {
    if (saving) return;
    await finalizeReminder("SKIPPED");
  };

  if (!accessChecked) {
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
          {formatTime12h(params.time)}
        </ThemedText>

        <ThemedText style={[styles.date, { color: colors.icon }]}>
          {params.date ?? ""}
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
});
