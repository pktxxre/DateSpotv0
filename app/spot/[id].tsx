import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Image,
  Alert, ScrollView, Dimensions, TextInput, Share, LayoutAnimation, Animated,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getVisitById, deleteVisit, updateVisit, getAllVisits, updateRankOrder, recomputeRatings, Visit,
  ACTIVITY_TYPES, OCCASION_TYPES, PRICE_LABELS, Price, ActivityType, OccasionType,
  ratingColor, formatRating, friendlyDate,
} from '@/lib/visits';
import { getStacksForVisit, createStack, TierKey } from '@/lib/stacks';
import {
  startComparison, advance, resolveRankOrder, resolveAtMid,
  currentComparison, ComparisonState,
} from '@/lib/ranking';
import { uploadPhoto } from '@/lib/storage';
import { getSeedSpotById, getSeedSpotsRaw, SeedSpot } from '@/lib/seeds';
import { supabase } from '@/lib/supabase';
import { getAllFutureSpots, insertFutureSpot, deleteFutureSpot } from '@/lib/future';
import { scheduleOpenLogWithLocation } from '@/app/(tabs)/map';
import * as Crypto from 'expo-crypto';
import { T } from '@/lib/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const H_PAD = 20;
const PHOTO_COLS = 3;
const PHOTO_GAP = 1;
const PHOTO_SIZE = (SCREEN_W - H_PAD * 2 - PHOTO_GAP * (PHOTO_COLS - 1)) / PHOTO_COLS;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const _NOW = new Date();
const YEARS = Array.from({ length: 11 }, (_, i) => String(_NOW.getFullYear() - i));
const DATE_OPTION_H = 46;
const DATE_DROPDOWN_H = DATE_OPTION_H * 2.5;
type DateField = 'month' | 'day' | 'year';

function initDateState(dateStr?: string): { month: string; day: string; year: string } {
  if (dateStr) {
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return {
      month: MONTHS[parseInt(m[2]) - 1] ?? MONTHS[_NOW.getMonth()],
      day: String(parseInt(m[3])),
      year: m[1],
    };
  }
  return { month: MONTHS[_NOW.getMonth()], day: String(_NOW.getDate()), year: String(_NOW.getFullYear()) };
}

function RankAgainModal({ visit, onClose, onDone }: {
  visit: Visit; onClose: () => void; onDone: (updated: Visit) => void;
}) {
  const others = getAllVisits().filter(v => v.id !== visit.id && v.triage === visit.triage && v.occasion_type === visit.occasion_type);
  const [cmpState, setCmpState] = useState<ComparisonState<Visit> | null>(
    () => startComparison(others, (v) => v.triage === visit.triage && v.occasion_type === visit.occasion_type)
  );

  function handleResult(result: 'better' | 'worse') {
    const prev = cmpState!;
    const next = advance(prev, result);
    if (next) {
      setCmpState(next);
    } else {
      const finalLo = result === 'better' ? prev.lo : prev.mid + 1;
      saveRank(resolveRankOrder({ ...prev, lo: finalLo }, others));
    }
  }

  function handleTooHard() { saveRank(resolveAtMid(cmpState!, others)); }

  function saveRank(rank_order: number) {
    updateRankOrder(visit.id, rank_order);
    recomputeRatings();
    const updated = getVisitById(visit.id);
    if (updated) onDone(updated);
  }

  const opponent = cmpState ? currentComparison(cmpState) : null;
  const oppColor = opponent ? ratingColor(opponent.rating) : T.muted;

  const cardContent = others.length === 0 ? (
    <>
      <Text style={r.title}>Nothing to compare</Text>
      <Text style={r.subtitle}>Log more {visit.triage} {OCCASION_TYPES.find(a => a.value === visit.occasion_type)?.label?.toLowerCase() ?? 'romantic'} spots to start ranking.</Text>
      <Pressable style={r.secBtn} onPress={onClose}><Text style={r.secBtnText}>Got it</Text></Pressable>
    </>
  ) : opponent ? (
    <>
      <Text style={r.title}>Which was better?</Text>
      <Text style={r.subtitle}>Tap to rank</Text>
      <View style={r.compareRow}>
        <Pressable style={[r.card, r.cardThis]} onPress={() => handleResult('better')}>
          <Text style={r.cardName} numberOfLines={3}>{visit.venue_name}</Text>
          <Text style={r.cardLabel}>This one</Text>
        </Pressable>
        <View style={r.vs}><Text style={r.vsText}>vs</Text></View>
        <Pressable style={[r.card, r.cardThat]} onPress={() => handleResult('worse')}>
          <View style={[r.scorePill, { backgroundColor: oppColor + '2E' }]}>
            <Text style={[r.scoreText, { color: oppColor }]}>{formatRating(opponent.rating)}</Text>
          </View>
          <Text style={r.cardName} numberOfLines={3}>{opponent.venue_name}</Text>
          <Text style={r.cardLabel}>That one</Text>
        </Pressable>
      </View>
      <Pressable style={r.tooHardBtn} onPress={handleTooHard}>
        <Text style={r.tooHardText}>Too hard to compare</Text>
      </Pressable>
      <Pressable style={r.secBtn} onPress={onClose}><Text style={r.secBtnText}>Cancel</Text></Pressable>
    </>
  ) : null;

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent>
      <Pressable style={r.overlay} onPress={onClose}>
        <Pressable style={r.floatingCard} onPress={() => {}}>
          {cardContent}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const r = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', paddingHorizontal: 16,
  },
  floatingCard: {
    backgroundColor: T.bg, borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20,
  },
  title: { fontSize: 18, fontWeight: '700', color: T.primary, fontFamily: 'InstrumentSerif-Regular', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: T.muted, textAlign: 'center', marginBottom: 20 },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  card: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 8, minHeight: 110, justifyContent: 'center' },
  cardThis: { backgroundColor: T.accentTint, borderWidth: 2, borderColor: T.accent },
  cardThat: { backgroundColor: T.inputBg, borderWidth: 2, borderColor: T.border },
  scorePill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  scoreText: { fontSize: 13, fontWeight: '800' },
  cardName: { fontSize: 13, fontWeight: '700', color: T.primary, textAlign: 'center', lineHeight: 17 },
  cardLabel: { fontSize: 11, color: T.muted, fontWeight: '500' },
  vs: { width: 30, height: 30, borderRadius: 15, backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center' },
  vsText: { fontSize: 11, fontWeight: '700', color: T.muted },
  tooHardBtn: { backgroundColor: T.inputBg, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 8 },
  tooHardText: { fontSize: 14, fontWeight: '600', color: T.muted },
  secBtn: { backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  secBtnText: { fontSize: 14, fontWeight: '500', color: T.muted },
});

