// schedule.tsx
import AddMedicationModal, {
  MedicationPayload,
} from "@/components/AddMedicationModal";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { authApi, UserDetailsResponse } from "@/services/authApi";
import {
  MedicationResponse,
  medicationsApi,
  MedicationStatus,
  MedicationUpsertRequest,
} from "@/services/medicationsApi";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

const pad2 = (n: number) => String(n).padStart(2, "0");

const formatTime12h = (value?: string) => {
  if (!value) return "—";
  const parts = value.split(":");
  const hh = Number(parts[0]);
  const mm = parts[1] ?? "00";
  if (Number.isNaN(hh)) return value;

  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${mm} ${period}`;
};

const toYmd = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const parseYmd = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

const dayCode = (d: Date) => {
  const codes = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
  return codes[d.getDay()];
};

const daysBetween = (a: Date, b: Date) => {
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.floor((b0 - a0) / (24 * 60 * 60 * 1000));
};

const monthsBetween = (a: Date, b: Date) =>
  (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

const weeksBetween = (a: Date, b: Date) => Math.floor(daysBetween(a, b) / 7);

const isDueOnDate = (m: MedicationPayload, date: Date) => {
  const start = parseYmd(m.startDate);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (target < new Date(start.getFullYear(), start.getMonth(), start.getDate()))
    return false;

  if (m.repeat?.endDate) {
    const end = parseYmd(m.repeat.endDate);
    const end0 = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (target > end0) return false;
  }

  const type = m.repeat?.type ?? "once";
  const interval = Math.max(1, Number(m.repeat?.interval ?? 1));
  const unit = m.repeat?.unit ?? (type === "monthly" ? "month" : "day");
  const dow = m.repeat?.daysOfWeek ?? [];

  if (type === "once") {
    return toYmd(target) === m.startDate;
  }

  if (type === "daily" || unit === "day") {
    const diff = daysBetween(start, target);
    return diff % interval === 0;
  }

  if (type === "weekly" || unit === "week") {
    const wdiff = weeksBetween(start, target);
    if (wdiff % interval !== 0) return false;
    if (dow.length === 0) return true;
    return dow.includes(dayCode(target));
  }

  // monthly
  const mdiff = monthsBetween(start, target);
  if (mdiff % interval !== 0) return false;

  // anchor to start day-of-month (simple rule)
  return target.getDate() === start.getDate();
};

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

  // ==========================
  // USER LOAD (same pattern as dashboard)
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

  // ==========================
  // MEDICATIONS (cache + API) + CRUD (same idea as dashboard)
  // ==========================
  const [medications, setMedications] = React.useState<MedicationPayload[]>([]);
  const [medModalOpen, setMedModalOpen] = React.useState(false);
  const [editingMed, setEditingMed] = React.useState<MedicationPayload | null>(
    null,
  );

  const toApiStatus = (s: MedicationPayload["status"]): MedicationStatus =>
    s === "completed" ? "COMPLETED" : "ONGOING";

  const toUpsertRequest = (m: MedicationPayload): MedicationUpsertRequest => ({
    userId: user.id,
    name: m.name,
    dose: m.dose,
    startDate: m.startDate,
    repeat: {
      type: m.repeat.type,
      interval: m.repeat.interval,
      unit: m.repeat.unit,
      daysOfWeek: m.repeat.daysOfWeek,
      endDate: m.repeat.endDate ?? null,
    },
    schedule: {
      time: m.schedule.time,
      reminderOffsetMinutes: m.schedule.reminderOffsetMinutes,
    },
    status: toApiStatus(m.status),
    notes: m.notes ?? null,
  });

  const toUiMedication = (m: MedicationResponse): MedicationPayload => ({
    id: m.id,
    userId: m.userId,
    name: m.name,
    dose: m.dose,
    startDate: m.startDate,
    repeat: {
      type: m.repeat.type,
      interval: m.repeat.interval,
      unit: m.repeat.unit,
      daysOfWeek: m.repeat.daysOfWeek,
      endDate: m.repeat.endDate ?? undefined,
    },
    schedule: {
      time: m.schedule.time,
      reminderOffsetMinutes: m.schedule.reminderOffsetMinutes,
    },
    status: m.status === "COMPLETED" ? "completed" : "ongoing",
    notes: m.notes ?? undefined,
  });

  const medsKey = React.useMemo(() => {
    const uid = user.id || "unknown";
    return `medications:${uid}`;
  }, [user.id]);

  React.useEffect(() => {
    let mounted = true;

    const loadMeds = async () => {
      if (!user.id) return;

      // 1) cached
      try {
        const cached = await AsyncStorage.getItem(medsKey);
        if (mounted && cached) setMedications(JSON.parse(cached));
      } catch {}

      // 2) API
      try {
        const list = await medicationsApi.listByUser(user.id);
        const ui = list
          .map(toUiMedication)
          .sort((a, b) => a.schedule.time.localeCompare(b.schedule.time));

        if (!mounted) return;
        setMedications(ui);
        await AsyncStorage.setItem(medsKey, JSON.stringify(ui));
      } catch {
        // keep cached
      }
    };

    loadMeds();
    return () => {
      mounted = false;
    };
  }, [user.id, medsKey]);

  const persistMeds = async (items: MedicationPayload[]) => {
    if (!user.id) return;
    await AsyncStorage.setItem(medsKey, JSON.stringify(items));
  };

  const handleAddMedication = async (payload: MedicationPayload) => {
    if (!user.id) return;

    const req = toUpsertRequest(payload);
    const created = await medicationsApi.create(req);
    const createdUi = toUiMedication(created);

    const next = [createdUi, ...medications].sort((a, b) =>
      a.schedule.time.localeCompare(b.schedule.time),
    );

    setMedications(next);
    await persistMeds(next);
  };

  const handleUpdateMedication = async (payload: MedicationPayload) => {
    if (!user.id) return;

    const req = toUpsertRequest(payload);
    const updated = await medicationsApi.update(payload.id, req);
    const updatedUi = toUiMedication(updated);

    const next = medications
      .map((m) => (m.id === updatedUi.id ? updatedUi : m))
      .sort((a, b) => a.schedule.time.localeCompare(b.schedule.time));

    setMedications(next);
    await persistMeds(next);
  };

  const handleDeleteMedication = async (id: string) => {
    try {
      await medicationsApi.delete(id);
    } finally {
      const next = medications.filter((m) => m.id !== id);
      setMedications(next);
      await persistMeds(next);
    }
  };

  // ==========================
  // CALENDAR DOTS + FILTERED LIST (derived from medications)
  // ==========================
  const selectedDateObj = useMemo(() => {
    return new Date(year, monthIndex, selectedDate);
  }, [year, monthIndex, selectedDate]);

  const scheduleDays = useMemo(() => {
    const set = new Set<number>();
    if (!medications.length) return set;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, monthIndex, d);
      const hasAny = medications.some((m) => isDueOnDate(m, date));
      if (hasAny) set.add(d);
    }
    return set;
  }, [medications, year, monthIndex, daysInMonth]);

  const filteredSchedules = useMemo(() => {
    const list = medications
      .filter((m) => isDueOnDate(m, selectedDateObj))
      .slice()
      .sort((a, b) => a.schedule.time.localeCompare(b.schedule.time));
    return list;
  }, [medications, selectedDateObj]);

  return (
    <>
      <AddMedicationModal
        visible={medModalOpen}
        userId={user.id}
        mode={editingMed ? "update" : "add"}
        initialData={editingMed ?? undefined}
        onClose={() => {
          setMedModalOpen(false);
          setEditingMed(null);
        }}
        onSubmit={editingMed ? handleUpdateMedication : handleAddMedication}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
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

          <Pressable
            style={[styles.addButton, { borderColor: colors.tint }]}
            onPress={() => {
              setEditingMed(null);
              setMedModalOpen(true);
            }}
          >
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
            style={[
              styles.weekRow,
              { backgroundColor: colors.inputBackground },
            ]}
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
                <ThemedText style={[styles.thEdit, { color: colors.icon }]} />
                <ThemedText style={[styles.thDel, { color: colors.icon }]} />
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
                filteredSchedules.map((m) => (
                  <View
                    key={m.id}
                    style={[styles.tableRow, { borderColor: colors.border }]}
                  >
                    <Pressable
                      style={styles.tdEdit}
                      onPress={() => {
                        setEditingMed(m);
                        setMedModalOpen(true);
                      }}
                      hitSlop={10}
                    >
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color={colors.tint}
                      />
                    </Pressable>

                    <Pressable
                      style={styles.tdDel}
                      onPress={() => handleDeleteMedication(m.id)}
                      hitSlop={10}
                    >
                      <Ionicons name="trash-outline" size={18} color="red" />
                    </Pressable>

                    <ThemedText style={[styles.tdTime, { color: colors.text }]}>
                      {formatTime12h(m.schedule.time)}
                    </ThemedText>

                    <ThemedText
                      style={[styles.tdMedicine, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {m.name}
                    </ThemedText>

                    <ThemedText style={[styles.tdDose, { color: colors.text }]}>
                      {m.dose}
                    </ThemedText>

                    <ThemedText
                      style={[styles.tdNotes, { color: colors.icon }]}
                    >
                      {m.notes || "—"}
                    </ThemedText>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </>
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

  table: {
    width: 720,
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
  thDel: { width: 50, fontWeight: "700" },
  thTime: { width: 120, fontWeight: "700" },
  thMedicine: { width: 180, fontWeight: "700" },
  thDose: { width: 120, fontWeight: "700" },
  thNotes: { width: 200, fontWeight: "700" },

  // DATA WIDTHS
  tdEdit: { width: 50, alignItems: "center" },
  tdDel: { width: 50, alignItems: "center" },
  tdTime: { width: 120 },
  tdMedicine: { width: 180 },
  tdDose: { width: 120 },
  tdNotes: { width: 200 },
});
