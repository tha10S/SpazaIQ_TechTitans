import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../config/ThemeContext';
import { diagnose, scoreShop } from '../services/admin/performance';

const TIERS = {
  high: { label: 'High performer', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  mid: { label: 'Mid performer', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  low: { label: 'Needs attention', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.15)' },
};

// Shows a shop owner how their own shop is doing and what to fix first. Only shop-level totals are
// shared with the admin area; individual sales and customer records remain private.
// The score is measured against a typical shop, because a shop can't see other shops.
export default function ShopHealthCard({ stats }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const result = useMemo(() => {
    if (!stats) return null;
    const scored = scoreShop(stats);
    return { ...scored, ...diagnose(scored) };
  }, [stats]);

  if (!result) return null;
  const tier = TIERS[result.tier];
  const todo = result.causes.slice(0, 3);
  const good = result.strengths.slice(0, 2);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.badge, { backgroundColor: tier.bg }]}>
          <Text style={[styles.badgeText, { color: tier.color }]}>{result.score}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Shop health: {tier.label}</Text>
          <Text style={styles.muted}>Based on your last 30 days, out of 100.</Text>
        </View>
      </View>

      {todo.length > 0 ? <Text style={styles.label}>FIX FIRST</Text> : null}
      {todo.map((item) => (
        <View key={item.id} style={styles.item}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.muted}>{item.detail}</Text>
          <Text style={styles.tip}>{item.tip}</Text>
        </View>
      ))}

      {good.length > 0 ? <Text style={styles.label}>WORKING WELL</Text> : null}
      {good.map((item) => (
        <Text key={item.id} style={styles.good}>✓ {item.title}. {item.detail}</Text>
      ))}
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    badge: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontSize: 20, fontWeight: '800' },
    title: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    muted: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
    label: { fontSize: 10, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.8, marginTop: 14, marginBottom: 6 },
    item: { marginBottom: 10 },
    itemTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    tip: { fontSize: 12, color: colors.primary, marginTop: 3, lineHeight: 17 },
    good: { fontSize: 12, color: colors.textMuted, marginBottom: 4, lineHeight: 17 },
  });
