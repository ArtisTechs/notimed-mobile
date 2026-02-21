import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

type Patient = {
  id: string;
  name: string;
  email: string;
};

export default function PatientsScreen() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];

  const [connected, setConnected] = useState<Patient[]>([
    { id: "1", name: "Carlos Mendoza", email: "carlos@email.com" },
    { id: "2", name: "Liza Gomez", email: "liza@email.com" },
  ]);

  const removeAccess = (id: string) => {
    setConnected((prev) => prev.filter((p) => p.id !== id));
  };

  const renderConnected = useMemo(() => {
    if (connected.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={28} color={colors.icon} />
          <ThemedText
            style={{
              marginTop: 8,
              color: colors.icon,
              fontSize: 13 * fontScale,
            }}
          >
            NO CONNECTED PATIENTS
          </ThemedText>
        </View>
      );
    }

    return connected.map((item) => (
      <View key={item.id} style={[styles.row, { borderColor: colors.border }]}>
        <View style={styles.rowLeft}>
          <View style={[styles.dot, { backgroundColor: colors.tint }]} />
          <View>
            <ThemedText
              style={{
                fontSize: 15 * fontScale,
                fontWeight: "600",
                color: colors.text,
              }}
            >
              {item.name}
            </ThemedText>
            <ThemedText
              style={{
                fontSize: 12 * fontScale,
                color: colors.icon,
              }}
            >
              {item.email}
            </ThemedText>
          </View>
        </View>

        <Pressable
          onPress={() => removeAccess(item.id)}
          style={[styles.removeButton, { borderColor: colors.error }]}
        >
          <ThemedText
            style={{
              color: colors.error,
              fontSize: 12 * fontScale,
              fontWeight: "600",
            }}
          >
            REMOVE
          </ThemedText>
        </Pressable>
      </View>
    ));
  }, [connected, colors, fontScale]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <ThemedText
          style={{
            fontSize: 20 * fontScale,
            fontWeight: "700",
            color: colors.text,
          }}
        >
          PATIENTS
        </ThemedText>

        <ThemedText
          style={{
            marginTop: 4,
            fontSize: 13 * fontScale,
            color: colors.icon,
            letterSpacing: 0.5,
          }}
        >
          Manage and monitor patient access
        </ThemedText>
      </View>

      {/* Connect Button */}
      <Pressable
        style={[styles.connectButton, { backgroundColor: colors.tint }]}
        onPress={() => {
          // navigate or open modal
        }}
      >
        <Ionicons name="person-add-outline" size={18} color="#fff" />
        <ThemedText
          style={{
            color: "#fff",
            fontWeight: "600",
            fontSize: 14 * fontScale,
            marginLeft: 8,
          }}
        >
          Connect to Patient
        </ThemedText>
      </Pressable>

      {/* Card */}
      <View
        style={[
          styles.card,
          {
            borderColor: colors.tint,
            backgroundColor: colors.card,
          },
        ]}
      >
        {renderConnected}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerRow: {
    marginBottom: 16,
  },

  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },

  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  removeButton: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },
});
