import AddAppointmentModal, {
  AppointmentPayload,
} from "@/components/AddAppointmentModal";
import AddMedicationModal, {
  MedicationPayload,
} from "@/components/AddMedicationModal";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { rescheduleAllFromCache } from "@/services/alarmScheduler";
import {
  AppointmentResponse,
  appointmentsApi,
} from "@/services/appointmentsApi";
import { authApi, UserDetailsResponse } from "@/services/authApi";
import {
  MedicationResponse,
  medicationsApi,
  MedicationStatus,
  MedicationUpsertRequest,
} from "@/services/medicationsApi";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

const pad2 = (n: number) => String(n).padStart(2, "0");

const normalizeTime = (t?: string) => {
  if (!t) return "00:00";
  const [h = "0", m = "0"] = t.split(":");
  return `${pad2(Number(h))}:${pad2(Number(m))}`;
};

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

const toISODateLocal = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const parseISODateLocal = (iso: string) => {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  return new Date(y, (m ?? 1) - 1, d ?? 1); // local midnight
};

const daysBetweenLocal = (fromIso: string, toIso: string) => {
  const a = parseISODateLocal(fromIso);
  const b = parseISODateLocal(toIso);
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86400000);
};

const monthsBetweenLocal = (fromIso: string, toIso: string) => {
  const a = parseISODateLocal(fromIso);
  const b = parseISODateLocal(toIso);
  return (
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  );
};

const toDowCode = (d: Date) =>
  ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()];

const isWithinRange = (dateIso: string, startIso: string, endIso?: string) => {
  if (dateIso < startIso) return false;
  if (endIso && dateIso > endIso) return false;
  return true;
};

const isMedicationDueOn = (m: MedicationPayload, dateIso: string) => {
  const start = m.startDate;
  const end = m.repeat.endDate;

  if (!start) return false;
  if (!isWithinRange(dateIso, start, end)) return false;

  const type = m.repeat.type;
  const interval = Math.max(1, Number(m.repeat.interval || 1));

  if (type === "once") {
    return dateIso === start;
  }

  if (type === "daily") {
    const diff = daysBetweenLocal(start, dateIso);
    return diff >= 0 && diff % interval === 0;
  }

  if (type === "weekly") {
    const dow = toDowCode(parseISODateLocal(dateIso));
    const daysOfWeek = m.repeat.daysOfWeek ?? [];
    if (!daysOfWeek.includes(dow)) return false;

    const diffDays = daysBetweenLocal(start, dateIso);
    if (diffDays < 0) return false;

    const diffWeeks = Math.floor(diffDays / 7);
    return diffWeeks % interval === 0;
  }

  if (type === "monthly") {
    const startD = parseISODateLocal(start).getDate();
    const curD = parseISODateLocal(dateIso).getDate();
    if (startD !== curD) return false;

    const diffMonths = monthsBetweenLocal(start, dateIso);
    return diffMonths >= 0 && diffMonths % interval === 0;
  }

  // if your modal supports "custom" (day/week/month) in some builds:
  // treat it as interval+unit. If unit missing, default to day.
  if ((type as any) === "custom") {
    const unit = (m.repeat as any).unit ?? "day";
    if (unit === "day") {
      const diff = daysBetweenLocal(start, dateIso);
      return diff >= 0 && diff % interval === 0;
    }
    if (unit === "week") {
      const diffDays = daysBetweenLocal(start, dateIso);
      if (diffDays < 0) return false;
      const diffWeeks = Math.floor(diffDays / 7);
      return diffWeeks % interval === 0;
    }
    if (unit === "month") {
      const startD = parseISODateLocal(start).getDate();
      const curD = parseISODateLocal(dateIso).getDate();
      if (startD !== curD) return false;
      const diffMonths = monthsBetweenLocal(start, dateIso);
      return diffMonths >= 0 && diffMonths % interval === 0;
    }
  }

  return false;
};

