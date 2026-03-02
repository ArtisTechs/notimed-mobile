import * as Notifications from "expo-notifications";

export async function ensureNotifPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}
