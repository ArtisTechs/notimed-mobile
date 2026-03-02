import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function initNotificationsAndroid() {
  if (Platform.OS !== "android") return;

  // Medication channel
  await Notifications.setNotificationChannelAsync("medication", {
    name: "Medication Reminders",
    importance: Notifications.AndroidImportance.MAX,
    sound: "medication.wav", // must match registered sound filename
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Appointment channel
  await Notifications.setNotificationChannelAsync("appointment", {
    name: "Appointment Reminders",
    importance: Notifications.AndroidImportance.MAX,
    sound: "appointment.wav",
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}
