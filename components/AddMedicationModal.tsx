import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import * as Crypto from "expo-crypto";
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

export type RepeatType = "once" | "daily" | "weekly" | "monthly" | "custom";
export type RepeatUnit = "day" | "week" | "month";
export type MedicationStatus = "ongoing" | "completed";

const REPEAT_TYPES: { label: string; value: RepeatType }[] = [
  { label: "Once", value: "once" },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Custom", value: "custom" },
];

const REPEAT_UNITS: { label: string; value: RepeatUnit }[] = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
];

const WEEKDAYS = [
  { label: "Mon", value: "MON" },
  { label: "Tue", value: "TUE" },
  { label: "Wed", value: "WED" },
  { label: "Thu", value: "THU" },
  { label: "Fri", value: "FRI" },
  { label: "Sat", value: "SAT" },
  { label: "Sun", value: "SUN" },
] as const;

const STATUS_OPTIONS: { label: string; value: MedicationStatus }[] = [
  { label: "Ongoing", value: "ongoing" },
  { label: "Completed", value: "completed" },
];

const REMINDER_OPTIONS = [
  { label: "5 minutes", value: 5 },
  { label: "10 minutes", value: 10 },
  { label: "15 minutes", value: 15 },
  { label: "20 minutes", value: 20 },
  { label: "30 minutes", value: 30 },
];

const parseDaysCsv = (csv: string) =>
  csv
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

const serializeDays = (days: string[]) => days.join(",");

export type MedicationPayload = {
  id: string;
  userId: string;
  name: string;
  dose: string;
  startDate: string; // YYYY-MM-DD
  repeat: {
    type: RepeatType;
    interval: number;
    unit: RepeatUnit;
    daysOfWeek: string[]; // e.g. ["MON","WED"]
    endDate?: string; // YYYY-MM-DD
  };
  schedule: {
    time: string; // HH:mm
    reminderOffsetMinutes: number;
  };
  status: MedicationStatus;
  notes?: string;
};

