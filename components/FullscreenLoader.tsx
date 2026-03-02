import { ThemedText } from "@/components/themed-text";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

type Props = {
  visible: boolean;
  text?: string;
  colors: any;
  fontScale: number;
};

export default function FullscreenLoader({
  visible,
  text = "Loading...",
  colors,
  fontScale,
}: Props) {
  if (!visible) return null;

  return (
    <View
      style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.35)" }]}
      pointerEvents="auto"
    >
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText
          style={{
            marginTop: 12,
            color: colors.text,
            fontWeight: "600",
            fontSize: 14 * fontScale,
          }}
        >
          {text}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 200,
  },
});
