// src/services/notificationTapRouting.ts
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

export function registerNotificationTapRouting() {
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const data: any = resp.notification.request.content.data;

    if (data?.kind === "MEDICATION") {
      router.push({
        pathname: "/(drawer)/reminder",
        params: {
          kind: "MEDICATION",
          userId: data.userId,
          medId: data.medId,
          name: data.name,
          dose: data.dose,
          notes: data.notes ?? "",
          date: data.date,
          time: data.time,
          isReAlarm: String(Boolean(data.isReAlarm)),
          reminderOffsetMinutes: String(data.reminderOffsetMinutes ?? ""),
          reAlarmAfterMinutes: String(data.reAlarmAfterMinutes ?? ""),
        },
      });
      return;
    }

    if (data?.kind === "APPOINTMENT") {
      router.push({
        pathname: "/(drawer)/reminder",
        params: {
          kind: "APPOINTMENT",
          userId: data.userId,
          apptId: data.apptId,
          title: data.title,
          notes: data.notes ?? "",
          date: data.date,
          time: data.time,
        },
      });
    }
  });

  return () => sub.remove();
}
