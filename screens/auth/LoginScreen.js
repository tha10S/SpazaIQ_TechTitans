import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../config/ThemeContext";
import { getAuthErrorMessage, logIn } from "../../services/auth/firebaseAuth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function handleLogin() {
    if (isSubmitting) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    try {
      setError("");
      setIsSubmitting(true);
      await logIn(normalizedEmail, password);
    } catch (loginError) {
      setError(getAuthErrorMessage(loginError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.brand}>
              <View style={styles.brandMark}>
                <Ionicons name="storefront-outline" size={25} color={colors.primaryDark} />
              </View>
              <Text style={styles.brandName}>
                Spaza<Text style={styles.brandAccent}>IQ</Text>
              </Text>
            </View>

            <Text style={styles.eyebrow}>YOUR BUSINESS, IN CONTROL</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to keep your shop running smoothly.
            </Text>

            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>Email address</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={19} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (error) setError("");
                  }}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  accessibilityLabel="Email address"
                />
              </View>

              <View style={styles.passwordLabelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
              </View>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={19} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (error) setError("");
                  }}
                  secureTextEntry={!passwordVisible}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  accessibilityLabel="Password"
                />
                <TouchableOpacity
                  style={styles.visibilityButton}
                  onPress={() => setPasswordVisible((visible) => !visible)}
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                  hitSlop={8}
                >
                  <Ionicons
                    name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {error ? (
                <View style={styles.errorBanner} accessibilityRole="alert">
                  <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleLogin}
                disabled={isSubmitting}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Sign in</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.secureNote}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
                <Text style={styles.secureNoteText}>Your account is protected</Text>
              </View>
            </View>

            <View style={styles.signupPrompt}>
              <Text style={styles.signupPromptText}>New to SpazaIQ?</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Signup")}
                disabled={isSubmitting}
                accessibilityRole="button"
              >
                <Text style={styles.signupLink}>Create an account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 32,
    },
    content: {
      width: "100%",
      maxWidth: 440,
      alignSelf: "center",
    },
    brand: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 38,
      gap: 11,
    },
    brandMark: {
      width: 48,
      height: 48,
      borderRadius: 15,
      backgroundColor: colors.primaryLight,
      alignItems: "center",
      justifyContent: "center",
    },
    brandName: {
      color: colors.textPrimary,
      fontSize: 21,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    brandAccent: {
      color: colors.primary,
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.25,
      marginBottom: 9,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 34,
      fontWeight: "800",
      letterSpacing: -1,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 23,
      marginTop: 8,
      marginBottom: 26,
    },
    formCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 20,
      padding: 22,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 18,
      elevation: 3,
    },
    fieldLabel: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 9,
    },
    inputContainer: {
      height: 54,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 14,
      marginBottom: 20,
    },
    input: {
      flex: 1,
      height: "100%",
      color: colors.textPrimary,
      fontSize: 15,
      paddingHorizontal: 11,
    },
    passwordLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    visibilityButton: {
      padding: 4,
    },
    errorBanner: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      backgroundColor: colors.dangerBg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: -4,
      marginBottom: 16,
      gap: 8,
    },
    errorText: {
      flex: 1,
      color: colors.danger,
      fontSize: 13,
      lineHeight: 18,
    },
    submitButton: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor: colors.primaryDark,
      gap: 9,
    },
    submitButtonDisabled: {
      opacity: 0.7,
    },
    submitButtonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "700",
    },
    secureNote: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 18,
      gap: 7,
    },
    secureNoteText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "500",
    },
    signupPrompt: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 24,
      gap: 5,
    },
    signupPromptText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    signupLink: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "700",
    },
  });
}