function EditDatePicker({ month, day, year, onMonthChange, onDayChange, onYearChange }: {
  month: string; day: string; year: string;
  onMonthChange: (v: string) => void;
  onDayChange: (v: string) => void;
  onYearChange: (v: string) => void;
}) {
  const [open, setOpen] = useState<DateField | null>(null);
  const [tabRowH, setTabRowH] = useState(68);
  const [tabLayouts, setTabLayouts] = useState<Partial<Record<DateField, { x: number; width: number }>>>({});
  const listRef = useRef<ScrollView>(null);

  function toggle(field: DateField) {
    LayoutAnimation.configureNext({ duration: 220, update: { type: 'easeInEaseOut' }, create: { type: 'easeInEaseOut', property: 'opacity' }, delete: { type: 'easeInEaseOut', property: 'opacity' } });
    setOpen(prev => prev === field ? null : field);
  }

  useEffect(() => {
    if (!open) return;
    const items = open === 'month' ? MONTHS : open === 'day' ? DAYS : YEARS;
    const val = open === 'month' ? month : open === 'day' ? day : year;
    const idx = items.indexOf(val);
    if (idx >= 0) setTimeout(() => listRef.current?.scrollTo({ y: idx * DATE_OPTION_H, animated: false }), 40);
  }, [open]);

  function pick(field: DateField, val: string) {
    if (field === 'month') onMonthChange(val);
    else if (field === 'day') onDayChange(val);
    else onYearChange(val);
    LayoutAnimation.configureNext({ duration: 180, update: { type: 'easeInEaseOut' }, delete: { type: 'easeInEaseOut', property: 'opacity' } });
    setOpen(null);
  }

  const fields: { key: DateField; label: string; value: string; flex?: number }[] = [
    { key: 'month', label: 'Month', value: month, flex: 1.3 },
    { key: 'day',   label: 'Day',   value: day },
    { key: 'year',  label: 'Year',  value: year, flex: 1.4 },
  ];
  const openItems = open === 'month' ? MONTHS : open === 'day' ? DAYS : YEARS;
  const openVal   = open === 'month' ? month  : open === 'day' ? day  : year;
  const dropLayout = open ? tabLayouts[open] : null;

  return (
    <View style={{ marginBottom: 12, zIndex: 20 }}>
      <View style={e.dateTabRow} onLayout={ev => setTabRowH(ev.nativeEvent.layout.height)}>
        {fields.map(f => (
          <Pressable
            key={f.key}
            style={[e.dateTab, { flex: f.flex ?? 1 }, open === f.key && e.dateTabOpen]}
            onPress={() => toggle(f.key)}
            onLayout={ev => {
              const { x, width } = ev.nativeEvent.layout;
              setTabLayouts(prev => ({ ...prev, [f.key]: { x, width } }));
            }}
          >
            <Text style={e.dateTabLabel}>{f.label}</Text>
            <Text style={[e.dateTabValue, open === f.key && e.dateTabValueOpen]}>{f.value}</Text>
            <Ionicons name={open === f.key ? 'chevron-up' : 'chevron-down'} size={11} color={open === f.key ? T.accent : T.muted} />
          </Pressable>
        ))}
      </View>
      {open && dropLayout && (
        <View style={[e.dateDropdown, { position: 'absolute', top: tabRowH + 4, left: dropLayout.x, width: dropLayout.width, height: DATE_DROPDOWN_H }]}>
          <ScrollView ref={listRef} showsVerticalScrollIndicator={false} nestedScrollEnabled style={{ flex: 1 }}>
            {openItems.map(item => {
              const selected = item === openVal;
              return (
                <Pressable key={item} style={[e.dateOption, selected && e.dateOptionSelected]} onPress={() => pick(open, item)}>
                  <Text style={[e.dateOptionText, selected && e.dateOptionTextSelected]}>{item}</Text>
                  {selected && <Ionicons name="checkmark" size={16} color={T.accent} />}
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={e.dateFade} pointerEvents="none">
            <View style={{ flex: 1, backgroundColor: 'rgba(252,249,242,0)' }} />
            <View style={{ flex: 1, backgroundColor: 'rgba(252,249,242,0.55)' }} />
            <View style={{ flex: 1, backgroundColor: 'rgba(252,249,242,0.9)' }} />
          </View>
        </View>
      )}
    </View>
  );
}


const ACTIVITY_COLORS_HERO: Record<string, string> = {
  // Occasion types (personal visits)
  romantic: '#C4604A',
  friend:   '#C49A4A',
  solo:     '#6A8FA0',
  // Venue types (seed spots — fallback colors)
  food: '#C4604A', bars: '#C49A4A', cafes: '#A07850',
  outdoors: '#6A8F6A', indoors: '#7A8CAA', view: '#6A8FA0',
  entertainment: '#8B7BB0', shopping: '#C47890', other: '#8B7255',
};

function triageToTier(rating: number): TierKey {
  if (rating >= 8.0) return 'S';
  if (rating >= 6.5) return 'A';
  if (rating >= 5.0) return 'B';
  if (rating >= 3.5) return 'C';
  return 'F';
}

function MakeStackModal({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    const stack = createStack(name.trim(), [visit.id], triageToTier(visit.rating));
    setSaving(false);
    onClose();
    router.push(`/stack/${stack.id}` as any);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={e.root} edges={['top', 'bottom']}>
        <View style={e.header}>
          <Pressable onPress={onClose} hitSlop={8}><Text style={e.cancel}>Cancel</Text></Pressable>
          <Text style={e.title}>Make a Stack</Text>
          <Pressable onPress={handleCreate} disabled={saving || !name.trim()} hitSlop={8}>
            <Text style={[e.save, (!name.trim() || saving) && { opacity: 0.35 }]}>Create</Text>
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <TextInput
            style={e.input}
            placeholder="Name this stack…"
            placeholderTextColor={T.placeholder}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [seedSpot, setSeedSpot] = useState<SeedSpot | null>(null);
  const [editing, setEditing] = useState(false);
  const [rankingAgain, setRankingAgain] = useState(false);
  const [makingStack, setMakingStack] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    const local = getVisitById(id);
    if (local) {
      setVisit(local);
      setSeedSpot(null);
    } else {
      setVisit(null);
      getSeedSpotById(id).then(s => setSeedSpot(s));
    }
  }, [id]));

  if (!visit && seedSpot) {
    return <SeedSpotDetail spot={seedSpot} />;
  }

  if (!visit) return null;

  const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
  const color = ratingColor(visit.rating);
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);
  const heroBg = ACTIVITY_COLORS_HERO[visit.activity_type] ?? ACTIVITY_COLORS_HERO.other;
  const priceLabel = PRICE_LABELS[visit.price as Price];

  async function handleShare() {
    try {
      await Share.share({ message: `Checked out ${visit!.venue_name} — rated it ${formatRating(visit!.rating)}/10 on DateSpot.` });
    } catch {}
  }

  function handleDelete() {
    const inStacks = getStacksForVisit(id);
    const stackNames = inStacks.map(s => `"${s.name}"`).join(', ');
    const stackNote = inStacks.length > 0
      ? `\n\nThis spot is in ${stackNames} and will be permanently removed from it.`
      : '';
    Alert.alert('Remove Spot', `Remove "${visit!.venue_name}" from your log?${stackNote}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: () => {
          deleteVisit(id);
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Floating header over colored hero */}
      <SafeAreaView style={sd.floatingHeader} edges={['top']}>
        <View style={sd.floatingHeaderInner}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={sd.floatingBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={handleShare} hitSlop={12} style={sd.floatingBtn}>
            <Ionicons name="share-outline" size={20} color="#fff" />
          </Pressable>
          <Pressable onPress={() => setEditing(true)} hitSlop={12} style={sd.floatingBtn}>
            <Ionicons name="pencil-outline" size={18} color="#fff" />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={12} style={sd.floatingBtn}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ backgroundColor: heroBg }}>
          {/* Colored hero */}
          <View style={sd.hero}>
            <View style={sd.heroContent}>
              <Text style={sd.heroMeta}>
                {(info?.label ?? '').toUpperCase()}{priceLabel ? ` · ${priceLabel}` : ''}
              </Text>
              <Text style={sd.heroName}>{visit.venue_name}</Text>
              <Text style={sd.heroCity}>{dateStr}</Text>
            </View>
          </View>

          {/* White card */}
          <View style={[sd.whiteCard, { minHeight: SCREEN_H }]}>
            {/* Rating badge + action buttons */}
            <View style={sd.badgeRow}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Pressable style={styles.rankAgainBtn} onPress={() => setRankingAgain(true)}>
                  <Ionicons name="git-compare-outline" size={13} color={T.accent} />
                  <Text style={styles.rankAgainText}>Rank again</Text>
                </Pressable>
                <Pressable style={styles.rankAgainBtn} onPress={() => setMakingStack(true)}>
                  <Ionicons name="layers-outline" size={13} color={T.accent} />
                  <Text style={styles.rankAgainText}>Make a Stack</Text>
                </Pressable>
              </View>
              <View style={[sd.ratingBadge, { borderColor: color }]}>
                <Text style={[sd.ratingBadgeText, { color }]}>{formatRating(visit.rating)}</Text>
              </View>
            </View>

            <View style={{ height: 20 }} />

            {/* Notes */}
            {visit.notes ? (
              <>
                <Text style={sd.sectionLabel}>NOTES FROM THE NIGHT</Text>
                <Text style={sd.notesText}>{visit.notes}</Text>
                <View style={{ height: 16 }} />
              </>
            ) : null}

            {/* Map */}
            <Text style={sd.sectionLabel}>WHERE IT IS</Text>
            <Pressable style={sd.mapWrap} onPress={() => router.push('/(tabs)/map')}>
              <MapView
                style={StyleSheet.absoluteFill}
                region={{ latitude: visit.lat, longitude: visit.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 }}
                scrollEnabled={false} zoomEnabled={false} rotateEnabled={false}
                pitchEnabled={false} showsUserLocation={false} showsPointsOfInterest={false}
                showsCompass={false} showsScale={false} mapType="standard" pointerEvents="none"
              >
                <Marker coordinate={{ latitude: visit.lat, longitude: visit.lng }}>
                  <View style={[styles.pin, { borderColor: color }]}>
                    <Text style={[styles.pinText, { color }]}>{formatRating(visit.rating)}</Text>
                  </View>
                </Marker>
              </MapView>
              <View style={styles.mapHint}>
                <Ionicons name="map-outline" size={12} color="#fff" />
                <Text style={styles.mapHintText}>View on map</Text>
              </View>
            </Pressable>

            <View style={{ height: 20 }} />

            {/* Photos */}
            <Text style={sd.sectionLabel}>PHOTOS</Text>
            {visit.photos.length > 0 ? (
              <View style={sd.photosGrid}>
                {visit.photos.map((uri, idx) => (
                  <Image key={idx} source={{ uri }} style={sd.photoThumb} resizeMode="cover" />
                ))}
              </View>
            ) : (
              <View style={sd.emptySection}>
                <Ionicons name="camera-outline" size={28} color={T.border} />
                <Text style={sd.emptySectionText}>No photos yet</Text>
              </View>
            )}

            <View style={{ height: 40 }} />
          </View>
        </View>
      </ScrollView>

      {editing && (
        <EditModal
          visit={visit}
          onClose={() => setEditing(false)}
          onSave={(updated) => { setVisit(updated); setEditing(false); }}
        />
      )}
      {rankingAgain && (
        <RankAgainModal
          visit={visit}
          onClose={() => setRankingAgain(false)}
          onDone={(updated) => { setVisit(updated); setRankingAgain(false); }}
        />
      )}
      {makingStack && (
        <MakeStackModal visit={visit} onClose={() => setMakingStack(false)} />
      )}
    </View>
  );
}


function SeedSpotDetail({ spot }: { spot: SeedSpot }) {
  const [savedFutureId, setSavedFutureId] = useState<string | null>(null);
  const [spotPhotos, setSpotPhotos] = useState<string[]>([]);
  const [spotRank, setSpotRank] = useState<number | null>(null);
  const [ratingExpanded, setRatingExpanded] = useState(false);
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const color = ratingColor(spot.rating);
  const priceLabel = PRICE_LABELS[spot.price as Price];
  const heroBg = ACTIVITY_COLORS_HERO[spot.activity_type] ?? ACTIVITY_COLORS_HERO.other;
  const catLabel = spot.activity_type
    ? spot.activity_type.charAt(0).toUpperCase() + spot.activity_type.slice(1)
    : 'Other';

  useEffect(() => {
    const existing = getAllFutureSpots().find(
      f => f.venue_name === spot.venue_name && Math.abs(f.lat - spot.lat) < 0.001
    );
    setSavedFutureId(existing?.id ?? null);
  }, [spot.id]);

  // Determine this spot's overall rank (by rating) to gate Editor's Pick
  useEffect(() => {
    getSeedSpotsRaw().then(all => {
      const sorted = [...all].sort((a, b) => b.rating - a.rating);
      const idx = sorted.findIndex(s => s.venue_name === spot.venue_name);
      setSpotRank(idx >= 0 ? idx + 1 : null);
    });
  }, [spot.venue_name]);

  // Fetch any user-uploaded photos for this venue
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('visits')
      .select('photos')
      .ilike('venue_name', spot.venue_name)
      .not('photos', 'is', null)
      .then(({ data }) => {
        if (!data) return;
        const all: string[] = [];
        for (const row of data) {
          if (Array.isArray(row.photos)) all.push(...(row.photos as string[]));
        }
        setSpotPhotos(all);
      });
  }, [spot.venue_name]);

  function showSavedBanner() {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    Animated.spring(bannerAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    bannerTimer.current = setTimeout(() => {
      Animated.timing(bannerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, 1500);
  }

  function toggleSave() {
    if (savedFutureId) {
      deleteFutureSpot(savedFutureId);
      setSavedFutureId(null);
    } else {
      const newId = Crypto.randomUUID();
      insertFutureSpot({
        id: newId,
        venue_name: spot.venue_name,
        lat: spot.lat,
        lng: spot.lng,
        created_at: new Date().toISOString(),
      });
      setSavedFutureId(newId);
      showSavedBanner();
    }
  }

  function handleLogVisit() {
    scheduleOpenLogWithLocation(spot.venue_name, spot.lat, spot.lng);
    router.push('/(tabs)/map');
  }

  const isEditorsPick = spotRank !== null && spotRank <= 10;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Floating header over hero */}
      <SafeAreaView style={sd.floatingHeader} edges={['top']}>
        <View style={sd.floatingHeaderInner}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={sd.floatingBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={handleLogVisit} hitSlop={12} style={sd.floatingBtn}>
            <Ionicons name="add" size={18} color="#fff" />
          </Pressable>
          <Pressable onPress={toggleSave} hitSlop={12} style={sd.floatingBtn}>
            <Ionicons name={savedFutureId ? 'bookmark' : 'bookmark-outline'} size={16} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Saved banner */}
      <Animated.View
        style={[
          sd.savedBanner,
          {
            opacity: bannerAnim,
            transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="bookmark" size={13} color="#5856d6" />
        <Text style={sd.savedBannerText}>Saved! Check it out on your map.</Text>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        {/* Wrapper shares hero color so rounded card corners show against it */}
        <View style={{ backgroundColor: heroBg }}>
          {/* Colored hero — content pinned right under the floating header */}
          <View style={sd.hero}>
            <View style={sd.heroContent}>
              <Text style={sd.heroMeta}>
                {(catLabel || 'Other').toUpperCase()}{priceLabel ? ` · ${priceLabel}` : ''}
              </Text>
              <Text style={sd.heroName}>{spot.venue_name}</Text>
              <Text style={sd.heroCity}>Seattle</Text>
            </View>
          </View>

          {/* White card inside wrapper — rounded corners visible against heroBg */}
          <View style={sd.whiteCard}>
          {/* Badge row + rating */}
          <View style={sd.badgeRow}>
            {isEditorsPick ? (
              <View style={sd.editorBadge}>
                <Ionicons name="star" size={11} color="#E76F51" style={{ marginRight: 4 }} />
                <Text style={sd.editorBadgeText}>EDITOR'S PICK</Text>
              </View>
            ) : <View />}
            <View style={sd.ratingWrap}>
              <Pressable onPress={() => setRatingExpanded(v => !v)}>
                <View style={[sd.ratingBadge, { borderColor: color }]}>
                  <Text style={[sd.ratingBadgeText, { color }]}>{spot.rating.toFixed(1)}</Text>
                </View>
              </Pressable>
              {ratingExpanded && (
                <Text style={sd.ratingCaption}>Avg. of all logs</Text>
              )}
            </View>
          </View>

          <View style={{ height: 20 }} />

          {/* Why it's a great date */}
          {spot.notes ? (
            <>
              <Text style={sd.sectionLabel}>WHY IT'S A GREAT DATE</Text>
              <Text style={sd.notesText}>{spot.notes}</Text>
              <View style={{ height: 16 }} />
            </>
          ) : null}

          {/* Map */}
          <Text style={sd.sectionLabel}>WHERE IT IS</Text>
          <View style={sd.mapWrap}>
            <MapView
              style={StyleSheet.absoluteFill}
              region={{ latitude: spot.lat, longitude: spot.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 }}
              scrollEnabled={false} zoomEnabled={false} rotateEnabled={false}
              pitchEnabled={false} showsUserLocation={false} showsPointsOfInterest={false}
              showsCompass={false} showsScale={false} mapType="standard" pointerEvents="none"
            >
              <Marker coordinate={{ latitude: spot.lat, longitude: spot.lng }}>
                <View style={[styles.pin, { borderColor: color }]}>
                  <Text style={[styles.pinText, { color }]}>{spot.rating.toFixed(1)}</Text>
                </View>
              </Marker>
            </MapView>
          </View>

          {spot.address ? (
            <Text style={sd.addressText}>{spot.address}</Text>
          ) : null}

          {/* Divider */}
          <View style={sd.divider} />

          {/* Photos section — always visible */}
          <Text style={sd.sectionLabel}>PHOTOS</Text>
          {spotPhotos.length > 0 ? (
            <View style={sd.photosGrid}>
              {spotPhotos.map((uri, idx) => (
                <Image key={idx} source={{ uri }} style={sd.photoThumb} resizeMode="cover" />
              ))}
            </View>
          ) : (
            <View style={sd.emptySection}>
              <Ionicons name="camera-outline" size={28} color={T.border} />
              <Text style={sd.emptySectionText}>No photos yet</Text>
            </View>
          )}

          {/* Divider */}
          <View style={sd.divider} />

          {/* What your friends think — always visible */}
          <Text style={sd.sectionLabel}>WHAT YOUR FRIENDS THINK</Text>
          <View style={sd.emptySection}>
            <Ionicons name="people-outline" size={28} color={T.border} />
            <Text style={sd.emptySectionText}>None of your friends have logged this spot yet.</Text>
            <Pressable style={sd.addFriendsBtn} onPress={() => router.push('/(tabs)/friends')}>
              <Ionicons name="person-add-outline" size={14} color={T.accent} />
              <Text style={sd.addFriendsBtnText}>Add friends</Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </View>
        </View>{/* end heroBg wrapper */}
      </ScrollView>
    </View>
  );
}

const sd = StyleSheet.create({
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  floatingHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  floatingBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedBanner: {
    position: 'absolute',
    top: 96,
    alignSelf: 'center',
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  savedBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5856d6',
  },
  hero: {
    paddingTop: 96,
    paddingBottom: 10,
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  heroMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'InstrumentSerif-Regular',
    lineHeight: 30,
    marginBottom: 4,
  },
  heroCity: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  whiteCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flex: 1,
    padding: 20,
    minHeight: SCREEN_H,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0EB',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#E76F51',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  editorBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E76F51',
    letterSpacing: 0.4,
  },
  ratingWrap: {
    alignItems: 'flex-end',
    gap: 3,
  },
  ratingBadge: {
    borderRadius: 99,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  ratingBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  ratingCaption: {
    fontSize: 10,
    color: T.muted,
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 15,
    color: '#4B3621',
    lineHeight: 23,
  },
  mapWrap: {
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#e8e8ed',
  },
  addressText: {
    fontSize: 13,
    color: T.muted,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
  },
  photoThumb: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    backgroundColor: '#f2f2f7',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.border,
    marginVertical: 20,
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptySectionText: {
    fontSize: 13,
    color: T.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  addFriendsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.accent,
    backgroundColor: T.accentTint,
  },
  addFriendsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.accent,
  },
  ctaSafe: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  logCta: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E76F51',
    borderRadius: 14,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 16,
  },
  logCtaText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

function EditModal({ visit, onClose, onSave }: { visit: Visit; onClose: () => void; onSave: (v: Visit) => void }) {
  const [name, setName] = useState(visit.venue_name);
  const [notes, setNotes] = useState(visit.notes ?? '');
  const [activity, setActivity] = useState<ActivityType | null>(visit.activity_type);
  const [occasion, setOccasion] = useState<OccasionType | null>(visit.occasion_type);
  const [price, setPrice] = useState<Price | undefined>(visit.price);
  const [photos, setPhotos] = useState<string[]>(visit.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const initDate = initDateState(visit.visited_at);
  const [month, setMonth] = useState(initDate.month);
  const [day, setDay] = useState(initDate.day);
  const [year, setYear] = useState(initDate.year);

  const visitedAt = (() => {
    const mi = MONTHS.indexOf(month) + 1;
    const di = parseInt(day);
    const yi = parseInt(year);
    return `${yi}-${String(mi).padStart(2, '0')}-${String(di).padStart(2, '0')}`;
  })();

  async function pickPhoto() {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo library access.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets.length) return;
      setUploading(true);
      const uploaded: string[] = [];
      for (const asset of result.assets) {
        const url = await uploadPhoto(asset.uri, `spots/${visit.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
        if (url) uploaded.push(url);
      }
      if (uploaded.length) setPhotos(prev => [...prev, ...uploaded]);
      else Alert.alert('Upload failed', 'Could not upload photos.');
    } catch { Alert.alert('Error', 'Something went wrong.'); }
    finally { setUploading(false); }
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Name required', 'Give this spot a name.'); return; }
    setSaving(true);
    updateVisit(visit.id, {
      venue_name: name.trim(), visited_at: visitedAt,
      notes: notes.trim() || null,
      activity_type: activity ?? visit.activity_type,
      occasion_type: occasion ?? visit.occasion_type,
      price: price ?? visit.price,
      photos,
    });
    const updated = getVisitById(visit.id);
    setSaving(false);
    if (updated) onSave(updated);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={e.root} edges={['top', 'bottom']}>
        <View style={e.header}>
          <Pressable onPress={onClose} hitSlop={8}><Text style={e.cancel}>Cancel</Text></Pressable>
          <Text style={e.title}>Edit Spot</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={8}>
            <Text style={e.save}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
        <ScrollView style={e.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TextInput style={e.input} placeholder="Name your date!" placeholderTextColor={T.placeholder} value={name} onChangeText={setName} autoFocus returnKeyType="next" />

          <Text style={e.sectionLabel}>Date</Text>
          <EditDatePicker month={month} day={day} year={year} onMonthChange={setMonth} onDayChange={setDay} onYearChange={setYear} />

          <Text style={e.sectionLabel}>Photos</Text>
          <View style={e.photoGrid}>
            {photos.map((uri, idx) => (
              <Pressable key={idx} style={e.photoThumb} onLongPress={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}>
                <Image source={{ uri }} style={e.photoThumbImg} resizeMode="cover" />
              </Pressable>
            ))}
            <Pressable style={e.photoAdd} onPress={pickPhoto} disabled={uploading}>
              <Ionicons name={uploading ? 'hourglass-outline' : 'camera-outline'} size={22} color={T.muted} />
              <Text style={e.photoAddLabel}>{uploading ? 'Uploading…' : 'Add photo'}</Text>
            </Pressable>
          </View>

          <Text style={e.sectionLabel}>Category</Text>
          <View style={e.chipWrap}>
            {ACTIVITY_TYPES.map(a => {
              const sel = activity === a.value;
              return (
                <Pressable key={a.value} style={[e.chip, sel && e.chipSel]} onPress={() => setActivity(sel ? null : a.value)}>
                  <Text style={[e.chipLabel, sel && e.chipLabelSel]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={e.sectionLabel}>What kind of date?</Text>
          <View style={e.occasionRow}>
            {OCCASION_TYPES.map(a => {
              const sel = occasion === a.value;
              return (
                <Pressable key={a.value} style={[e.occasionBtn, sel && e.occasionBtnSel]} onPress={() => setOccasion(sel ? null : a.value)}>
                  <Text style={[e.occasionLabel, sel && e.occasionLabelSel]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={e.sectionLabel}>Price range</Text>
          <View style={e.priceRow}>
            {([0, 1, 2, 3] as Price[]).map(p => {
              const sel = price === p;
              return (
                <Pressable key={p} style={[e.priceBtn, sel && e.priceBtnSel]} onPress={() => setPrice(sel ? undefined : p)}>
                  <Text style={[e.priceBtnText, sel && e.priceBtnTextSel]}>{PRICE_LABELS[p]}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={[e.input, e.inputMulti]}
            placeholder="Notes — what made it memorable?"
            placeholderTextColor={T.placeholder}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  headerSafe: { backgroundColor: T.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 2 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  hero: {
    paddingHorizontal: H_PAD, paddingTop: 8, paddingBottom: 24,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  venueName: {
    fontSize: 26, fontWeight: '800', color: T.primary,
    lineHeight: 32, letterSpacing: -0.5, marginBottom: 6,
  },
  dateStr: { fontSize: 14, color: T.muted, fontWeight: '500', marginBottom: 14 },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tag: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  tagText: { fontSize: 13, fontWeight: '500', color: T.muted },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  rankAgainBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: T.accent, backgroundColor: T.accentTint,
  },
  rankAgainText: { fontSize: 12, fontWeight: '600', color: T.accent },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'baseline', gap: 2,
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1.5, backgroundColor: 'transparent',
  },
  ratingScore: { fontSize: 18, fontWeight: '800' },
  ratingSlash: { fontSize: 11, fontWeight: '600' },
  ratingCaption: { fontSize: 13, color: T.muted, fontWeight: '500' },

  section: { paddingHorizontal: H_PAD, marginTop: 22 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: T.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  notesCard: {
    backgroundColor: T.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: T.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6,
  },
  notesText: { fontSize: 15, color: T.primary, lineHeight: 23 },

  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: PHOTO_GAP },
  photoThumb: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 0, backgroundColor: '#f2f2f7' },

  mapCard: { height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#e8e8ed' },
  mapHint: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  mapHintText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  pin: {
    minWidth: 34, height: 22, borderRadius: 11, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3,
  },
  pinText: { fontSize: 10, fontWeight: '800' },

  fullMap: { flex: 1 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, gap: 8 },
  modalBackBtn: {
    width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  modalPill: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6,
  },
  modalPillText: { fontSize: 15, fontWeight: '600', color: '#1c1c1e', textAlign: 'center' },
});

const e = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  cancel: { fontSize: 16, color: T.muted },
  title: { fontSize: 17, fontWeight: '600', color: T.primary },
  save: { fontSize: 16, fontWeight: '600', color: T.accent },
  form: { paddingHorizontal: 20, paddingTop: 16 },

  sectionLabel: { fontSize: 12, fontWeight: '600', color: T.muted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: T.inputBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: T.primary, marginBottom: 16 },
  inputMulti: { minHeight: 90, textAlignVertical: 'top', marginBottom: 0 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  occasionRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  occasionBtn: {
    flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.inputBg, gap: 4,
  },
  occasionBtnSel: { backgroundColor: T.accentTint, borderColor: T.accent },
  occasionLabel: { fontSize: 14, fontWeight: '600', color: T.primary },
  occasionLabelSel: { color: T.accent },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: T.inputBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipSel: { backgroundColor: T.accentTint, borderColor: T.accent },
  chipLabel: { fontSize: 13, fontWeight: '600', color: T.primary },
  chipLabelSel: { color: T.accent },

  priceRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  priceBtn: { flex: 1, backgroundColor: T.inputBg, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  priceBtnSel: { backgroundColor: T.accentTint, borderColor: T.accent },
  priceBtnText: { fontSize: 14, fontWeight: '600', color: T.primary },
  priceBtnTextSel: { color: T.accent },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: PHOTO_GAP, marginBottom: 16 },
  photoThumb: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 0, overflow: 'hidden' },
  photoThumbImg: { width: '100%', height: '100%' },
  photoAdd: {
    width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 0,
    backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1, borderColor: T.border, borderStyle: 'dashed',
  },
  photoAddLabel: { fontSize: 10, color: T.muted, fontWeight: '500' },

  dateTabRow: { flexDirection: 'row', gap: 8 },
  dateTab: { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: T.border, paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center', gap: 2 },
  dateTabOpen: { borderColor: T.accent, backgroundColor: T.accentTint },
  dateTabLabel: { fontSize: 10, fontWeight: '600', color: T.muted, letterSpacing: 0.5 },
  dateTabValue: { fontSize: 18, fontWeight: '700', color: T.primary },
  dateTabValueOpen: { color: T.accent },
  dateDropdown: { borderRadius: 12, borderWidth: 1.5, borderColor: T.accent, backgroundColor: T.card, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.13, shadowRadius: 14, elevation: 10 },
  dateOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, height: DATE_OPTION_H, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border },
  dateOptionSelected: { backgroundColor: T.accentTint },
  dateOptionText: { fontSize: 15, fontWeight: '500', color: T.primary },
  dateOptionTextSelected: { color: T.accent, fontWeight: '700' },
  dateFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 36 },
});
