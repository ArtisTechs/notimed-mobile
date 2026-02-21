import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { useAppView } from "@/context/AppViewContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

type Mode = "login" | "signup";

export default function AuthScreen() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];
  const { setView } = useAppView();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isLogin = mode === "login";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<"patient" | "caregiver">("patient");

  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<any>({});

  React.useEffect(() => {
    let timer: any;
    if (otpStep && countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpStep, countdown]);

  const validateLogin = () => {
    const newErrors: any = {};
    if (!email.trim()) newErrors.email = "Email is required";
    if (!password.trim()) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignup = () => {
    const newErrors: any = {};
    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";
    if (!email.trim()) newErrors.email = "Email is required";
    if (!password.trim()) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateOtp = () => {
    const newErrors: any = {};
    if (!otp.trim()) newErrors.otp = "OTP is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.screen}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.header}>
              <View style={styles.logoRow}>
                <Image
                  source={require("@/assets/images/notimed-logo-transparent.png")}
                  style={styles.logoIcon}
                  resizeMode="contain"
                />
                <ThemedText
                  style={[
                    styles.brand,
                    { fontSize: 28 * fontScale, color: colors.text },
                  ]}
                >
                  NotiMed
                </ThemedText>
              </View>

              <ThemedText
                style={[
                  styles.subtitle,
                  { fontSize: 12 * fontScale, color: colors.icon },
                ]}
              >
                Your personal assistant for managing medications and
                appointments with ease and peace of mind.
              </ThemedText>
            </View>

            <View
              style={[styles.tabContainer, { backgroundColor: colors.border }]}
            >
              <Pressable
                style={[
                  styles.tab,
                  isLogin && { backgroundColor: colors.tint },
                ]}
                onPress={() => setMode("login")}
              >
                <ThemedText
                  style={{
                    color: isLogin ? colors.buttonText : colors.text,
                    fontWeight: "600",
                    fontSize: 14 * fontScale,
                  }}
                >
                  Log In
                </ThemedText>
              </Pressable>

              <Pressable
                style={[
                  styles.tab,
                  !isLogin && { backgroundColor: colors.tint },
                ]}
                onPress={() => setMode("signup")}
              >
                <ThemedText
                  style={{
                    color: !isLogin ? colors.buttonText : colors.text,
                    fontWeight: "600",
                    fontSize: 14 * fontScale,
                  }}
                >
                  Sign Up
                </ThemedText>
              </Pressable>
            </View>

            <View
              style={[styles.formCard, { backgroundColor: colors.background }]}
            >
              {isLogin ? (
                <>
                  <ThemedText
                    style={[
                      styles.formTitle,
                      { fontSize: 20 * fontScale, color: colors.text },
                    ]}
                  >
                    Log In
                  </ThemedText>

                  <ThemedText
                    style={[
                      styles.label,
                      { fontSize: 12 * fontScale, color: colors.text },
                    ]}
                  >
                    Email
                  </ThemedText>

                  <TextInput
                    placeholder="Enter your email address"
                    placeholderTextColor={colors.icon}
                    value={email}
                    onChangeText={setEmail}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                  />

                  {errors.email && (
                    <ThemedText
                      style={[
                        styles.errorText,
                        { fontSize: 12 * fontScale, color: colors.error },
                      ]}
                    >
                      {errors.email}
                    </ThemedText>
                  )}

                  <ThemedText
                    style={[
                      styles.label,
                      { fontSize: 12 * fontScale, color: colors.text },
                    ]}
                  >
                    Password
                  </ThemedText>

                  <View
                    style={[
                      styles.passwordContainer,
                      {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <TextInput
                      placeholder="Enter your password"
                      placeholderTextColor={colors.icon}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                      style={[styles.passwordInput, { color: colors.text }]}
                    />

                    <Pressable
                      onPress={() => setShowPassword((prev) => !prev)}
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={colors.icon}
                      />
                    </Pressable>
                  </View>

                  {errors.password && (
                    <ThemedText
                      style={[
                        styles.errorText,
                        { fontSize: 12 * fontScale, color: colors.error },
                      ]}
                    >
                      {errors.password}
                    </ThemedText>
                  )}

                  <Pressable
                    style={[
                      styles.primaryButton,
                      { backgroundColor: colors.tint },
                    ]}
                    onPress={async () => {
                      if (!validateLogin()) return;

                      const mockRole: "patient" | "caregiver" = email.includes(
                        "care",
                      )
                        ? "caregiver"
                        : "patient";

                      await AsyncStorage.setItem("userRole", mockRole);

                      setView(mockRole);

                      if (mockRole === "caregiver") {
                        router.replace("/(drawer)/dashboard-caregiver-view");
                      } else {
                        router.replace("/(drawer)/dashboard-patient-view");
                      }
                    }}
                  >
                    <ThemedText
                      style={{
                        color: colors.buttonText,
                        fontWeight: "600",
                        fontSize: 14 * fontScale,
                      }}
                    >
                      Log In
                    </ThemedText>
                  </Pressable>
                </>
              ) : (
                <>
                  <ThemedText
                    style={[
                      styles.formTitle,
                      { fontSize: 20 * fontScale, color: colors.text },
                    ]}
                  >
                    Create an Account
                  </ThemedText>

                  <ThemedText
                    style={[
                      styles.helperText,
                      { fontSize: 12 * fontScale, color: colors.icon },
                    ]}
                  >
                    Get started by setting up your new account.
                  </ThemedText>

                  <Pressable
                    style={[
                      styles.primaryButton,
                      { backgroundColor: colors.tint },
                    ]}
                    onPress={() => {
                      if (validateSignup()) {
                        setOtpStep(true);
                        setCountdown(30);
                      }
                    }}
                  >
                    <ThemedText
                      style={{
                        color: colors.buttonText,
                        fontWeight: "600",
                        fontSize: 14 * fontScale,
                      }}
                    >
                      Create Account
                    </ThemedText>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 2,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoIcon: {
    width: 60,
    height: 60,
  },
  brand: {
    fontWeight: "800",
  },
  subtitle: {
    textAlign: "center",
    marginTop: 6,
  },
  tabContainer: {
    flexDirection: "row",
    borderRadius: 10,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  formCard: {
    borderRadius: 14,
    padding: 16,
  },
  formTitle: {
    textAlign: "center",
    fontWeight: "700",
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  helperText: {
    marginBottom: 16,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 14,
    height: 44,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
  },
  eyeButton: {
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    marginTop: -10,
    marginBottom: 10,
  },
});
