import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../services/firebase/firebaseConfig";
import { getAuthErrorMessage, logIn } from "../../services/auth/firebaseAuth";
import { isValidEmail, normalizeEmail } from "../../services/validation";
import { KEYBOARD_BEHAVIOR } from "../../components/keyboard";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function handleLogin() {
    if (isSubmitting) return;

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    try {
      setError("");
      setInfo("");
      setIsSubmitting(true);
      await logIn(normalizedEmail, password);
    } catch (loginError) {
      setError(getAuthErrorMessage(loginError));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Sends Firebase's password reset email to the address typed above.
  // The message is the same whether or not an account exists, so it can't be used to find out who has an account.
  async function handleForgotPassword() {
    if (isSubmitting) return;

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setInfo("");
      setError("Type your email address above first, then tap Forgot password.");
      return;
    }

    const sentMessage = `If an account exists for ${normalizedEmail}, we've sent a link to reset your password. Check your spam folder too.`;
    try {
      setError("");
      setInfo("");
      setIsSubmitting(true);
      await sendPasswordResetEmail(auth, normalizedEmail);
      setInfo(sentMessage);
    } catch (resetError) {
      const code = String(resetError?.code || "");
      if (code.includes("too-many-requests")) {
        setError("Too many requests. Wait a few minutes and try again.");
      } else if (code.includes("network")) {
        setError("No internet connection. Check your connection and try again.");
      } else if (code.includes("invalid-email")) {
        setError("Enter a valid email address.");
      } else {
        // For example "user-not-found": show the same message as a success
        setInfo(sentMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.container} behavior={KEYBOARD_BEHAVIOR}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>Spaza</Text>

              <View style={styles.iqBox}>
                <Text style={styles.iqText}>IQ</Text>
              </View>
            </View>

            {/* Heading */}
            <Text style={styles.title}>Welcome Back</Text>

            <Text style={styles.subtitle}>
              Sign in to keep your shop running{"\n"}smoothly.
            </Text>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>

              <TextInput
                style={styles.input}
                placeholder="sipho@example.com"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (error) setError("");
                  if (info) setInfo("");
                }}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                maxLength={254}
                textContentType="emailAddress"
                returnKeyType="next"
                accessibilityLabel="Email address"
              />
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity
                  onPress={handleForgotPassword}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text style={styles.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, !passwordVisible && styles.passwordHidden]}
                  placeholder="••••••"
                  placeholderTextColor="#9CA3AF"
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
                  onPress={() => setPasswordVisible((visible) => !visible)}
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                  hitSlop={8}
                >
                  <Ionicons
                    name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.signInButton, isSubmitting && styles.signInButtonDisabled]}
              onPress={handleLogin}
              disabled={isSubmitting}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {error ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            {info ? <Text style={styles.infoText}>{info}</Text> : null}

            {/* Sign up */}
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>New to SpazaIQ? </Text>

              <TouchableOpacity
                onPress={() => navigation.navigate("Signup")}
                disabled={isSubmitting}
                accessibilityRole="button"
              >
                <Text style={styles.signupLink}>Create an account</Text>
              </TouchableOpacity>
            </View>

            {/* Admin login (for the SpazaIQ team) */}
            <TouchableOpacity
              onPress={() => navigation.navigate("AdminLogin")}
              disabled={isSubmitting}
              accessibilityRole="button"
              style={styles.adminLinkWrap}
            >
              <Text style={styles.adminLink}>Admin login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Same look as the Signup screen: light page, solid brand green buttons
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 30,
  },

  content: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },

  // Logo
  logoContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  logoText: {
    fontSize: 25,
    fontWeight: "800",
    color: "#111827",
  },

  iqBox: {
    backgroundColor: "#004B49",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 2,
  },

  iqText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  // Heading
  title: {
    textAlign: "center",
    fontSize: 21,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },

  subtitle: {
    textAlign: "center",
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },

  // Inputs
  inputGroup: {
    marginBottom: 12,
  },

  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  label: {
    fontSize: 11,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },

  forgotLink: {
    fontSize: 11,
    color: "#004B49",
    fontWeight: "800",
    marginBottom: 6,
  },

  input: {
    height: 43,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 9,
    paddingHorizontal: 13,
    fontSize: 12,
    color: "#111827",
  },

  // Password
  passwordContainer: {
    height: 43,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 13,
    paddingRight: 12,
  },

  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },

  // Wide dot spacing only while the password is hidden
  passwordHidden: {
    letterSpacing: 3,
  },

  // Button
  signInButton: {
    height: 44,
    backgroundColor: "#004B49",
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,

    // Shadow
    shadowColor: "#004B49",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },

  signInButtonDisabled: {
    opacity: 0.7,
  },

  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  errorText: {
    color: "#B91C1C",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 10,
  },

  infoText: {
    color: "#004B49",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 10,
  },

  // Sign up
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },

  signupText: {
    color: "#6B7280",
    fontSize: 11,
  },

  signupLink: {
    color: "#004B49",
    fontSize: 11,
    fontWeight: "800",
  },

  // Admin login link
  adminLinkWrap: {
    alignSelf: "center",
    marginTop: 14,
    padding: 8,
  },

  adminLink: {
    color: "#004B49",
    fontSize: 14,
    fontWeight: "800",
  },
});