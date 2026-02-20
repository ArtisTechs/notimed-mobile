import CustomDrawerContent from "@/components/CustomDrawerContent";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { Drawer } from "expo-router/drawer";
import { Image, Pressable, Text, View } from "react-native";

export default function DrawerLayout() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ route, navigation }) => ({
        headerShown: true,

        headerStyle: {
          backgroundColor: colors.background,
        },

        headerTitleAlign: "center",
        headerTintColor: colors.text,

        drawerType: "slide",

        overlayColor:
          resolvedScheme === "dark" ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.35)",

        drawerStyle: {
          width: 320,
          borderTopRightRadius: 30,
          borderBottomRightRadius: 30,
          backgroundColor: colors.card,
        },

        headerTitle: () => (
          <Text
            style={{
              fontSize: 18 * fontScale,
              fontWeight: "700",
              color: colors.text,
            }}
          >
            {getTitle(route.name)}
          </Text>
        ),

        headerLeft: () => (
          <Pressable
            onPress={() => navigation.toggleDrawer()}
            style={{ marginLeft: 16 }}
          >
            <Ionicons name="menu-outline" size={26} color={colors.text} />
          </Pressable>
        ),

        headerRight: () => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginRight: 16,
            }}
          >
            <Image
              source={require("@/assets/images/notimed-logo-transparent.png")}
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
            />
            <Text
              style={{
                marginLeft: 4,
                fontSize: 16 * fontScale,
                fontWeight: "700",
                color: colors.text,
              }}
            >
              NotiMed
            </Text>
          </View>
        ),
      })}
    >
      <Drawer.Screen name="dashboard-patient-view" />
      <Drawer.Screen name="appointments" />
      <Drawer.Screen name="profile" />
    </Drawer>
  );
}

function getTitle(routeName: string) {
  switch (routeName) {
    case "dashboard-patient-view":
      return "Dashboard";
    case "appointments":
      return "Appointments";
    case "profile":
      return "Profile";
    default:
      return "";
  }
}
