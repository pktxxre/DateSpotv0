import { useCallback, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable,
  TextInput, Image,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getVisitsFiltered, Visit, ACTIVITY_TYPES, ActivityType,
  Price, PRICE_LABELS, formatRating,
} from '@/lib/visits';

const C = {
  bg: '#FCF9F2',
  primary: '#4B3621',
  accent: '#E76F51',
  green: '#2D6A4F',
  muted: '#8B7762',
  card: '#FFFFFF',
  border: '#EDE8E0',
  placeholder: '#E0D8CE',
};

function ratingColor(r: number): string {
  if (r >= 7) return C.green;
  if (r >= 4) return C.accent;
  return '#C0392B';
}

const CATEGORY_FILTERS: { value: ActivityType | null; label: string }[] = [
  { value: null, label: 'All' },
  ...ACTIVITY_TYPES.map(a => ({ value: a.value, label: `${a.emoji} ${a.label}` })),
];

export default function HomeScreen() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ActivityType | null>(null);

  useFocusEffect(
    useCallback(() => {
      setVisits(getVisitsFiltered({ query, activityType: activeCategory }));
    }, [query, activeCategory])
  );

  const handleQuery = (text: string) => {
    setQuery(text);
    setVisits(getVisitsFiltered({ query: text, activityType: activeCategory }));
  };

  const handleCategory = (cat: ActivityType | null) => {
    setActiveCategory(cat);
    setVisits(getVisitsFiltered({ query, activityType: cat }));
  };

  const isFiltering = query.length > 0 || activeCategory !== null;
  const topPicks = visits.filter(v => v.rating >= 7);
  const tryAgain = visits.filter(v => v.rating >= 4 && v.rating < 7);
  const ranked = [...visits].sort((a, b) => b.rank_order - a.rank_order);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DateSpot</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Find your next spot..."
            placeholderTextColor={C.muted}
            value={query}
            onChangeText={handleQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {CATEGORY_FILTERS.map(cat => {
          const active = activeCategory === cat.value;
          return (
            <Pressable
              key={cat.value ?? 'all'}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => handleCategory(cat.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Content */}
      {visits.length === 0 ? (
        <View style={styles.emptyState}>
          {isFiltering ? (
            <>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptyBody}>Try a different search or category.</Text>
            </>
          ) : (
            <>
              <Text style={styles.emptyEmoji}>🗺</Text>
              <Text style={styles.emptyTitle}>No spots yet</Text>
              <Text style={styles.emptyBody}>Log your first date spot and it'll show up here.</Text>
              <Pressable style={styles.logCta} onPress={() => router.push('/(tabs)/map')}>
                <Text style={styles.logCtaText}>Log a spot</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {isFiltering ? (
            <View style={styles.section}>
              <Text style={styles.sectionMeta}>{visits.length} spot{visits.length !== 1 ? 's' : ''}</Text>
              {ranked.map((v, i) => <RankedRow key={v.id} visit={v} rank={i + 1} />)}
            </View>
          ) : (
            <>
              {topPicks.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Your picks</Text>
                  {topPicks.map(v => <PickCard key={v.id} visit={v} />)}
                </View>
              )}
              {tryAgain.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Try again</Text>
                  {tryAgain.map(v => <TryCard key={v.id} visit={v} />)}
                </View>
              )}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>All your spots</Text>
                {ranked.map((v, i) => <RankedRow key={v.id} visit={v} rank={i + 1} />)}
              </View>
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PickCard({ visit }: { visit: Visit }) {
  const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
  const photo = visit.photos?.[0];
  const color = ratingColor(visit.rating);
  return (
    <Pressable
      style={({ pressed }) => [styles.pickCard, pressed && { opacity: 0.85 }]}
      onPress={() => router.push(`/spot/${visit.id}`)}
    >
      <View style={styles.pickPhoto}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: C.placeholder }]} />
        )}
        <View style={[styles.ratingPill, { backgroundColor: color }]}>
          <Text style={styles.ratingPillText}>{formatRating(visit.rating)}</Text>
        </View>
      </View>
      <View style={styles.pickInfo}>
        <Text style={styles.pickName} numberOfLines={1}>{visit.venue_name}</Text>
        <Text style={styles.pickMeta}>{info?.label} · {PRICE_LABELS[visit.price as Price]}</Text>
      </View>
    </Pressable>
  );
}

function TryCard({ visit }: { visit: Visit }) {
  const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
  const photo = visit.photos?.[0];
  const color = ratingColor(visit.rating);
  return (
    <Pressable
      style={({ pressed }) => [styles.tryCard, pressed && { opacity: 0.85 }]}
      onPress={() => router.push(`/spot/${visit.id}`)}
    >
      <View style={styles.tryThumb}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: C.placeholder }]} />
        )}
      </View>
      <View style={styles.tryInfo}>
        <Text style={styles.tryName} numberOfLines={1}>{visit.venue_name}</Text>
        <Text style={styles.tryMeta}>{info?.label} · {PRICE_LABELS[visit.price as Price]}</Text>
      </View>
      <View style={[styles.tryRating, { backgroundColor: color + '22' }]}>
        <Text style={[styles.tryRatingText, { color }]}>{formatRating(visit.rating)}</Text>
      </View>
    </Pressable>
  );
}

