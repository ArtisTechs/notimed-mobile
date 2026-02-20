import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme as useSystemScheme } from "react-native";

type ThemeMode = "light" | "dark" | "auto";
type TextSize = "small" | "medium" | "large";

interface AppThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  resolvedScheme: "light" | "dark";
  fontScale: number;
}

const AppThemeContext = createContext<AppThemeContextType | null>(null);

export function AppThemeProvider({ children }: any) {
  const systemScheme = useSystemScheme() ?? "light";

  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const [textSize, setTextSize] = useState<TextSize>("medium");

  useEffect(() => {
    (async () => {
      const savedTheme = await AsyncStorage.getItem("themeMode");
      const savedText = await AsyncStorage.getItem("textSize");

      if (savedTheme) setThemeMode(savedTheme as ThemeMode);
      if (savedText) setTextSize(savedText as TextSize);
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("themeMode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    AsyncStorage.setItem("textSize", textSize);
  }, [textSize]);

  const resolvedScheme = themeMode === "auto" ? systemScheme : themeMode;

  const fontScale =
    textSize === "small" ? 0.9 : textSize === "large" ? 1.15 : 1;

  return (
    <AppThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        textSize,
        setTextSize,
        resolvedScheme,
        fontScale,
      }}
    >
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) throw new Error("AppThemeProvider missing");
  return ctx;
}
