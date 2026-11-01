// Live platform revenue chart for the Admin Overview.
// No chart library: bars are plain Views, so it works on web and phone and adds no dependency.
// Feed it the SAME shop stats array the admin screen already holds from an onSnapshot listener,
// so the bars move whenever any shop's published stats change.
//
// Shop-level totals only (weekRevenue1..4, optional dailyRevenue14d). No sales or customer data.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

const BRAND = '#004B49';
const BAR_AREA = 120;

const money = (v) => `R ${Math.round(Number(v) || 0).toLocaleString('en-ZA')}`;
// Works whether each shop row is the stats object itself or wraps it as { stats: {...} } / { shopStats: {...} }
const statsOf = (s) => s?.stats || s?.shopStats || s || {};
const sum = (shops, key) => shops.reduce((a, s) => a + (Number(statsOf(s)[key]) || 0), 0);

function Bar({ value, max, label, highlight }) {
  const h = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(h, {
      toValue: max > 0 ? Math.max(4, (value / max) * BAR_AREA) : 4,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [value, max, h]);
  return (
    <View style={styles.barWrap}>
      <Text style={styles.barValue} numberOfLines={1}>{value > 0 ? money(value) : ''}</Text>
      <Animated.View style={[styles.bar, highlight && styles.barLatest, { height: h }]} />
      <Text style={[styles.barLabel, highlight && styles.barLabelLatest]}>{label}</Text>
    </View>
  );
}

export default function LivePulseChart({ shops = [] }) {
  // Pulsing LIVE dot
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 800, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Prefer a real daily series when every shop publishes one; otherwise the four weekly buckets.
  const { bars, delta, title } = useMemo(() => {
    const daily = shops.length > 0 && shops.every((s) => Array.isArray(statsOf(s).dailyRevenue14d));
    if (daily) {
      const days = Array.from({ length: 14 }, (_, i) =>
        shops.reduce((a, s) => a + (Number(statsOf(s).dailyRevenue14d[i]) || 0), 0)
      ); // index 0 = today
      const ordered = [...days].reverse(); // oldest -> today
      const today = days[0];
      const yesterday = days[1];
      return {
        title: 'Platform revenue, last 14 days',
        bars: ordered.map((v, i) => ({ label: i === 13 ? 'Today' : `-${13 - i}`, value: v, latest: i === 13 })),
        delta: yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : null,
      };
    }
    const w = [sum(shops, 'weekRevenue4'), sum(shops, 'weekRevenue3'), sum(shops, 'weekRevenue2'), sum(shops, 'weekRevenue1')];
    return {
      title: 'Platform revenue by week',
      bars: [
        { label: '3 wks ago', value: w[0] },
        { label: '2 wks ago', value: w[1] },
        { label: 'Last wk', value: w[2] },
        { label: 'This wk', value: w[3], latest: true },
      ],
      delta: w[2] > 0 ? ((w[3] - w[2]) / w[2]) * 100 : null,
    };
  }, [shops]);

  const max = Math.max(1, ...bars.map((b) => b.value));
  const total = bars.reduce((a, b) => a + b.value, 0);

  // "Updated" time moves whenever the totals change, which is the live proof for the demo
  const signature = bars.map((b) => Math.round(b.value)).join('|');
  const [updatedAt, setUpdatedAt] = useState(new Date());
  useEffect(() => { setUpdatedAt(new Date()); }, [signature]);

  const up = delta !== null && delta >= 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.total}>{money(total)}</Text>
        </View>
        <View style={styles.liveBadge}>
          <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        {delta !== null ? (
          <Text style={[styles.delta, { color: up ? '#059669' : '#DC2626' }]}>
            {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% vs previous period
          </Text>
        ) : (
          <Text style={styles.metaMuted}>Not enough history yet</Text>
        )}
        <Text style={styles.metaMuted}>Updated {updatedAt.toLocaleTimeString('en-ZA')}</Text>
      </View>

      <View style={styles.chartRow}>
        {bars.map((b) => (
          <Bar key={b.label} value={b.value} max={max} label={b.label} highlight={b.latest} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: 12, fontWeight: '700', color: '#6B7280', letterSpacing: 0.4, textTransform: 'uppercase' },
  total: { fontSize: 28, fontWeight: '800', color: '#111827', marginTop: 2 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 6 },
  liveText: { fontSize: 11, fontWeight: '800', color: '#059669' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 14 },
  delta: { fontSize: 12, fontWeight: '700' },
  metaMuted: { fontSize: 12, color: '#9CA3AF' },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: BAR_AREA + 44 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', maxWidth: 40, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#A7C4C2' },
  barLatest: { backgroundColor: BRAND },
  barValue: { fontSize: 9, color: '#6B7280', marginBottom: 3 },
  barLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 5 },
  barLabelLatest: { color: BRAND, fontWeight: '800' },
});