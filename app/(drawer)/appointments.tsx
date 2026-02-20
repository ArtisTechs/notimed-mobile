import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

export default function AppointmentScreen() {
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

  // MOCK APPOINTMENT DATA
  const mockAppointments = [
    {
      id: "app-1",
      date: new Date(year, monthIndex, 4),
      time: "10:30",
      title: "CT scan",
      status: "Pending",
    },
    {
      id: "app-2",
      date: new Date(year, monthIndex, 4),
      time: "02:00",
      title: "Cardiology Checkup",
      status: "Scheduled",
    },
  ];

  const appointmentDays = useMemo(() => {
    return new Set(
      mockAppointments
        .filter(
          (item) =>
            item.date.getFullYear() === year &&
            item.date.getMonth() === monthIndex,
        )
        .map((item) => item.date.getDate()),
    );
  }, [mockAppointments, year, monthIndex]);

  const filteredAppointments = mockAppointments.filter(
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
      <View style={styles.headerRow}>
        <ThemedText
          style={{
            fontSize: 20 * fontScale,
            fontWeight: "700",
            color: colors.text,
          }}
        >
          APPOINTMENTS
        </ThemedText>

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

            if (!day) return <View key={index} style={styles.dayCell} />;

            return (
              <Pressable
                key={index}
                onPress={() => setSelectedDate(day)}
                style={[
                  styles.dayCell,
                  isSelected && { backgroundColor: colors.tint },
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

                {appointmentDays.has(day) && (
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

      {/* Header Label */}
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
        APPOINTMENTS FOR {monthLabel} {selectedDate}, {year}
      </ThemedText>

      {/* Table */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.tableHeader}>
          <ThemedText style={[styles.thTime, { color: colors.icon }]}>
            TIME
          </ThemedText>
          <ThemedText style={[styles.thTitle, { color: colors.icon }]}>
            APPOINTMENT
          </ThemedText>
          <ThemedText style={[styles.thStatus, { color: colors.icon }]}>
            STATUS
          </ThemedText>
        </View>

        {filteredAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={32} color={colors.icon} />
            <ThemedText
              style={{
                marginTop: 8,
                color: colors.icon,
                fontSize: 13 * fontScale,
              }}
            >
              NO APPOINTMENTS
            </ThemedText>
          </View>
        ) : (
          filteredAppointments.map((item) => (
            <View
              key={item.id}
              style={[styles.tableRow, { borderColor: colors.border }]}
            >
              <ThemedText style={[styles.tdTime, { color: colors.text }]}>
                {item.time}
              </ThemedText>

              <View style={styles.tdTitle}>
                <ThemedText
                  style={{
                    color: colors.text,
                    fontWeight: "600",
                  }}
                >
                  {item.title}
                </ThemedText>
              </View>

              <View style={styles.tdStatus}>
                <View
                  style={[
                    styles.statusCircle,
                    {
                      borderColor:
                        item.status === "Pending" ? "#f97316" : colors.tint,
                    },
                  ]}
                />
                <ThemedText
                  style={{
                    marginLeft: 6,
                    fontWeight: "600",
                    color: item.status === "Pending" ? "#f97316" : colors.tint,
                  }}
                >
                  {item.status.toUpperCase()}
                </ThemedText>
              </View>
            </View>
          ))
        )}
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

  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },

  tableHeader: {
    flexDirection: "row",
    marginBottom: 10,
  },

  tableRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
  },

  thTime: { width: 80, fontWeight: "700" },
  thTitle: { flex: 1, fontWeight: "700" },
  thStatus: { width: 120, fontWeight: "700", textAlign: "right" },

  tdTime: { width: 80 },
  tdTitle: { flex: 1 },
  tdStatus: {
    width: 120,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },

  statusCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },
});
