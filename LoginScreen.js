import React, { useState } from "react";
import { View, TextInput, Button, Text } from "react-native";
import { getAuthErrorMessage, logIn } from "./services/auth/firebaseAuth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin() {
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
      // no navigation needed, App.js handles it
    } catch (error) {
      setError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword}
        secureTextEntry />
      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
      <Button title={isSubmitting ? "Logging in..." : "Log in"} onPress={handleLogin} disabled={isSubmitting} />
      <Button title="Create account" onPress={() => navigation.navigate("Signup")} disabled={isSubmitting} />
    </View>
  );
}