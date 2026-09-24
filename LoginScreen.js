import React, { useState } from "react";
import { View, TextInput, Button, Text } from "react-native";
import { logIn } from "../services/auth/firebaseAuth";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin() {
    try {
      setError("");
      await logIn(email.trim(), password);
      // no navigation needed, App.js handles it
    } catch (e) {
      setError(e.code === "auth/invalid-credential" ? "Wrong email or password" : e.message);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail}
        autoCapitalize="none" keyboardType="email-address" />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword}
        secureTextEntry />
      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
      <Button title="Log in" onPress={handleLogin} />
      <Button title="Create account" onPress={() => navigation.navigate("Signup")} />
    </View>
  );
}