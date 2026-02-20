import { router } from "expo-router";
import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";

export default function GetStarted() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Hero Section */}
      <View style={[styles.hero, { backgroundColor: colors.tint }]}>
        <Image
          source={require("@/assets/images/notimed-logo-transparent.png")}
          style={styles.heroImage}
          resizeMode="contain"
        />

        <ThemedText
          style={[
            styles.heroBrand,
            {
              color: colors.buttonText,
              fontSize: 32 * fontScale,
            },
          ]}
        >
          NotiMed
        </ThemedText>
      </View>

      {/* Bottom Content */}
      <View
        style={[
          styles.bottomContainer,
          { backgroundColor: colors.card ?? colors.background },
        ]}
      >
        <ThemedText
          style={[
            styles.smallTitle,
            {
              color: colors.text,
              fontSize: 18 * fontScale,
            },
          ]}
        >
          Manage Your Health
        </ThemedText>

        <ThemedText
          style={[
            styles.bigTitle,
            {
              color: colors.text,
              fontSize: 28 * fontScale,
            },
          ]}
        >
          STAY ON TRACK
        </ThemedText>

        <ThemedText
          style={[
            styles.description,
            {
              color: colors.text,
              opacity: 0.7,
              fontSize: 14 * fontScale,
            },
          ]}
        >
          Monitor medications and appointments with clarity and control.
        </ThemedText>

        <Pressable
          style={[styles.ctaButton, { backgroundColor: colors.tint }]}
          onPress={() => router.replace("/(auth)/login")}
        >
          <ThemedText
            style={[
              styles.ctaText,
              {
                color: colors.buttonText,
                fontSize: 16 * fontScale,
              },
            ]}
          >
            Get Started
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  hero: {
    height: "45%",
    borderBottomRightRadius: 80,
    alignItems: "center",
    justifyContent: "flex-end",
  },

  heroImage: {
    width: 140,
    height: 140,
  },

  heroBrand: {
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 20,
  },

  bottomContainer: {
    flex: 1,
    borderTopLeftRadius: 40,
    paddingHorizontal: 32,
    paddingTop: 60,
    alignItems: "center",
  },

  smallTitle: {
    marginBottom: 8,
  },

  bigTitle: {
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 16,
  },

  description: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
  },

  ctaButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
  },

  ctaText: {
    fontWeight: "700",
  },
});
