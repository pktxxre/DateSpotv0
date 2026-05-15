import { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable,
  ActivityIndicator, FlatList,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getSeedSpots, SeedSpot } from '@/lib/seeds';
import { ACTIVITY_TYPES, PRICE_LABELS, ratingColor, formatRating, Price } from '@/lib/visits';
import { T } from '@/lib/theme';

type PriceFilter = 0 | 1 | 2 | 3 | null;

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food',
  drinks: 'Drinks',
  outdoors: 'Outdoors',
  view: 'Views',
  entertainment: 'Entertainment',
  other: 'Other',
};

const ACTIVITY_COLORS: Record<string, string> = {
  food: '#C4604A',
  drinks: '#C49A4A',
  outdoors: '#6A8F6A',
  view: '#6A8FA0',
  entertainment: '#8B7BB0',
  other: '#8B7255',
};

export default function SpotsScreen() {
  const [seeds, setSeeds] = useState<SeedSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>(null);

  useEffect(() => {
    getSeedSpots().then(data => {
      setSeeds(data);
      setLoading(false);
    });
  }, []);

  const categoryCounts: Record<string, number> = {};
  for (const s of seeds) {
    categoryCounts[s.activity_type] = (categoryCounts[s.activity_type] ?? 0) + 1;
  }

  const filtered = seeds
    .filter(s => {
      if (categoryFilter && s.activity_type !== categoryFilter) return false;
      if (priceFilter !== null && s.price !== priceFilter) return false;
      return true;
    })
    .sort((a, b) => b.rating - a.rating);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Custom header */}
        <View style={s.headerRow}>
          <Pressable
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={T.primary} />
          </Pressable>
          <Text style={s.headerTitle}>All date spots</Text>
          <View style={s.headerSpacer} />
        </View>

        {/* Category filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipScroll}
          contentContainerStyle={s.chipRow}
        >
          <Pressable
            style={[s.chip, categoryFilter === null && s.chipActive]}
            onPress={() => setCategoryFilter(null)}
          >
            <Text style={[s.chipText, categoryFilter === null && s.chipTextActive]}>
              All {seeds.length > 0 ? seeds.length : ''}
            </Text>
          </Pressable>
          {ACTIVITY_TYPES.map(a => {
            const count = categoryCounts[a.value] ?? 0;
            if (count === 0) return null;
            const active = categoryFilter === a.value;
            return (
              <Pressable
                key={a.value}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setCategoryFilter(active ? null : a.value)}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>
                  {CATEGORY_LABELS[a.value] ?? a.label} {count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Price filter row */}
        <View style={s.priceRow}>
          <Text style={s.priceLabel}>PRICE</Text>
          {([1, 2, 3, 0] as Price[]).map(p => {
            const active = priceFilter === p;
            const label = PRICE_LABELS[p];
            return (
              <Pressable
                key={p}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setPriceFilter(active ? null : p as PriceFilter)}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Spot list */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={T.accent} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>No spots match</Text>
            <Pressable onPress={() => { setCategoryFilter(null); setPriceFilter(null); }}>
              <Text style={s.emptyLink}>Clear filters</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.listContent}
            ItemSeparatorComponent={() => <View style={s.separator} />}
            renderItem={({ item, index }) => {
              const color = ratingColor(item.rating);
              const accentColor = ACTIVITY_COLORS[item.activity_type] ?? ACTIVITY_COLORS.other;
              const priceLabel = PRICE_LABELS[item.price as Price] ?? '';
              const catLabel = CATEGORY_LABELS[item.activity_type] ?? item.activity_type;
              const meta = [catLabel, priceLabel, 'Seattle'].filter(Boolean).join(' · ');

              return (
                <Pressable
                  style={({ pressed }) => [s.spotRow, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push(`/spot/${item.id}` as any)}
                >
                  <View style={[s.accentBar, { backgroundColor: accentColor }]} />
                  <Text style={s.spotRank}>{index + 1}</Text>
                  <View style={s.spotInfo}>
                    <Text style={s.spotName}>{item.venue_name}</Text>
                    <Text style={s.spotMeta}>{meta}</Text>
                  </View>
                  <View style={[s.ratingPill, { borderColor: color }]}>
                    <Text style={[s.ratingPillText, { color }]}>{item.rating.toFixed(1)}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: T.bg,
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'InstrumentSerif-Regular',
  },
  headerSpacer: { width: 36 },

  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
  },
  chipActive: { backgroundColor: '#4B3621', borderColor: '#4B3621' },
  chipText: { fontSize: 13, fontWeight: '500', color: T.muted },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 12,
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1.2,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.border,
    marginLeft: 44,
  },

  spotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 10,
    minHeight: 36,
  },
  spotRank: {
    width: 24,
    fontSize: 13,
    fontWeight: '500',
    color: T.muted,
    marginRight: 8,
  },
  spotInfo: { flex: 1, marginRight: 10 },
  spotName: { fontSize: 15, fontWeight: '600', color: T.primary, marginBottom: 2 },
  spotMeta: { fontSize: 12, color: T.muted },

  ratingPill: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'transparent',
  },
  ratingPillText: {
    fontSize: 12,
    fontWeight: '800',
  },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, color: T.muted },
  emptyLink: { fontSize: 14, color: T.accent, fontWeight: '600' },
});