export default function PatientDashboard() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];
  const [refreshing, setRefreshing] = React.useState(false);

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

  const fullName = `${user.firstName} ${user.middleName || ""} ${user.lastName}`;
  const caregivers = user.connectedUsers ?? [];

  // ==========================
  // APPOINTMENTS (API integrated)
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

  const apptsKey = React.useMemo(() => {
    const uid = user.id || "unknown";
    return `appointments:${uid}`;
  }, [user.id]);

  // ==========================
  // MEDICATIONS (keep your existing code below)
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

  // ==========================
  // USER LOAD (existing)
  // ==========================
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
  // LOAD APPOINTMENTS (cache + API)
  // ==========================
  React.useEffect(() => {
    let mounted = true;

    const loadAppts = async () => {
      if (!user.id) return;

      // 1) cached
      try {
        const cached = await AsyncStorage.getItem(apptsKey);
        if (mounted && cached) setAppointments(JSON.parse(cached));
      } catch {}

      // 2) API
      try {
        const list = await appointmentsApi.list(user.id);
        const ui = list.map(toUiAppointment).sort((a, b) => {
          const aKey = `${a.appointmentDate} ${a.appointmentTime}`;
          const bKey = `${b.appointmentDate} ${b.appointmentTime}`;
          return aKey.localeCompare(bKey);
        });

        if (!mounted) return;
        setAppointments(ui);
        await AsyncStorage.setItem(apptsKey, JSON.stringify(ui));
      } catch {
        // keep cached
      }
    };

    loadAppts();
    return () => {
      mounted = false;
    };
  }, [user.id, apptsKey]);

  const todayIso = React.useMemo(() => toISODateLocal(new Date()), []);

  const todaysMedications = React.useMemo(() => {
    return medications
      .filter((m) => isMedicationDueOn(m, todayIso))
      .sort((a, b) =>
        normalizeTime(a.schedule.time).localeCompare(
          normalizeTime(b.schedule.time),
        ),
      );
  }, [medications, todayIso]);

  const todaysAppointments = React.useMemo(() => {
    return appointments
      .filter((a) => a.appointmentDate === todayIso)
      .sort((a, b) =>
        normalizeTime(a.appointmentTime).localeCompare(
          normalizeTime(b.appointmentTime),
        ),
      );
  }, [appointments, todayIso]);

  const persistAppts = async (items: AppointmentPayload[]) => {
    if (!user.id) return;
    await AsyncStorage.setItem(apptsKey, JSON.stringify(items));
  };

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

    const next = [createdUi, ...appointments].sort((a, b) => {
      const aKey = `${a.appointmentDate} ${a.appointmentTime}`;
      const bKey = `${b.appointmentDate} ${b.appointmentTime}`;
      return aKey.localeCompare(bKey);
    });

    setAppointments(next);
    await persistAppts(next);
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

    const next = appointments
      .map((a) => (a.id === updatedUi.id ? updatedUi : a))
      .sort((a, b) => {
        const aKey = `${a.appointmentDate} ${a.appointmentTime}`;
        const bKey = `${b.appointmentDate} ${b.appointmentTime}`;
        return aKey.localeCompare(bKey);
      });

    setAppointments(next);
    await persistAppts(next);
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      await appointmentsApi.delete(user.id, id);
    } finally {
      const next = appointments.filter((a) => a.id !== id);
      setAppointments(next);
      await persistAppts(next);
    }
  };

  const onRefresh = React.useCallback(async () => {
    if (!user.id) return;

    setRefreshing(true);
    try {
      // refresh user details (same logic as your USER LOAD effect)
      const userId = await AsyncStorage.getItem("userId");
      if (userId) {
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

        setUser(details);
      }

      // refresh appointments (API)
      const apptList = await appointmentsApi.list(user.id);
      const apptUi = apptList.map(toUiAppointment).sort((a, b) => {
        const aKey = `${a.appointmentDate} ${normalizeTime(a.appointmentTime)}`;
        const bKey = `${b.appointmentDate} ${normalizeTime(b.appointmentTime)}`;
        return aKey.localeCompare(bKey);
      });
      setAppointments(apptUi);

      const medList = await medicationsApi.listByUser(user.id);
      const medUi = medList
        .map(toUiMedication)
        .sort((a, b) =>
          normalizeTime(a.schedule.time).localeCompare(
            normalizeTime(b.schedule.time),
          ),
        );
      setMedications(medUi);
    } finally {
      setRefreshing(false);
    }
  }, [user.id]);

  React.useEffect(() => {
    if (!user.id) return;
    rescheduleAllFromCache({ medications, appointments, horizonDays: 14 });
  }, [user.id, medications, appointments]);

  React.useEffect(() => {
    let mounted = true;

    const loadMeds = async () => {
      if (!user.id) return;

      try {
        const cached = await AsyncStorage.getItem(medsKey);
        if (mounted && cached) setMedications(JSON.parse(cached));
      } catch {}

      try {
        const list = await medicationsApi.listByUser(user.id);
        const ui = list
          .map(toUiMedication)
          .sort((a, b) => a.schedule.time.localeCompare(b.schedule.time));

        if (!mounted) return;
        setMedications(ui);
        await AsyncStorage.setItem(medsKey, JSON.stringify(ui));
      } catch {}
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
      await medicationsApi.delete(user.id, id);
    } finally {
      const next = medications.filter((m) => m.id !== id);
      setMedications(next);
      await persistMeds(next);
    }
  };

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

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tint}
          />
        }
      >
        <View style={styles.header}>
          <ThemedText
            style={[
              styles.greeting,
              {
                color: colors.text,
                fontSize: 22 * fontScale,
                textTransform: "capitalize",
              },
            ]}
          >
            Greetings, {fullName}
          </ThemedText>
          <ThemedText
            style={[
              styles.subGreeting,
              { color: colors.icon, fontSize: 14 * fontScale },
            ]}
          >
            Welcome back. Here is your overview for today.
          </ThemedText>
        </View>

        <View
          style={[
            styles.systemCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color={colors.tint}
          />
          <View style={styles.systemText}>
            <ThemedText
              style={[
                styles.systemTitle,
                { color: colors.tint, fontSize: 12 * fontScale },
              ]}
            >
              SYSTEM HEALTH
            </ThemedText>
            <ThemedText
              style={[
                styles.systemSub,
                { color: colors.icon, fontSize: 13 * fontScale },
              ]}
            >
              Audio & Visual Alerts Active
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText
              style={[
                styles.sectionTitle,
                { color: colors.text, fontSize: 18 * fontScale },
              ]}
            >
              Medications
            </ThemedText>

            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.tint }]}
              onPress={() => {
                setEditingMed(null);
                setMedModalOpen(true);
              }}
            >
              <Ionicons name="add" size={16} color={colors.buttonText} />
              <ThemedText
                style={[
                  styles.buttonText,
                  { color: colors.buttonText, fontSize: 13 * fontScale },
                ]}
              >
                Add Medication
              </ThemedText>
            </Pressable>
          </View>

          {todaysMedications.length > 0 ? (
            todaysMedications.map((med) => (
              <View
                key={med.id}
                style={[
                  styles.dataCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name="medical-outline"
                      size={20}
                      color={colors.tint}
                    />
                    <View>
                      <ThemedText
                        style={{
                          color: colors.text,
                          fontWeight: "700",
                          fontSize: 16 * fontScale,
                          textTransform: "capitalize",
                          width: 150,
                        }}
                      >
                        {med.name.toLowerCase()}
                      </ThemedText>
                      <ThemedText
                        style={{ color: colors.icon, fontSize: 13 * fontScale }}
                      >
                        {med.dose}
                      </ThemedText>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.timeBadge,
                      { backgroundColor: colors.inputBackground },
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={colors.icon}
                    />
                    <ThemedText
                      style={{ color: colors.text, fontSize: 12 * fontScale }}
                    >
                      {formatTime12h(med.schedule.time)}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText style={{ color: colors.icon, marginTop: 8 }}>
                  {med.notes || "—"}
                </ThemedText>

                <ThemedText style={{ color: colors.icon, marginTop: 4 }}>
                  Reminder offset: {med.schedule.reminderOffsetMinutes} min
                </ThemedText>

                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => {
                      setEditingMed(med);
                      setMedModalOpen(true);
                    }}
                    hitSlop={10}
                  >
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={colors.icon}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => handleDeleteMedication(med.id)}
                    hitSlop={10}
                  >
                    <Ionicons name="trash-outline" size={18} color="red" />
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <View
              style={[
                styles.emptyCard,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.inputBackground,
                },
              ]}
            >
              <ThemedText style={{ color: colors.text }}>
                No medications scheduled yet.
              </ThemedText>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText
              style={[
                styles.sectionTitle,
                { color: colors.text, fontSize: 18 * fontScale },
              ]}
            >
              Appointments
            </ThemedText>

            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.tint }]}
              onPress={() => {
                setEditingAppt(null);
                setApptModalOpen(true);
              }}
            >
              <Ionicons name="add" size={16} color={colors.buttonText} />
              <ThemedText
                style={[
                  styles.buttonText,
                  { color: colors.buttonText, fontSize: 13 * fontScale },
                ]}
              >
                Add Appointment
              </ThemedText>
            </Pressable>
          </View>

          {todaysAppointments.length > 0 ? (
            todaysAppointments.map((app) => (
              <View
                key={app.id}
                style={[
                  styles.dataCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name="medkit-outline"
                      size={20}
                      color={colors.tint}
                    />
                    <ThemedText
                      style={{
                        color: colors.text,
                        fontWeight: "700",
                        fontSize: 16 * fontScale,
                        textTransform: "capitalize",
                      }}
                    >
                      {app.title}
                    </ThemedText>
                  </View>

                  <View
                    style={[
                      styles.timeBadge,
                      { backgroundColor: colors.inputBackground },
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={colors.icon}
                    />
                    <ThemedText style={{ color: colors.text }}>
                      {formatTime12h(app.appointmentTime)}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText style={{ color: colors.icon, marginTop: 8 }}>
                  {app.appointmentDate}
                </ThemedText>

                <ThemedText style={{ color: colors.icon, marginTop: 4 }}>
                  {app.notes || "—"}
                </ThemedText>

                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => {
                      setEditingAppt(app);
                      setApptModalOpen(true);
                    }}
                    hitSlop={10}
                  >
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={colors.icon}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => handleDeleteAppointment(app.id)}
                    hitSlop={10}
                  >
                    <Ionicons name="trash-outline" size={18} color="red" />
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <View
              style={[
                styles.emptyCard,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.inputBackground,
                },
              ]}
            >
              <ThemedText style={{ color: colors.icon }}>
                No upcoming appointments.
              </ThemedText>
            </View>
          )}
        </View>

        <View
          style={[
            styles.inviteCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <ThemedText
            style={[
              styles.sectionTitle,
              { color: colors.text, fontSize: 18 * fontScale },
            ]}
          >
            My Invite Code
          </ThemedText>
          <ThemedText
            style={[
              styles.inviteSub,
              { color: colors.icon, fontSize: 13 * fontScale },
            ]}
          >
            Share this with your caregiver to connect accounts.
          </ThemedText>

          <View
            style={[
              styles.codeBox,
              {
                borderColor: colors.border,
                backgroundColor: colors.inputBackground,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.codeText,
                { color: colors.tint, fontSize: 18 * fontScale },
              ]}
            >
              {user.inviteCode || "—"}
            </ThemedText>
            <Ionicons name="copy-outline" size={18} color={colors.icon} />
          </View>
        </View>

        <View
          style={[
            styles.inviteCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <ThemedText
            style={[
              styles.sectionTitle,
              { color: colors.text, fontSize: 18 * fontScale },
            ]}
          >
            Connected Caregivers
          </ThemedText>
          <ThemedText
            style={[
              styles.inviteSub,
              { color: colors.icon, fontSize: 13 * fontScale },
            ]}
          >
            People who can view your medical data.
          </ThemedText>

          {caregivers.length > 0 ? (
            caregivers.map((cg: any, idx: number) => (
              <View
                key={cg?.id ?? String(idx)}
                style={[
                  styles.dataCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <ThemedText
                  style={{
                    color: colors.text,
                    fontWeight: "700",
                    fontSize: 15 * fontScale,
                    textTransform: "capitalize",
                  }}
                >
                  {cg?.firstName && cg?.lastName
                    ? `${cg.firstName} ${cg.lastName}`
                    : (cg?.name ?? "Connected User")}
                </ThemedText>
                <ThemedText style={{ color: colors.icon }}>
                  {cg?.email ?? "No email provided"}
                </ThemedText>
              </View>
            ))
          ) : (
            <View
              style={[
                styles.emptyCard,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.inputBackground,
                },
              ]}
            >
              <ThemedText style={{ color: colors.icon }}>
                No active connections.
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },

  greeting: { fontWeight: "700" },
  subGreeting: { marginTop: 4 },

  systemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
  },

  systemText: { flex: 1 },

  systemTitle: {
    fontWeight: "700",
    letterSpacing: 1,
  },

  systemSub: { marginTop: 2 },

  section: { marginBottom: 28 },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  sectionTitle: { fontWeight: "700" },

  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },

  buttonText: { fontWeight: "600" },

  emptyCard: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
  },

  inviteCard: {
    padding: 18,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
  },

  inviteSub: {
    marginTop: 4,
    marginBottom: 14,
  },

  codeBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  codeText: {
    fontWeight: "700",
    letterSpacing: 2,
  },

  dataCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },

  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },

  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    marginTop: 12,
  },
});
