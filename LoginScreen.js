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
              placeholderTextColor="#303846"
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
              placeholderTextColor="#202733"
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
    backgroundColor: "#ffffff",
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
    backgroundColor: "#E7F7F1",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 82,
  },

  logoIconText: {
    color: "#00A86B",
    fontSize: 31,
    fontWeight: "400",
    marginTop: -3,
  },

  logoText: {
    fontSize: 29,
    fontWeight: "800",
    color: "#00A86B",
    marginTop: 9,
    letterSpacing: -0.7,
  },

  subtitle: {
    fontSize: 13.5,
    color: "#667085",
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
    fontWeight: "700",
    color: "#202733",
    marginBottom: 8,
  },

  passwordLabel: {
    marginTop: 18,
  },

  inputContainer: {
    height: 42,
    width: "100%",
    borderWidth: 1,
    borderColor: "#D9DEE5",
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
    color: "#9AA4B2",
    textAlign: "center",
  },

  input: {
    flex: 1,
    height: "100%",
    fontSize: 14,
    color: "#202733",
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
    color: "#9AA4B2",
  },

  /* ---------------- LOGIN BUTTON ---------------- */

  loginButton: {
    height: 45,
    width: "100%",
    backgroundColor: "#00A86B",
    borderRadius: 10,
    marginTop: 18,
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#00A86B",
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
    fontWeight: "700",
  },

  /* ---------------- SIGN UP ---------------- */

  signupContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 1,
  },

  signupTextNormal: {
    color: "#667085",
    fontSize: 12,
    fontWeight: "600",
  },

  signupLink: {
    color: "#00A86B",
    fontSize: 12,
    fontWeight: "800",
  },

  /* ---------------- SECURITY BADGE ---------------- */

  securityBadge: {
    alignSelf: "center",
    height: 28,
    backgroundColor: "#E7F7F1",
    borderRadius: 7,
    paddingHorizontal: 13,
    marginBottom: 27,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  shield: {
    color: "#00A86B",
    fontSize: 16,
    marginRight: 7,
  },

  securityText: {
    color: "#00A86B",
    fontSize: 10.5,
    fontWeight: "700",
  },
});