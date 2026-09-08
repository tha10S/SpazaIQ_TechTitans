import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useTheme } from '../ThemeContext';

export default function PlaceholderScreen() {
  const route = useRoute();
  const { colors, spacing, typography } = useTheme();
  const styles = makeStyles(colors, typography, spacing);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="construct-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>{route.name}</Text>
        <Text style={styles.subtitle}>
          This screen hasn't been built yet. Swap it in from your teammate's work
          when it's ready.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors, typography, spacing) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    title: { ...typography.h1, marginBottom: spacing.sm },
    subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  });
}