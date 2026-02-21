import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

export default function ScheduleScreen() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];

  const today = new Date();

  const [currentDate, setCurrentDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(today.getDate());

  const year = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth();

  const monthLabel = useMemo(() => {
    return currentDate.toLocaleString("en-US", { month: "long" }).toUpperCase();
  }, [currentDate]);

  const daysInMonth = useMemo(() => {
    return new Date(year, monthIndex + 1, 0).getDate();
  }, [year, monthIndex]);

  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();

  const calendarDays = useMemo(() => {
    const blanksStart = Array.from({ length: firstDayOfWeek }, () => null);
    const dates = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const totalCells = blanksStart.length + dates.length;
    const totalRows = Math.ceil(totalCells / 7);
    const totalSlots = totalRows * 7;

    const blanksEnd = Array.from(
      { length: totalSlots - totalCells },
      () => null,
    );

    return [...blanksStart, ...dates, ...blanksEnd];
  }, [firstDayOfWeek, daysInMonth]);

  const changeMonth = (direction: number) => {
    const newDate = new Date(year, monthIndex + direction, 1);
    setCurrentDate(newDate);
    setSelectedDate(1);
  };

  // MOCK SCHEDULE DATA
  const mockSchedules = [
    {
      id: "sch-1",
      date: new Date(year, monthIndex, 4),
      time: "08:00 AM",
      reminder: "Biogesic",
      dose: "10mg",
      notes: "After breakfast",
      status: "Pending",
    },
    {
      id: "sch-2",
      date: new Date(year, monthIndex, 4),
      time: "01:00 PM",
      reminder: "Amoxicillin",
      dose: "500mg",
      notes: "With water",
      status: "Done",
    },
    {
      id: "sch-3",
      date: new Date(year, monthIndex, 10),
      time: "08:00 PM",
      reminder: "Losartan",
      dose: "50mg",
      notes: "Before sleep",
      status: "Pending",
    },
  ];

  const scheduleDays = useMemo(() => {
    return new Set(
      mockSchedules
        .filter(
          (item) =>
            item.date.getFullYear() === year &&
            item.date.getMonth() === monthIndex,
        )
        .map((item) => item.date.getDate()),
    );
  }, [mockSchedules, year, monthIndex]);

  const filteredSchedules = mockSchedules.filter(
    (item) =>
      item.date.getFullYear() === year &&
      item.date.getMonth() === monthIndex &&
      item.date.getDate() === selectedDate,
  );

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
            MEDICATION SCHEDULE
          </ThemedText>

          <ThemedText
            style={{
              marginTop: 4,
              fontSize: 13 * fontScale,
              color: colors.icon,
              letterSpacing: 0.5,
            }}
          >
            Manage and track your daily medications
          </ThemedText>
        </View>

        <Pressable style={[styles.addButton, { borderColor: colors.tint }]}>
          <Ionicons name="add" size={18} color={colors.tint} />
        </Pressable>
      </View>

      {/* Calendar */}
      <View
        style={[
          styles.calendarCard,
          {
            borderColor: colors.tint,
            backgroundColor: colors.card,
          },
        ]}
      >
        <View style={styles.monthRow}>
          <Pressable onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={18} color={colors.tint} />
          </Pressable>

          <ThemedText
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              color: colors.tint,
              fontWeight: "700",
              fontSize: 16 * fontScale,
              letterSpacing: 1,
              flexShrink: 1,
            }}
          >
            {monthLabel} {year}
          </ThemedText>

          <Pressable onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={18} color={colors.tint} />
          </Pressable>
        </View>

        <View
          style={[styles.weekRow, { backgroundColor: colors.inputBackground }]}
        >
          {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((day) => (
            <ThemedText
              key={day}
              style={{
                color: colors.text,
                fontSize: 12 * fontScale,
                fontWeight: "600",
              }}
            >
              {day}
            </ThemedText>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {calendarDays.map((day, index) => {
            const isSelected = selectedDate === day;

            if (!day) {
              return <View key={index} style={styles.dayCell} />;
            }

            return (
              <Pressable
                key={index}
                onPress={() => setSelectedDate(day)}
                style={[
                  styles.dayCell,
                  isSelected && {
                    backgroundColor: colors.tint,
                  },
                ]}
              >
                <ThemedText
                  style={{
                    color: isSelected ? colors.buttonText : colors.text,
                    fontWeight: isSelected ? "700" : "500",
                  }}
                >
                  {day}
                </ThemedText>

                {scheduleDays.has(day) && (
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isSelected
                          ? colors.buttonText
                          : colors.tint,
                      },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Reminder Header */}
      <ThemedText
        style={{
          marginTop: 24,
          marginBottom: 12,
          fontWeight: "700",
          fontSize: 14 * fontScale,
          letterSpacing: 1,
          color: colors.icon,
        }}
      >
        REMINDERS FOR {monthLabel} {selectedDate}, {year}
      </ThemedText>

      {/* Reminder Card */}
      <View
        style={[
          styles.reminderCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            {/* HEADER */}
            <View style={styles.tableHeader}>
              <ThemedText
                style={[styles.thEdit, { color: colors.icon }]}
              ></ThemedText>
              <ThemedText style={[styles.thTime, { color: colors.icon }]}>
                TIME
              </ThemedText>
              <ThemedText style={[styles.thMedicine, { color: colors.icon }]}>
                MEDICINE
              </ThemedText>
              <ThemedText style={[styles.thDose, { color: colors.icon }]}>
                DOSE
              </ThemedText>
              <ThemedText style={[styles.thNotes, { color: colors.icon }]}>
                NOTES
              </ThemedText>
              {/* <ThemedText style={[styles.thStatus, { color: colors.icon }]}>
                STATUS
              </ThemedText> */}
            </View>

            {filteredSchedules.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="calendar-outline"
                  size={32}
                  color={colors.icon}
                />
                <ThemedText
                  style={{
                    marginTop: 8,
                    color: colors.icon,
                    fontSize: 13 * fontScale,
                  }}
                >
                  NO TASKS FOR TODAY
                </ThemedText>
              </View>
            ) : (
              filteredSchedules.map((item) => (
                <View
                  key={item.id}
                  style={[styles.tableRow, { borderColor: colors.border }]}
                >
                  <Pressable
                    style={styles.tdEdit}
                    onPress={() => console.log("Edit", item.id)}
                  >
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={colors.tint}
                    />
                  </Pressable>

                  <ThemedText style={[styles.tdTime, { color: colors.text }]}>
                    {item.time}
                  </ThemedText>

                  <ThemedText
                    style={[styles.tdMedicine, { color: colors.text }]}
                  >
                    {item.reminder}
                  </ThemedText>

                  <ThemedText style={[styles.tdDose, { color: colors.text }]}>
                    {item.dose}
                  </ThemedText>

                  <ThemedText style={[styles.tdNotes, { color: colors.icon }]}>
                    {item.notes}
                  </ThemedText>

                  {/* <ThemedText
                    style={[
                      styles.tdStatus,
                      {
                        color:
                          item.status === "Done" ? colors.tint : colors.icon,
                        fontWeight: "600",
                      },
                    ]}
                  >
                    {item.status}
                  </ThemedText> */}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  addButton: {
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
  },

  calendarCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
  },

  monthRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },

  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 12,
  },

  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },

  reminderCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  colTime: {
    flex: 1.2,
  },

  colMain: {
    flex: 2.5,
    paddingHorizontal: 6,
  },

  colDose: {
    flex: 1,
    textAlign: "center",
  },

  colStatus: {
    flex: 1,
    textAlign: "right",
  },

  table: {
    width: 650, // force larger than screen
  },

  tableHeader: {
    flexDirection: "row",
    marginBottom: 10,
  },

  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },

  // HEADER WIDTHS
  thEdit: { width: 50, fontWeight: "700" },
  thTime: { width: 100, fontWeight: "700" },
  thMedicine: { width: 160, fontWeight: "700" },
  thDose: { width: 100, fontWeight: "700" },
  thNotes: { width: 160, fontWeight: "700" },
  //   thStatus: { width: 100, fontWeight: "700" },

  // DATA WIDTHS
  tdTime: { width: 100 },
  tdMedicine: { width: 160 },
  tdDose: { width: 100 },
  tdNotes: { width: 160 },
  //   tdStatus: { width: 100 },
  tdEdit: {
    width: 50,
    alignItems: "center",
  },
});
