import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, TextInput } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function Login() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <ThemedView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ThemedText type="title" style={styles.title}>
        Login
      </ThemedText>

      <TextInput
        placeholder="Email"
        placeholderTextColor={colors.icon}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: colors.icon,
          },
        ]}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor={colors.icon}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: colors.icon,
          },
        ]}
      />

      <Pressable
        style={[styles.button, { backgroundColor: colors.tint }]}
        onPress={() => router.replace("/(tabs)")}
      >
        <ThemedText style={[styles.buttonText, { color: colors.background }]}>
          Sign In
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    textAlign: "center",
    marginBottom: 32,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
