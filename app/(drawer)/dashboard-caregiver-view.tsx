// CaregiverDashboard.tsx
import AddAppointmentModal, {
  AppointmentPayload,
} from "@/components/AddAppointmentModal";
import AddMedicationModal, {
  MedicationPayload,
} from "@/components/AddMedicationModal";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
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
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  UIManager,
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
  return new Date(y, (m ?? 1) - 1, d ?? 1);
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

  if (type === "once") return dateIso === start;

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

  // support "custom" if present in your modal builds
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

export default function CaregiverDashboard() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];

  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const [refreshing, setRefreshing] = React.useState(false);

  // logged-in caregiver
  const [caregiver, setCaregiver] = React.useState<UserDetailsResponse>({
    id: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    role: "CAREGIVER" as any,
    inviteCode: "",
    connectedUsers: [],
  });

  // dropdown patients sourced from caregiver.connectedUsers
  const patients = React.useMemo(() => {
    const list = caregiver.connectedUsers ?? [];
    return list.filter(
      (u: any) => String(u?.role ?? "").toUpperCase() === "PATIENT",
    );
  }, [caregiver.connectedUsers]);

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null,
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // selected patient profile (details)
  const [patient, setPatient] = React.useState<UserDetailsResponse | null>(
    null,
  );

  // selected patient data
  const [appointments, setAppointments] = React.useState<AppointmentPayload[]>(
    [],
  );
  const [medications, setMedications] = React.useState<MedicationPayload[]>([]);

  // modals + edit state
  const [apptModalOpen, setApptModalOpen] = React.useState(false);
  const [editingAppt, setEditingAppt] =
    React.useState<AppointmentPayload | null>(null);

  const [medModalOpen, setMedModalOpen] = React.useState(false);
  const [editingMed, setEditingMed] = React.useState<MedicationPayload | null>(
    null,
  );

  // connect modal
  const [connectModalOpen, setConnectModalOpen] = React.useState(false);
  const [inviteCodeInput, setInviteCodeInput] = React.useState("");
  const [connectLoading, setConnectLoading] = React.useState(false);
  const [connectError, setConnectError] = React.useState<string>("");

  const toUiAppointment = (a: AppointmentResponse): AppointmentPayload => ({
    id: a.id,
    userId: a.userId,
    title: a.title,
    appointmentDate: a.appointmentDate,
    appointmentTime: a.appointmentTime,
    notes: a.notes ?? undefined,
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

  const toApiStatus = (s: MedicationPayload["status"]): MedicationStatus =>
    s === "completed" ? "COMPLETED" : "ONGOING";

  const toUpsertRequest = (
    patientId: string,
    m: MedicationPayload,
  ): MedicationUpsertRequest => ({
    userId: patientId,
    name: m.name,
    dose: m.dose,
    startDate: m.startDate,
    repeat: {
      type: m.repeat.type,
      interval: m.repeat.interval,
      unit: (m.repeat as any).unit,
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

  const selectedPatientSummary = useMemo(() => {
    return patients.find(
      (p: any) => String(p?.id) === String(selectedPatientId),
    );
  }, [patients, selectedPatientId]);

  const selectedPatientName =
    patient?.firstName && patient?.lastName
      ? `${patient.firstName} ${patient.middleName || ""} ${patient.lastName}`
          .replace(/\s+/g, " ")
          .trim()
      : selectedPatientSummary?.firstName && selectedPatientSummary?.lastName
        ? `${selectedPatientSummary.firstName} ${
            selectedPatientSummary.middleName || ""
          } ${selectedPatientSummary.lastName}`
            .replace(/\s+/g, " ")
            .trim()
        : "Select patient";

  const hasPatients = patients.length > 0;

  const fetchCaregiver = React.useCallback(async () => {
    const userId = await AsyncStorage.getItem("userId");
    if (!userId) return;

    const details = await authApi.getUserById(userId);
    setCaregiver(details);

    const patientList = (details.connectedUsers ?? []).filter(
      (u: any) => String(u?.role ?? "").toUpperCase() === "PATIENT",
    );

    setSelectedPatientId((prev) => {
      if (prev && patientList.some((p: any) => String(p.id) === String(prev)))
        return prev;
      return patientList[0]?.id ? String(patientList[0].id) : null;
    });
  }, []);

  const fetchSelectedPatientData = React.useCallback(async () => {
    if (!selectedPatientId) {
      setPatient(null);
      setAppointments([]);
      setMedications([]);
      return;
    }

    const [p, apptList, medList] = await Promise.all([
      authApi.getUserById(selectedPatientId),
      appointmentsApi.list(selectedPatientId),
      medicationsApi.listByUser(selectedPatientId),
    ]);

    setPatient(p);

    const apptUi = apptList
      .map(toUiAppointment)
      .sort((a, b) =>
        `${a.appointmentDate} ${normalizeTime(a.appointmentTime)}`.localeCompare(
          `${b.appointmentDate} ${normalizeTime(b.appointmentTime)}`,
        ),
      );
    setAppointments(apptUi);

    const medUi = medList
      .map(toUiMedication)
      .sort((a, b) =>
        normalizeTime(a.schedule.time).localeCompare(
          normalizeTime(b.schedule.time),
        ),
      );
    setMedications(medUi);
  }, [selectedPatientId]);

  React.useEffect(() => {
    const init = async () => {
      try {
        await fetchCaregiver();
      } catch {}
    };
    init();
  }, [fetchCaregiver]);

  React.useEffect(() => {
    const run = async () => {
      try {
        await fetchSelectedPatientData();
      } catch {}
    };
    run();
  }, [fetchSelectedPatientData]);

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

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCaregiver();
      await fetchSelectedPatientData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchCaregiver, fetchSelectedPatientData]);

  const handleAddAppointment = async (payload: AppointmentPayload) => {
    if (!selectedPatientId) return;

    const created = await appointmentsApi.create({
      userId: selectedPatientId,
      title: payload.title,
      appointmentDate: payload.appointmentDate,
      appointmentTime: payload.appointmentTime,
      notes: payload.notes ?? null,
    });

    const createdUi = toUiAppointment(created);

    setAppointments((prev) =>
      [createdUi, ...prev].sort((a, b) =>
        `${a.appointmentDate} ${normalizeTime(a.appointmentTime)}`.localeCompare(
          `${b.appointmentDate} ${normalizeTime(b.appointmentTime)}`,
        ),
      ),
    );
  };

  const handleUpdateAppointment = async (payload: AppointmentPayload) => {
    if (!selectedPatientId) return;

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
        .sort((a, b) =>
          `${a.appointmentDate} ${normalizeTime(
            a.appointmentTime,
          )}`.localeCompare(
            `${b.appointmentDate} ${normalizeTime(b.appointmentTime)}`,
          ),
        ),
    );
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!selectedPatientId) return;

    try {
      await appointmentsApi.delete(selectedPatientId, id);
    } finally {
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleAddMedication = async (payload: MedicationPayload) => {
    if (!selectedPatientId) return;

    const created = await medicationsApi.create(
      toUpsertRequest(selectedPatientId, payload),
    );
    const createdUi = toUiMedication(created);

    setMedications((prev) =>
      [createdUi, ...prev].sort((a, b) =>
        normalizeTime(a.schedule.time).localeCompare(
          normalizeTime(b.schedule.time),
        ),
      ),
    );
  };

  const handleUpdateMedication = async (payload: MedicationPayload) => {
    if (!selectedPatientId) return;

    const updated = await medicationsApi.update(
      payload.id,
      toUpsertRequest(selectedPatientId, payload),
    );
    const updatedUi = toUiMedication(updated);

    setMedications((prev) =>
      prev
        .map((m) => (m.id === updatedUi.id ? updatedUi : m))
        .sort((a, b) =>
          normalizeTime(a.schedule.time).localeCompare(
            normalizeTime(b.schedule.time),
          ),
        ),
    );
  };

  const handleDeleteMedication = async (id: string) => {
    if (!selectedPatientId) return;

    try {
      await medicationsApi.delete(selectedPatientId, id);
    } finally {
      setMedications((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const handleConnect = async () => {
    const code = inviteCodeInput.trim().toUpperCase();
    if (!code) {
      setConnectError("Invite code is required.");
      return;
    }

    setConnectError("");
    setConnectLoading(true);
    try {
      const caregiverId = await AsyncStorage.getItem("userId");
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

      // pull updated connections
      await fetchCaregiver();
      await fetchSelectedPatientData();
    } catch (e: any) {
      const msg =
        e?.message ||
        e?.error ||
        "Unable to connect. Check invite code and try again.";
      setConnectError(String(msg));
    } finally {
      setConnectLoading(false);
    }
  };

  return (
    <>
      <AddMedicationModal
        visible={medModalOpen}
        userId={selectedPatientId ?? ""}
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
        userId={selectedPatientId ?? ""}
        mode={editingAppt ? "update" : "add"}
        initialData={editingAppt ?? undefined}
        onClose={() => {
          setApptModalOpen(false);
          setEditingAppt(null);
        }}
        onSubmit={editingAppt ? handleUpdateAppointment : handleAddAppointment}
      />

      {/* CONNECT MODAL */}
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
                  onChangeText={(t) => setInviteCodeInput(t)}
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
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tint}
          />
        }
      >
        {/* HEADER */}
        <ThemedText
          style={{
            fontSize: 22 * fontScale,
            fontWeight: "700",
            color: colors.text,
          }}
        >
          Caregiver Panel
        </ThemedText>

        <ThemedText
          style={{
            marginTop: 4,
            fontSize: 13 * fontScale,
            color: colors.icon,
          }}
        >
          Monitoring {patients.length} active patient profiles.
        </ThemedText>

        {/* CONNECT BUTTON — ALWAYS VISIBLE */}
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
            }}
          >
            Connect to Patient
          </ThemedText>
        </Pressable>

        {/* ================= EMPTY STATE ================= */}
        {!hasPatients && (
          <View
            style={[
              styles.emptyStateBox,
              {
                borderColor: colors.tint,
                backgroundColor: colors.card,
              },
            ]}
          >
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: colors.inputBackground },
              ]}
            >
              <Ionicons name="heart-outline" size={40} color={colors.tint} />
            </View>

            <ThemedText
              style={{
                marginTop: 16,
                fontWeight: "700",
                fontSize: 16 * fontScale,
                color: colors.text,
              }}
            >
              No Patients Connected
            </ThemedText>

            <ThemedText
              style={{
                marginTop: 6,
                fontSize: 13 * fontScale,
                color: colors.icon,
                textAlign: "center",
                paddingHorizontal: 20,
              }}
            >
              You haven't connected to any patients yet. Use the button above to
              link an account via Invite Code.
            </ThemedText>
          </View>
        )}

        {/* ================= DASHBOARD CONTENT ================= */}
        {hasPatients && (
          <View
            style={[
              styles.cardContainer,
              {
                borderColor: colors.tint,
                backgroundColor: colors.card,
              },
            ]}
          >
            {/* DROPDOWN */}
            <View
              style={[
                styles.dropdownWrapper,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Pressable
                style={[
                  styles.dropdownButton,
                  { backgroundColor: colors.tint },
                ]}
                onPress={() => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                  setDropdownOpen(!dropdownOpen);
                }}
              >
                <ThemedText
                  style={{
                    color: colors.buttonText,
                    fontWeight: "600",
                  }}
                >
                  {selectedPatientName}
                </ThemedText>

                <Ionicons
                  name={dropdownOpen ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.buttonText}
                />
              </Pressable>

              {dropdownOpen &&
                patients.map((p: any) => {
                  const label =
                    p?.firstName && p?.lastName
                      ? `${p.firstName} ${p.middleName || ""} ${p.lastName}`
                          .replace(/\s+/g, " ")
                          .trim()
                      : (p?.name ?? "Patient");
                  return (
                    <Pressable
                      key={String(p.id)}
                      style={[
                        styles.dropdownItem,
                        { borderTopColor: colors.border },
                      ]}
                      onPress={() => {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.easeInEaseOut,
                        );
                        setSelectedPatientId(String(p.id));
                        setDropdownOpen(false);
                      }}
                    >
                      <ThemedText style={{ color: colors.text }}>
                        {label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
            </View>

            {/* ================= MEDICATION SECTION ================= */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText
                  style={{
                    fontWeight: "700",
                    fontSize: 18 * fontScale,
                    color: colors.text,
                  }}
                >
                  Medications
                </ThemedText>

                <Pressable
                  style={[
                    styles.primaryButton,
                    { backgroundColor: colors.tint },
                  ]}
                  onPress={() => {
                    setEditingMed(null);
                    setMedModalOpen(true);
                  }}
                >
                  <Ionicons name="add" size={16} color={colors.buttonText} />
                  <ThemedText
                    style={{
                      color: colors.buttonText,
                      fontSize: 13 * fontScale,
                      fontWeight: "600",
                    }}
                  >
                    Add Medication
                  </ThemedText>
                </Pressable>
              </View>

              {todaysMedications.length ? (
                todaysMedications.map((med) => (
                  <View
                    key={med.id}
                    style={[
                      styles.dataCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
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
                            }}
                          >
                            {med.name}
                          </ThemedText>
                          <ThemedText
                            style={{
                              color: colors.icon,
                              fontSize: 13 * fontScale,
                            }}
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
                          style={{
                            color: colors.text,
                            fontSize: 12 * fontScale,
                          }}
                        >
                          {formatTime12h(med.schedule.time)}
                        </ThemedText>
                      </View>
                    </View>

                    <ThemedText style={{ color: colors.icon, marginTop: 8 }}>
                      {med.notes || "—"}
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
                  <ThemedText style={{ color: colors.icon }}>
                    No medications scheduled today.
                  </ThemedText>
                </View>
              )}
            </View>

            {/* ================= APPOINTMENTS ================= */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText
                  style={{
                    fontWeight: "700",
                    fontSize: 18 * fontScale,
                    color: colors.text,
                  }}
                >
                  Appointments
                </ThemedText>

                <Pressable
                  style={[
                    styles.primaryButton,
                    { backgroundColor: colors.tint },
                  ]}
                  onPress={() => {
                    setEditingAppt(null);
                    setApptModalOpen(true);
                  }}
                >
                  <Ionicons name="add" size={16} color={colors.buttonText} />
                  <ThemedText
                    style={{
                      color: colors.buttonText,
                      fontSize: 13 * fontScale,
                      fontWeight: "600",
                    }}
                  >
                    Add Appointment
                  </ThemedText>
                </Pressable>
              </View>

              {todaysAppointments.length ? (
                todaysAppointments.map((app) => (
                  <View
                    key={app.id}
                    style={[
                      styles.dataCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
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
                        <ThemedText
                          style={{
                            color: colors.text,
                            fontSize: 12 * fontScale,
                          }}
                        >
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
                    No upcoming appointments today.
                  </ThemedText>
                </View>
              )}
            </View>

            {/* INVITE CODE */}
            <View style={[styles.inviteBox, { borderColor: colors.border }]}>
              <ThemedText
                style={{
                  fontWeight: "600",
                  color: colors.text,
                }}
              >
                Invite Code
              </ThemedText>
              <ThemedText style={{ color: colors.tint }}>
                {patient?.inviteCode || "—"}
              </ThemedText>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginTop: 20,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
  },
  connectButton: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },

  emptyStateBox: {
    marginTop: 24,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 32,
    alignItems: "center",
  },

  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
  },

  dropdownWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
  },

  dropdownButton: {
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  dropdownItem: {
    padding: 12,
    borderTopWidth: 1,
  },

  section: { marginBottom: 28 },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
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

  emptyCard: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
  },

  inviteBox: {
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderRadius: 12,
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
