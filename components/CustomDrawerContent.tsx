import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import { router } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";

export default function CustomDrawerContent(props: any) {
  const {
    themeMode,
    setThemeMode,
    textSize,
    setTextSize,
    resolvedScheme,
    fontScale,
  } = useAppTheme();

  const colors = Colors[resolvedScheme];
  const activeRoute = props.state.routeNames[props.state.index];

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={{
        flex: 1,
        backgroundColor: colors.card,
        borderTopRightRadius: 30,
        borderBottomRightRadius: 30,
        padding: 20,
      }}
    >
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Image
            source={require("@/assets/images/notimed-logo-transparent.png")}
            style={{ width: 32, height: 32 }}
          />
          <Text
            style={{
              fontSize: 20 * fontScale,
              fontWeight: "700",
              marginLeft: 8,
              color: colors.text,
            }}
          >
            NotiMed
          </Text>
        </View>

        <Text
          style={{
            color: colors.icon,
            marginTop: 6,
            fontSize: 12 * fontScale,
          }}
        >
          Manage your health and app settings.
        </Text>
      </View>

      <Text
        style={{
          fontSize: 12 * fontScale,
          color: colors.icon,
          letterSpacing: 1,
        }}
      >
        MAIN MENU
      </Text>

      <MenuItem
        icon="grid-outline"
        label="Dashboard"
        routeName="dashboard-patient-view"
        activeRoute={activeRoute}
        onPress={() => router.replace("/dashboard-patient-view")}
        colors={colors}
        fontScale={fontScale}
      />

      <MenuItem
        icon="medkit-outline"
        label="Schedule"
        routeName="schedule"
        activeRoute={activeRoute}
        onPress={() => router.replace("/schedule")}
        colors={colors}
        fontScale={fontScale}
      />

      <MenuItem
        icon="calendar-outline"
        label="Appointments"
        routeName="appointments"
        activeRoute={activeRoute}
        onPress={() => router.replace("/appointments")}
        colors={colors}
        fontScale={fontScale}
      />

      <MenuItem
        icon="time-outline"
        label="View History"
        routeName="history"
        activeRoute={activeRoute}
        onPress={() => router.replace("/history")}
        colors={colors}
        fontScale={fontScale}
      />

      <MenuItem
        icon="person-outline"
        label="Caregiver Access"
        routeName="profile"
        activeRoute={activeRoute}
        onPress={() => router.replace("/profile")}
        colors={colors}
        fontScale={fontScale}
      />

      <View
        style={{
          height: 1,
          backgroundColor: colors.border,
          marginVertical: 20,
        }}
      />

      <Text
        style={{
          fontSize: 12 * fontScale,
          color: colors.icon,
          letterSpacing: 1,
        }}
      >
        APPEARANCE
      </Text>

      <View style={{ flexDirection: "row", marginTop: 10 }}>
        <ToggleButton
          label="Light"
          active={themeMode === "light"}
          onPress={() => setThemeMode("light")}
          colors={colors}
          fontScale={fontScale}
        />
        <ToggleButton
          label="Dark"
          active={themeMode === "dark"}
          onPress={() => setThemeMode("dark")}
          colors={colors}
          fontScale={fontScale}
        />
        <ToggleButton
          label="Auto"
          active={themeMode === "auto"}
          onPress={() => setThemeMode("auto")}
          colors={colors}
          fontScale={fontScale}
        />
      </View>

      <Text
        style={{
          fontSize: 12 * fontScale,
          color: colors.icon,
          letterSpacing: 1,
          marginTop: 20,
        }}
      >
        TEXT SIZE
      </Text>

      <View style={{ flexDirection: "row", marginTop: 10 }}>
        <ToggleButton
          label="Small"
          active={textSize === "small"}
          onPress={() => setTextSize("small")}
          colors={colors}
          fontScale={fontScale}
        />
        <ToggleButton
          label="Med"
          active={textSize === "medium"}
          onPress={() => setTextSize("medium")}
          colors={colors}
          fontScale={fontScale}
        />
        <ToggleButton
          label="Large"
          active={textSize === "large"}
          onPress={() => setTextSize("large")}
          colors={colors}
          fontScale={fontScale}
        />
      </View>

      <View style={{ flex: 1 }} />

      <Pressable
        style={{
          backgroundColor: colors.error,
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: "#FFF",
            fontWeight: "600",
            fontSize: 14 * fontScale,
          }}
        >
          Log Out
        </Text>
      </Pressable>
    </DrawerContentScrollView>
  );
}

function MenuItem({
  icon,
  label,
  routeName,
  activeRoute,
  onPress,
  colors,
  fontScale,
}: {
  icon: any;
  label: string;
  routeName: string;
  activeRoute: string;
  onPress: () => void;
  colors: any;
  fontScale: number;
}) {
  const isActive = routeName === activeRoute;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: isActive ? colors.tint + "20" : "transparent",
      }}
    >
      <Ionicons
        name={icon}
        size={20}
        color={isActive ? colors.tint : colors.icon}
      />
      <Text
        style={{
          fontSize: 16 * fontScale,
          marginLeft: 14,
          color: isActive ? colors.tint : colors.text,
          fontWeight: isActive ? "600" : "400",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ToggleButton({
  label,
  active,
  onPress,
  colors,
  fontScale,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  colors: any;
  fontScale: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: active ? colors.tint : colors.border,
        marginRight: 8,
      }}
    >
      <Text
        style={{
          color: active ? colors.buttonText : colors.text,
          fontSize: 14 * fontScale,
          fontWeight: active ? "600" : "400",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
