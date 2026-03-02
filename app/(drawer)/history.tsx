// app/(drawer)/history.tsx  (or wherever your HistoryScreen lives)
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useMemo, useState } from "react";
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

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
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

  const getStoredUserId = async (): Promise<string | null> => {
    const direct = await AsyncStorage.getItem("userId");
    if (direct) return direct;

    const userJson =
      (await AsyncStorage.getItem("user")) ??
      (await AsyncStorage.getItem("userDetails")) ??
      (await AsyncStorage.getItem("auth:user"));

    if (!userJson) return null;

    try {
      const parsed = JSON.parse(userJson);
      const id = parsed?.id ?? parsed?.userId;
      return typeof id === "string" ? id : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const userId = await getStoredUserId();
        if (!userId) {
          if (!cancelled) setItems([]);
          return;
        }

        const date = formatISODate(selectedDate);
        const res = await historyApi.list({ userId, date });

        if (!cancelled) setItems(res.map(mapApiItem));
      } catch (e: any) {
        if (!cancelled) {
          setItems([]);
          setError(e?.message ?? "Failed to load history");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

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

      <View
        style={[
          styles.card,
          {
            borderColor: colors.tint,
            backgroundColor: colors.card ?? colors.background,
          },
        ]}
      >
        <Pressable
          style={[styles.dropdown, { backgroundColor: colors.tint }]}
          onPress={() => setShowPicker(true)}
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
          {loading && (
            <View style={{ paddingVertical: 18, alignItems: "center" }}>
              <ActivityIndicator />
            </View>
          )}

          {!loading && error && (
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

          {filteredData.map((item, index) => (
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

          {!loading && filteredData.length === 0 && (
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
  title: {
    fontWeight: "700",
    marginBottom: 5,
  },
  subtitle: {
    opacity: 0.7,
    marginBottom: 10,
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
