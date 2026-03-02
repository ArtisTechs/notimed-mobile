// app/(drawer)/history.tsx
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { authApi, UserDetailsResponse } from "@/services/authApi";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import {
  HistoryStatus as ApiHistoryStatus,
  HistoryType as ApiHistoryType,
  historyApi,
  HistoryResponse,
} from "@/services/historyApi";

type HistoryStatus = "late" | "onTime" | "missed";

interface HistoryItem {
  id: string;
  title: string;
  type: "Medication" | "Appointment";
  status: HistoryStatus;
  message: string;
  lastDate?: string;
  date: string;
}

export default function HistoryScreen() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];

  // ==========================
  // USER LOAD (+ caregiver patient selector)
  // ==========================
  const [user, setUser] = React.useState<UserDetailsResponse>({
    id: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    role: "PATIENT",
    inviteCode: "",
    connectedUsers: [],
  });

  React.useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const cached = await AsyncStorage.getItem("userDetails");
        if (cached && mounted) setUser(JSON.parse(cached));

        const userId = await AsyncStorage.getItem("userId");
        if (!userId) return;

        const details = await authApi.getUserById(userId);

        await AsyncStorage.multiSet([
          ["userId", String(details.id)],
          ["userRole", String(details.role).toLowerCase()],
          ["userEmail", String(details.email ?? "")],
          [
            "userName",
            `${details.firstName ?? ""} ${details.lastName ?? ""}`.trim(),
          ],
          ["userDetails", JSON.stringify(details)],
        ]);

        if (mounted) setUser(details);
      } catch {
        // keep cached
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const isCaregiver = String(user.role).toUpperCase() === "CAREGIVER";
  const [selectedPatientId, setSelectedPatientId] = React.useState<string>("");

  const patientOptions = useMemo(() => {
    const list = (user.connectedUsers ?? []) as any[];

    return list
      .map((u) => {
        const id = String(u?.id ?? "");
        const name = String(
          u?.name ?? `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim() ?? "",
        ).trim();

        return { id, label: name || u?.email || id };
      })
      .filter((x) => x.id);
  }, [user.connectedUsers]);

  React.useEffect(() => {
    if (!isCaregiver) {
      if (selectedPatientId) setSelectedPatientId("");
      return;
    }

    if (!selectedPatientId && patientOptions.length > 0) {
      setSelectedPatientId(patientOptions[0].id);
    }

    if (
      selectedPatientId &&
      patientOptions.length > 0 &&
      !patientOptions.some((p) => p.id === selectedPatientId)
    ) {
      setSelectedPatientId(patientOptions[0].id);
    }
  }, [isCaregiver, patientOptions, selectedPatientId]);

  const targetUserId = useMemo(() => {
    if (!user.id) return "";
    if (!isCaregiver) return user.id;
    return selectedPatientId || "";
  }, [user.id, isCaregiver, selectedPatientId]);

  // ==========================
  // DATE FILTER
  // ==========================
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStatusColor = (status: HistoryStatus) =>
    status === "onTime" ? colors.success : colors.error;

  const formatDisplayDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatISODate = (date: Date) => date.toISOString().split("T")[0];

  const mapApiStatus = (status: ApiHistoryStatus): HistoryStatus => {
    if (status === "COMPLETED") return "onTime";
    return "missed"; // SKIPPED / MISSED
  };

  const mapApiType = (type: ApiHistoryType): HistoryItem["type"] =>
    type === "MEDICATION" ? "Medication" : "Appointment";

  const buildMessage = (h: HistoryResponse): string => {
    const timePart = h.time ? ` at ${h.time}` : "";
    const notesPart = h.notes ? ` ${h.notes}` : "";

    if (h.status === "COMPLETED")
      return `Completed${timePart}.${notesPart}`.trim();
    if (h.status === "SKIPPED") return `Skipped${timePart}.${notesPart}`.trim();
    return `Missed${timePart}.${notesPart}`.trim();
  };

  const mapApiItem = (h: HistoryResponse): HistoryItem => {
    const doseSuffix = h.type === "MEDICATION" && h.dose ? ` (${h.dose})` : "";
    return {
      id: h.id,
      title: `${h.name}${doseSuffix}`,
      type: mapApiType(h.type),
      status: mapApiStatus(h.status),
      message: buildMessage(h),
      date: h.date,
    };
  };

  const loadHistory = useCallback(
    async (opts?: { asRefetch?: boolean }) => {
      const asRefetch = opts?.asRefetch ?? false;

      if (asRefetch) setRefetching(true);
      else setLoading(true);

      setError(null);

      try {
        if (!targetUserId) {
          setItems([]);
          return;
        }

        const date = formatISODate(selectedDate);
        const res = await historyApi.list({ userId: targetUserId, date });
        setItems(res.map(mapApiItem));
      } catch (e: any) {
        setItems([]);
        setError(e?.message ?? "Failed to load history");
      } finally {
        if (asRefetch) setRefetching(false);
        else setLoading(false);
      }
    },
    [targetUserId, selectedDate],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await loadHistory();
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [loadHistory]);

  const filteredData = useMemo(() => {
    const selectedISO = formatISODate(selectedDate);
    return items.filter((item) => item.date === selectedISO);
  }, [items, selectedDate]);

  const onChangeDate = (_: any, date?: Date) => {
    if (Platform.OS !== "ios") setShowPicker(false);
    if (date) setSelectedDate(date);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.titleContainer}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <ThemedText
              style={{
                fontSize: 20 * fontScale,
                fontWeight: "700",
                color: colors.text,
              }}
            >
              HISTORY
            </ThemedText>
            <ThemedText
              style={[
                styles.subtitle,
                { fontSize: 14 * fontScale, color: colors.text },
              ]}
            >
              View Your Adherence
            </ThemedText>
          </View>

          <Pressable
            style={[
              styles.refetchBtn,
              {
                borderColor: colors.tint,
                opacity: !targetUserId || refetching ? 0.6 : 1,
              },
            ]}
            onPress={() => loadHistory({ asRefetch: true })}
            disabled={!targetUserId || refetching}
            hitSlop={10}
          >
            <Ionicons name="refresh" size={18} color={colors.tint} />
          </Pressable>
        </View>
      </View>

      <View
        style={[
          styles.card,
          {
            borderColor: colors.tint,
            backgroundColor: colors.card ?? colors.background,
          },
        ]}
      >
        {isCaregiver && (
          <View style={{ marginBottom: 12 }}>
            <ThemedText
              style={{
                color: colors.icon,
                fontSize: 12 * fontScale,
                fontWeight: "700",
                letterSpacing: 0.8,
                marginBottom: 8,
              }}
            >
              PATIENT
            </ThemedText>

            <View
              style={[
                styles.pickerWrap,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.inputBackground,
                },
              ]}
            >
              <Picker
                selectedValue={selectedPatientId}
                onValueChange={(v) => setSelectedPatientId(String(v))}
                style={[
                  styles.picker,
                  { color: colors.text, fontSize: 14 * fontScale },
                ]}
                dropdownIconColor={colors.icon}
              >
                {patientOptions.length === 0 ? (
                  <Picker.Item label="No connected patients" value="" />
                ) : (
                  patientOptions.map((p) => (
                    <Picker.Item key={p.id} label={p.label} value={p.id} />
                  ))
                )}
              </Picker>
            </View>
          </View>
        )}

        <Pressable
          style={[
            styles.dropdown,
            { backgroundColor: colors.tint, opacity: !targetUserId ? 0.6 : 1 },
          ]}
          onPress={() => {
            if (!targetUserId) return;
            setShowPicker(true);
          }}
        >
          <ThemedText
            style={[
              styles.dropdownText,
              { fontSize: 14 * fontScale, color: colors.background },
            ]}
          >
            {formatDisplayDate(selectedDate)}
          </ThemedText>
          <Ionicons
            name="calendar-outline"
            size={18 * fontScale}
            color={colors.background}
          />
        </Pressable>

        {showPicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={onChangeDate}
            maximumDate={new Date()}
          />
        )}

        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {!targetUserId && (
            <View style={{ paddingVertical: 18, alignItems: "center" }}>
              <Ionicons name="people-outline" size={32} color={colors.icon} />
              <ThemedText
                style={{
                  marginTop: 8,
                  color: colors.icon,
                  fontSize: 13 * fontScale,
                  textAlign: "center",
                }}
              >
                SELECT A PATIENT TO VIEW HISTORY
              </ThemedText>
            </View>
          )}

          {targetUserId && (loading || refetching) && (
            <View style={{ paddingVertical: 18, alignItems: "center" }}>
              <ActivityIndicator />
            </View>
          )}

          {targetUserId && !loading && !refetching && error && (
            <ThemedText
              style={{
                fontSize: 14 * fontScale,
                color: colors.error,
                opacity: 0.9,
                marginTop: 8,
                textAlign: "center",
              }}
            >
              {error}
            </ThemedText>
          )}

          {targetUserId &&
            !loading &&
            !refetching &&
            filteredData.map((item, index) => (
              <View key={item.id}>
                <View style={styles.item}>
                  <ThemedText
                    style={[
                      styles.itemTitle,
                      { color: colors.tint, fontSize: 18 * fontScale },
                    ]}
                  >
                    {item.title}{" "}
                    <ThemedText
                      style={{ fontSize: 14 * fontScale, color: colors.text }}
                    >
                      ({item.type})
                    </ThemedText>
                  </ThemedText>

                  <ThemedText
                    style={{
                      color: getStatusColor(item.status),
                      fontSize: 14 * fontScale,
                      marginTop: 4,
                    }}
                  >
                    {item.message}
                  </ThemedText>

                  {!!item.lastDate && (
                    <ThemedText
                      style={{ fontSize: 14 * fontScale, color: colors.text }}
                    >
                      Last dose was during {item.lastDate}.
                    </ThemedText>
                  )}
                </View>

                {index !== filteredData.length - 1 && (
                  <View
                    style={[styles.divider, { backgroundColor: colors.border }]}
                  />
                )}
              </View>
            ))}

          {targetUserId &&
            !loading &&
            !refetching &&
            filteredData.length === 0 && (
              <ThemedText
                style={{
                  fontSize: 14 * fontScale,
                  color: colors.text,
                  opacity: 0.6,
                  marginTop: 20,
                  textAlign: "center",
                }}
              >
                No records for selected date.
              </ThemedText>
            )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  titleContainer: {
    marginTop: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  subtitle: {
    opacity: 0.7,
    marginBottom: 10,
  },
  refetchBtn: {
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
  },
  card: {
    marginTop: 15,
    borderWidth: 2,
    borderRadius: 20,
    padding: 16,
  },
  dropdown: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 16,
    gap: 4,
  },
  dropdownText: {
    fontWeight: "600",
  },
  pickerWrap: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  picker: {
    width: "100%",
    height: 48,
  },
  item: {
    paddingVertical: 12,
  },
  itemTitle: {
    fontWeight: "700",
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
});
