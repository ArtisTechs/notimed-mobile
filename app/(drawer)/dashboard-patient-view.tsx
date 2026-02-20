import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

// MOCK DATA (later replace with API or state)
const patient = {
  firstName: "Yette",
  lastName: "Garcia",
  inviteCode: "87NQ1D",
};

const medications = [
  {
    id: "med-1",
    name: "Biogesic",
    dosage: "10mg",
    reason: "for high blood",
    time: "13:33",
    reminderSound: "Default",
  },
  {
    id: "med-2",
    name: "Amoxicillin",
    dosage: "500mg",
    reason: "bacterial infection",
    time: "08:00",
    reminderSound: "Chime",
  },
  {
    id: "med-3",
    name: "Losartan",
    dosage: "50mg",
    reason: "blood pressure control",
    time: "20:00",
    reminderSound: "Alert",
  },
];

const appointments = [
  {
    id: "app-1",
    title: "CT Scan",
    date: "Fri Feb 20 2026",
    time: "10:30",
    notes: "Bring previous lab results.",
  },
  {
    id: "app-2",
    title: "Cardiology Checkup",
    date: "Mon Mar 02 2026",
    time: "14:00",
    notes: "Routine heart monitoring.",
  },
  {
    id: "app-3",
    title: "Dental Cleaning",
    date: "Wed Mar 18 2026",
    time: "09:15",
    notes: "Annual oral prophylaxis.",
  },
];

const caregivers = [
  {
    id: "cg-1",
    name: "Maria Santos",
    relationship: "Daughter",
  },
  {
    id: "cg-2",
    name: "Juan Dela Cruz",
    relationship: "Son",
  },
  {
    id: "cg-3",
    name: "Ana Reyes",
    relationship: "Nurse",
  },
];

export default function PatientDashboard() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];
  const fullName = `${patient.firstName} ${patient.lastName}`;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <ThemedText
          style={[
            styles.greeting,
            { color: colors.text, fontSize: 22 * fontScale },
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
            Medication Schedule
          </ThemedText>

          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.tint }]}
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

        {medications.length > 0 ? (
          medications.map((med) => (
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
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
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
                      {med.name.toLowerCase()}
                    </ThemedText>
                    <ThemedText
                      style={{
                        color: colors.icon,
                        fontSize: 13 * fontScale,
                      }}
                    >
                      {med.dosage}
                    </ThemedText>
                  </View>
                </View>

                <View
                  style={[
                    styles.timeBadge,
                    { backgroundColor: colors.inputBackground },
                  ]}
                >
                  <Ionicons name="time-outline" size={14} color={colors.icon} />
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

              <ThemedText style={{ color: colors.icon, marginTop: 8 }}>
                {med.reason}
              </ThemedText>

              <ThemedText style={{ color: colors.icon, marginTop: 4 }}>
                Reminder on time with '{med.reminderSound}' sound.
              </ThemedText>

              <View style={styles.cardActions}>
                <Ionicons name="create-outline" size={18} color={colors.icon} />
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

        {appointments.length > 0 ? (
          appointments.map((app) => (
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
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
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

                <View style={styles.timeBadge}>
                  <Ionicons name="time-outline" size={14} color={colors.icon} />
                  <ThemedText style={{ color: colors.text }}>
                    {app.time}
                  </ThemedText>
                </View>
              </View>

              <ThemedText style={{ color: colors.icon, marginTop: 8 }}>
                {app.date}
              </ThemedText>

              <ThemedText style={{ color: colors.icon, marginTop: 4 }}>
                {app.notes}
              </ThemedText>

              <View style={styles.cardActions}>
                <Ionicons name="create-outline" size={18} color={colors.icon} />
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
            {patient.inviteCode}
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
          caregivers.map((cg) => (
            <View
              key={cg.id}
              style={[
                styles.dataCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <ThemedText
                style={{
                  color: colors.text,
                  fontWeight: "700",
                  fontSize: 15 * fontScale,
                }}
              >
                {cg.name}
              </ThemedText>
              <ThemedText style={{ color: colors.icon }}>
                {cg.relationship}
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

  emptyText: {
    fontWeight: "600",
    textAlign: "center",
  },

  emptySubText: {
    marginTop: 4,
    textAlign: "center",
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
