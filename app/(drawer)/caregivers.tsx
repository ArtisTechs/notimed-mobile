import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

type Caregiver = {
  id: string;
  name: string;
  email: string;
};

export default function CaregiversScreen() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];

  const [activeTab, setActiveTab] = useState<"connected" | "requests">(
    "connected",
  );

  // MOCK DATA
  const [connected, setConnected] = useState<Caregiver[]>([
    { id: "1", name: "Maria Santos", email: "maria@email.com" },
    { id: "2", name: "John Reyes", email: "john@email.com" },
  ]);

  const [requests, setRequests] = useState<Caregiver[]>([
    { id: "3", name: "Angela Cruz", email: "angela@email.com" },
    { id: "4", name: "David Lee", email: "david@email.com" },
  ]);

  const removeAccess = (id: string) => {
    setConnected((prev) => prev.filter((c) => c.id !== id));
  };

  const approve = (caregiver: Caregiver) => {
    setConnected((prev) => [...prev, caregiver]);
    setRequests((prev) => prev.filter((c) => c.id !== caregiver.id));
  };

  const decline = (id: string) => {
    setRequests((prev) => prev.filter((c) => c.id !== id));
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
            NO CONNECTED CAREGIVERS
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

  const renderRequests = useMemo(() => {
    if (requests.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="mail-outline" size={28} color={colors.icon} />
          <ThemedText
            style={{
              marginTop: 8,
              color: colors.icon,
              fontSize: 13 * fontScale,
            }}
          >
            NO PENDING REQUESTS
          </ThemedText>
        </View>
      );
    }

    return requests.map((item) => (
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

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => approve(item)}
            style={[styles.actionButton, { backgroundColor: colors.tint }]}
          >
            <Ionicons name="checkmark" size={16} color={colors.buttonText} />
          </Pressable>

          <Pressable
            onPress={() => decline(item.id)}
            style={[
              styles.actionButton,
              { borderColor: colors.error, borderWidth: 1 },
            ]}
          >
            <Ionicons name="close" size={16} color={colors.error} />
          </Pressable>
        </View>
      </View>
    ));
  }, [requests, colors, fontScale]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <ThemedText
            style={{
              fontSize: 20 * fontScale,
              fontWeight: "700",
              color: colors.text,
            }}
          >
            CAREGIVERS
          </ThemedText>

          <ThemedText
            style={{
              marginTop: 4,
              fontSize: 13 * fontScale,
              color: colors.icon,
              letterSpacing: 0.5,
            }}
          >
            Manage and monitor caregiver access
          </ThemedText>
        </View>
      </View>

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
        {/* Tabs */}
        <View
          style={[styles.tabRow, { backgroundColor: colors.inputBackground }]}
        >
          {["connected", "requests"].map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab as "connected" | "requests")}
                style={[
                  styles.tab,
                  isActive && { backgroundColor: colors.tint },
                ]}
              >
                <ThemedText
                  style={{
                    color: isActive ? colors.buttonText : colors.text,
                    fontWeight: "600",
                    fontSize: 13 * fontScale,
                  }}
                >
                  {tab.toUpperCase()}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Content */}
        <View style={{ marginTop: 10 }}>
          {activeTab === "connected" ? renderConnected : renderRequests}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerRow: {
    marginBottom: 20,
  },

  card: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
  },

  tabRow: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 4,
    marginBottom: 10,
  },

  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
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

  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },
});
