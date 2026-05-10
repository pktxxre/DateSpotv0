import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, ImageBackground, Dimensions, Alert, TextInput, Share } from 'react-native';
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOpenLog, scheduleOpenFutureDate } from './map';
import { getAllFutureSpots, deleteFutureSpot, updateFutureSpot, FutureSpot } from '@/lib/future';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_W = Dimensions.get('window').width;
import { getAllVisits, Visit, ACTIVITY_TYPES, Price, PRICE_LABELS, formatRating, ratingColor, friendlyDate } from '@/lib/visits';
import { T } from '@/lib/theme';

const CATEGORY_BANNERS: Partial<Record<string, any>> = {
  food:          require('../../assets/images/category-food.jpg'),
  drinks:        require('../../assets/images/category-drinks.jpg'),
  outdoors:      require('../../assets/images/category-outdoors.avif'),
  view:          require('../../assets/images/category-view.jpg'),
  entertainment: require('../../assets/images/category-entertainment.jpg'),
  other:         require('../../assets/images/category-other.jpg'),
};

type Tab = 'picks' | 'all' | 'future' | 'activity';
type SortOption = 'best' | 'worst';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'best', label: 'Best to Worst' },
  { value: 'worst', label: 'Worst to Best' },
];

const RATING_UNLOCK_COUNT = 3;

function visitDate(v: Visit): number {
  const raw = v.visited_at;
  if (raw) {
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime();
    const t = new Date(raw).getTime();
    if (!isNaN(t)) return t;
  }
  return new Date(v.created_at).getTime();
}

function sortVisits(visits: Visit[], sort: SortOption): Visit[] {
  const copy = [...visits];
  if (sort === 'best') return copy.sort((a, b) => b.rating - a.rating);
  return copy.sort((a, b) => a.rating - b.rating);
}

function openLogFlow() {
  scheduleOpenLog();
  router.navigate('/(tabs)/map');
}

function openFutureDateFlow() {
  scheduleOpenFutureDate();
  router.navigate('/(tabs)/map');
}

