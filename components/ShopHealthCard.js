import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase/firebaseConfig';
import { useTheme } from '../config/ThemeContext';
import { diagnose, scoreShop } from '../services/admin/performance';

const TIERS = {
  high: { label: 'High performer', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' },
  mid: { label: 'Mid performer', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' },
  low: { label: 'Needs attention', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.15)' },
};

// Shows a shop owner how their own shop is doing and what to fix first. `stats` comes from
// buildShopStats(), which is built from the shop's own data, so nothing here is shared with anyone.
// The score itself comes from the SpazaIQ team's dashboard, which can compare this shop with the others. The shop
// only ever receives its own finished number (shopScores/{storeId}), never another shop's figures. Until that
// number has been published, the card shows an estimate worked out on the phone. What to fix first always comes
// from the shop's own live numbers.
export default function ShopHealthCard({ stats, storeId }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [published, setPublished] = useState(null);

  useEffect(() => {
    if (!storeId) return undefined;
    return onSnapshot(
      doc(db, 'shopScores', storeId),
      (snapshot) => setPublished(snapshot.exists() ? snapshot.data() : null),
      (error) => {
        console.warn('Shop score unavailable', error?.code || error?.message);
        setPublished(null);
      }
    );
  }, [storeId]);

  const result = useMemo(() => {
    if (!stats) return null;
    const scored = scoreShop(stats);
    const base = { ...scored, ...diagnose(scored) };
    const usable = published && Number.isFinite(published.score) && TIERS[published.tier];
    return usable ? { ...base, score: published.score, tier: published.tier } : base;
  }, [stats, published]);

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
          <Text style={styles.muted}>
            {published ? 'Out of 100, compared with other shops on SpazaIQ.' : 'Estimate out of 100, based on your last 30 days.'}
          </Text>
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
