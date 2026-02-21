import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    LayoutAnimation,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    UIManager,
    View,
} from "react-native";

type Medication = {
  id: string;
  name: string;
  dosage?: string;
  reason?: string;
  time: string;
};

type Appointment = {
  id: string;
  title: string;
  date: string;
  time?: string;
  notes?: string;
};

type Patient = {
  id: string;
  name: string;
  inviteCode: string;
  medications: Medication[];
  appointments: Appointment[];
};

/* ===== TO TEST EMPTY STATE CHANGE THIS TO [] ===== */
const MOCK_PATIENTS: Patient[] = [
  {
    id: "1",
    name: "Juan Dela Cruz",
    inviteCode: "NTM-4821",
    medications: [
      {
        id: "m1",
        name: "Paracetamol",
        dosage: "500mg",
        reason: "Pain relief",
        time: "08:00",
      },
    ],
    appointments: [
      {
        id: "a1",
        title: "Cardiology Checkup",
        date: "April 25, 2026",
        time: "10:30",
        notes: "Bring lab results",
      },
    ],
  },
];

export default function CaregiverDashboard() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];

  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const [patients] = useState<Patient[]>(MOCK_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState(
    patients[0]?.id ?? null,
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId],
  );

  const hasPatients = patients.length > 0;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
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
            link an account via Email or Invite Code.
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
              style={[styles.dropdownButton, { backgroundColor: colors.tint }]}
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
                {selectedPatient?.name}
              </ThemedText>

              <Ionicons
                name={dropdownOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.buttonText}
              />
            </Pressable>

            {dropdownOpen &&
              patients.map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    styles.dropdownItem,
                    { borderTopColor: colors.border },
                  ]}
                  onPress={() => {
                    LayoutAnimation.configureNext(
                      LayoutAnimation.Presets.easeInEaseOut,
                    );
                    setSelectedPatientId(p.id);
                    setDropdownOpen(false);
                  }}
                >
                  <ThemedText style={{ color: colors.text }}>
                    {p.name}
                  </ThemedText>
                </Pressable>
              ))}
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
                Medication Schedule
              </ThemedText>

              <Pressable
                style={[styles.primaryButton, { backgroundColor: colors.tint }]}
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

            {selectedPatient?.medications.length ? (
              selectedPatient.medications.map((med) => (
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
                        {med.dosage && (
                          <ThemedText
                            style={{
                              color: colors.icon,
                              fontSize: 13 * fontScale,
                            }}
                          >
                            {med.dosage}
                          </ThemedText>
                        )}
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
                        {med.time}
                      </ThemedText>
                    </View>
                  </View>

                  {med.reason && (
                    <ThemedText style={{ color: colors.icon, marginTop: 8 }}>
                      {med.reason}
                    </ThemedText>
                  )}

                  <View style={styles.cardActions}>
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={colors.icon}
                    />
                    <Ionicons name="trash-outline" size={18} color="red" />
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
                  No medications scheduled yet.
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
                style={[styles.primaryButton, { backgroundColor: colors.tint }]}
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

            {selectedPatient?.appointments.length ? (
              selectedPatient.appointments.map((app) => (
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

                    {app.time && (
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
                          {app.time}
                        </ThemedText>
                      </View>
                    )}
                  </View>

                  <ThemedText style={{ color: colors.icon, marginTop: 8 }}>
                    {app.date}
                  </ThemedText>

                  {app.notes && (
                    <ThemedText style={{ color: colors.icon, marginTop: 4 }}>
                      {app.notes}
                    </ThemedText>
                  )}

                  <View style={styles.cardActions}>
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={colors.icon}
                    />
                    <Ionicons name="trash-outline" size={18} color="red" />
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
              {selectedPatient?.inviteCode}
            </ThemedText>
          </View>
        </View>
      )}
    </ScrollView>
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
});
