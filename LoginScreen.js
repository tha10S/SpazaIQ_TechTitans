import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const login = () => {
    if (!username || !password) {
      Alert.alert(
        "Missing Information",
        "Please enter your username/email and password."
      );
      return;
    }

    navigation.navigate("MainTabs");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>

        {/* Logo Icon */}
        <View style={styles.logoIcon}>
          <Text style={styles.logoIconText}>↗</Text>
        </View>

        {/* Logo */}
        <Text style={styles.logoText}>SpazaIQ</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Intelligent Spaza Shop Management
        </Text>

        {/* Form */}
        <View style={styles.form}>

          {/* Username */}
          <Text style={styles.label}>
            USERNAME / MOBILE / EMAIL
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>♙</Text>

            <TextInput
              style={styles.input}
              placeholder="thabomart@gmail.com"
              placeholderTextColor="#9CA3AF"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Password */}
          <Text style={[styles.label, styles.passwordLabel]}>
            PIN / PASSWORD
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputIcon}>▣</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />

            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.eye}>
                {showPassword ? "◉" : "◉"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={login}
            activeOpacity={0.8}
          >
            <Text style={styles.loginButtonText}>
              Login
            </Text>
          </TouchableOpacity>

          {/* Sign Up */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupTextNormal}>
              Don't have an account?{" "}
            </Text>

            <TouchableOpacity
              onPress={() => navigation.navigate("Signup")}
            >
              <Text style={styles.signupLink}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>

      {/* Security Badge */}
      <View style={styles.securityBadge}>
        <Text style={styles.shield}>♢</Text>

        <Text style={styles.securityText}>
          Secured & Verified by SpazaIQ SA
        </Text>
      </View>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  content: {
    flex: 1,
    paddingHorizontal: 43,
    alignItems: "center",
  },

  /* ---------------- LOGO ---------------- */

  logoIcon: {
    width: 57,
    height: 57,
    borderRadius: 13,
    backgroundColor: "#E6F4F1",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 82,
  },

  logoIconText: {
    color: "#004B49",
    fontSize: 31,
    fontWeight: "400",
    marginTop: -3,
  },

  logoText: {
    fontSize: 29,
    fontWeight: "800",
    color: "#004B49",
    marginTop: 9,
    letterSpacing: -0.7,
  },

  subtitle: {
    fontSize: 13.5,
    color: "#6B7280",
    marginTop: 7,
    textAlign: "center",
  },

  /* ---------------- FORM ---------------- */

  form: {
    width: "100%",
    marginTop: 42,
  },

  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },

  passwordLabel: {
    marginTop: 18,
  },

  inputContainer: {
    height: 42,
    width: "100%",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },

  inputIcon: {
    width: 25,
    marginLeft: 12,
    marginRight: 5,
    fontSize: 19,
    color: "#9CA3AF",
    textAlign: "center",
  },

  input: {
    flex: 1,
    height: "100%",
    fontSize: 14,
    color: "#111827",
    paddingVertical: 0,
  },

  eyeButton: {
    width: 42,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  eye: {
    fontSize: 18,
    color: "#9CA3AF",
  },

  /* ---------------- LOGIN BUTTON ---------------- */

  loginButton: {
    height: 45,
    width: "100%",
    backgroundColor: "#004B49",
    borderRadius: 10,
    marginTop: 18,
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#004B49",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },

  loginButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  /* ---------------- SIGN UP ---------------- */

  signupContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 1,
  },

  signupTextNormal: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
  },

  signupLink: {
    color: "#004B49",
    fontSize: 12,
    fontWeight: "800",
  },

  /* ---------------- SECURITY BADGE ---------------- */

  securityBadge: {
    alignSelf: "center",
    height: 28,
    backgroundColor: "#E6F4F1",
    borderRadius: 7,
    paddingHorizontal: 13,
    marginBottom: 27,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  shield: {
    color: "#004B49",
    fontSize: 16,
    marginRight: 7,
  },

  securityText: {
    color: "#004B49",
    fontSize: 10.5,
    fontWeight: "800",
  },
});