// app/(drawer)/reminder.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";

import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Speech from "expo-speech";

import { historyApi, HistoryStatus, HistoryType } from "@/services/historyApi";

type Params = {
  kind?: "MEDICATION" | "APPOINTMENT";
  userId?: string;

  medId?: string;
  apptId?: string;

  name?: string;
  dose?: string;

  title?: string;
  notes?: string;

  date?: string; // prefer YYYY-MM-DD
  time?: string; // HH:mm

  // ADD THIS: reminder offset in minutes (e.g. 10)
  reminderOffsetMinutes?: string; // expo-router params are strings
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

  const offsetMinutes = React.useMemo(() => {
    const n = Number(params.reminderOffsetMinutes);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [params.reminderOffsetMinutes]);

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

  const spokenText =
    kind === "MEDICATION"
      ? `Time to take your medicine. ${params.name ?? ""}. ${params.dose ?? ""}.`
      : `Appointment reminder. ${params.title ?? ""}.`;

  const speakingRef = React.useRef(false);
  const stopRef = React.useRef(false);
  const [saving, setSaving] = React.useState(false);

  // timers for auto-stop/re-alarm
  const stopTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const cycleRunningRef = React.useRef(false);

  const clearTimers = React.useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stopAlarmOnly = React.useCallback(() => {
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

  // 3 min ring, then stop. re-alarm after offsetMinutes from the original ring start time.
  const startAlarmCycle = React.useCallback(() => {
    if (cycleRunningRef.current) return;
    cycleRunningRef.current = true;

    const RING_MS = 3 * 60 * 1000;
    const OFFSET_MS = offsetMinutes * 60 * 1000;

    const runOnce = () => {
      if (!cycleRunningRef.current) return;

      startAlarmOnly();

      // stop at +3min
      stopTimerRef.current = setTimeout(() => {
        stopAlarmOnly();

        // no re-alarm configured
        if (OFFSET_MS <= 0) return;

        // re-alarm at +offsetMinutes (e.g. 10 min) -> wait offset - 3
        const waitMs = Math.max(0, OFFSET_MS - RING_MS);
        restartTimerRef.current = setTimeout(() => {
          runOnce();
        }, waitMs);
      }, RING_MS);
    };

    clearTimers();
    runOnce();
  }, [offsetMinutes, startAlarmOnly, stopAlarmOnly, clearTimers]);

  const stopAllAudio = React.useCallback(() => {
    cycleRunningRef.current = false;
    clearTimers();
    stopAlarmOnly();
  }, [clearTimers, stopAlarmOnly]);

  React.useEffect(() => {
    // start cycle immediately when screen opens
    startAlarmCycle();
    return () => stopAllAudio();
  }, [startAlarmCycle, stopAllAudio]);

  React.useEffect(() => {
    // keep sound alive if loaded but not playing (during active ring window)
    if ((status as any)?.isLoaded === false) return;
    if ((status as any)?.loading === true) return;

    if (!cycleRunningRef.current) return;
    if (stopRef.current) return;

    try {
      if (!(status as any)?.playing) player.play();
    } catch {}
  }, [status, player]);

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

  const handleTaken = async () => {
    if (saving) return;
    setSaving(true);
    stopAllAudio();
    try {
      await postHistory("COMPLETED");
    } catch {}
    setSaving(false);
    router.back();
  };

  const handleSkipped = async () => {
    if (saving) return;
    setSaving(true);
    stopAllAudio();
    try {
      await postHistory("SKIPPED");
    } catch {}
    setSaving(false);
    router.back();
  };

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

        <ThemedText style={[styles.title, { color: colors.text }]}>
          {title}
        </ThemedText>

        {subtitle ? (
          <ThemedText style={[styles.subtitle, { color: colors.text }]}>
            {subtitle}
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
          onPress={stopAllAudio}
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
  container: { flex: 1, padding: 20 },
  card: {
    flex: 1,
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
  title: {
    marginTop: 30,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: { marginTop: 6, fontSize: 18, textAlign: "center" },
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