export default function HomeScreen() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [futureSpots, setFutureSpots] = useState<FutureSpot[]>([]);
  const [tab, setTab] = useState<Tab>('picks');
  const [sort, setSort] = useState<SortOption>('best');
  const slideX = useSharedValue(0);

  const refreshFuture = useCallback(() => setFutureSpots(getAllFutureSpots()), []);

  useFocusEffect(
    useCallback(() => {
      setVisits(getAllVisits());
      setFutureSpots(getAllFutureSpots());
    }, [])
  );

  const tabPositions: Record<Tab, number> = { picks: 0, all: -SCREEN_W, future: -SCREEN_W * 2, activity: -SCREEN_W * 3 };

  useEffect(() => {
    slideX.value = withTiming(tabPositions[tab], { duration: 260 });
  }, [tab]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  const allSorted = sortVisits(visits, sort);
  const hideRating = visits.length < RATING_UNLOCK_COUNT;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DateSpot</Text>
        <Text style={styles.headerSub}>Your favorite places</Text>
      </View>

      {/* Segmented control — 4 tabs */}
      <View style={styles.segControl}>
        {(['picks', 'all', 'future', 'activity'] as Tab[]).map((t) => {
          const labels: Record<Tab, string> = { picks: 'Favorites', all: 'All', future: 'Future', activity: 'Activity' };
          return (
            <Pressable key={t} style={[styles.segBtn, tab === t && styles.segBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.segBtnText, tab === t && styles.segBtnTextActive]}>{labels[t]}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Sort row — only visible on All tab */}
      <View style={[styles.sortRow, tab !== 'all' && styles.sortRowHidden]}>
        {SORT_OPTIONS.map(opt => (
          <Pressable
            key={opt.value}
            style={[styles.sortChip, sort === opt.value && styles.sortChipActive]}
            onPress={() => setSort(opt.value)}
          >
            <Text style={[styles.sortChipText, sort === opt.value && styles.sortChipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Sliding panels */}
      <View style={styles.slideContainer}>
        <Animated.View style={[styles.slidePanels, slideStyle]}>
          <View style={styles.slidePanel}>
            <PicksTab visits={visits} hideRating={hideRating} />
          </View>
          <View style={styles.slidePanel}>
            <AllTab visits={allSorted} hideRating={hideRating} />
          </View>
          <View style={styles.slidePanel}>
            <FutureTab spots={futureSpots} onRefresh={refreshFuture} />
          </View>
          <View style={styles.slidePanel}>
            <ActivityTab visits={visits} />
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function PicksTab({ visits, hideRating }: { visits: Visit[]; hideRating: boolean }) {
  if (visits.length === 0) {
    return (
      <View style={styles.emptyCenter}>
        <Text style={styles.emptyTitle}>No spots yet</Text>
        <Pressable style={styles.logCtaInline} onPress={openLogFlow}>
          <Text style={styles.logCtaText}>+ Log a new spot</Text>
        </Pressable>
        <Text style={styles.emptySubCta}>to get started!</Text>
      </View>
    );
  }

  const categories = ACTIVITY_TYPES
    .map(type => ({
      ...type,
      spots: visits
        .filter(v => v.activity_type === type.value)
        .sort((a, b) => b.rank_order - a.rank_order)
        .slice(0, 3),
    }))
    .filter(c => c.spots.length > 0);

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
      {categories.map(cat => {
        const banner = CATEGORY_BANNERS[cat.value];
        return (
          <View key={cat.value} style={styles.categorySection}>
            {banner ? (
              <ImageBackground source={banner} style={styles.categoryBanner} imageStyle={styles.categoryBannerImg}>
                <View style={styles.categoryBannerOverlay}>
                  <Text style={styles.categoryBannerTitle}>{cat.label}</Text>
                  <Text style={styles.categoryBannerCount}>Top {cat.spots.length}</Text>
                </View>
              </ImageBackground>
            ) : (
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>{cat.label}</Text>
              </View>
            )}
            {cat.spots.map(v => <SpotRow key={v.id} visit={v} hideRating={hideRating} />)}
          </View>
        );
      })}
    </ScrollView>
  );
}

function AllTab({ visits, hideRating }: { visits: Visit[]; hideRating: boolean }) {
  return (
    <>
      {visits.length === 0 ? (
        <View style={styles.emptyCenter}>
          <Text style={styles.emptyTitle}>No spots yet</Text>
          <Pressable style={styles.logCtaInline} onPress={openLogFlow}>
            <Text style={styles.logCtaText}>+ Log a new spot</Text>
          </Pressable>
          <Text style={styles.emptySubCta}>to get started!</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {visits.map(v => <SpotRow key={v.id} visit={v} hideRating={hideRating} />)}
        </ScrollView>
      )}
    </>
  );
}


function FutureTab({ spots, onRefresh: _ }: { spots: FutureSpot[]; onRefresh: () => void }) {
  if (spots.length === 0) {
    return (
      <View style={styles.emptyCenter}>
        <Text style={styles.emptyTitle}>No future dates yet</Text>
        <Pressable style={styles.logCtaInline} onPress={openFutureDateFlow}>
          <Text style={styles.logCtaText}>+ Add a future date</Text>
        </Pressable>
        <Text style={styles.emptySubCta}>to get started!</Text>
      </View>
    );
  }
  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
      {spots.map(s => <FutureRow key={s.id} spot={s} />)}
    </ScrollView>
  );
}

function FutureRow({ spot }: { spot: FutureSpot }) {
  const dateStr = friendlyDate(spot.created_at);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/future/${spot.id}` as any)}
    >
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>{spot.venue_name}</Text>
          <View style={styles.futureTag}>
            <Text style={styles.futureTagText}>Want to go</Text>
          </View>
        </View>
        <Text style={styles.rowDate}>Added {dateStr}</Text>
      </View>
    </Pressable>
  );
}

function ActivityTab({ visits }: { visits: Visit[] }) {
  const [filter, setFilter] = useState<'mine' | 'friends'>('mine');
  const [query, setQuery] = useState('');

  const recent = [...visits].sort((a, b) => visitDate(b) - visitDate(a));

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.sortRow}>
        {(['mine', 'friends'] as const).map(f => (
          <Pressable key={f} style={[styles.sortChip, filter === f && styles.sortChipActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.sortChipText, filter === f && styles.sortChipTextActive]}>
              {f === 'mine' ? 'My Activity' : 'Friends'}
            </Text>
          </Pressable>
        ))}
      </View>

      {filter === 'mine' && (
        recent.length === 0 ? (
          <View style={styles.emptyCenter}>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Pressable style={styles.logCtaInline} onPress={openLogFlow}>
              <Text style={styles.logCtaText}>+ Log a new spot</Text>
            </Pressable>
            <Text style={styles.emptySubCta}>to get started!</Text>
          </View>
        ) : (
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
            {recent.map(v => <ActivitySpotRow key={v.id} visit={v} />)}
          </ScrollView>
        )
      )}

      {filter === 'friends' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={T.muted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by username or phone"
              placeholderTextColor={T.muted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.emptyCenter}>
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptyBody}>Search above or share your link to connect</Text>
            <Pressable style={styles.logCtaInline} onPress={() => Share.share({ message: 'Join me on DateSpot!' }).catch(() => {})}>
              <Text style={styles.logCtaText}>Share invite link</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function ActivitySpotRow({ visit }: { visit: Visit }) {
  const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/spot/${visit.id}`)}
    >
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>{visit.venue_name}</Text>
          <Text style={styles.rowDate}>{dateStr}</Text>
        </View>
        <Text style={styles.rowMeta}>{info?.label}</Text>
      </View>
    </Pressable>
  );
}

function SpotRow({ visit, hideRating }: { visit: Visit; hideRating?: boolean }) {
  const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
  const color = ratingColor(visit.rating);
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);
  const preview = visit.notes?.trim().slice(0, 70) ?? null;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/spot/${visit.id}`)}
    >
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>{visit.venue_name}</Text>
          {!hideRating && (
            <View style={[styles.ratingPill, { borderColor: color }]}>
              <Text style={[styles.ratingPillText, { color }]}>{formatRating(visit.rating)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.rowMeta}>
          {info?.label} · {PRICE_LABELS[visit.price as Price]} · {dateStr}
        </Text>
        {preview ? (
          <Text style={styles.rowPreview} numberOfLines={1}>{preview}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { flex: 1 },
  listContent: { paddingBottom: 40 },

  slideContainer: { flex: 1, overflow: 'hidden' },
  slidePanels: { flexDirection: 'row', width: SCREEN_W * 4, flex: 1 },
  slidePanel: { width: SCREEN_W, flex: 1 },

  header: {
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
    alignItems: 'center', gap: 2,
  },
  headerTitle: {
    fontSize: 32, fontWeight: '700', color: T.primary,
    fontFamily: 'Georgia', letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13, color: T.muted, fontWeight: '500', letterSpacing: 0.2,
  },

  segControl: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 14,
    backgroundColor: T.segBg, borderRadius: 10, padding: 3,
  },
  segBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: T.card,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  segBtnText: { fontSize: 11, fontWeight: '500', color: T.muted },
  segBtnTextActive: { color: T.primary, fontWeight: '600' },

  sortRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12,
  },
  sortRowHidden: { opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' },
  sortChip: {
    flex: 1, paddingVertical: 6, borderRadius: 20, alignItems: 'center',
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
  },
  sortChipActive: { backgroundColor: T.primary, borderColor: T.primary },
  sortChipText: { fontSize: 12, fontWeight: '600', color: T.muted },
  sortChipTextActive: { color: '#fff' },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  rowEmoji: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: T.border, marginTop: 1,
  },
  rowEmojiText: { fontSize: 19 },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  rowName: { fontSize: 15, fontWeight: '600', color: T.primary, flex: 1, marginRight: 8 },
  rowDate: { fontSize: 12, color: T.muted },
  rowMeta: { fontSize: 12, color: T.muted, marginBottom: 4 },
  rowPreview: { fontSize: 12, color: '#A0927E', fontStyle: 'italic', lineHeight: 16 },

  futureTag: {
    backgroundColor: '#ebebff', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  futureTagText: { fontSize: 11, fontWeight: '600', color: '#5856d6' },

  ratingPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1.5, backgroundColor: 'transparent' },
  ratingPillText: { fontSize: 12, fontWeight: '800' },

  categorySection: { marginBottom: 28 },

  categoryBanner: { height: 90, marginBottom: 12 },
  categoryBannerImg: {},
  categoryBannerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 20, justifyContent: 'flex-end', paddingBottom: 12, gap: 1,
  },
  categoryBannerTitle: {
    fontSize: 26, fontWeight: '700', color: '#fff',
    fontFamily: 'Georgia', letterSpacing: -0.4,
  },
  categoryBannerCount: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },

  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingHorizontal: 16 },
  categoryEmoji: { fontSize: 20 },
  categoryTitle: {
    fontSize: 16, fontWeight: '700', color: T.primary, fontFamily: 'Georgia',
  },

  logCta: {
    backgroundColor: 'transparent', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: T.accent,
  },
  logCtaInline: {
    backgroundColor: 'transparent', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: T.accent,
    alignSelf: 'stretch', marginTop: 24,
  },
  logCtaText: { color: T.accent, fontSize: 16, fontWeight: '700' },

  emptyCenter: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40,
  },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingTop: 60,
  },
  emptyEmoji: { fontSize: 44, marginBottom: 14 },
  emptyTitle: {
    fontSize: 20, fontWeight: '700', color: T.primary,
    fontFamily: 'Georgia', marginBottom: 8,
  },
  emptyBody: { fontSize: 15, color: T.muted, textAlign: 'center', lineHeight: 22 },
  emptySubCta: { fontSize: 15, color: T.muted, marginTop: 10 },

  activityFilterRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
  },
  activityFilterChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
  },
  activityFilterChipActive: { backgroundColor: T.primary, borderColor: T.primary },
  activityFilterText: { fontSize: 13, fontWeight: '600', color: T.muted },
  activityFilterTextActive: { color: '#fff' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: T.card, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: T.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: T.primary },
});
