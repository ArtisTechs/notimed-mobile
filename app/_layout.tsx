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
    shouldShowAlert: true,
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
  if (data?.kind === "MEDICATION") {
    router.replace({
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
    return true;
  }

  if (data?.kind === "APPOINTMENT") {
    router.replace({
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
    return true;
  }

  return false;
}

function Navigation() {
  const { resolvedScheme } = useAppTheme();

  React.useEffect(() => {
    let subscription: Notifications.Subscription | undefined;

    (async () => {
      await initAndroidNotificationChannels();
      await ensureNotificationPermission();

      // COLD START: app opened from killed state via notification tap
      const last = await Notifications.getLastNotificationResponseAsync();
      const lastData: any = last?.notification.request.content.data;
      if (lastData) {
        routeFromNotificationData(lastData);
      }

      // NORMAL: app already running/backgrounded, user taps notification
      subscription = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data: any = response.notification.request.content.data;
          routeFromNotificationData(data);
        },
      );
    })();

    return () => {
      if (subscription) subscription.remove();
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
