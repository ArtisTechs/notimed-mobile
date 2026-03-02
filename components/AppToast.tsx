import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

type ToastType = "success" | "error";

type Props = {
  visible: boolean;
  message: string;
  type?: ToastType;
  onClose: () => void;
};

export default function AppToast({
  visible,
  message,
  type = "success",
  onClose,
}: Props) {
  const { resolvedScheme } = useAppTheme();
  const colors = Colors[resolvedScheme];

  if (!visible) return null;

  const backgroundColor = type === "success" ? colors.success : colors.error;

  const iconName = type === "success" ? "checkmark-circle" : "warning-outline";

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Type Icon */}
      <Ionicons
        name={iconName}
        size={22}
        color={colors.buttonText}
        style={styles.icon}
      />

      {/* Message */}
      <View style={styles.messageContainer}>
        <ThemedText
          style={{
            color: colors.buttonText,
            fontWeight: "600",
          }}
        >
          {message}
        </ThemedText>
      </View>

      {/* Close Button */}
      <Pressable onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={18} color={colors.buttonText} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    elevation: 20,
    zIndex: 9999,
  },
  icon: {
    marginRight: 10,
  },
  messageContainer: {
    flex: 1,
  },
  closeButton: {
    paddingLeft: 10,
  },
});
