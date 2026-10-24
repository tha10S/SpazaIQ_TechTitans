import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase/firebaseConfig';
import { useTheme } from '../../config/ThemeContext';
import { Pill, SEVERITY_COLOR, StatCard, TIER_META, TONE_META, confirmAction } from './adminUi';
import AdminShopDetail from './AdminShopDetail';
import { deactivateMany, publishShopScores, subscribeShopStats, subscribeSubscriptions } from '../../services/admin/adminRepository';
import { DEFAULT_FEE, formatDay, paymentReminderMessage, subscriptionState, toDate } from '../../services/admin/billing';
import {
  formatRand,
  formatValue,
  medianOf,
  platformInsights,
  platformTotals,
  scoreAll,
  tierComparison,
} from '../../services/admin/performance';
import { openWhatsApp } from '../../services/whatsapp';

const BRAND_GREEN = '#004B49';
const DAY_MS = 24 * 60 * 60 * 1000;
const TABS = ['Overview', 'Shops', 'Billing'];
const SORTS = [
  { id: 'score', label: 'Score' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'activity', label: 'Activity' },
  { id: 'name', label: 'Name' },
];
const BILLING_ORDER = { overdue: 0, deactivated: 1, 'due-soon': 2, none: 3, paid: 4 };

export default function AdminDashboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [shops, setShops] = useState([]);
  const [subs, setSubs] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('Overview');
  const [tierFilter, setTierFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const onError = (err) => {
      setLoading(false);
      setError(
        err?.code === 'permission-denied'
          ? 'Permission denied. Check that this account is in the admins collection and the Firestore rules are deployed.'
          : err?.message || 'Could not load the admin data.'
      );
    };
    const offShops = subscribeShopStats((rows) => {
      setShops(rows);
      setLoading(false);
      setError('');
    }, onError);
    const offSubs = subscribeSubscriptions(setSubs, onError);
    return () => {
      offShops();
      offSubs();
    };
  }, []);

  const now = useMemo(() => new Date(), [shops, subs]);
  const scored = useMemo(
    () => scoreAll(shops, now).map((shop) => ({ ...shop, sub: subs[shop.storeId] || null, state: subscriptionState(subs[shop.storeId], now) })),
    [shops, subs, now]
  );
  // Each shop's finished score is published for that shop to read, so the shop owner sees the same number as here.
  // Only scores that changed are written.
  const publishedScores = useRef({});
  useEffect(() => {
    const changed = scored.filter((shop) => publishedScores.current[shop.storeId] !== `${shop.score}-${shop.tier}`);
    if (!changed.length) return;
    changed.forEach((shop) => {
      publishedScores.current[shop.storeId] = `${shop.score}-${shop.tier}`;
    });
    publishShopScores(changed.map(({ storeId, score, tier }) => ({ storeId, score, tier }))).catch((err) => {
      changed.forEach((shop) => {
        delete publishedScores.current[shop.storeId]; // try again on the next change
      });
      console.warn('Could not publish shop scores', err?.code || err?.message);
    });
  }, [scored]);

  const totals = useMemo(() => platformTotals(scored), [scored]);
  const insights = useMemo(() => platformInsights(scored), [scored]);
  const comparison = useMemo(() => tierComparison(scored), [scored]);
  const medianBasket = useMemo(() => medianOf(scored.map((shop) => shop.d.basket).filter((value) => value > 0)), [scored]);

  const billing = useMemo(() => {
    const count = (key) => scored.filter((shop) => shop.state.key === key).length;
    const payingShops = scored.filter((shop) => shop.sub && shop.state.key !== 'deactivated');
    const recent = scored.filter((shop) => {
      const paidAt = toDate(shop.sub?.lastPaymentAt);
      return paidAt && now - paidAt <= 30 * DAY_MS;
    });
    return {
      paid: count('paid'),
      dueSoon: count('due-soon'),
      overdue: count('overdue'),
      deactivated: count('deactivated'),
      none: count('none'),
      mrr: payingShops.reduce((sum, shop) => sum + Number(shop.sub.monthlyFee || 0), 0),
      paying: payingShops.length,
      collected30d: recent.reduce((sum, shop) => sum + Number(shop.sub.lastPaymentAmount || 0), 0),
    };
  }, [scored, now]);

  const visibleShops = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = scored.filter((shop) => (tierFilter === 'all' || shop.tier === tierFilter)
      && (!term || String(shop.shopName || '').toLowerCase().includes(term)));
    const sorters = {
      score: (a, b) => b.score - a.score,
      revenue: (a, b) => b.revenue30d - a.revenue30d,
      activity: (a, b) => b.activeDays30d - a.activeDays30d,
      name: (a, b) => String(a.shopName).localeCompare(String(b.shopName)),
    };
    return [...list].sort(sorters[sortBy]);
  }, [scored, tierFilter, sortBy, search]);

  const billingRows = useMemo(
    () => [...scored].sort((a, b) => BILLING_ORDER[a.state.key] - BILLING_ORDER[b.state.key]),
    [scored]
  );

  const toDeactivate = scored.filter(
    (shop) => shop.sub && shop.sub.status !== 'deactivated' && (shop.state.key === 'overdue' || shop.state.key === 'deactivated')
  );

  const runBulkDeactivate = () => {
    confirmAction(
      `Deactivate ${toDeactivate.length} ${toDeactivate.length === 1 ? 'shop' : 'shops'}?`,
      'These shops are past their due date. They will not be able to record new sales until they pay.',
      async () => {
        try {
          await deactivateMany(toDeactivate.map((shop) => ({ storeId: shop.storeId, sub: shop.sub })));
          setNotice(`Deactivated ${toDeactivate.length} ${toDeactivate.length === 1 ? 'shop' : 'shops'}.`);
        } catch (err) {
          setNotice(err?.message || 'Could not deactivate the shops.');
        }
      }
    );
  };

  const remind = async (shop) => {
    const result = await openWhatsApp(
      shop.contactPhone,
      paymentReminderMessage({ shopName: shop.shopName, fee: shop.sub?.monthlyFee ?? DEFAULT_FEE, dueDate: shop.state.dueDate, accessUntil: shop.state.accessUntil })
    );
    if (!result.ok) setNotice(result.error);
  };

  const selected = scored.find((shop) => shop.storeId === selectedId) || null;

  const goShops = (tier) => {
    setTierFilter(tier);
    setTab('Shops');
  };

  const renderOverview = () => (
    <>
      <View style={styles.grid}>
        <StatCard colors={colors} label="SHOPS" value={String(totals.shops)} hint={`${totals.activeShops} sold something in 30 days`} />
        <StatCard colors={colors} label="MONTHLY RECURRING" value={formatRand(billing.mrr)} hint={`${billing.paying} paying ${billing.paying === 1 ? 'shop' : 'shops'}`} />
        <StatCard colors={colors} label="SHOP REVENUE (30 DAYS)" value={formatRand(totals.revenue30d)} hint={`${totals.sales30d} sales, ${totals.items30d} items`} />
        <StatCard colors={colors} label="AVERAGE SCORE" value={String(totals.avgScore)} hint="out of 100" />
      </View>

      <Text style={styles.section}>PERFORMANCE</Text>
      <View style={styles.tierRow}>
        {['high', 'mid', 'low'].map((tier) => (
          <Pressable key={tier} style={[styles.tierCard, { borderColor: TIER_META[tier].color }]} onPress={() => goShops(tier)}>
            <Text style={[styles.tierCount, { color: TIER_META[tier].color }]}>{totals[tier]}</Text>
            <Text style={styles.tierLabel}>{TIER_META[tier].label} performers</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>NEEDS ATTENTION</Text>
      {insights.length === 0 ? (
        <View style={styles.card}><Text style={styles.muted}>Nothing urgent. Every shop is paid up and trading.</Text></View>
      ) : (
        insights.map((item) => (
          <View key={item.id} style={styles.insight}>
            <View style={[styles.dot, { backgroundColor: SEVERITY_COLOR[item.severity] }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.insightTitle}>{item.title}</Text>
              <Text style={styles.muted}>{item.detail}</Text>
            </View>
          </View>
        ))
      )}

      <Text style={styles.section}>WHAT SEPARATES THE BEST SHOPS</Text>
      {comparison.rows.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>This appears once at least one shop is a high performer and another is mid or low.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.compareHead}>
            <Text style={[styles.compareCol, { flex: 1.6 }]}> </Text>
            <Text style={[styles.compareCol, { color: TIER_META.high.color }]}>High</Text>
            <Text style={[styles.compareCol, { color: comparison.againstLabel === 'Low' ? TIER_META.low.color : TIER_META.mid.color }]}>{comparison.againstLabel}</Text>
          </View>
          {comparison.rows.map((row) => (
            <View key={row.key} style={styles.compareRow}>
              <Text style={[styles.compareLabel, { flex: 1.6 }]}>{row.label}</Text>
              <Text style={styles.compareValue}>{formatValue(row.kind, row.high)}</Text>
              <Text style={styles.compareValue}>{formatValue(row.kind, row.other)}</Text>
            </View>
          ))}
          <Text style={[styles.muted, { marginTop: 8 }]}>Averages across each group. The biggest gaps are listed first, so they show what to coach the weaker shops on.</Text>
        </View>
      )}
    </>
  );

  const renderShops = () => (
    <>
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search shops"
        placeholderTextColor={colors.textMuted}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {['all', 'high', 'mid', 'low'].map((tier) => (
          <Pressable key={tier} onPress={() => setTierFilter(tier)} style={[styles.chip, tierFilter === tier && styles.chipActive]}>
            <Text style={[styles.chipText, tierFilter === tier && styles.chipTextActive]}>{tier === 'all' ? 'All' : TIER_META[tier].label}</Text>
          </Pressable>
        ))}
        <View style={{ width: 14 }} />
        {SORTS.map((sort) => (
          <Pressable key={sort.id} onPress={() => setSortBy(sort.id)} style={[styles.chip, sortBy === sort.id && styles.chipActive]}>
            <Text style={[styles.chipText, sortBy === sort.id && styles.chipTextActive]}>{sort.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {visibleShops.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>
            {scored.length === 0
              ? 'No shops yet. A shop appears here after it opens the updated app once.'
              : 'No shops match this filter.'}
          </Text>
        </View>
      ) : (
        visibleShops.map((shop) => {
          const tier = TIER_META[shop.tier];
          const tone = TONE_META[shop.state.tone];
          return (
            <Pressable key={shop.storeId} style={styles.shopCard} onPress={() => setSelectedId(shop.storeId)}>
              <View style={[styles.scoreBadge, { backgroundColor: tier.bg }]}>
                <Text style={[styles.scoreText, { color: tier.color }]}>{shop.score}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName} numberOfLines={1}>{shop.shopName || 'Shop'}</Text>
                <Text style={styles.muted}>{formatRand(shop.revenue30d)} · {shop.activeDays30d ?? 0} trading days</Text>
              </View>
              <Pill label={shop.state.label} color={tone.color} bg={tone.bg} />
            </Pressable>
          );
        })
      )}
    </>
  );

  const renderBilling = () => (
    <>
      <View style={styles.grid}>
        <StatCard colors={colors} label="PAID" value={String(billing.paid)} />
        <StatCard colors={colors} label="DUE SOON" value={String(billing.dueSoon)} />
        <StatCard colors={colors} label="OVERDUE" value={String(billing.overdue)} hint="past the 28th" />
        <StatCard colors={colors} label="DEACTIVATED" value={String(billing.deactivated)} />
        <StatCard colors={colors} label="PAYMENTS (30 DAYS)" value={formatRand(billing.collected30d)} />
        <StatCard colors={colors} label="NO SUBSCRIPTION" value={String(billing.none)} />
      </View>

      <Text style={styles.rule}>
        The fee is due on the 28th. A shop that has not paid by the 1st is cut off automatically by the security rules.
        You can also deactivate early.
      </Text>

      {toDeactivate.length > 0 ? (
        <Pressable style={styles.dangerBtn} onPress={runBulkDeactivate}>
          <Text style={styles.dangerBtnText}>Deactivate {toDeactivate.length} overdue {toDeactivate.length === 1 ? 'shop' : 'shops'} now</Text>
        </Pressable>
      ) : null}

      <Text style={styles.section}>ACCOUNTS</Text>
      {billingRows.length === 0 ? (
        <View style={styles.card}><Text style={styles.muted}>No shops yet.</Text></View>
      ) : (
        billingRows.map((shop) => {
          const tone = TONE_META[shop.state.tone];
          const chase = shop.state.key === 'overdue' || shop.state.key === 'due-soon' || shop.state.key === 'deactivated';
          return (
            <Pressable key={shop.storeId} style={styles.billRow} onPress={() => setSelectedId(shop.storeId)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName} numberOfLines={1}>{shop.shopName || 'Shop'}</Text>
                <Text style={styles.muted}>
                  {shop.sub ? `R${shop.sub.monthlyFee}/month · due ${formatDay(shop.state.dueDate)} · cut-off ${formatDay(shop.state.accessUntil)}` : 'No subscription set up yet'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Pill label={shop.state.label} color={tone.color} bg={tone.bg} />
                {chase && shop.contactPhone ? (
                  <Pressable onPress={() => remind(shop)} hitSlop={8}>
                    <Text style={styles.link}>WhatsApp</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin</Text>
          <Text style={styles.muted}>SpazaIQ platform</Text>
        </View>
        <Pressable onPress={() => signOut(auth)} style={styles.signOut}>
          <Ionicons name="log-out-outline" size={18} color={colors.primary} />
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map((name) => (
          <Pressable key={name} onPress={() => setTab(name)} style={[styles.tab, tab === name && styles.tabActive]}>
            <Text style={[styles.tabText, tab === name && styles.tabTextActive]}>{name}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? (
          <Pressable onPress={() => setNotice('')}><Text style={styles.notice}>{notice}</Text></Pressable>
        ) : null}
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> : null}
        {!loading && tab === 'Overview' ? renderOverview() : null}
        {!loading && tab === 'Shops' ? renderShops() : null}
        {!loading && tab === 'Billing' ? renderBilling() : null}
      </ScrollView>

      {selected ? (
        <AdminShopDetail
          shop={selected}
          colors={colors}
          adminUid={auth.currentUser?.uid}
          medianBasket={medianBasket}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
    title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
    signOut: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    tabs: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: colors.card, borderRadius: 24, padding: 4, borderWidth: 1, borderColor: colors.border },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center' },
    tabActive: { backgroundColor: BRAND_GREEN },
    tabText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
    tabTextActive: { color: '#FFFFFF' },
    content: { padding: 20, paddingBottom: 48 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    section: { fontSize: 11, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.8, marginTop: 22, marginBottom: 8 },
    muted: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
    card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
    tierRow: { flexDirection: 'row', gap: 10 },
    tierCard: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 12, borderWidth: 1.5, alignItems: 'center' },
    tierCount: { fontSize: 26, fontWeight: '800' },
    tierLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', marginTop: 2 },
    insight: { flexDirection: 'row', gap: 10, backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
    insightTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
    dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
    compareHead: { flexDirection: 'row', marginBottom: 6 },
    compareCol: { flex: 1, fontSize: 12, fontWeight: '800', textAlign: 'right' },
    compareRow: { flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
    compareLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
    compareValue: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '800', textAlign: 'right' },
    search: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14, fontSize: 14, color: colors.textPrimary, marginBottom: 10 },
    chip: { paddingHorizontal: 14, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    chipActive: { backgroundColor: BRAND_GREEN, borderColor: BRAND_GREEN },
    chipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    chipTextActive: { color: '#FFFFFF' },
    shopCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
    scoreBadge: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    scoreText: { fontSize: 17, fontWeight: '800' },
    shopName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    billRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
    rule: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: 14 },
    dangerBtn: { height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
    dangerBtnText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
    link: { color: colors.primary, fontSize: 13, fontWeight: '700' },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600', marginBottom: 12, lineHeight: 18 },
    notice: { color: colors.primary, fontSize: 13, fontWeight: '600', marginBottom: 12 },
  });