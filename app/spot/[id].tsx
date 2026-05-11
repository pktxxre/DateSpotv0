import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Image,
  Alert, ScrollView, Dimensions, TextInput, Share, NativeModules, LayoutAnimation,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getVisitById, deleteVisit, updateVisit, getAllVisits, updateRankOrder, recomputeRatings, Visit,
  ACTIVITY_TYPES, PRICE_LABELS, DATE_TYPES, Price, ActivityType, DateType,
  ratingColor, formatRating, friendlyDate,
} from '@/lib/visits';
import {
  startComparison, advance, resolveRankOrder, resolveAtMid,
  currentComparison, ComparisonState,
} from '@/lib/ranking';
import { uploadPhoto } from '@/lib/storage';
import { T } from '@/lib/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 20;
const PHOTO_COLS = 3;
const PHOTO_GAP = 4;
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
  const others = getAllVisits().filter(v => v.id !== visit.id && v.triage === visit.triage);
  const [cmpState, setCmpState] = useState<ComparisonState | null>(() => startComparison(others, visit.triage));

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
      <Text style={r.subtitle}>Log more {visit.triage} spots to start ranking.</Text>
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
  title: { fontSize: 20, fontWeight: '700', color: T.primary, fontFamily: 'Georgia', textAlign: 'center', marginBottom: 4 },
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


export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rankingAgain, setRankingAgain] = useState(false);

  useFocusEffect(useCallback(() => {
    if (id) setVisit(getVisitById(id));
  }, [id]));

  if (!visit) return null;

  const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
  const color = ratingColor(visit.rating);
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);

  async function handleShare() {
    try {
      await Share.share({ message: `Checked out ${visit!.venue_name} — rated it ${formatRating(visit!.rating)}/10 on DateSpot.` });
    } catch {}
  }

  function handleDelete() {
    Alert.alert('Remove Spot', `Remove "${visit!.venue_name}" from your log?`, [
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
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={26} color={T.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={handleShare} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="share-outline" size={22} color={T.primary} />
          </Pressable>
          <Pressable onPress={() => setEditing(true)} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="pencil-outline" size={20} color={T.primary} />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="trash-outline" size={20} color={T.danger} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Hero: name + date + tags */}
        <View style={styles.hero}>
          <Text style={styles.venueName}>{visit.venue_name}</Text>
          <Text style={styles.dateStr}>{dateStr}</Text>

          <View style={styles.tags}>
            {info && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{info.label}</Text>
              </View>
            )}
            <View style={styles.tag}>
              <Text style={styles.tagText}>{PRICE_LABELS[visit.price as Price]}</Text>
            </View>
          </View>

          {/* Rating — smaller, secondary */}
          <View style={styles.ratingRow}>
            <View style={[styles.ratingBadge, { borderColor: color }]}>
              <Text style={[styles.ratingScore, { color }]}>{formatRating(visit.rating)}</Text>
              <Text style={[styles.ratingSlash, { color: color + 'AA' }]}>/10</Text>
            </View>
            <Text style={styles.ratingCaption}>Overall rating</Text>
            <Pressable style={styles.rankAgainBtn} onPress={() => setRankingAgain(true)}>
              <Ionicons name="git-compare-outline" size={13} color={T.accent} />
              <Text style={styles.rankAgainText}>Rank again</Text>
            </Pressable>
          </View>
        </View>

        {/* Notes */}
        {visit.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes from the night</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{visit.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* Photos */}
        {visit.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Photos</Text>
            <View style={styles.photosGrid}>
              {visit.photos.map((uri, idx) => (
                <Image key={idx} source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
              ))}
            </View>
          </View>
        )}

        {/* Map — smaller, below content */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Location</Text>
          <Pressable style={styles.mapCard} onPress={() => setMapExpanded(true)}>
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
              <Ionicons name="expand-outline" size={12} color="#fff" />
              <Text style={styles.mapHintText}>Expand</Text>
            </View>
          </Pressable>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* Full-screen map modal */}
      <Modal visible={mapExpanded} animationType="slide">
        <View style={styles.fullMap}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{ latitude: visit.lat, longitude: visit.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
            showsUserLocation={false} showsPointsOfInterest={false} mapType="standard"
          >
            <Marker coordinate={{ latitude: visit.lat, longitude: visit.lng }}>
              <View style={[styles.pin, { borderColor: color }]}>
                <Text style={[styles.pinText, { color }]}>{formatRating(visit.rating)}</Text>
              </View>
            </Marker>
          </MapView>
          <SafeAreaView style={styles.modalOverlay} edges={['top']} pointerEvents="box-none">
            <View style={styles.modalHeader} pointerEvents="auto">
              <Pressable onPress={() => setMapExpanded(false)} hitSlop={16} style={styles.modalBackBtn}>
                <Ionicons name="chevron-back" size={22} color="#1c1c1e" />
              </Pressable>
              <View style={styles.modalPill}>
                <Text style={styles.modalPillText} numberOfLines={1}>{visit.venue_name}</Text>
              </View>
              <View style={{ width: 44 }} />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

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
    </View>
  );
}

function EditModal({ visit, onClose, onSave }: { visit: Visit; onClose: () => void; onSave: (v: Visit) => void }) {
  const [name, setName] = useState(visit.venue_name);
  const [notes, setNotes] = useState(visit.notes ?? '');
  const [activity, setActivity] = useState<ActivityType | null>(visit.activity_type);
  const [price, setPrice] = useState<Price | undefined>(visit.price);
  const [dateType, setDateType] = useState<DateType | null>(visit.date_type ?? null);
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
    if (!NativeModules.ExponentImagePicker) {
      Alert.alert('Not available', 'Run `npx expo run:ios` to enable photo upload.');
      return;
    }
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo library access.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.8 });
      if (result.canceled || !result.assets[0]) return;
      setUploading(true);
      const url = await uploadPhoto(result.assets[0].uri, `spots/${visit.id}/${Date.now()}.jpg`);
      if (url) setPhotos(prev => [...prev, url]);
      else Alert.alert('Upload failed', 'Could not upload photo.');
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
      price: price ?? visit.price,
      date_type: dateType,
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={e.photoScroll} contentContainerStyle={e.photoScrollContent}>
            {photos.map((uri, idx) => (
              <Pressable key={idx} style={e.photoThumb} onLongPress={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}>
                <Image source={{ uri }} style={e.photoThumbImg} resizeMode="cover" />
              </Pressable>
            ))}
            <Pressable style={e.photoAdd} onPress={pickPhoto} disabled={uploading}>
              <Ionicons name={uploading ? 'hourglass-outline' : 'camera-outline'} size={22} color={T.muted} />
              <Text style={e.photoAddLabel}>{uploading ? 'Uploading…' : 'Add photo'}</Text>
            </Pressable>
          </ScrollView>

          <Text style={e.sectionLabel}>What kind of spot?</Text>
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

          <Text style={e.sectionLabel}>What kind of date?</Text>
          <View style={e.chipWrap}>
            {DATE_TYPES.map(d => {
              const sel = dateType === d.value;
              return (
                <Pressable key={d.value} style={[e.chip, sel && e.chipSel]} onPress={() => setDateType(sel ? null : d.value)}>
                  <Text style={[e.chipLabel, sel && e.chipLabelSel]}>{d.label}</Text>
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
  photoThumb: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 10, backgroundColor: '#f2f2f7' },

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

  photoScroll: { marginBottom: 16, marginHorizontal: -20 },
  photoScrollContent: { paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  photoThumb: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden' },
  photoThumbImg: { width: '100%', height: '100%' },
  photoAdd: {
    width: 72, height: 72, borderRadius: 10,
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
