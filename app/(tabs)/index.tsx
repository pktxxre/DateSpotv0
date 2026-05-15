import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable,
  ActivityIndicator, Dimensions, TextInput, FlatList,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAllVisits, Visit, ACTIVITY_TYPES, PRICE_LABELS, Price, formatRating, ratingColor, friendlyDate } from '@/lib/visits';
import { getSeedSpots, SeedSpot } from '@/lib/seeds';
import { getAllStacks, StackSummary } from '@/lib/stacks';
import { getProfile } from '@/lib/profile';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { T } from '@/lib/theme';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = SCREEN_W - 40;
const MONTHLY_GOAL = 6;

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


type PriceFilter = 0 | 1 | 2 | 3 | null;

function getMonthVisits(visits: Visit[]): Visit[] {
  const now = new Date();
  return visits.filter(v => {
    const d = new Date(v.visited_at || v.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

function formatMonth(): string {
  return new Date().toLocaleString('default', { month: 'long' }).toUpperCase();
}

export default function HomeScreen() {
  const [seeds, setSeeds] = useState<SeedSpot[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [stacks, setStacks] = useState<StackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');

  useFocusEffect(
    useCallback(() => {
      setVisits(getAllVisits().filter(v => !(v as any).is_seed));
      setStacks(getAllStacks());
      getProfile().then(p => setCity(p.city || ''));
    }, [])
  );

  useEffect(() => {
    getSeedSpots().then(data => {
      setSeeds(data);
      setLoading(false);
    });
  }, []);

  const monthVisits = getMonthVisits(visits);
  const recentVisits = [...visits].sort((a, b) => {
    const ta = new Date(a.visited_at || a.created_at).getTime();
    const tb = new Date(b.visited_at || b.created_at).getTime();
    return tb - ta;
  }).slice(0, 5);

  // Build category cards: each ACTIVITY_TYPE that has >= 1 spot, top 5 by rating
  const categoryCards = ACTIVITY_TYPES.map(a => {
    const spots = seeds
      .filter(s => s.activity_type === a.value)
      .sort((x, y) => y.rating - x.rating)
      .slice(0, 5);
    return { category: a, spots };
  }).filter(({ spots }) => spots.length > 0);

  // Search results
  const searchResults = search.trim()
    ? seeds.filter(s => {
        const q = search.trim().toLowerCase();
        return (
          s.venue_name.toLowerCase().includes(q) ||
          (s.notes?.toLowerCase().includes(q) ?? false)
        );
      }).sort((a, b) => b.rating - a.rating)
    : [];

  const isSearching = search.trim().length > 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          {city ? (
            <View style={s.cityRow}>
              <Ionicons name="locate-outline" size={11} color={T.muted} />
              <Text style={s.city}>{city.toUpperCase()}</Text>
            </View>
          ) : null}
          <Text style={s.title}>Discover</Text>
        </View>
        <ProfileAvatar onPress={() => router.push('/(tabs)/profile')} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Search bar */}
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={16} color={T.muted} style={s.searchIcon} />
          <TextInput
            style={s.searchInput}
            placeholder="Search spots, neighborhoods..."
            placeholderTextColor={T.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {/* Monthly goal card */}
        <View style={s.goalCard}>
          <View style={s.goalCardTop}>
            <Text style={s.goalLabel}>YOUR {formatMonth()}</Text>
            <Text style={s.goalCount}>{monthVisits.length} of {MONTHLY_GOAL} logged</Text>
          </View>
          <View style={s.goalPills}>
            {Array.from({ length: MONTHLY_GOAL }).map((_, i) => (
              <View
                key={i}
                style={[s.goalPill, i < monthVisits.length ? s.goalPillFilled : s.goalPillEmpty]}
              />
            ))}
          </View>
          <Text style={s.goalFooter}>
            {monthVisits.length < MONTHLY_GOAL
              ? `${MONTHLY_GOAL - monthVisits.length} more date${MONTHLY_GOAL - monthVisits.length === 1 ? '' : 's'} to hit your monthly goal.`
              : 'You hit your monthly goal!'}
          </Text>
        </View>

        {/* Your Stacks — only shown when stacks exist */}
        {stacks.length > 0 && (
          <View style={s.stacksSection}>
            <View style={s.stacksSectionHeader}>
              <Text style={s.stacksSectionTitle}>Your stacks</Text>
              <Pressable onPress={() => router.push('/(tabs)/lists')}>
                <Text style={s.seeAll}>See all →</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.stacksScroll}
            >
              {stacks.map(stack => (
                <HomeStackCard key={stack.id} stack={stack} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Top date spots header */}
        <View style={s.sectionHeaderRow}>
          <View>
            <Text style={s.sectionTitle}>Top date spots</Text>
            <Text style={s.sectionSubtitle}>Your next date spot is waiting</Text>
          </View>
          <Pressable onPress={() => router.push('/spots' as any)}>
            <Text style={s.seeAll}>See all →</Text>
          </Pressable>
        </View>

        {/* Search results OR category cards */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={T.accent} />
          </View>
        ) : isSearching ? (
          <View style={s.searchResultsList}>
            {searchResults.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyText}>No spots match</Text>
                <Pressable onPress={() => setSearch('')}>
                  <Text style={s.emptyLink}>Clear search</Text>
                </Pressable>
              </View>
            ) : (
              searchResults.map(spot => (
                <SearchResultRow key={spot.id} spot={spot} />
              ))
            )}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W + 12}
            decelerationRate="fast"
            contentContainerStyle={s.cardsScroll}
          >
            {categoryCards.map(({ category, spots }) => (
              <CategoryCard
                key={category.value}
                category={category}
                spots={spots}
                cardW={CARD_W}
              />
            ))}
          </ScrollView>
        )}

        {/* Recent dates section */}
        <View style={s.recentSection}>
          <View style={s.recentHeader}>
            <Text style={s.recentTitle}>Recent dates</Text>
            {recentVisits.length > 0 && (
              <Pressable onPress={() => router.push('/(tabs)/lists')}>
                <Text style={s.seeAll}>See all →</Text>
              </Pressable>
            )}
          </View>
          {recentVisits.length === 0 ? (
            <View style={s.emptyDates}>
              <View style={s.emptyDatesRow}>
                <Text style={s.emptyDatesText}>Tap </Text>
                <View style={s.plusCircle}><Text style={s.plusCircleText}>+</Text></View>
                <Text style={s.emptyDatesText}> to log your first date spot</Text>
              </View>
            </View>
          ) : (
            recentVisits.map(v => <RecentRow key={v.id} visit={v} />)
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeStackCard({ stack }: { stack: StackSummary }) {
  const color = ratingColor(stack.rating);
  const dateStr = friendlyDate(stack.created_at);
  return (
    <Pressable
      style={({ pressed }) => [s.stackCard, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/stack/${stack.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${stack.name}, ${dateStr}, ${stack.spot_count} spots`}
    >
      <View style={s.stackCardTop}>
        <Text style={s.stackCardName} numberOfLines={1}>{stack.name}</Text>
        <View style={s.stackSpotBadge}>
          <Text style={s.stackSpotBadgeText}>{stack.spot_count}</Text>
        </View>
      </View>
      <Text style={s.stackCardDate}>{dateStr}</Text>
      {stack.first_spot && stack.last_spot && stack.first_spot !== stack.last_spot && (
        <Text style={s.stackJourney} numberOfLines={1}>
          {stack.first_spot} → {stack.last_spot}
        </Text>
      )}
      {stack.rating > 0 && (
        <View style={[s.stackQuality, { backgroundColor: color }]}>
          <Text style={s.stackQualityText}>{formatRating(stack.rating)}</Text>
        </View>
      )}
    </Pressable>
  );
}

function CategoryCard({ category, spots, cardW }: {
  category: { value: string; label: string };
  spots: SeedSpot[];
  cardW: number;
}) {
  const bgColor = ACTIVITY_COLORS[category.value] ?? ACTIVITY_COLORS.other;
  return (
    <View style={[s.categoryCard, { width: cardW }]}>
      {/* Hero */}
      <View style={[s.categoryHero, { backgroundColor: bgColor }]}>
        <View style={s.categoryHeroInner}>
          <View style={s.categoryHeroContent}>
            <Text style={s.categoryHeroName}>{category.label}</Text>
            <Text style={s.categoryHeroSub}>Top {spots.length} in your area</Text>
          </View>
        </View>
      </View>
      {/* Spot rows */}
      {spots.map((spot, idx) => {
        const color = ratingColor(spot.rating);
        const priceLabel = PRICE_LABELS[spot.price as Price] ?? '';
        return (
          <View key={spot.id}>
            <Pressable
              style={({ pressed }) => [s.spotRow, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(`/spot/${spot.id}` as any)}
            >
              <Text style={s.spotRank}>{idx + 1}</Text>
              <View style={s.spotInfo}>
                <Text style={s.spotName}>{spot.venue_name}</Text>
                {priceLabel ? <Text style={s.spotPrice}>{priceLabel}</Text> : null}
              </View>
              <View style={[s.ratingPill, { borderColor: color }]}>
                <Text style={[s.ratingPillText, { color }]}>{spot.rating.toFixed(1)}</Text>
              </View>
            </Pressable>
            {idx < spots.length - 1 && <View style={s.rowDivider} />}
          </View>
        );
      })}
    </View>
  );
}

function SearchResultRow({ spot }: { spot: SeedSpot }) {
  const color = ratingColor(spot.rating);
  const priceLabel = PRICE_LABELS[spot.price as Price] ?? '';
  const catLabel = CATEGORY_LABELS[spot.activity_type] ?? spot.activity_type;
  const meta = [catLabel, priceLabel].filter(Boolean).join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [s.searchResultRow, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/spot/${spot.id}` as any)}
    >
      <View style={s.searchResultInfo}>
        <Text style={s.spotName}>{spot.venue_name}</Text>
        <Text style={s.spotMeta}>{meta}</Text>
      </View>
      <View style={[s.ratingPill, { borderColor: color }]}>
        <Text style={[s.ratingPillText, { color }]}>{spot.rating.toFixed(1)}</Text>
      </View>
    </Pressable>
  );
}

function RecentRow({ visit }: { visit: Visit }) {
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);
  const color = ratingColor(visit.rating);
  const catLabel = CATEGORY_LABELS[visit.activity_type] ?? visit.activity_type;
  const priceLabel = PRICE_LABELS[visit.price as Price] ?? '';
  return (
    <Pressable
      style={({ pressed }) => [s.recentRow, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/spot/${visit.id}`)}
    >
      <View style={[s.recentAccent, { backgroundColor: color }]} />
      <View style={s.recentRowLeft}>
        <Text style={s.recentName}>{visit.venue_name}</Text>
        <Text style={s.recentMeta}>
          {[catLabel, priceLabel, dateStr].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {visit.rating > 0 && (
        <View style={[s.recentScore, { borderColor: color }]}>
          <Text style={[s.recentScoreText, { color }]}>{formatRating(visit.rating)}</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 20 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: T.bg,
  },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  city: {
    fontSize: 11,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'InstrumentSerif-Regular',
    lineHeight: 36,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.inputBg,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: T.primary,
  },

  goalCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: T.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  goalCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1.2,
  },
  goalCount: {
    fontSize: 12,
    fontWeight: '600',
    color: T.primary,
  },
  goalPills: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  goalPill: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  goalPillFilled: { backgroundColor: '#E76F51' },
  goalPillEmpty: { backgroundColor: '#EDE8E0' },
  goalFooter: {
    fontSize: 12,
    color: T.muted,
    lineHeight: 17,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'InstrumentSerif-Regular',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: T.muted,
  },
  seeAll: { fontSize: 13, color: T.accent, fontWeight: '600' },

  cardsScroll: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 12,
    paddingBottom: 8,
    paddingTop: 4,
  },

  // Category card
  categoryCard: {
    borderRadius: 16, overflow: 'hidden', backgroundColor: T.card,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10, shadowRadius: 10,
  },
  categoryHero: {
    height: 130, justifyContent: 'flex-end',
  },
  categoryHeroInner: {
    flex: 1, padding: 16, justifyContent: 'flex-end',
  },
  categoryHeroContent: {},
  categoryHeroName: {
    fontSize: 21, fontWeight: '700', color: '#fff', fontFamily: 'InstrumentSerif-Regular', marginBottom: 2,
  },
  categoryHeroSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  // Spot row inside category card
  spotRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  spotRank: { width: 24, fontSize: 13, fontWeight: '500', color: T.muted, marginRight: 8 },
  spotInfo: { flex: 1, marginRight: 10 },
  spotName: { fontSize: 14, fontWeight: '600', color: T.primary },
  spotPrice: { fontSize: 12, color: T.muted, marginTop: 1 },
  spotMeta: { fontSize: 12, color: T.muted },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginLeft: 46 },

  // Rating pill
  ratingPill: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: 'transparent' },
  ratingPillText: {
    fontSize: 12,
    fontWeight: '800',
  },

  // Search results
  searchResultsList: {
    marginHorizontal: 16,
    backgroundColor: T.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  searchResultInfo: { flex: 1, marginRight: 10 },

  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 16, color: T.muted },
  emptyLink: { fontSize: 14, color: T.accent, fontWeight: '600' },

  stacksSection: {
    marginTop: 20,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  stacksSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 12,
  },
  stacksSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'InstrumentSerif-Regular',
  },
  stacksScroll: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 10,
    paddingBottom: 8,
  },
  stackCard: {
    width: 180,
    backgroundColor: T.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  stackCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  stackCardName: { fontSize: 14, fontWeight: '700', color: T.primary, fontFamily: 'InstrumentSerif-Regular', flex: 1, marginRight: 6 },
  stackSpotBadge: { backgroundColor: T.inputBg, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  stackSpotBadgeText: { fontSize: 11, fontWeight: '700', color: T.muted },
  stackCardDate: { fontSize: 11, color: T.muted, marginBottom: 4 },
  stackJourney: { fontSize: 11, color: T.muted, fontStyle: 'italic', marginBottom: 8 },
  stackQuality: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  stackQualityText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  recentSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  recentTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'InstrumentSerif-Regular',
  },
  emptyDates: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  emptyDatesText: {
    fontSize: 14,
    color: T.muted,
  },
  plusCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E76F51',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusCircleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },

  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  recentAccent: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
    minHeight: 36,
  },
  recentRowLeft: { flex: 1, marginRight: 12 },
  recentName: { fontSize: 15, fontWeight: '600', color: T.primary, marginBottom: 3 },
  recentMeta: { fontSize: 12, color: T.muted },
  recentScore: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: 'transparent',
  },
  recentScoreText: { fontSize: 13, fontWeight: '800' },
});
