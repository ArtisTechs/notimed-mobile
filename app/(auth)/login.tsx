import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

import AppToast from "@/components/AppToast";
import FullscreenLoader from "@/components/FullscreenLoader";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAppTheme } from "@/context/AppThemeContext";
import { useAppView } from "@/context/AppViewContext";
import { authApi } from "@/services/authApi";
import { router } from "expo-router";

type Mode = "login" | "signup";
type ForgotPasswordStep = "idle" | "otp" | "reset";

export default function AuthScreen() {
  const { resolvedScheme, fontScale } = useAppTheme();
  const colors = Colors[resolvedScheme];
  const { setView } = useAppView();
  const [loginLoading, setLoginLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Loading...");

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isLogin = mode === "login";
  const [forgotPasswordStep, setForgotPasswordStep] =
    useState<ForgotPasswordStep>("idle");
  const showForgotPassword =
    isLogin && forgotPasswordStep === "idle" && email.trim().length > 0;

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<"PATIENT" | "CAREGIVER">("PATIENT");

  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(30);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: "success" | "error";
  }>({
    visible: false,
    message: "",
    type: "success",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<any>({});

  React.useEffect(() => {
    let timer: any;
    if ((otpStep || forgotPasswordStep === "otp") && countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpStep, forgotPasswordStep, countdown]);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ visible: true, message, type });

    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2500);
  };

  const isValidEmail = (value: string) => {
    const v = value.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v);
  };

  const isUnregisteredEmailMessage = (message?: string) =>
    message?.trim().toLowerCase() === "email is not registered.";

  const validateLogin = () => {
    const newErrors: any = {};

    if (!email.trim()) newErrors.email = "Email is required";
    else if (!isValidEmail(email))
      newErrors.email = "Enter a valid email address";

    if (!password.trim()) newErrors.password = "Password is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignup = () => {
    const newErrors: any = {};

    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";

    if (!email.trim()) newErrors.email = "Email is required";
    else if (!isValidEmail(email))
      newErrors.email = "Enter a valid email address";

    if (!password.trim()) newErrors.password = "Password is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateOtp = () => {
    const newErrors: any = {};

    if (!otp.trim()) newErrors.otp = "OTP is required";
    else if (otp.trim().length !== 6) newErrors.otp = "OTP must be 6 digits";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateResetPassword = () => {
    const newErrors: any = {};

    if (!newPassword.trim()) newErrors.newPassword = "New password is required";
    else if (newPassword.trim().length < 6) {
      newErrors.newPassword = "Password must be at least 6 characters";
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = "Confirm your new password";
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForgotPasswordFlow = () => {
    setForgotPasswordStep("idle");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setCountdown(30);
    setErrors({});
  };

  return (
    <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
      <FullscreenLoader
        visible={loginLoading}
        text={loadingText}
        colors={colors}
        fontScale={fontScale}
      />
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
                onPress={() => {
                  setMode("login");
                  setOtpStep(false);
                  resetForgotPasswordFlow();
                }}
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
                onPress={() => {
                  setMode("signup");
                  resetForgotPasswordFlow();
                }}
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
                  {forgotPasswordStep === "idle" ? (
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
                            name={
                              showPassword ? "eye-off-outline" : "eye-outline"
                            }
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

                      {showForgotPassword && (
                        <Pressable
                          style={styles.forgotPasswordButton}
                          onPress={async () => {
                            if (!isValidEmail(email)) {
                              showToast(
                                "Enter a valid email address first",
                                "error",
                              );
                              return;
                            }

                            setLoadingText("Sending password recovery code...");
                            setLoginLoading(true);

                            try {
                              const response = await authApi.forgotPassword(
                                email.trim(),
                              );
                              if (isUnregisteredEmailMessage(response.message)) {
                                showToast(response.message, "error");
                                return;
                              }

                              setForgotPasswordStep("otp");
                              setOtp("");
                              setCountdown(30);
                              setErrors({});
                              showToast("OTP sent", "success");
                            } catch (e: any) {
                              showToast(
                                e?.message ?? "Failed to send recovery email",
                                "error",
                              );
                            } finally {
                              setLoginLoading(false);
                            }
                          }}
                        >
                          <ThemedText
                            style={{
                              color: colors.tint,
                              fontWeight: "600",
                              fontSize: 12 * fontScale,
                            }}
                          >
                            Forgot Password?
                          </ThemedText>
                        </Pressable>
                      )}

                      <Pressable
                        style={[
                          styles.primaryButton,
                          { backgroundColor: colors.tint },
                        ]}
                        onPress={async () => {
                          if (!validateLogin()) return;

                          setLoadingText("Signing in...");
                          setLoginLoading(true);

                          try {
                            const user = await authApi.login({
                              email: email.trim(),
                              password,
                            });

                            setLoadingText("Fetching account details...");
                            const details = await authApi.getUserById(user.id);

                            const normalizedRole = String(
                              details.role,
                            ).toLowerCase();

                            await AsyncStorage.multiSet([
                              ["userId", String(details.id)],
                              ["userRole", normalizedRole],
                              [
                                "userEmail",
                                String(details.email ?? email.trim()),
                              ],
                              [
                                "userName",
                                `${details.firstName ?? ""} ${details.lastName ?? ""}`.trim(),
                              ],
                              ["userDetails", JSON.stringify(details)],
                            ]);

                            if (normalizedRole === "caregiver") {
                              router.replace(
                                "/(drawer)/dashboard-caregiver-view",
                              );
                            } else {
                              router.replace(
                                "/(drawer)/dashboard-patient-view",
                              );
                            }
                          } catch (e: any) {
                            const message = e?.message ?? "";

                            if (
                              message.includes("Invalid credentials") ||
                              message.includes("401")
                            ) {
                              showToast("Invalid email or password", "error");
                            } else {
                              showToast(message || "Login failed", "error");
                            }
                          } finally {
                            setLoginLoading(false);
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
                  ) : forgotPasswordStep === "otp" ? (
                    <>
                      <Pressable
                        onPress={resetForgotPasswordFlow}
                        style={styles.backButton}
                      >
                        <ThemedText
                          style={{
                            color: colors.tint,
                            fontWeight: "600",
                            fontSize: 14 * fontScale,
                          }}
                        >
                          Back
                        </ThemedText>
                      </Pressable>

                      <ThemedText
                        style={[
                          styles.formTitle,
                          { fontSize: 20 * fontScale, color: colors.text },
                        ]}
                      >
                        Verify OTP
                      </ThemedText>

                      <ThemedText
                        style={[
                          styles.helperText,
                          { fontSize: 12 * fontScale, color: colors.icon },
                        ]}
                      >
                        Enter the 6-digit code sent to your email to continue
                        resetting your password.
                      </ThemedText>

                      <TextInput
                        placeholder="123456"
                        placeholderTextColor={colors.icon}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp}
                        onChangeText={(v) => {
                          const cleaned = v.replace(/\D/g, "");
                          setOtp(cleaned);
                          if (errors.otp)
                            setErrors((e: any) => ({ ...e, otp: undefined }));
                        }}
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.inputBackground,
                            borderColor: colors.border,
                            color: colors.text,
                            textAlign: "center",
                            fontSize: 20 * fontScale,
                            letterSpacing: 8,
                          },
                        ]}
                      />

                      {errors.otp && (
                        <ThemedText
                          style={[
                            styles.errorText,
                            { fontSize: 12 * fontScale, color: colors.error },
                          ]}
                        >
                          {errors.otp}
                        </ThemedText>
                      )}

                      <Pressable
                        disabled={countdown > 0}
                        onPress={async () => {
                          try {
                            setLoadingText("Resending OTP...");
                            setLoginLoading(true);

                            const response = await authApi.forgotPassword(
                              email.trim(),
                            );
                            if (isUnregisteredEmailMessage(response.message)) {
                              showToast(response.message, "error");
                              resetForgotPasswordFlow();
                              return;
                            }

                            setCountdown(30);
                            showToast("OTP resent", "success");
                          } catch (e: any) {
                            showToast(
                              e?.message ?? "Failed to resend OTP",
                              "error",
                            );
                          } finally {
                            setLoginLoading(false);
                          }
                        }}
                      >
                        <ThemedText
                          style={{
                            textAlign: "center",
                            marginBottom: 16,
                            fontSize: 12 * fontScale,
                            color: countdown > 0 ? colors.icon : colors.tint,
                          }}
                        >
                          {countdown > 0
                            ? `Resend OTP in ${countdown}s`
                            : "Resend OTP"}
                        </ThemedText>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.primaryButton,
                          { backgroundColor: colors.tint },
                        ]}
                        onPress={async () => {
                          if (!validateOtp()) return;

                          try {
                            setLoadingText("Verifying OTP...");
                            setLoginLoading(true);

                            await authApi.verifyOtp(email.trim(), otp.trim());
                            setForgotPasswordStep("reset");
                            setErrors({});
                            showToast("OTP verified", "success");
                          } catch (e: any) {
                            showToast(
                              e?.message ?? "OTP verification failed",
                              "error",
                            );
                          } finally {
                            setLoginLoading(false);
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
                          Verify OTP
                        </ThemedText>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable
                        onPress={resetForgotPasswordFlow}
                        style={styles.backButton}
                      >
                        <ThemedText
                          style={{
                            color: colors.tint,
                            fontWeight: "600",
                            fontSize: 14 * fontScale,
                          }}
                        >
                          Back to Login
                        </ThemedText>
                      </Pressable>

                      <ThemedText
                        style={[
                          styles.formTitle,
                          { fontSize: 20 * fontScale, color: colors.text },
                        ]}
                      >
                        Create New Password
                      </ThemedText>

                      <ThemedText
                        style={[
                          styles.label,
                          { fontSize: 12 * fontScale, color: colors.text },
                        ]}
                      >
                        New Password
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
                          placeholder="Enter new password"
                          placeholderTextColor={colors.icon}
                          secureTextEntry={!showPassword}
                          value={newPassword}
                          onChangeText={setNewPassword}
                          style={[styles.passwordInput, { color: colors.text }]}
                        />

                        <Pressable
                          onPress={() => setShowPassword((prev) => !prev)}
                          style={styles.eyeButton}
                        >
                          <Ionicons
                            name={
                              showPassword ? "eye-off-outline" : "eye-outline"
                            }
                            size={20}
                            color={colors.icon}
                          />
                        </Pressable>
                      </View>

                      {errors.newPassword && (
                        <ThemedText
                          style={[
                            styles.errorText,
                            { fontSize: 12 * fontScale, color: colors.error },
                          ]}
                        >
                          {errors.newPassword}
                        </ThemedText>
                      )}

                      <ThemedText
                        style={[
                          styles.label,
                          { fontSize: 12 * fontScale, color: colors.text },
                        ]}
                      >
                        Confirm New Password
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
                          placeholder="Confirm new password"
                          placeholderTextColor={colors.icon}
                          secureTextEntry={!showPassword}
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          style={[styles.passwordInput, { color: colors.text }]}
                        />

                        <Pressable
                          onPress={() => setShowPassword((prev) => !prev)}
                          style={styles.eyeButton}
                        >
                          <Ionicons
                            name={
                              showPassword ? "eye-off-outline" : "eye-outline"
                            }
                            size={20}
                            color={colors.icon}
                          />
                        </Pressable>
                      </View>

                      {errors.confirmPassword && (
                        <ThemedText
                          style={[
                            styles.errorText,
                            { fontSize: 12 * fontScale, color: colors.error },
                          ]}
                        >
                          {errors.confirmPassword}
                        </ThemedText>
                      )}

                      <Pressable
                        style={[
                          styles.primaryButton,
                          { backgroundColor: colors.tint },
                        ]}
                        onPress={async () => {
                          if (!validateResetPassword()) return;

                          try {
                            setLoadingText("Updating password...");
                            setLoginLoading(true);

                            await authApi.resetPassword(
                              email.trim(),
                              newPassword,
                            );

                            setPassword("");
                            resetForgotPasswordFlow();
                            showToast(
                              "Password reset successful. Please log in.",
                              "success",
                            );
                          } catch (e: any) {
                            showToast(
                              e?.message ?? "Failed to reset password",
                              "error",
                            );
                          } finally {
                            setLoginLoading(false);
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
                          Save New Password
                        </ThemedText>
                      </Pressable>
                    </>
                  )}
                </>
              ) : (
                <>
                  {!otpStep ? (
                    <>
                      {/* Title */}
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

                      {/* Role */}
                      <ThemedText
                        style={[styles.label, { color: colors.text }]}
                      >
                        Select your role
                      </ThemedText>

                      <View
                        style={[
                          styles.segmentContainer,
                          { backgroundColor: colors.border },
                        ]}
                      >
                        <Pressable
                          style={[
                            styles.segmentItem,
                            role === "PATIENT" && {
                              backgroundColor: colors.tint,
                            },
                          ]}
                          onPress={() => setRole("PATIENT")}
                        >
                          <ThemedText
                            style={{
                              color:
                                role === "PATIENT"
                                  ? colors.buttonText
                                  : colors.text,
                              fontWeight: "600",
                            }}
                          >
                            Patient/Guardian
                          </ThemedText>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.segmentItem,
                            role === "CAREGIVER" && {
                              backgroundColor: colors.tint,
                            },
                          ]}
                          onPress={() => setRole("CAREGIVER")}
                        >
                          <ThemedText
                            style={{
                              color:
                                role === "CAREGIVER"
                                  ? colors.buttonText
                                  : colors.text,
                              fontWeight: "600",
                            }}
                          >
                            Caregiver
                          </ThemedText>
                        </Pressable>
                      </View>

                      {/* First Name */}
                      <ThemedText
                        style={[styles.label, { color: colors.text }]}
                      >
                        First Name
                      </ThemedText>
                      <TextInput
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder="Enter first name"
                        placeholderTextColor={colors.icon}
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.inputBackground,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                      />
                      {errors.firstName && (
                        <ThemedText
                          style={[styles.errorText, { color: colors.error }]}
                        >
                          {errors.firstName}
                        </ThemedText>
                      )}

                      {/* Middle Name (Optional) */}
                      <ThemedText
                        style={[styles.label, { color: colors.text }]}
                      >
                        Middle Name (Optional)
                      </ThemedText>
                      <TextInput
                        value={middleName}
                        onChangeText={setMiddleName}
                        placeholder="Enter middle name"
                        placeholderTextColor={colors.icon}
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.inputBackground,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                      />

                      {/* Last Name */}
                      <ThemedText
                        style={[styles.label, { color: colors.text }]}
                      >
                        Last Name
                      </ThemedText>
                      <TextInput
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder="Enter last name"
                        placeholderTextColor={colors.icon}
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.inputBackground,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                      />
                      {errors.lastName && (
                        <ThemedText
                          style={[styles.errorText, { color: colors.error }]}
                        >
                          {errors.lastName}
                        </ThemedText>
                      )}

                      {/* Email */}
                      <ThemedText
                        style={[styles.label, { color: colors.text }]}
                      >
                        Email
                      </ThemedText>
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Enter email"
                        placeholderTextColor={colors.icon}
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
                          style={[styles.errorText, { color: colors.error }]}
                        >
                          {errors.email}
                        </ThemedText>
                      )}

                      {/* Password */}
                      <ThemedText
                        style={[styles.label, { color: colors.text }]}
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
                          secureTextEntry={!showPassword}
                          value={password}
                          onChangeText={setPassword}
                          placeholder="Enter password"
                          placeholderTextColor={colors.icon}
                          style={[styles.passwordInput, { color: colors.text }]}
                        />
                        <Pressable
                          onPress={() => setShowPassword((p) => !p)}
                          style={styles.eyeButton}
                        >
                          <Ionicons
                            name={
                              showPassword ? "eye-off-outline" : "eye-outline"
                            }
                            size={20}
                            color={colors.icon}
                          />
                        </Pressable>
                      </View>
                      {errors.password && (
                        <ThemedText
                          style={[styles.errorText, { color: colors.error }]}
                        >
                          {errors.password}
                        </ThemedText>
                      )}

                      {/* Submit */}
                      <Pressable
                        style={[
                          styles.primaryButton,
                          { backgroundColor: colors.tint },
                        ]}
                        onPress={async () => {
                          if (!validateSignup()) return;

                          try {
                            setLoadingText("Sending OTP...");
                            setLoginLoading(true);

                            await authApi.sendOtp(email.trim());

                            setOtpStep(true);
                            setCountdown(30);
                            showToast("OTP sent", "success");
                          } catch (e: any) {
                            showToast(
                              e?.message ?? "Failed to send OTP",
                              "error",
                            );
                          } finally {
                            setLoginLoading(false);
                          }
                        }}
                      >
                        <ThemedText
                          style={{
                            color: colors.buttonText,
                            fontWeight: "600",
                          }}
                        >
                          Create Account
                        </ThemedText>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      {/* Back Button */}
                      <Pressable
                        onPress={() => {
                          setOtpStep(false);
                          setOtp("");
                          setErrors({});
                          setCountdown(30);
                        }}
                        style={styles.backButton}
                      >
                        <ThemedText
                          style={{
                            color: colors.tint,
                            fontWeight: "600",
                            fontSize: 14 * fontScale,
                          }}
                        >
                          ← Back
                        </ThemedText>
                      </Pressable>

                      {/* Title */}
                      <ThemedText
                        style={[
                          styles.formTitle,
                          { fontSize: 20 * fontScale, color: colors.text },
                        ]}
                      >
                        Verify OTP
                      </ThemedText>

                      {/* Helper */}
                      <ThemedText
                        style={[
                          styles.helperText,
                          { fontSize: 12 * fontScale, color: colors.icon },
                        ]}
                      >
                        Enter the 6-digit code sent to your email.
                      </ThemedText>

                      {/* OTP Input */}
                      <TextInput
                        placeholder="123456"
                        placeholderTextColor={colors.icon}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp}
                        onChangeText={(v) => {
                          const cleaned = v.replace(/\D/g, "");
                          setOtp(cleaned);
                          if (errors.otp)
                            setErrors((e: any) => ({ ...e, otp: undefined }));
                        }}
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.inputBackground,
                            borderColor: colors.border,
                            color: colors.text,
                            textAlign: "center",
                            fontSize: 20 * fontScale,
                            letterSpacing: 8,
                          },
                        ]}
                      />

                      {/* Error */}
                      {errors.otp && (
                        <ThemedText
                          style={[
                            styles.errorText,
                            { fontSize: 12 * fontScale, color: colors.error },
                          ]}
                        >
                          {errors.otp}
                        </ThemedText>
                      )}

                      {/* Resend */}
                      <Pressable
                        disabled={countdown > 0}
                        onPress={async () => {
                          try {
                            setLoadingText("Resending OTP...");
                            setLoginLoading(true);

                            await authApi.sendOtp(email.trim());

                            setCountdown(30);
                            showToast("OTP resent", "success");
                          } catch (e: any) {
                            showToast(
                              e?.message ?? "Failed to resend OTP",
                              "error",
                            );
                          } finally {
                            setLoginLoading(false);
                          }
                        }}
                      >
                        <ThemedText
                          style={{
                            textAlign: "center",
                            marginBottom: 16,
                            fontSize: 12 * fontScale,
                            color: countdown > 0 ? colors.icon : colors.tint,
                          }}
                        >
                          {countdown > 0
                            ? `Resend OTP in ${countdown}s`
                            : "Resend OTP"}
                        </ThemedText>
                      </Pressable>

                      {/* Verify Button */}
                      <Pressable
                        style={[
                          styles.primaryButton,
                          { backgroundColor: colors.tint },
                        ]}
                        onPress={async () => {
                          if (!validateOtp()) return;

                          try {
                            await authApi.verifyOtp(email.trim(), otp.trim());

                            await authApi.register({
                              firstName: firstName.trim(),
                              middleName: middleName.trim()
                                ? middleName.trim()
                                : null,
                              lastName: lastName.trim(),
                              email: email.trim(),
                              password,
                              role, // "patient" | "caregiver"
                            });

                            setOtpStep(false);
                            setMode("login");
                            setOtp("");
                            setErrors({});
                            setCountdown(30);

                            showToast(
                              "Account created successfully",
                              "success",
                            );
                          } catch (e: any) {
                            showToast(
                              e?.message ??
                                "OTP verification / registration failed",
                              "error",
                            );
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
                          Verify
                        </ThemedText>
                      </Pressable>
                    </>
                  )}
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <AppToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
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
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 14,
  },

  backButton: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  segmentContainer: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },

  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },

  fullscreenLoader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderCard: {
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 200,
  },
});
