import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { AppThemeProvider, useAppTheme } from "@/context/AppThemeContext";
import { AppViewProvider } from "@/context/AppViewContext";

function Navigation() {
  const { resolvedScheme } = useAppTheme();

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