function RankedRow({ visit, rank }: { visit: Visit; rank: number }) {
  const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
  const color = ratingColor(visit.rating);
  return (
    <Pressable
      style={({ pressed }) => [styles.rankedRow, pressed && { opacity: 0.65 }]}
      onPress={() => router.push(`/spot/${visit.id}`)}
    >
      <Text style={styles.rankNum}>{rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rankName} numberOfLines={1}>{visit.venue_name}</Text>
        <Text style={styles.rankMeta}>{info?.label} · {PRICE_LABELS[visit.price as Price]}</Text>
      </View>
      <Text style={[styles.rankScore, { color }]}>{formatRating(visit.rating)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },

  header: {
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 20, fontWeight: '700', color: C.primary,
    fontFamily: 'Georgia', letterSpacing: -0.2,
  },

  searchRow: { paddingHorizontal: 16, paddingBottom: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EDE8E0', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 15, color: C.primary },

  chipsScroll: { flexGrow: 0 },
  chipsContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 14 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: C.bg,
    borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: C.muted },
  chipTextActive: { color: '#fff' },

  section: { paddingHorizontal: 16, marginBottom: 4 },
  sectionTitle: {
    fontSize: 20, fontWeight: '700', color: C.primary,
    fontFamily: 'Georgia', marginBottom: 14,
  },
  sectionMeta: { fontSize: 13, color: C.muted, marginBottom: 10 },

  pickCard: {
    backgroundColor: C.card, borderRadius: 16, overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  pickPhoto: { height: 170, backgroundColor: C.placeholder },
  ratingPill: {
    position: 'absolute', top: 10, right: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  ratingPillText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  pickInfo: { padding: 14 },
  pickName: { fontSize: 16, fontWeight: '700', color: C.primary, marginBottom: 4 },
  pickMeta: { fontSize: 13, color: C.muted },

  tryCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 16,
    padding: 12, gap: 12, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  tryThumb: {
    width: 70, height: 70, borderRadius: 12,
    backgroundColor: C.placeholder, overflow: 'hidden',
  },
  tryInfo: { flex: 1 },
  tryName: { fontSize: 15, fontWeight: '600', color: C.primary, marginBottom: 4 },
  tryMeta: { fontSize: 13, color: C.muted },
  tryRating: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  tryRatingText: { fontSize: 13, fontWeight: '700' },

  rankedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  rankNum: { fontSize: 14, fontWeight: '600', color: C.border, width: 20, textAlign: 'center' },
  rankName: { fontSize: 15, fontWeight: '600', color: C.primary },
  rankMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  rankScore: { fontSize: 16, fontWeight: '700' },

  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingTop: 60,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.primary, marginBottom: 8 },
  emptyBody: { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  logCta: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  logCtaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
