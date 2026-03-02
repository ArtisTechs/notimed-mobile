import * as Notifications from "expo-notifications";
import { router } from "expo-router";

export function registerNotificationTapRouting() {
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const data: any = resp.notification.request.content.data;

    if (data?.kind === "MEDICATION") {
      router.push({
        pathname: "/reminder",
        params: {
          kind: "MEDICATION",
          medId: data.medId,
          name: data.name,
          dose: data.dose,
          notes: data.notes ?? "",
          date: data.date,
          time: data.time,
        },
      });
      return;
    }

    if (data?.kind === "APPOINTMENT") {
      router.push({
        pathname: "/reminder",
        params: {
          kind: "APPOINTMENT",
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
