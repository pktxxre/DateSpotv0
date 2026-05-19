import { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable,
  FlatList, useWindowDimensions,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { getSeedSpotsRaw, SeedSpot } from '@/lib/seeds';
import { PRICE_LABELS, ratingColor, formatRating, Price } from '@/lib/visits';
import { T } from '@/lib/theme';

type PriceFilter = 0 | 1 | 2 | 3 | null;

const SK_BASE = '#E8DDD0';
const SK_LIGHT = '#F6F1E8';

function SkBox({
  shimmer,
  w,
  h,
  r = 4,
  style,
  screenW,
}: {
  shimmer: ReturnType<typeof useAnimatedStyle>;
  w: number | `${number}%`;
  h: number;
  r?: number;
  style?: object;
  screenW: number;
}) {
  return (
    <View style={[{ width: w, height: h, backgroundColor: SK_BASE, overflow: 'hidden', borderRadius: r }, style]}>
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, bottom: 0, width: screenW * 0.45, backgroundColor: SK_LIGHT, opacity: 0.85 },
          shimmer,
        ]}
      />
    </View>
  );
}

function SpotsSkeleton() {
  const { width: screenW } = useWindowDimensions();
  const offset = useSharedValue(-screenW);

  useEffect(() => {
    offset.value = withRepeat(
      withTiming(screenW, { duration: 1100, easing: Easing.linear }),
      -1,
      false,
    );
  }, [screenW]);

  const shimmer = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const sk = (w: number | `${number}%`, h: number, r?: number, style?: object) => (
    <SkBox shimmer={shimmer} w={w} h={h} r={r} style={style} screenW={screenW} />
  );

  const ROWS = 12;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Category chips */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 12, gap: 8 }}>
        {[68, 54, 88, 78, 106, 56].map((w, i) => (
          <SkBox key={i} shimmer={shimmer} w={w} h={32} r={20} screenW={screenW} />
        ))}
      </View>

      {/* Price filter */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 12, gap: 10, marginBottom: 8 }}>
        {sk(38, 10, 2)}
        {[38, 28, 34, 46].map((w, i) => (
          <SkBox key={i} shimmer={shimmer} w={w} h={32} r={20} screenW={screenW} />
        ))}
      </View>

      {/* Spot rows */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        {Array.from({ length: ROWS }).map((_, i) => (
          <View key={i}>
            {i > 0 && (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginLeft: 44 }} />
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13 }}>
              {sk(4, 36, 2, { marginRight: 10 })}
              {sk(22, 13, 3, { marginRight: 10 })}
              <View style={{ flex: 1, marginRight: 10, gap: 5 }}>
                {sk('70%', 15, 3)}
                {sk('48%', 12, 3)}
              </View>
              {sk(42, 26, 10)}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const SEED_VENUE_TYPES = [
  { value: 'food',          label: 'Food' },
  { value: 'bars',          label: 'Bars' },
  { value: 'cafes',         label: 'Cafes' },
  { value: 'outdoors',      label: 'Outdoors' },
  { value: 'indoors',       label: 'Indoors' },
  { value: 'view',          label: 'Scenic' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'shopping',      label: 'Shopping' },
  { value: 'other',         label: 'Other' },
];

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food', bars: 'Bars', cafes: 'Cafes', outdoors: 'Outdoors',
  indoors: 'Indoors', view: 'Views', entertainment: 'Entertainment',
  shopping: 'Shopping', other: 'Other',
};

const ACTIVITY_COLORS: Record<string, string> = {
  food: '#C4604A',
  bars: '#C49A4A',
  cafes: '#A07850',
  outdoors: '#6A8F6A',
  indoors: '#7A8CAA',
  view: '#6A8FA0',
  entertainment: '#8B7BB0',
  shopping: '#C47890',
  other: '#8B7255',
};

export default function SpotsScreen() {
  const [seeds, setSeeds] = useState<SeedSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>(null);

  useEffect(() => {
    getSeedSpotsRaw().then(data => {
      // Cap at top 50 per category by rating
      const byCategory = new Map<string, SeedSpot[]>();
      for (const spot of data) {
        if (!byCategory.has(spot.activity_type)) byCategory.set(spot.activity_type, []);
        byCategory.get(spot.activity_type)!.push(spot);
      }
      const capped: SeedSpot[] = [];
      for (const spots of byCategory.values()) {
        const sorted = [...spots].sort((a, b) => b.rating - a.rating);
        capped.push(...sorted.slice(0, 50));
      }
      setSeeds(capped);
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
        {!loading && (
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
            {SEED_VENUE_TYPES.map(a => {
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
        )}

        {/* Price filter row */}
        {!loading && (
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
        )}

        {/* Spot list */}
        {loading ? (
          <SpotsSkeleton />
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
              const restMeta = [priceLabel, 'Seattle'].filter(Boolean).join(' · ');

              return (
                <Pressable
                  style={({ pressed }) => [s.spotRow, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push(`/spot/${item.id}` as any)}
                >
                  <View style={[s.accentBar, { backgroundColor: color }]} />
                  <Text style={s.spotRank}>{index + 1}</Text>
                  <View style={s.spotInfo}>
                    <Text style={s.spotName} numberOfLines={1} ellipsizeMode="tail">{item.venue_name}</Text>
                    <Text style={s.spotMeta}>
                      <Text style={{ color: accentColor }}>{catLabel}</Text>
                      {restMeta ? <Text>{' · ' + restMeta}</Text> : null}
                    </Text>
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
    width: 32,
    fontSize: 12,
    fontWeight: '500',
    color: T.muted,
    marginRight: 10,
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

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, color: T.muted },
  emptyLink: { fontSize: 14, color: T.accent, fontWeight: '600' },
});
