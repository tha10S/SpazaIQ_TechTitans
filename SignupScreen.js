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
  ScrollView,
} from "react-native";
import { createLocalAccount } from "./services/auth/localAuth";

export default function SignupScreen({ navigation }) {
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [shopName, setShopName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  const createAccount = async () => {
    if (
      !fullName ||
      !mobile ||
      !email ||
      !shopName ||
      !pin ||
      !confirmPin
    ) {
      Alert.alert("Missing Information", "Please fill in all fields.");
      return;
    }

    if (pin.length !== 4) {
      Alert.alert("Invalid PIN", "PIN must be exactly 4 digits.");
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert("PIN Error", "PINs do not match.");
      return;
    }

    await createLocalAccount({ fullName, mobile, email, shopName, pin });
    navigation.navigate("MainTabs", { userName: fullName, shopName });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>Spaza</Text>

          <View style={styles.iqBox}>
            <Text style={styles.iqText}>IQ</Text>
          </View>
        </View>

        {/* Heading */}
        <Text style={styles.title}>Create Your Account</Text>

        <Text style={styles.subtitle}>
          Join thousands of spaza shop owners managing{"\n"}smart.
        </Text>

        {/* Full Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. Sipho Nkosi"
            placeholderTextColor="#9CA3AF"
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        {/* Mobile Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mobile Number</Text>

          <View style={styles.phoneContainer}>
            <Text style={styles.flag}>🇿🇦</Text>
            <Text style={styles.countryCode}>+27</Text>

            <TextInput
              style={styles.phoneInput}
              placeholder="82 123 4567"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={mobile}
              onChangeText={setMobile}
            />
          </View>
        </View>

        {/* Email */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>

          <TextInput
            style={styles.input}
            placeholder="sipho@example.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* Shop Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Shop Name</Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. Sipho's Quick Spaza"
            placeholderTextColor="#9CA3AF"
            value={shopName}
            onChangeText={setShopName}
          />
        </View>

        {/* PIN */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>PIN</Text>
            <Text style={styles.requirement}>Must be 4 digits</Text>
          </View>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              secureTextEntry={!showPin}
              maxLength={4}
              value={pin}
              onChangeText={setPin}
            />

            <TouchableOpacity onPress={() => setShowPin(!showPin)}>
              <Text style={styles.eye}>
                {showPin ? "◉" : "◉"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.helperText}>
            Create a secure 4-digit PIN for quick app access
          </Text>
        </View>

        {/* Confirm PIN */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Confirm PIN</Text>
            <Text style={styles.requirement}>Must be 4 digits</Text>
          </View>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              secureTextEntry={!showConfirmPin}
              maxLength={4}
              value={confirmPin}
              onChangeText={setConfirmPin}
            />

            <TouchableOpacity
              onPress={() => setShowConfirmPin(!showConfirmPin)}
            >
              <Text style={styles.eye}>◉</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Create Account Button */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={createAccount}
        >
          <Text style={styles.createButtonText}>Create Account</Text>
        </TouchableOpacity>

        {/* Login */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>
            Already have an account?{" "}
          </Text>

          <TouchableOpacity onPress={() => navigation.navigate("Login")}>
            <Text style={styles.loginLink}>Log In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 30,
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
    color: "#ffffff",
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
    marginBottom: 12,
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

  requirement: {
    fontSize: 9,
    color: "#004B49",
    fontWeight: "700",
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

  // Phone
  phoneContainer: {
    height: 43,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },

  flag: {
    fontSize: 17,
    marginRight: 5,
  },

  countryCode: {
    fontSize: 12,
    color: "#111827",
    marginRight: 8,
  },

  phoneInput: {
    flex: 1,
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
    letterSpacing: 3,
  },

  eye: {
    fontSize: 18,
    color: "#6B7280",
  },

  helperText: {
    fontSize: 9,
    color: "#6B7280",
    marginTop: 6,
  },

  // Button
  createButton: {
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

  createButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },

  // Login
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },

  loginText: {
    color: "#6B7280",
    fontSize: 11,
  },

  loginLink: {
    color: "#004B49",
    fontSize: 11,
    fontWeight: "800",
  },
});