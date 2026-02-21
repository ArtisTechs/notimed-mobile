import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useMemo, useState } from "react";
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";

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

  const mockData: HistoryItem[] = [
    {
      id: "1",
      title: "Biogesic",
      type: "Medication",
      status: "late",
      message: "Late! Missed today’s 8:00 pm dose.",
      lastDate: "2/19/2026",
      date: "2026-02-21",
    },
    {
      id: "2",
      title: "Paracetamol",
      type: "Medication",
      status: "onTime",
      message: "On time!",
      lastDate: "2/20/2026",
      date: "2026-02-21",
    },
    {
      id: "3",
      title: "CT Scan",
      type: "Appointment",
      status: "missed",
      message: "Missed today’s appointment at 5:00 pm.",
      date: "2026-02-20",
    },
  ];

  const getStatusColor = (status: HistoryStatus) =>
    status === "onTime" ? colors.success : colors.error;

  const formatDisplayDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatISODate = (date: Date) => date.toISOString().split("T")[0];

  const filteredData = useMemo(() => {
    const selectedISO = formatISODate(selectedDate);
    return mockData.filter((item) => item.date === selectedISO);
  }, [selectedDate]);

  const onChangeDate = (_: any, date?: Date) => {
    if (Platform.OS !== "ios") setShowPicker(false);
    if (date) setSelectedDate(date);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Title */}
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

      {/* Card */}
      <View
        style={[
          styles.card,
          {
            borderColor: colors.tint,
            backgroundColor: colors.card ?? colors.background,
          },
        ]}
      >
        {/* Date Picker */}
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
          {filteredData.map((item, index) => (
            <View key={item.id}>
              <View style={styles.item}>
                <ThemedText
                  style={[
                    styles.itemTitle,
                    {
                      color: colors.tint,
                      fontSize: 18 * fontScale,
                    },
                  ]}
                >
                  {item.title}{" "}
                  <ThemedText
                    style={{
                      fontSize: 14 * fontScale,
                      color: colors.text,
                    }}
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

                {item.lastDate && (
                  <ThemedText
                    style={{
                      fontSize: 14 * fontScale,
                      color: colors.text,
                    }}
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

          {filteredData.length === 0 && (
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
