import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import {
  authApi,
  ConnectedUserResponse,
  UserDetailsResponse,
} from "@/services/authApi";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

type CaregiverRow = {
  id: string;
  name: string;
  email: string;
  status?: string;
};

function fullName(
  u: Pick<ConnectedUserResponse, "firstName" | "middleName" | "lastName">,
) {
  return [u.firstName, u.middleName ?? "", u.lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getStoredUserId(): Promise<string | null> {
  const keysToTry = ["userDetails", "user", "authUser", "currentUser"];
  for (const key of keysToTry) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const id = parsed?.id ?? parsed?.user?.id ?? parsed?.data?.id;
      if (typeof id === "string" && id.length > 0) return id;
    } catch {}
  }
  return null;
}

export default function CaregiversScreen() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];

  const [me, setMe] = useState<UserDetailsResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"connected" | "requests">(
    "connected",
  );

  const [connected, setConnected] = useState<CaregiverRow[]>([]);
  const [requests, setRequests] = useState<CaregiverRow[]>([]);

  const [loadingConnected, setLoadingConnected] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadMeAndLists = useCallback(async () => {
    const myId = await getStoredUserId();
    if (!myId) {
      setMe(null);
      setConnected([]);
      setRequests([]);
      setLoadingConnected(false);
      setLoadingRequests(false);
      return;
    }

    // connected users come from user details
    setLoadingConnected(true);
    try {
      const details = await authApi.getUserById(myId);
      setMe(details);

      const connectedRows: CaregiverRow[] = (details.connectedUsers ?? [])
        .filter((u) => u.role === "CAREGIVER") // caregivers screen: show caregivers only
        .map((u) => ({
          id: u.id,
          name: fullName(u),
          email: u.email,
          status: u.status,
        }));

      setConnected(connectedRows);
    } finally {
      setLoadingConnected(false);
    }

    // pending requests come from /connect/requests/{patientId}
    setLoadingRequests(true);
    try {
      const pending = await authApi.getRequestedConnections(myId);
      const requestRows: CaregiverRow[] = (pending ?? [])
        .filter((u) => u.role === "CAREGIVER")
        .map((u) => ({
          id: u.id,
          name: fullName(u),
          email: u.email,
          status: u.status,
        }));

      setRequests(requestRows);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    loadMeAndLists();
  }, [loadMeAndLists]);

  const refresh = useCallback(async () => {
    await loadMeAndLists();
  }, [loadMeAndLists]);

  const removeAccess = useCallback(
    async (caregiverId: string) => {
      if (!me) return;

      setActionLoadingId(caregiverId);
      try {
        // this screen is for PATIENT managing CAREGIVERS
        await authApi.disconnect({ patientId: me.id, caregiverId });
        setConnected((prev) => prev.filter((c) => c.id !== caregiverId));
      } finally {
        setActionLoadingId(null);
      }
    },
    [me],
  );

  const approve = useCallback(
    async (caregiverId: string) => {
      if (!me) return;

      setActionLoadingId(caregiverId);
      try {
        await authApi.respondConnection({
          patientId: me.id,
          caregiverId,
          accept: true,
        });

        // optimistic UI
        const approved = requests.find((r) => r.id === caregiverId);
        if (approved) setConnected((prev) => [...prev, approved]);
        setRequests((prev) => prev.filter((r) => r.id !== caregiverId));
      } finally {
        setActionLoadingId(null);
      }
    },
    [me, requests],
  );

  const decline = useCallback(
    async (caregiverId: string) => {
      if (!me) return;

      setActionLoadingId(caregiverId);
      try {
        await authApi.respondConnection({
          patientId: me.id,
          caregiverId,
          accept: false,
        });
        setRequests((prev) => prev.filter((r) => r.id !== caregiverId));
      } finally {
        setActionLoadingId(null);
      }
    },
    [me],
  );

  const renderConnected = useMemo(() => {
    if (loadingConnected) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator />
          <ThemedText
            style={{
              marginTop: 10,
              color: colors.icon,
              fontSize: 13 * fontScale,
            }}
          >
            LOADING...
          </ThemedText>
        </View>
      );
    }

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

    return connected.map((item, idx) => (
      <View
        key={item.id}
        style={[
          styles.row,
          {
            borderColor: colors.border,
            borderTopWidth: idx === 0 ? 0 : 1,
            paddingTop: idx === 0 ? 0 : 14,
          },
        ]}
      >
        <View style={styles.rowLeft}>
          <View style={[styles.dot, { backgroundColor: colors.tint }]} />
          <View style={{ maxWidth: "78%" }}>
            <ThemedText
              style={{
                fontSize: 15 * fontScale,
                fontWeight: "600",
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {item.name}
            </ThemedText>
            <ThemedText
              style={{ fontSize: 12 * fontScale, color: colors.icon }}
              numberOfLines={1}
            >
              {item.email}
              {item.status ? ` • ${String(item.status).toUpperCase()}` : ""}
            </ThemedText>
          </View>
        </View>

        <Pressable
          onPress={() => removeAccess(item.id)}
          disabled={actionLoadingId === item.id}
          style={[
            styles.removeButton,
            {
              borderColor: colors.error,
              opacity: actionLoadingId === item.id ? 0.6 : 1,
            },
          ]}
        >
          {actionLoadingId === item.id ? (
            <ActivityIndicator />
          ) : (
            <ThemedText
              style={{
                color: colors.error,
                fontSize: 12 * fontScale,
                fontWeight: "600",
              }}
            >
              REMOVE
            </ThemedText>
          )}
        </Pressable>
      </View>
    ));
  }, [
    connected,
    loadingConnected,
    colors,
    fontScale,
    actionLoadingId,
    removeAccess,
  ]);

  const renderRequests = useMemo(() => {
    if (loadingRequests) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator />
          <ThemedText
            style={{
              marginTop: 10,
              color: colors.icon,
              fontSize: 13 * fontScale,
            }}
          >
            LOADING...
          </ThemedText>
        </View>
      );
    }

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

    return requests.map((item, idx) => (
      <View
        key={item.id}
        style={[
          styles.row,
          {
            borderColor: colors.border,
            borderTopWidth: idx === 0 ? 0 : 1,
            paddingTop: idx === 0 ? 0 : 14,
          },
        ]}
      >
        <View style={styles.rowLeft}>
          <View style={[styles.dot, { backgroundColor: colors.tint }]} />
          <View style={{ maxWidth: "64%" }}>
            <ThemedText
              style={{
                fontSize: 15 * fontScale,
                fontWeight: "600",
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {item.name}
            </ThemedText>
            <ThemedText
              style={{ fontSize: 12 * fontScale, color: colors.icon }}
              numberOfLines={1}
            >
              {item.email}
              {item.status ? ` • ${String(item.status).toUpperCase()}` : ""}
            </ThemedText>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => approve(item.id)}
            disabled={actionLoadingId === item.id}
            style={[
              styles.actionButton,
              {
                backgroundColor: colors.tint,
                opacity: actionLoadingId === item.id ? 0.6 : 1,
              },
            ]}
          >
            {actionLoadingId === item.id ? (
              <ActivityIndicator />
            ) : (
              <Ionicons name="checkmark" size={16} color={colors.buttonText} />
            )}
          </Pressable>

          <Pressable
            onPress={() => decline(item.id)}
            disabled={actionLoadingId === item.id}
            style={[
              styles.actionButton,
              {
                borderColor: colors.error,
                borderWidth: 1,
                opacity: actionLoadingId === item.id ? 0.6 : 1,
              },
            ]}
          >
            {actionLoadingId === item.id ? (
              <ActivityIndicator />
            ) : (
              <Ionicons name="close" size={16} color={colors.error} />
            )}
          </Pressable>
        </View>
      </View>
    ));
  }, [
    requests,
    loadingRequests,
    colors,
    fontScale,
    actionLoadingId,
    approve,
    decline,
  ]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: 20 }}
      showsVerticalScrollIndicator={false}
    >
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

      <Pressable
        style={[styles.refreshButton, { borderColor: colors.border }]}
        onPress={refresh}
        disabled={loadingConnected || loadingRequests}
      >
        <Ionicons name="refresh-outline" size={16} color={colors.icon} />
        <ThemedText
          style={{
            marginLeft: 8,
            color: colors.icon,
            fontSize: 13 * fontScale,
          }}
        >
          Refresh
        </ThemedText>
      </Pressable>

      <View
        style={[
          styles.card,
          { borderColor: colors.tint, backgroundColor: colors.card },
        ]}
      >
        <View
          style={[styles.tabRow, { backgroundColor: colors.inputBackground }]}
        >
          {(["connected", "requests"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
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

        <View style={{ marginTop: 10 }}>
          {activeTab === "connected" ? renderConnected : renderRequests}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerRow: { marginBottom: 20 },

  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
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
    minWidth: 84,
    alignItems: "center",
    justifyContent: "center",
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