type Props = {
  visible: boolean;
  userId: string;
  mode?: "add" | "update";
  initialData?: MedicationPayload;
  onClose: () => void;
  onSubmit: (item: MedicationPayload) => Promise<void> | void;
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
const toInt = (v: string, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const combineYmdAndTime = (ymd: string, hhmm: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
};

const ymdToDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
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

const compareYmd = (a: string, b: string) => {
  // returns -1 if a<b, 0 if equal, 1 if a>b
  if (!isValidYMD(a) || !isValidYMD(b)) return 0;
  const na = Number(a.replaceAll("-", ""));
  const nb = Number(b.replaceAll("-", ""));
  return na === nb ? 0 : na < nb ? -1 : 1;
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

const dateToYmd = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

function normalizeRepeat(
  type: RepeatType,
  intervalStr: string,
  unit: RepeatUnit,
  daysCsv: string,
  endDate: string,
) {
  // base
  let interval = toInt(intervalStr, 1);
  if (interval <= 0) interval = 1;

  let nextUnit: RepeatUnit = unit;
  let nextInterval = interval;

  if (type === "once") {
    nextUnit = "day";
    nextInterval = 1;
    return {
      type,
      interval: nextInterval,
      unit: nextUnit,
      daysOfWeek: [] as string[],
      endDate: undefined as string | undefined, // once shouldn't have an endDate
    };
  }

  if (type === "daily") {
    nextUnit = "day";
    nextInterval = 1;
  } else if (type === "weekly") {
    nextUnit = "week";
    nextInterval = 1;
  } else if (type === "monthly") {
    nextUnit = "month";
    nextInterval = 1;
  } else {
    // custom: keep user-selected unit + interval
    nextUnit = unit;
    nextInterval = interval;
  }

  const allowDays =
    type === "weekly" || (type === "custom" && nextUnit === "week");

  const daysOfWeek = allowDays ? parseDaysCsv(daysCsv) : [];

  return {
    type,
    interval: nextInterval,
    unit: nextUnit,
    daysOfWeek,
    endDate: endDate.trim() ? endDate.trim() : undefined,
  };
}

export default function AddMedicationModal({
  visible,
  userId,
  mode = "add",
  initialData,
  onClose,
  onSubmit,
}: Props) {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];
  const [name, setName] = React.useState("");
  const [dose, setDose] = React.useState("");
  const [startDate, setStartDate] = React.useState(todayYMD());
  const [time, setTime] = React.useState("");
  const [reminderOffset, setReminderOffset] = React.useState<number>(5);
  const [repeatType, setRepeatType] = React.useState<RepeatType>("once");
  const [repeatInterval, setRepeatInterval] = React.useState("1");
  const [repeatUnit, setRepeatUnit] = React.useState<RepeatUnit>("day");
  const [daysOfWeek, setDaysOfWeek] = React.useState(""); // MON,WED
  const [endDate, setEndDate] = React.useState(""); // optional
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [showStartPicker, setShowStartPicker] = React.useState(false);
  const [showEndPicker, setShowEndPicker] = React.useState(false);
  const [showTimePicker, setShowTimePicker] = React.useState(false);
  const [timeValue, setTimeValue] = React.useState<Date>(() =>
    hhmmToDate("08:00"),
  );
  const [status, setStatus] = React.useState<MedicationStatus>("ongoing");

  React.useEffect(() => {
    if (!visible) return;

    if (mode === "update" && initialData) {
      setName(initialData.name);
      setDose(initialData.dose);
      setStartDate(initialData.startDate);
      setTime(initialData.schedule.time);
      setTimeValue(hhmmToDate(initialData.schedule.time));
      setReminderOffset(initialData.schedule.reminderOffsetMinutes ?? 5);
      setRepeatType(initialData.repeat.type);
      setRepeatInterval(String(initialData.repeat.interval));
      setRepeatUnit(initialData.repeat.unit);
      setDaysOfWeek(initialData.repeat.daysOfWeek.join(","));
      setEndDate(initialData.repeat.endDate ?? "");
      setNotes(initialData.notes ?? "");
      setStatus(initialData.status ?? "ongoing");
    } else {
      setName("");
      setDose("");
      setStartDate(todayYMD());
      setTime("");
      setTimeValue(hhmmToDate("08:00"));
      setShowTimePicker(false);
      setReminderOffset(5);
      setRepeatType("once");
      setRepeatInterval("1");
      setRepeatUnit("day");
      setDaysOfWeek("");
      setEndDate("");
      setNotes("");
      setShowStartPicker(false);
      setShowEndPicker(false);
      setStatus("ongoing");
    }

    setSaving(false);
    setErrors({});
  }, [visible, mode, initialData]);

  const validate = () => {
    const e: Record<string, string> = {};

    if (!name.trim()) e.name = "Name is required";
    if (!dose.trim()) e.dose = "Dose is required";

    if (!startDate.trim()) e.startDate = "Start date is required";
    else if (!isValidYMD(startDate)) e.startDate = "Use YYYY-MM-DD";

    if (!time.trim()) e.time = "Time is required";
    else if (!isValidTimeHHmm(time)) e.time = "Use HH:mm (e.g. 08:00)";

    if (
      repeatType === "once" &&
      isValidYMD(startDate) &&
      isValidTimeHHmm(time) &&
      combineYmdAndTime(startDate.trim(), time.trim()).getTime() <= Date.now()
    ) {
      e.time = "One-time reminders must be scheduled in the future";
    }

    if (endDate.trim() && !isValidYMD(endDate)) e.endDate = "Use YYYY-MM-DD";

    if (endDate.trim() && isValidYMD(endDate) && isValidYMD(startDate)) {
      if (compareYmd(endDate.trim(), startDate.trim()) < 0) {
        e.endDate = "End date must be on/after Start date";
      }
    }

    // normalized repeat validation (single source of truth)
    const normalized = normalizeRepeat(
      repeatType,
      repeatInterval,
      repeatUnit,
      daysOfWeek,
      endDate,
    );

    if (repeatType === "custom") {
      if (normalized.interval <= 0) e.repeatInterval = "Interval must be >= 1";
    }

    const needsDays =
      normalized.type === "weekly" ||
      (normalized.type === "custom" && normalized.unit === "week");

    if (needsDays && normalized.daysOfWeek.length === 0) {
      e.daysOfWeek = "Select at least one day";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      setSaving(true);

      const intervalN = toInt(repeatInterval, 1);

      const parsedDays =
        repeatType === "weekly"
          ? daysOfWeek
              .split(",")
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean)
          : [];

      const id =
        mode === "update" && initialData?.id
          ? initialData.id
          : Crypto.randomUUID();

      const normalizedRepeat = normalizeRepeat(
        repeatType,
        repeatInterval,
        repeatUnit,
        daysOfWeek,
        endDate,
      );

      const payload: MedicationPayload = {
        id,
        userId,
        name: name.trim(),
        dose: dose.trim(),
        startDate: startDate.trim(),
        repeat: normalizedRepeat,
        schedule: {
          time: time.trim(),
          reminderOffsetMinutes: reminderOffset,
        },
        status,
        notes: notes.trim() ? notes.trim() : undefined,
      };

      await onSubmit(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const chevron = (
    <Ionicons name="chevron-down" size={18} color={colors.icon} />
  );

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
                {mode === "update" ? "Update Medication" : "Add Medication"}
              </ThemedText>
              <ThemedText
                style={{
                  color: colors.icon,
                  marginTop: 4,
                  lineHeight: 18,
                  fontSize: 12.5 * fontScale,
                }}
              >
                Fill in the details for the medication. Click save when you're
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
            <FieldRow label="Name" colors={colors} fontScale={fontScale}>
              <InputShell colors={colors}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Lisinopril"
                  placeholderTextColor={colors.icon}
                  style={[styles.textInput, { color: colors.text }]}
                  editable={!saving}
                />
              </InputShell>
              {!!errors.name && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>
                  {errors.name}
                </ThemedText>
              )}
            </FieldRow>
            <FieldRow label="Start Date" colors={colors} fontScale={fontScale}>
              <Pressable onPress={() => !saving && setShowStartPicker(true)}>
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
                    value={startDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.icon}
                    style={[styles.textInput, { color: colors.text }]}
                    editable={false}
                    pointerEvents="none"
                  />
                </InputShell>
              </Pressable>

              {!!errors.startDate && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>
                  {errors.startDate}
                </ThemedText>
              )}

              {showStartPicker ? (
                <DateTimePicker
                  value={ymdToDate(startDate)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, selected) => {
                    if (Platform.OS !== "ios") setShowStartPicker(false);
                    if (!selected) return;

                    const nextStart = dateToYmd(selected);
                    setStartDate(nextStart);

                    if (
                      endDate.trim() &&
                      isValidYMD(endDate) &&
                      compareYmd(endDate, nextStart) < 0
                    ) {
                      setEndDate(nextStart);
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.endDate;
                        return copy;
                      });
                    }
                  }}
                />
              ) : null}

              {Platform.OS === "ios" && showStartPicker ? (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    marginTop: 8,
                  }}
                >
                  <Pressable
                    onPress={() => setShowStartPicker(false)}
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
            <FieldRow label="Repeat" colors={colors} fontScale={fontScale}>
              <InputShell colors={colors} rightIcon={chevron}>
                <View
                  style={{
                    position: "relative",
                    height: 48,
                    justifyContent: "center",
                  }}
                >
                  {/* Visible label */}
                  <ThemedText
                    style={{ color: colors.text, fontSize: 14 * fontScale }}
                  >
                    {REPEAT_TYPES.find((x) => x.value === repeatType)?.label ??
                      repeatType}
                  </ThemedText>

                  {/* Invisible Picker overlay */}
                  <Picker
                    style={styles.pickerOverlay}
                    dropdownIconColor="transparent"
                    selectedValue={repeatType}
                    onValueChange={(val) => {
                      const next = val as RepeatType;
                      setRepeatType(next);

                      if (next !== "custom") {
                        setRepeatInterval("1");
                        setRepeatUnit(
                          next === "daily"
                            ? "day"
                            : next === "weekly"
                              ? "week"
                              : next === "monthly"
                                ? "month"
                                : "day",
                        );
                      }

                      if (next === "once") {
                        setDaysOfWeek("");
                        setEndDate("");
                      } else {
                        // if leaving weekly-like modes, clear days
                        if (next !== "weekly") {
                          // keep days only if custom+week will be selected later; simplest: clear now
                          setDaysOfWeek("");
                        }
                      }
                    }}
                    enabled={!saving}
                  >
                    {REPEAT_TYPES.map((opt) => (
                      <Picker.Item
                        key={opt.value}
                        label={opt.label}
                        value={opt.value}
                      />
                    ))}
                  </Picker>
                </View>
              </InputShell>
            </FieldRow>
            <FieldRow label="Dose" colors={colors} fontScale={fontScale}>
              <InputShell colors={colors}>
                <TextInput
                  value={dose}
                  onChangeText={setDose}
                  placeholder="e.g., 10mg"
                  placeholderTextColor={colors.icon}
                  style={[styles.textInput, { color: colors.text }]}
                  editable={!saving}
                />
              </InputShell>
              {!!errors.dose && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>
                  {errors.dose}
                </ThemedText>
              )}
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
                    value={time ? formatTo12Hour(time) : ""}
                    placeholder="Select time"
                    placeholderTextColor={colors.icon}
                    style={[styles.textInput, { color: colors.text }]}
                    editable={false}
                    pointerEvents="none"
                  />
                </InputShell>
              </Pressable>

              {!!errors.time && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>
                  {errors.time}
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
                    setTime(dateToHHmm(selected)); // still saved as 24-hour HH:mm
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
            <FieldRow label="Status" colors={colors} fontScale={fontScale}>
              <InputShell colors={colors} rightIcon={chevron}>
                <View
                  style={{
                    position: "relative",
                    height: 48,
                    justifyContent: "center",
                  }}
                >
                  <ThemedText
                    style={{ color: colors.text, fontSize: 14 * fontScale }}
                  >
                    {STATUS_OPTIONS.find((x) => x.value === status)?.label ??
                      status}
                  </ThemedText>

                  <Picker
                    style={styles.pickerOverlay}
                    dropdownIconColor="transparent"
                    selectedValue={status}
                    onValueChange={(val) => setStatus(val as MedicationStatus)}
                    enabled={!saving}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <Picker.Item
                        key={opt.value}
                        label={opt.label}
                        value={opt.value}
                      />
                    ))}
                  </Picker>
                </View>
              </InputShell>
            </FieldRow>
            <FieldRow label="Notes" colors={colors} fontScale={fontScale}>
              <InputShell colors={colors}>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g., After breakfast"
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
            <FieldRow
              label="Retry Delay"
              colors={colors}
              fontScale={fontScale}
            >
              <InputShell colors={colors} rightIcon={chevron}>
                <View
                  style={{
                    position: "relative",
                    height: 48,
                    justifyContent: "center",
                  }}
                >
                  <ThemedText
                    style={{ color: colors.text, fontSize: 14 * fontScale }}
                  >
                    {
                      REMINDER_OPTIONS.find((x) => x.value === reminderOffset)
                        ?.label
                    }
                  </ThemedText>

                  <Picker
                    style={styles.pickerOverlay}
                    dropdownIconColor="transparent"
                    selectedValue={reminderOffset}
                    onValueChange={(val) => setReminderOffset(val as number)}
                    enabled={!saving}
                  >
                    {REMINDER_OPTIONS.map((opt) => (
                      <Picker.Item
                        key={opt.value}
                        label={opt.label}
                        value={opt.value}
                      />
                    ))}
                  </Picker>
                </View>
              </InputShell>
            </FieldRow>
            {/* Advanced repeat fields (kept, but visually compact) */}
            <View style={styles.divider} />
            {repeatType === "custom" ? (
              <>
                {/* Advanced repeat fields (custom only) */}
                <View style={styles.divider} />

                <FieldRow
                  label="Interval"
                  colors={colors}
                  fontScale={fontScale}
                >
                  <InputShell colors={colors}>
                    <TextInput
                      value={repeatInterval}
                      onChangeText={(v) =>
                        setRepeatInterval(v.replace(/[^\d]/g, ""))
                      }
                      placeholder="1"
                      placeholderTextColor={colors.icon}
                      keyboardType="number-pad"
                      style={[styles.textInput, { color: colors.text }]}
                      editable={!saving}
                    />
                  </InputShell>
                  {!!errors.repeatInterval && (
                    <ThemedText
                      style={[styles.errorText, { color: colors.error }]}
                    >
                      {errors.repeatInterval}
                    </ThemedText>
                  )}
                </FieldRow>

                <FieldRow label="Unit" colors={colors} fontScale={fontScale}>
                  <InputShell colors={colors} rightIcon={chevron}>
                    <View
                      style={{
                        position: "relative",
                        height: 48,
                        justifyContent: "center",
                      }}
                    >
                      <ThemedText
                        style={{ color: colors.text, fontSize: 14 * fontScale }}
                      >
                        {REPEAT_UNITS.find((x) => x.value === repeatUnit)
                          ?.label ?? repeatUnit}
                      </ThemedText>

                      <Picker
                        style={styles.pickerOverlay}
                        dropdownIconColor="transparent"
                        selectedValue={repeatUnit}
                        onValueChange={(val) =>
                          setRepeatUnit(val as RepeatUnit)
                        }
                        enabled={!saving}
                      >
                        {REPEAT_UNITS.map((opt) => (
                          <Picker.Item
                            key={opt.value}
                            label={opt.label}
                            value={opt.value}
                          />
                        ))}
                      </Picker>
                    </View>
                  </InputShell>
                </FieldRow>
              </>
            ) : null}

            {repeatType === "weekly" ||
            (repeatType === "custom" && repeatUnit === "week") ? (
              <FieldRow label="Days" colors={colors} fontScale={fontScale}>
                <View style={styles.dayGrid}>
                  {WEEKDAYS.map((d) => {
                    const selected = parseDaysCsv(daysOfWeek).includes(d.value);
                    return (
                      <Pressable
                        key={d.value}
                        onPress={() => {
                          if (saving) return;
                          const current = parseDaysCsv(daysOfWeek);
                          const next = selected
                            ? current.filter((x) => x !== d.value)
                            : [...current, d.value];
                          setDaysOfWeek(serializeDays(next));
                        }}
                        style={[
                          styles.dayChip,
                          {
                            borderColor: colors.border,
                            backgroundColor: selected
                              ? colors.tint
                              : colors.inputBackground,
                          },
                        ]}
                      >
                        <ThemedText
                          style={{
                            color: selected ? colors.buttonText : colors.text,
                            fontWeight: "800",
                            fontSize: 12 * fontScale,
                          }}
                        >
                          {d.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>

                {!!errors.daysOfWeek && (
                  <ThemedText
                    style={[styles.errorText, { color: colors.error }]}
                  >
                    {errors.daysOfWeek}
                  </ThemedText>
                )}
              </FieldRow>
            ) : null}

            <FieldRow label="End Date" colors={colors} fontScale={fontScale}>
              <Pressable onPress={() => !saving && setShowEndPicker(true)}>
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
                    value={endDate}
                    placeholder="Optional"
                    placeholderTextColor={colors.icon}
                    style={[styles.textInput, { color: colors.text }]}
                    editable={false}
                    pointerEvents="none"
                  />
                </InputShell>
              </Pressable>

              {!!errors.endDate && (
                <ThemedText style={[styles.errorText, { color: colors.error }]}>
                  {errors.endDate}
                </ThemedText>
              )}

              {showEndPicker ? (
                <DateTimePicker
                  value={ymdToDate(endDate || startDate)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={ymdToDate(startDate)}
                  onChange={(_, selected) => {
                    if (Platform.OS !== "ios") setShowEndPicker(false);
                    if (!selected) return;

                    const nextEnd = dateToYmd(selected);

                    if (
                      isValidYMD(startDate) &&
                      compareYmd(nextEnd, startDate) < 0
                    ) {
                      setEndDate(startDate);
                      return;
                    }

                    setEndDate(nextEnd);
                  }}
                />
              ) : null}

              {Platform.OS === "ios" && showEndPicker ? (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 8,
                  }}
                >
                  <Pressable
                    onPress={() => {
                      setEndDate("");
                      setShowEndPicker(false);
                    }}
                    hitSlop={10}
                  >
                    <ThemedText
                      style={{ color: colors.error, fontWeight: "800" }}
                    >
                      Clear
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => setShowEndPicker(false)}
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
          </ScrollView>

          {/* Sticky footer buttons */}
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
    height: "88%",
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

  helperText: {
    marginTop: 6,
    fontSize: 12,
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    opacity: 0.25,
    marginVertical: 8,
    backgroundColor: "#999",
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
  pickerShell: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 8,
    overflow: "hidden",
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  dayChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  pickerOverlay: {
    position: "absolute",
    top: 0,
    left: -12,
    right: -12,
    bottom: 0,
    opacity: 0.02,
  },
});
