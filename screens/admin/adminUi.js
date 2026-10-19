import React from 'react';
import { Alert, Platform, Text, View } from 'react-native';

export const TIER_META = {
  high: { label: 'High', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  mid: { label: 'Mid', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  low: { label: 'Low', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.15)' },
};

export const TONE_META = {
  good: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  warn: { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  bad: { color: '#DC2626', bg: 'rgba(220, 38, 38, 0.15)' },
  muted: { color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)' },
};

export const SEVERITY_COLOR = { danger: '#DC2626', warning: '#F59E0B', info: '#3B82F6' };

export function Pill({ label, color, bg }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color, fontSize: 11, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}

export function StatCard({ colors, label, value, hint }) {
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted, marginBottom: 4 }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary }}>{value}</Text>
      {hint ? <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{hint}</Text> : null}
    </View>
  );
}

// A thin progress bar. value is 0 to 1.
export function Bar({ colors, value, color }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.primaryLight, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, backgroundColor: color || colors.primary }} />
    </View>
  );
}

// Alert.alert shows nothing on web, so use the browser's confirm there.
export function confirmAction(title, message, onConfirm) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: onConfirm },
  ]);
}
