import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import type { NotificationBehavior } from "expo-notifications";
import * as Notifications from "expo-notifications";
import React from "react";
import { Platform } from "react-native";

import { AppThemeProvider, useAppTheme } from "@/context/AppThemeContext";
import { AppViewProvider } from "@/context/AppViewContext";

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

function Navigation() {
  const { resolvedScheme } = useAppTheme();

  React.useEffect(() => {
    let tapSub: Notifications.Subscription | undefined;
    let fgSub: Notifications.Subscription | undefined;

    (async () => {
      await initAndroidNotificationChannels();

      const granted = await ensureNotificationPermission();
      if (!granted) return;

      // COLD START
      const last = await Notifications.getLastNotificationResponseAsync();
      const lastData: any = last?.notification.request.content.data;
      if (lastData) routeFromNotificationData(lastData);

      // FOREGROUND (alarm fires while app open)
      fgSub = Notifications.addNotificationReceivedListener((notif) => {
        const data: any = notif.request.content.data;
        routeFromNotificationData(data);
      });

      // BACKGROUND (user taps notification)
      tapSub = Notifications.addNotificationResponseReceivedListener((resp) => {
        const data: any = resp.notification.request.content.data;
        routeFromNotificationData(data);
      });
    })();

    return () => {
      fgSub?.remove();
      tapSub?.remove();
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
          <Stack.Screen name="reminder" />
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
