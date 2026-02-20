import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function GetStarted() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Welcome
      </ThemedText>

      <ThemedText type="default" style={styles.subtitle}>
        Start using the app in a few simple steps.
      </ThemedText>

      <Pressable
        style={[styles.button, { backgroundColor: colors.tint }]}
        onPress={() => router.replace("/(auth)/login")}
      >
        <ThemedText style={[styles.buttonText, { color: colors.background }]}>
          Get Started
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    marginBottom: 12,
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.8,
    marginBottom: 32,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
