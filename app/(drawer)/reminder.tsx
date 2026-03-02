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

type Params = {
  kind?: "MEDICATION" | "APPOINTMENT";
  medId?: string;
  apptId?: string;
  name?: string;
  dose?: string;
  title?: string;
  notes?: string;
  date?: string;
  time?: string;
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

export default function ReminderScreen() {
  const { resolvedScheme } = useAppTheme();
  const colors = Colors[resolvedScheme];

  const params = useLocalSearchParams<Params>();
  const kind = (params.kind ?? "MEDICATION") as "MEDICATION" | "APPOINTMENT";

  // In-app alarm audio source (bundled asset)
  // Make sure these files exist:
  const alarmSource =
    kind === "MEDICATION"
      ? require("../../assets/sounds/medication.wav")
      : require("../../assets/sounds/appointment.wav");

  // Create managed audio player (no `new AudioPlayer(...)`)
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

  const stopAllAudio = React.useCallback(() => {
    Speech.stop();
    try {
      player.pause();
      // if your expo-audio version supports this:
      // player.seekTo(0);
    } catch {}
  }, [player]);

  React.useEffect(() => {
    // start TTS immediately
    Speech.stop();
    Speech.speak(spokenText, { language: "en", rate: 0.95, pitch: 1.0 });

    // configure looping + play once loaded
    try {
      // loop property exists on AudioPlayer (runtime object)
      (player as any).loop = true;
    } catch {}

    return () => {
      stopAllAudio();
    };
  }, [spokenText, player, stopAllAudio]);

  React.useEffect(() => {
    // Play when the asset is done loading (best-effort)
    // expo-audio status includes loading info; avoid playing too early.
    if ((status as any)?.isLoaded === false) return;
    if ((status as any)?.loading === true) return;

    try {
      if (!(status as any)?.playing) player.play();
    } catch {}
  }, [status, player]);

  const handleTaken = () => {
    stopAllAudio();
    router.back();
  };

  const handleSkipped = () => {
    stopAllAudio();
    router.back();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor:
              resolvedScheme === "dark"
                ? "rgba(59,130,246,0.2)"
                : "rgba(59,130,246,0.15)",
          },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.tint }]}>
          <Ionicons name="alarm" size={42} color="#fff" />
        </View>

        <ThemedText style={[styles.time, { color: colors.text }]}>
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
            style={[styles.button, styles.takenButton]}
            onPress={handleTaken}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
            <ThemedText style={styles.buttonText}>Taken</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.button, styles.skippedButton]}
            onPress={handleSkipped}
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
  container: { flex: 1, justifyContent: "center", padding: 20 },
  card: {
    borderRadius: 28,
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
  time: { fontSize: 52, fontWeight: "600" },
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
