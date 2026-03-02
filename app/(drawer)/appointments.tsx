// appointments.tsx (or AppointmentScreen.tsx)
import AddAppointmentModal, {
  AppointmentPayload,
} from "@/components/AddAppointmentModal";
import FullscreenLoader from "@/components/FullscreenLoader";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import {
  AppointmentResponse,
  appointmentsApi,
} from "@/services/appointmentsApi";
import { authApi, UserDetailsResponse } from "@/services/authApi";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

const pad2 = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const normalizeTime = (t?: string) => {
  if (!t) return "00:00";
  const [h = "0", m = "0"] = t.split(":");
  return `${pad2(Number(h))}:${pad2(Number(m))}`;
};

const formatTime12h = (value?: string) => {
  if (!value) return "—";
  const [hStr, mStr = "00"] = value.split(":");
  const hh = Number(hStr);
  if (Number.isNaN(hh)) return value;

  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${mStr} ${period}`;
};

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
  const [refetchingAppts, setRefetchingAppts] = React.useState(false);

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
    const newYear = newDate.getFullYear();
    const newMonth = newDate.getMonth();
    const maxDay = new Date(newYear, newMonth + 1, 0).getDate();

    setCurrentDate(newDate);
    setSelectedDate((d) => Math.min(d, maxDay));
  };

  // ==========================
  // USER LOAD
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

  const refetchAppts = React.useCallback(async () => {
    if (!user.id) return;

    setRefetchingAppts(true);
    try {
      const list = await appointmentsApi.list(user.id);
      const ui = list.map(toUiAppointment).sort((a, b) => {
        const aKey = `${a.appointmentDate} ${normalizeTime(a.appointmentTime)}`;
        const bKey = `${b.appointmentDate} ${normalizeTime(b.appointmentTime)}`;
        return aKey.localeCompare(bKey);
      });

      setAppointments(ui);
    } catch {
      // keep existing list
    } finally {
      setRefetchingAppts(false);
    }
  }, [user.id]);

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
  // APPOINTMENTS (single cache source = appointmentsApi)
  // ==========================
  const [appointments, setAppointments] = React.useState<AppointmentPayload[]>(
    [],
  );
  const [apptModalOpen, setApptModalOpen] = React.useState(false);
  const [editingAppt, setEditingAppt] =
    React.useState<AppointmentPayload | null>(null);

  const toUiAppointment = (a: AppointmentResponse): AppointmentPayload => ({
    id: a.id,
    userId: a.userId,
    title: a.title,
    appointmentDate: a.appointmentDate,
    appointmentTime: a.appointmentTime,
    notes: a.notes ?? undefined,
  });

  React.useEffect(() => {
    let mounted = true;

    const loadAppts = async () => {
      if (!user.id) return;

      // 1) cached (service-owned)
      try {
        const cached = await appointmentsApi.getCached(user.id);
        const uiCached = cached.map(toUiAppointment).sort((a, b) => {
          const aKey = `${a.appointmentDate} ${normalizeTime(a.appointmentTime)}`;
          const bKey = `${b.appointmentDate} ${normalizeTime(b.appointmentTime)}`;
          return aKey.localeCompare(bKey);
        });

        if (mounted) setAppointments(uiCached);
      } catch {}

      // 2) API (refresh master list + service cache)
      try {
        if (mounted) await refetchAppts();
      } catch {
        // keep cached
      }
    };

    loadAppts();
    return () => {
      mounted = false;
    };
  }, [user.id, refetchAppts]);

  const handleAddAppointment = async (payload: AppointmentPayload) => {
    if (!user.id) return;

    const created = await appointmentsApi.create({
      userId: user.id,
      title: payload.title,
      appointmentDate: payload.appointmentDate,
      appointmentTime: payload.appointmentTime,
      notes: payload.notes ?? null,
    });

    const createdUi = toUiAppointment(created);

    setAppointments((prev) =>
      [createdUi, ...prev].sort((a, b) => {
        const aKey = `${a.appointmentDate} ${normalizeTime(a.appointmentTime)}`;
        const bKey = `${b.appointmentDate} ${normalizeTime(b.appointmentTime)}`;
        return aKey.localeCompare(bKey);
      }),
    );
  };

  const handleUpdateAppointment = async (payload: AppointmentPayload) => {
    if (!user.id) return;

    const updated = await appointmentsApi.update(payload.id, {
      title: payload.title,
      appointmentDate: payload.appointmentDate,
      appointmentTime: payload.appointmentTime,
      notes: payload.notes ?? null,
    });

    const updatedUi = toUiAppointment(updated);

    setAppointments((prev) =>
      prev
        .map((a) => (a.id === updatedUi.id ? updatedUi : a))
        .sort((a, b) => {
          const aKey = `${a.appointmentDate} ${normalizeTime(a.appointmentTime)}`;
          const bKey = `${b.appointmentDate} ${normalizeTime(b.appointmentTime)}`;
          return aKey.localeCompare(bKey);
        }),
    );
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!user.id) return;

    try {
      await appointmentsApi.delete(user.id, id);
    } finally {
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    }
  };

  // ==========================
  // CALENDAR DOTS + FILTERED (by selected date)
  // ==========================
  const selectedYmd = useMemo(() => {
    return toYmd(new Date(year, monthIndex, selectedDate));
  }, [year, monthIndex, selectedDate]);

  const appointmentDays = useMemo(() => {
    const set = new Set<number>();

    for (const a of appointments) {
      const d = new Date(`${a.appointmentDate}T00:00:00`);
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        set.add(d.getDate());
      }
    }

    return set;
  }, [appointments, year, monthIndex]);

  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((a) => a.appointmentDate === selectedYmd)
      .slice()
      .sort((a, b) =>
        normalizeTime(a.appointmentTime).localeCompare(
          normalizeTime(b.appointmentTime),
        ),
      );
  }, [appointments, selectedYmd]);

  return (
    <>
      <AddAppointmentModal
        visible={apptModalOpen}
        userId={user.id}
        mode={editingAppt ? "update" : "add"}
        initialData={editingAppt ?? undefined}
        onClose={() => {
          setApptModalOpen(false);
          setEditingAppt(null);
        }}
        onSubmit={editingAppt ? handleUpdateAppointment : handleAddAppointment}
      />

      <FullscreenLoader
        visible={refetchingAppts}
        text="Refreshing appointments..."
        colors={colors}
        fontScale={fontScale}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
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
              APPOINTMENTS
            </ThemedText>

            <ThemedText
              style={{
                marginTop: 4,
                fontSize: 13 * fontScale,
                color: colors.icon,
                letterSpacing: 0.5,
              }}
            >
              Manage and track your medical visits
            </ThemedText>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              style={[
                styles.addButton,
                {
                  borderColor: colors.tint,
                  opacity: refetchingAppts ? 0.6 : 1,
                },
              ]}
              onPress={refetchAppts}
              disabled={refetchingAppts}
            >
              <Ionicons name="refresh" size={18} color={colors.tint} />
            </Pressable>

            <Pressable
              style={[styles.addButton, { borderColor: colors.tint }]}
              onPress={() => {
                setEditingAppt(null);
                setApptModalOpen(true);
              }}
            >
              <Ionicons name="add" size={18} color={colors.tint} />
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.calendarCard,
            { borderColor: colors.tint, backgroundColor: colors.card },
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

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <ThemedText style={[styles.thEdit, { color: colors.icon }]} />
                <ThemedText style={[styles.thDel, { color: colors.icon }]} />
                <ThemedText style={[styles.thTime, { color: colors.icon }]}>
                  TIME
                </ThemedText>
                <ThemedText style={[styles.thTitle, { color: colors.icon }]}>
                  APPOINTMENT
                </ThemedText>
                <ThemedText style={[styles.thNotes, { color: colors.icon }]}>
                  NOTES
                </ThemedText>
              </View>

              {filteredAppointments.length === 0 ? (
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
                    NO APPOINTMENTS
                  </ThemedText>
                </View>
              ) : (
                filteredAppointments.map((a) => (
                  <View
                    key={a.id}
                    style={[styles.tableRow, { borderColor: colors.border }]}
                  >
                    <Pressable
                      style={styles.tdEdit}
                      onPress={() => {
                        setEditingAppt(a);
                        setApptModalOpen(true);
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
                      onPress={() => handleDeleteAppointment(a.id)}
                      hitSlop={10}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={colors.error}
                      />
                    </Pressable>

                    <ThemedText style={[styles.tdTime, { color: colors.text }]}>
                      {formatTime12h(a.appointmentTime)}
                    </ThemedText>

                    <ThemedText
                      style={[styles.tdTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {a.title}
                    </ThemedText>

                    <ThemedText
                      style={[styles.tdNotes, { color: colors.icon }]}
                    >
                      {a.notes || "—"}
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

  card: {
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
    width: 600,
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

  thEdit: { width: 50, fontWeight: "700" },
  thDel: { width: 50, fontWeight: "700" },
  thTime: { width: 120, fontWeight: "700" },
  thTitle: { width: 220, fontWeight: "700" },
  thNotes: { width: 250, fontWeight: "700" },

  tdEdit: { width: 50, alignItems: "center" },
  tdDel: { width: 50, alignItems: "center" },
  tdTime: { width: 120 },
  tdTitle: { width: 220 },
  tdNotes: { width: 250 },
});
