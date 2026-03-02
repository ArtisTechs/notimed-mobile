import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from "react-native";

export type AppointmentPayload = {
  id: string;
  userId: string;
  title: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:mm (24-hour)
  notes?: string;
};

type Props = {
  visible: boolean;
  userId: string;
  mode?: "add" | "update";
  initialData?: AppointmentPayload;
  onClose: () => void;
  onSubmit: (item: AppointmentPayload) => Promise<void> | void;
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const nowISO = () => new Date().toISOString();

const isValidTimeHHmm = (value: string) =>
  /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());
const isValidYMD = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

const ymdToDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
};

const dateToYmd = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const dateToHHmm = (date: Date) =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const hhmmToDate = (hhmm: string) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  const d = new Date();
  if (!m) return d;
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
};

const formatTo12Hour = (hhmm: string) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!m) return hhmm;

  let hour = Number(m[1]);
  const minute = m[2];
  const ampm = hour >= 12 ? "PM" : "AM";

  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${pad2(hour)}:${minute} ${ampm}`;
};

function FieldRow({
  label,
  children,
  colors,
  fontScale,
}: {
  label: string;
  children: React.ReactNode;
  colors: any;
  fontScale: number;
}) {
  return (
    <View style={styles.row}>
      <ThemedText
        style={[
          styles.rowLabel,
          { color: colors.text, fontSize: 13 * fontScale },
        ]}
      >
        {label}
      </ThemedText>
      <View style={styles.rowControl}>{children}</View>
    </View>
  );
}

function InputShell({
  colors,
  rightIcon,
  children,
}: {
  colors: any;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.inputShell,
        {
          backgroundColor: colors.inputBackground,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={{ flex: 1 }}>{children}</View>
      {rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
    </View>
  );
}

export default function AddAppointmentModal({
  visible,
  userId,
  mode = "add",
  initialData,
  onClose,
  onSubmit,
}: Props) {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];

  const [title, setTitle] = React.useState("");
  const [appointmentDate, setAppointmentDate] = React.useState(todayYMD());
  const [appointmentTime, setAppointmentTime] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [showTimePicker, setShowTimePicker] = React.useState(false);
  const [timeValue, setTimeValue] = React.useState<Date>(() =>
    hhmmToDate("09:00"),
  );

  React.useEffect(() => {
    if (!visible) return;

    if (mode === "update" && initialData) {
      setTitle(initialData.title);
      setAppointmentDate(initialData.appointmentDate);
      setAppointmentTime(initialData.appointmentTime);
      setTimeValue(hhmmToDate(initialData.appointmentTime));
      setNotes(initialData.notes ?? "");
    } else {
      setTitle("");
      setAppointmentDate(todayYMD());
      setAppointmentTime("");
      setTimeValue(hhmmToDate("09:00"));
      setNotes("");
      setShowDatePicker(false);
      setShowTimePicker(false);
    }

    setSaving(false);
    setErrors({});
  }, [visible, mode, initialData]);

  const validate = () => {
    const e: Record<string, string> = {};

    if (!title.trim()) e.title = "Title is required";

    if (!appointmentDate.trim()) e.appointmentDate = "Date is required";
    else if (!isValidYMD(appointmentDate)) e.appointmentDate = "Use YYYY-MM-DD";

    if (!appointmentTime.trim()) e.appointmentTime = "Time is required";
    else if (!isValidTimeHHmm(appointmentTime))
      e.appointmentTime = "Use HH:mm (e.g. 14:30)";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      setSaving(true);

      const id =
        mode === "update" && initialData?.id
          ? initialData.id
          : `appt-${Date.now()}`;
      void nowISO(); // kept if you want later

      const payload: AppointmentPayload = {
        id,
        userId,
        title: title.trim(),
        appointmentDate: appointmentDate.trim(),
        appointmentTime: appointmentTime.trim(),
        notes: notes.trim() ? notes.trim() : undefined,
      };

      await onSubmit(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <ThemedText
                style={{
                  color: colors.text,
                  fontWeight: "900",
                  fontSize: 18 * fontScale,
                }}
              >
                {mode === "update" ? "Update Appointment" : "Add Appointment"}
              </ThemedText>
              <ThemedText
                style={{
                  color: colors.icon,
                  marginTop: 4,
                  lineHeight: 18,
                  fontSize: 12.5 * fontScale,
                }}
              >
                Fill in the details for the appointment. Click save when you're
                done.
              </ThemedText>
            </View>

            <Pressable
              onPress={saving ? undefined : onClose}
              style={styles.closeBtn}
              hitSlop={10}
            >
              <Ionicons name="close" size={20} color={colors.icon} />
            </Pressable>
          </View>

          {/* Scrollable form */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <FieldRow label="Title" colors={colors} fontScale={fontScale}>
              <InputShell colors={colors}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g., Dental checkup"
                  placeholderTextColor={colors.icon}
                  style={[styles.textInput, { color: colors.text }]}
                  editable={!saving}
                />
              </InputShell>
              {!!errors.title && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>
                  {errors.title}
                </ThemedText>
              )}
            </FieldRow>

            <FieldRow label="Date" colors={colors} fontScale={fontScale}>
              <Pressable onPress={() => !saving && setShowDatePicker(true)}>
                <InputShell
                  colors={colors}
                  rightIcon={
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={colors.icon}
                    />
                  }
                >
                  <TextInput
                    value={appointmentDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.icon}
                    style={[styles.textInput, { color: colors.text }]}
                    editable={false}
                    pointerEvents="none"
                  />
                </InputShell>
              </Pressable>

              {!!errors.appointmentDate && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>
                  {errors.appointmentDate}
                </ThemedText>
              )}

              {showDatePicker ? (
                <DateTimePicker
                  value={ymdToDate(appointmentDate)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, selected) => {
                    if (Platform.OS !== "ios") setShowDatePicker(false);
                    if (selected) setAppointmentDate(dateToYmd(selected));
                  }}
                />
              ) : null}

              {Platform.OS === "ios" && showDatePicker ? (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    marginTop: 8,
                  }}
                >
                  <Pressable
                    onPress={() => setShowDatePicker(false)}
                    hitSlop={10}
                  >
                    <ThemedText
                      style={{ color: colors.tint, fontWeight: "800" }}
                    >
                      Done
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </FieldRow>

            <FieldRow label="Time" colors={colors} fontScale={fontScale}>
              <Pressable onPress={() => !saving && setShowTimePicker(true)}>
                <InputShell
                  colors={colors}
                  rightIcon={
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={colors.icon}
                    />
                  }
                >
                  <TextInput
                    value={
                      appointmentTime ? formatTo12Hour(appointmentTime) : ""
                    }
                    placeholder="Select time"
                    placeholderTextColor={colors.icon}
                    style={[styles.textInput, { color: colors.text }]}
                    editable={false}
                    pointerEvents="none"
                  />
                </InputShell>
              </Pressable>

              {!!errors.appointmentTime && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>
                  {errors.appointmentTime}
                </ThemedText>
              )}

              {showTimePicker ? (
                <DateTimePicker
                  value={timeValue}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, selected) => {
                    if (Platform.OS !== "ios") setShowTimePicker(false);
                    if (!selected) return;

                    setTimeValue(selected);
                    setAppointmentTime(dateToHHmm(selected)); // stored as HH:mm
                  }}
                />
              ) : null}

              {Platform.OS === "ios" && showTimePicker ? (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    marginTop: 8,
                  }}
                >
                  <Pressable
                    onPress={() => setShowTimePicker(false)}
                    hitSlop={10}
                  >
                    <ThemedText
                      style={{ color: colors.tint, fontWeight: "800" }}
                    >
                      Done
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </FieldRow>

            <FieldRow label="Notes" colors={colors} fontScale={fontScale}>
              <InputShell colors={colors}>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g., Bring records"
                  placeholderTextColor={colors.icon}
                  style={[
                    styles.textInput,
                    styles.notesInput,
                    { color: colors.text },
                  ]}
                  editable={!saving}
                  multiline
                  textAlignVertical="top"
                />
              </InputShell>
            </FieldRow>
          </ScrollView>

          {/* Sticky footer */}
          <View
            style={[
              styles.stickyFooter,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
              },
            ]}
          >
            <View style={styles.btnStack}>
              <Pressable
                onPress={saving ? undefined : handleSave}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: colors.tint, opacity: saving ? 0.6 : 1 },
                ]}
              >
                <ThemedText
                  style={{
                    color: colors.buttonText,
                    fontWeight: "800",
                    fontSize: 14 * fontScale,
                  }}
                >
                  {saving
                    ? mode === "update"
                      ? "Updating..."
                      : "Saving..."
                    : mode === "update"
                      ? "Update changes"
                      : "Save changes"}
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={saving ? undefined : onClose}
                style={[
                  styles.secondaryBtn,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <ThemedText
                  style={{
                    color: colors.text,
                    fontWeight: "800",
                    fontSize: 14 * fontScale,
                  }}
                >
                  Cancel
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 16,
    justifyContent: "center",
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    height: "78%",
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 12,
    flexShrink: 0,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 50,
    flexGrow: 1,
  },
  stickyFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 8,
  },
  rowLabel: {
    width: 92,
    fontWeight: "700",
    fontSize: 13,
    paddingTop: 12,
  },
  rowControl: {
    flex: 1,
  },
  inputShell: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  textInput: {
    paddingVertical: 12,
    fontSize: 14,
  },
  notesInput: {
    minHeight: 90,
  },
  rightIcon: {
    marginLeft: 10,
    paddingLeft: 8,
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  btnStack: {
    marginTop: 8,
    gap: 10,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
});
