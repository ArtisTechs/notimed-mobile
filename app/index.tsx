import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { useAppView } from "@/context/AppViewContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Image, View } from "react-native";

export default function Index() {
  const { setView } = useAppView();
  const { resolvedScheme } = useAppTheme();
  const colors = Colors[resolvedScheme];

  useEffect(() => {
    const bootstrap = async () => {
      const role = await AsyncStorage.getItem("userRole");

      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (role === "caregiver") {
        setView("caregiver");
        router.replace("/(drawer)/dashboard-caregiver-view");
      } else if (role === "patient") {
        setView("patient");
        router.replace("/(drawer)/dashboard-patient-view");
      } else {
        router.replace("/(auth)/get-started");
      }
    };

    bootstrap();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      <Image
        source={require("../assets/images/notimed-logo-transparent.png")}
        style={{
          width: 180,
          height: 180,
          resizeMode: "contain",
          marginBottom: 24,
        }}
      />

      <ActivityIndicator size="large" color={colors.tint} />
    </View>
  );
}
