import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoLinking from "expo-linking";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import type { NotificationBehavior } from "expo-notifications";
import * as Notifications from "expo-notifications";
import React from "react";
import { Alert, AppState, Platform } from "react-native";

import { androidAlarm } from "@/services/androidAlarm";
import { AppThemeProvider, useAppTheme } from "@/context/AppThemeContext";
import { AppViewProvider } from "@/context/AppViewContext";
import { rescheduleCurrentUserNotifications } from "@/services/alarmScheduler";
import { historyApi } from "@/services/historyApi";

Notifications.setNotificationHandler({
  handleNotification: async (): Promise<NotificationBehavior> => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function initAndroidNotificationChannels() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("medication", {
    name: "Medication Reminders",
    importance: Notifications.AndroidImportance.MAX,
    sound: "medication.wav",
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  await Notifications.setNotificationChannelAsync("appointment", {
    name: "Appointment Reminders",
    importance: Notifications.AndroidImportance.MAX,
    sound: "appointment.wav",
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function ensureNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function routeFromNotificationData(data: any) {
  if (!data?.kind) return false;

  // small delay ensures navigation is mounted
  setTimeout(() => {
    if (data.kind === "MEDICATION") {
      router.push({
        pathname: "/(drawer)/reminder",
        params: {
          kind: "MEDICATION",
          userId: data.userId,
          medId: data.medId,
          alarmId: data.alarmId,
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

    if (data.kind === "APPOINTMENT") {
      router.push({
        pathname: "/(drawer)/reminder",
        params: {
          kind: "APPOINTMENT",
          userId: data.userId,
          apptId: data.apptId,
          alarmId: data.alarmId,
          title: data.title,
          notes: data.notes ?? "",
          date: data.date,
          time: data.time,
        },
      });
    }
  }, 0);

  return true;
}

function routeFromAlarmUrl(url?: string | null) {
  if (!url) return false;

  try {
    const parsed = ExpoLinking.parse(url);
    const host = String(parsed.hostname ?? "").toLowerCase();
    const path = String(parsed.path ?? "").replace(/^\/+/, "").toLowerCase();

    if (host !== "reminder" && path !== "reminder") return false;
    return routeFromNotificationData(parsed.queryParams ?? {});
  } catch {
    return false;
  }
}

function Navigation() {
  const { resolvedScheme } = useAppTheme();

  React.useEffect(() => {
    let tapSub: Notifications.Subscription | undefined;
    let fgSub: Notifications.Subscription | undefined;
    let linkSub: { remove(): void } | undefined;
    let isMounted = true;
    let exactAlarmPrompted = false;
    let fullScreenPrompted = false;
    let lastAlarmKey = "";
    let lastAlarmAt = 0;

    const routeAlarmOnce = (data: any) => {
      const alarmId = String(data?.alarmId ?? "").trim();
      const alarmKey = alarmId || JSON.stringify(data ?? {});
      const now = Date.now();

      if (alarmKey && lastAlarmKey === alarmKey && now - lastAlarmAt < 2000) {
        return false;
      }

      const handled = routeFromNotificationData(data);
      if (handled) {
        lastAlarmKey = alarmKey;
        lastAlarmAt = now;
      }
      return handled;
    };

    const routeAlarmUrlOnce = (url?: string | null) => {
      if (!url) return false;

      try {
        const parsed = ExpoLinking.parse(url);
        const alarmId = String(parsed.queryParams?.alarmId ?? "").trim();
        const alarmKey = alarmId || url;
        const now = Date.now();

        if (alarmKey && lastAlarmKey === alarmKey && now - lastAlarmAt < 2000) {
          return false;
        }

        const handled = routeFromAlarmUrl(url);
        if (handled) {
          lastAlarmKey = alarmKey;
          lastAlarmAt = now;
        }
        return handled;
      } catch {
        return false;
      }
    };

    const ensureAndroidAlarmAccess = async () => {
      if (Platform.OS !== "android" || !androidAlarm.isAvailable) return;

      const role = await AsyncStorage.getItem("userRole");
      if (role !== "patient") return;

      const exactAlarmAllowed = await androidAlarm.canScheduleExactAlarms();
      if (!exactAlarmAllowed && !exactAlarmPrompted) {
        exactAlarmPrompted = true;
        Alert.alert(
          "Allow exact alarms",
          "NotiMed needs exact alarm access so medication reminders can ring at the scheduled time.",
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Open settings",
              onPress: () => {
                void androidAlarm.openExactAlarmSettings();
              },
            },
          ],
        );
        return;
      }

      const fullScreenAllowed = await androidAlarm.canUseFullScreenIntent();
      if (!fullScreenAllowed && !fullScreenPrompted) {
        fullScreenPrompted = true;
        Alert.alert(
          "Allow full-screen alarms",
          "Enable full-screen alarm access so reminders can appear over the lock screen when they fire.",
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Open settings",
              onPress: () => {
                void androidAlarm.openFullScreenIntentSettings();
              },
            },
          ],
        );
      }
    };

    const syncNotificationSchedule = async () => {
      try {
        await rescheduleCurrentUserNotifications();
      } catch {}
    };

    const syncPendingHistory = async () => {
      try {
        await historyApi.syncPending();
      } catch {}
    };

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void ensureAndroidAlarmAccess();
        void syncPendingHistory();
        void syncNotificationSchedule();
      }
    });

    (async () => {
      await initAndroidNotificationChannels();

      const granted = await ensureNotificationPermission();
      if (!granted || !isMounted) return;

      await ensureAndroidAlarmAccess();
      await syncPendingHistory();
      await syncNotificationSchedule();

      const initialUrl = await ExpoLinking.getInitialURL();
      if (initialUrl) routeAlarmUrlOnce(initialUrl);

      // COLD START
      const last = await Notifications.getLastNotificationResponseAsync();
      const lastData: any = last?.notification.request.content.data;
      if (lastData) routeAlarmOnce(lastData);

      // FOREGROUND (alarm fires while app open)
      fgSub = Notifications.addNotificationReceivedListener((notif) => {
        const data: any = notif.request.content.data;
        routeAlarmOnce(data);
      });

      // BACKGROUND (user taps notification)
      tapSub = Notifications.addNotificationResponseReceivedListener((resp) => {
        const data: any = resp.notification.request.content.data;
        routeAlarmOnce(data);
      });

      linkSub = ExpoLinking.addEventListener("url", ({ url }) => {
        routeAlarmUrlOnce(url);
      });
    })();

    return () => {
      isMounted = false;
      fgSub?.remove();
      tapSub?.remove();
      linkSub?.remove();
      appStateSub.remove();
    };
  }, []);

  return (
    <ThemeProvider value={resolvedScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AppViewProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(drawer)" />
          <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        </Stack>

        <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />
      </AppViewProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <Navigation />
    </AppThemeProvider>
  );
}
