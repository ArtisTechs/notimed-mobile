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
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

type PatientRow = {
  id: string;
  name: string;
  email: string;
  role: "PATIENT" | "CAREGIVER";
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

export default function PatientsScreen() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];

  const [me, setMe] = useState<UserDetailsResponse | null>(null);
  const [connected, setConnected] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState("");

  const loadConnected = useCallback(async () => {
    setLoading(true);
    try {
      const myId = await getStoredUserId();
      if (!myId) {
        setMe(null);
        setConnected([]);
        return;
      }

      const details = await authApi.getUserById(myId);
      setMe(details);

      const rows = (details.connectedUsers ?? []).map((u) => ({
        id: u.id,
        name: fullName(u),
        email: u.email,
        role: u.role,
        status: u.status,
      }));

      setConnected(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnected();
  }, [loadConnected]);

  const removeAccess = useCallback(
    async (otherId: string) => {
      if (!me) return;

      setActionLoadingId(otherId);
      try {
        const payload =
          me.role === "CAREGIVER"
            ? { patientId: otherId, caregiverId: me.id } // caregiver removing patient
            : { patientId: me.id, caregiverId: otherId }; // patient removing caregiver

        await authApi.disconnect(payload);
        setConnected((prev) => prev.filter((p) => p.id !== otherId));
      } finally {
        setActionLoadingId(null);
      }
    },
    [me],
  );

  const title = me?.role === "PATIENT" ? "CAREGIVERS" : "PATIENTS";
  const subtitle =
    me?.role === "PATIENT"
      ? "Manage caregiver access"
      : "Manage and monitor patient access";

  const emptyLabel =
    me?.role === "PATIENT"
      ? "NO CONNECTED CAREGIVERS"
      : "NO CONNECTED PATIENTS";

  const renderConnected = useMemo(() => {
    if (loading) {
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
            {emptyLabel}
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
    colors,
    emptyLabel,
    fontScale,
    loading,
    actionLoadingId,
    removeAccess,
  ]);

  const handleConnect = useCallback(async () => {
    const code = inviteCodeInput.trim().toUpperCase();
    if (!code) {
      setConnectError("Invite code is required.");
      return;
    }

    setConnectError("");
    setConnectLoading(true);
    try {
      const caregiverId = await getStoredUserId();
      if (!caregiverId) {
        setConnectError("Missing caregiver id. Please login again.");
        return;
      }

      await authApi.connect({
        caregiverId,
        inviteCode: code,
      });

      setInviteCodeInput("");
      setConnectModalOpen(false);
      await loadConnected();
    } catch (e: any) {
      const msg =
        e?.message ||
        e?.error ||
        "Unable to connect. Check invite code and try again.";
      setConnectError(String(msg));
    } finally {
      setConnectLoading(false);
    }
  }, [inviteCodeInput, loadConnected]);

  return (
    <>
      <Modal
        visible={connectModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!connectLoading) {
            setConnectModalOpen(false);
            setConnectError("");
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", paddingHorizontal: 18 }}
          >
            <View
              style={[
                styles.modalCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.modalHeaderRow}>
                <ThemedText
                  style={{
                    fontSize: 18 * fontScale,
                    fontWeight: "700",
                    color: colors.text,
                  }}
                >
                  Connect to Patient
                </ThemedText>

                <Pressable
                  onPress={() => {
                    if (connectLoading) return;
                    setConnectModalOpen(false);
                    setConnectError("");
                  }}
                  hitSlop={10}
                >
                  <Ionicons name="close" size={20} color={colors.icon} />
                </Pressable>
              </View>

              <ThemedText
                style={{
                  marginTop: 6,
                  fontSize: 13 * fontScale,
                  color: colors.icon,
                }}
              >
                Enter the patient invite code.
              </ThemedText>

              <View
                style={[
                  styles.inputBox,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="key-outline" size={18} color={colors.icon} />
                <TextInput
                  value={inviteCodeInput}
                  onChangeText={(text) => setInviteCodeInput(text)}
                  placeholder="e.g. NTM-4821"
                  placeholderTextColor={colors.icon}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!connectLoading}
                  style={[
                    styles.input,
                    { color: colors.text, fontSize: 14 * fontScale },
                  ]}
                />
              </View>

              {!!connectError && (
                <ThemedText
                  style={{
                    marginTop: 10,
                    color: "red",
                    fontSize: 12 * fontScale,
                  }}
                >
                  {connectError}
                </ThemedText>
              )}

              <View style={styles.modalActionsRow}>
                <Pressable
                  style={[
                    styles.modalButton,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    if (connectLoading) return;
                    setConnectModalOpen(false);
                    setConnectError("");
                  }}
                >
                  <ThemedText
                    style={{
                      color: colors.text,
                      fontWeight: "600",
                      fontSize: 13 * fontScale,
                    }}
                  >
                    Cancel
                  </ThemedText>
                </Pressable>

                <Pressable
                  style={[
                    styles.modalButton,
                    { backgroundColor: colors.tint, borderColor: colors.tint },
                  ]}
                  onPress={handleConnect}
                >
                  {connectLoading ? (
                    <ActivityIndicator color={colors.buttonText} />
                  ) : (
                    <ThemedText
                      style={{
                        color: colors.buttonText,
                        fontWeight: "700",
                        fontSize: 13 * fontScale,
                      }}
                    >
                      Connect
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <ThemedText
            style={{
              fontSize: 20 * fontScale,
              fontWeight: "700",
              color: colors.text,
            }}
          >
            {title}
          </ThemedText>

          <ThemedText
            style={{
              marginTop: 4,
              fontSize: 13 * fontScale,
              color: colors.icon,
              letterSpacing: 0.5,
            }}
          >
            {subtitle}
          </ThemedText>
        </View>

        <Pressable
          style={[styles.connectButton, { backgroundColor: colors.tint }]}
          onPress={() => {
            setInviteCodeInput("");
            setConnectError("");
            setConnectModalOpen(true);
          }}
        >
          <Ionicons
            name="person-add-outline"
            size={18}
            color={colors.buttonText}
          />
          <ThemedText
            style={{
              color: colors.buttonText,
              fontWeight: "600",
              fontSize: 14 * fontScale,
              marginLeft: 8,
            }}
          >
            Connect to Patient
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.refreshButton, { borderColor: colors.border }]}
          onPress={loadConnected}
          disabled={loading}
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
          {renderConnected}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerRow: { marginBottom: 16 },

  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },

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

  dot: { width: 6, height: 6, borderRadius: 3 },

  removeButton: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 84,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },

  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  inputBox: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  input: {
    flex: 1,
    paddingVertical: 0,
  },

  modalActionsRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },

  modalButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
