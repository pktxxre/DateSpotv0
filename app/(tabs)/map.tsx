import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, Pressable, TextInput, Alert, ScrollView, Image,
} from 'react-native';
import MapView, { Marker, Region, MapPressEvent } from 'react-native-maps';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import {
  getAllVisits, insertVisit, ratingColor, formatRating, Visit,
  ActivityType, Price, ACTIVITY_TYPES, PRICE_LABELS,
} from '@/lib/visits';
import {
  startComparison, advance, resolveRankOrder, resolveAtMid,
  currentComparison, ComparisonState, Triage,
} from '@/lib/ranking';
import { saveDraft, loadDraft, clearDraft } from '@/lib/draft';
import { uploadPhoto } from '@/lib/storage';
import { T } from '@/lib/theme';

const SF_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type Step = 'location' | 'details' | 'triage' | 'compare' | 'done';

interface DraftVisit {
  lat: number;
  lng: number;
  venue_name: string;
  visited_at: string;
  notes: string;
  activity_type: ActivityType;
  price: Price;
  photos: string[];
}

export default function MapScreen() {
  const { openLog: openLogParam } = useLocalSearchParams<{ openLog?: string }>();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [draft, setDraft] = useState<Partial<DraftVisit>>({});
  const [droppingPin, setDroppingPin] = useState(false);
  const [cmpState, setCmpState] = useState<ComparisonState | null>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);
  const openLogHandled = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setVisits(getAllVisits());
      if (openLogParam === '1' && !openLogHandled.current) {
        openLogHandled.current = true;
        setSelectedVisit(null);
        setStep('location');
        sheetRef.current?.snapToIndex(1);
      }
      loadDraft().then((saved) => {
        if (saved && saved.step !== 'done') {
          Alert.alert(
            'Resume logging?',
            `You were logging "${saved.venue_name || 'a spot'}" — continue?`,
            [
              { text: 'Start fresh', style: 'destructive', onPress: () => clearDraft() },
              {
                text: 'Resume', onPress: () => {
                  setDraft({
                    lat: saved.lat,
                    lng: saved.lng,
                    venue_name: saved.venue_name,
                    visited_at: saved.visited_at,
                    notes: saved.notes,
                  });
                  const resumeStep: Step = saved.step === 'compare' || saved.step === 'triage'
                    ? 'details'
                    : saved.step as Step;
                  setStep(resumeStep);
                  sheetRef.current?.snapToIndex(1);
                }
              },
            ]
          );
        }
      });
    }, [])
  );

  useEffect(() => {
    if (step === null || step === 'location') return;
    saveDraft({ ...draft, step, savedAt: new Date().toISOString() });
  }, [step, draft]);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then(loc => {
          mapRef.current?.animateToRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }, 800);
        })
        .catch(() => {});
    });
  }, []);

  function openLog() {
    setSelectedVisit(null);
    setStep('location');
    sheetRef.current?.snapToIndex(1);
  }

  function resetFlow() {
    setStep(null);
    setDraft({});
    setDroppingPin(false);
    setCmpState(null);
    clearDraft();
  }

  async function handleUseLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location access needed', 'Enable location in Settings to use this feature.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setDraft((d) => ({ ...d, lat: loc.coords.latitude, lng: loc.coords.longitude }));
    setStep('details');
    sheetRef.current?.snapToIndex(2);
  }

  function handleDropPin() {
    setDroppingPin(true);
    sheetRef.current?.snapToIndex(0);
  }

  function handleMapPress(e: MapPressEvent) {
    if (!droppingPin) {
      setSelectedVisit(null);
      return;
    }
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setDraft((d) => ({ ...d, lat: latitude, lng: longitude }));
    setDroppingPin(false);
    setStep('details');
    sheetRef.current?.snapToIndex(2);
  }

  function handleSearchPlaceholder() {
    Alert.alert('Search venues', 'Venue search coming in V1.5. Drop a pin or use your location for now.');
  }

  function handleDetailsDone() {
    if (!draft.venue_name?.trim()) {
      Alert.alert('Name required', 'What was this place called?');
      return;
    }
    if (!draft.activity_type) {
      Alert.alert('Type required', 'What kind of spot was this?');
      return;
    }
    const existing = getAllVisits();
    if (existing.length === 0) {
      saveVisit(1000);
      return;
    }
    setStep('triage');
    sheetRef.current?.snapToIndex(1);
  }

  function handleTriage(triage: Triage) {
    const existing = getAllVisits();
    const initial = startComparison(existing, draft.activity_type, triage);
    setCmpState(initial);
    if (initial === null) {
      saveVisit(1000);
      return;
    }
    setStep('compare');
    sheetRef.current?.snapToIndex(1);
  }

  function handleCompare(result: 'better' | 'worse') {
    const next = cmpState ? advance(cmpState, result) : null;
    if (next === null) {
      const existing = getAllVisits();
      const rank_order = resolveRankOrder(cmpState, existing);
      saveVisit(rank_order);
    } else {
      setCmpState(next);
    }
  }

  function handleTooHard() {
    if (!cmpState) return;
    const existing = getAllVisits();
    const rank_order = resolveAtMid(cmpState, existing);
    saveVisit(rank_order);
  }

  function saveVisit(rank_order: number) {
    if (!draft.lat || !draft.lng || !draft.venue_name) return;
    insertVisit({
      id: Crypto.randomUUID(),
      venue_name: draft.venue_name.trim(),
      lat: draft.lat,
      lng: draft.lng,
      visited_at: draft.visited_at || new Date().toISOString(),
      rank_order,
      notes: draft.notes || undefined,
      activity_type: draft.activity_type || 'other',
      price: draft.price || 2,
      photos: draft.photos || [],
    });
    setVisits(getAllVisits());
    setStep('done');
    sheetRef.current?.snapToIndex(1);
  }

  function handlePinPress(visit: Visit) {
    if (step !== null) return;
    setSelectedVisit((prev) => (prev?.id === visit.id ? null : visit));
  }

  const snapPoints = ['30%', '68%', '95%'];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={SF_REGION}
        mapType="standard"
        showsUserLocation={false}
        showsMyLocationButton={false}
        onPress={handleMapPress}
      >
        {visits.map((v) => (
          <Marker
            key={v.id}
            coordinate={{ latitude: v.lat, longitude: v.lng }}
            onPress={() => handlePinPress(v)}
          >
            <View style={[styles.pinBadge, { borderColor: ratingColor(v.rating) }]}>
              <Text style={[styles.pinScore, { color: ratingColor(v.rating) }]}>{formatRating(v.rating)}</Text>
            </View>
          </Marker>
        ))}
        {draft.lat != null && draft.lng != null && (
          <Marker coordinate={{ latitude: draft.lat, longitude: draft.lng }} pinColor="#ff3b5c" />
        )}
      </MapView>

      {droppingPin && (
        <View style={styles.pinHint} pointerEvents="none">
          <Text style={styles.pinHintText}>Tap the map to drop a pin</Text>
        </View>
      )}

      {selectedVisit && step === null && (
        <VisitDetail visit={selectedVisit} onClose={() => setSelectedVisit(null)} />
      )}

      {visits.length === 0 && step === null && (
        <View style={styles.emptyState} pointerEvents="none">
          <Text style={styles.emptyText}>Tap + to log your first date spot</Text>
        </View>
      )}

      {step === null && (
        <Pressable style={styles.fab} onPress={openLog}>
          <Ionicons name="add" size={30} color="#fff" />
        </Pressable>
      )}

      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={resetFlow}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.sheetContent}>
          {step === 'location' && (
            <LocationStep
              onUseLocation={handleUseLocation}
              onDropPin={handleDropPin}
              onSearch={handleSearchPlaceholder}
            />
          )}
          {step === 'details' && (
            <DetailsStep
              draft={draft}
              onChange={(key, val) => setDraft((d) => ({ ...d, [key]: val }))}
              onNext={handleDetailsDone}
              onBack={() => sheetRef.current?.close()}
            />
          )}
          {step === 'triage' && (
            <TriageStep onPick={handleTriage} />
          )}
          {step === 'compare' && cmpState && (
            <CompareStep
              newVenueName={draft.venue_name || ''}
              opponent={currentComparison(cmpState)}
              comparisonNumber={cmpState.count + 1}
              onBetter={() => handleCompare('better')}
              onWorse={() => handleCompare('worse')}
              onTooHard={handleTooHard}
              onBack={() => { setStep('triage'); sheetRef.current?.snapToIndex(1); }}
            />
          )}
          {step === 'done' && (
            <DoneStep
              venueName={draft.venue_name || ''}
              onAnother={() => { resetFlow(); openLog(); }}
              onClose={() => sheetRef.current?.close()}
            />
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

function VisitDetail({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const info = ACTIVITY_TYPES.find((a) => a.value === visit.activity_type);
  return (
    <Pressable style={styles.detailCard} onPress={() => router.push(`/spot/${visit.id}`)}>
      <View style={styles.detailHeader}>
        <Text style={styles.detailName} numberOfLines={1}>{visit.venue_name}</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={20} color="#8e8e93" />
        </Pressable>
      </View>
      <View style={styles.detailMeta}>
        <View style={[styles.detailScorePill, { backgroundColor: ratingColor(visit.rating) + '2E' }]}>
          <Text style={[styles.detailScoreText, { color: ratingColor(visit.rating) }]}>{formatRating(visit.rating)}</Text>
        </View>
        <Text style={styles.detailMetaText}>{info?.emoji} {info?.label}</Text>
        <Text style={styles.detailMetaDot}>·</Text>
        <Text style={styles.detailMetaText}>{PRICE_LABELS[visit.price as Price]}</Text>
      </View>
      {visit.notes ? (
        <Text style={styles.detailNotes} numberOfLines={2}>{visit.notes}</Text>
      ) : null}
      <Text style={styles.detailTapHint}>Tap to view details →</Text>
    </Pressable>
  );
}

function LocationStep({ onUseLocation, onDropPin, onSearch }: {
  onUseLocation: () => void; onDropPin: () => void; onSearch: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Where did you go?</Text>
      <Text style={styles.stepSubtitle}>Step 1 of 5</Text>
      <View style={styles.circleRow}>
        <CircleButton icon="location" label="Use location" sublabel="Where I am now" onPress={onUseLocation} tint="#e8f0fe" />
        <CircleButton icon="map" label="Drop a pin" sublabel="Tap the map" onPress={onDropPin} tint="#f2f2f7" />
        <CircleButton icon="search" label="Search" sublabel="Venues & places" onPress={onSearch} tint="#e8f8ec" />
      </View>
    </View>
  );
}

function CircleButton({ icon, label, sublabel, onPress, tint }: {
  icon: string; label: string; sublabel: string; onPress: () => void; tint: string;
}) {
  return (
    <Pressable style={styles.circleBtn} onPress={onPress}>
      <View style={[styles.circle, { backgroundColor: tint }]}>
        <Ionicons name={icon as any} size={28} color="#1c1c1e" />
      </View>
      <Text style={styles.circleBtnLabel}>{label}</Text>
      <Text style={styles.circleBtnSub}>{sublabel}</Text>
    </Pressable>
  );
}

function DetailsStep({ draft, onChange, onNext, onBack }: {
  draft: Partial<DraftVisit>;
  onChange: (key: string, val: any) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  const photos: string[] = draft.photos || [];

  async function pickPhoto() {
    let ImagePicker: any;
    try { ImagePicker = require('expo-image-picker'); } catch {}
    if (!ImagePicker?.requestMediaLibraryPermissionsAsync) {
      Alert.alert('Photo picking unavailable', 'Run `npx expo run:ios` once to compile the native photo module.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    const path = `visits/${Date.now()}.jpg`;
    const url = await uploadPhoto(result.assets[0].uri, path);
    setUploading(false);
    if (url) onChange('photos', [...photos, url]);
  }

  function removePhoto(index: number) {
    onChange('photos', photos.filter((_, i) => i !== index));
  }

  return (
    <ScrollView style={styles.stepContainer} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>Tell me about it</Text>
      <Text style={styles.stepSubtitle}>Step 2 of 5</Text>

      <TextInput
        style={styles.input}
        placeholder="Venue name, e.g. Tartine Bakery"
        placeholderTextColor="#c7c7cc"
        value={draft.venue_name || ''}
        onChangeText={(v) => onChange('venue_name', v)}
        autoFocus
        returnKeyType="next"
      />

      <TextInput
        style={styles.input}
        placeholder="Date (e.g. Apr 28)"
        placeholderTextColor="#c7c7cc"
        value={draft.visited_at || ''}
        onChangeText={(v) => onChange('visited_at', v)}
        returnKeyType="next"
      />

      <Text style={styles.sectionLabel}>Photos</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.photoScroll}
        contentContainerStyle={styles.photoScrollContent}
      >
        {photos.map((uri, i) => (
          <Pressable key={i} style={styles.photoThumb} onLongPress={() => removePhoto(i)}>
            <Image source={{ uri }} style={styles.photoThumbImg} />
          </Pressable>
        ))}
        <Pressable style={styles.photoAdd} onPress={pickPhoto} disabled={uploading}>
          <Ionicons name={uploading ? 'hourglass-outline' : 'camera-outline'} size={22} color={T.muted} />
          <Text style={styles.photoAddLabel}>{uploading ? 'Uploading…' : 'Add photo'}</Text>
        </Pressable>
      </ScrollView>

      <Text style={styles.sectionLabel}>What kind of spot?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ paddingHorizontal: 24 }}>
        {ACTIVITY_TYPES.map((a) => {
          const selected = draft.activity_type === a.value;
          return (
            <Pressable
              key={a.value}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange('activity_type', a.value)}
            >
              <Text style={styles.chipEmoji}>{a.emoji}</Text>
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{a.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionLabel}>Price range</Text>
      <View style={styles.priceRow}>
        {([1, 2, 3] as Price[]).map((p) => {
          const selected = draft.price === p;
          return (
            <Pressable
              key={p}
              style={[styles.priceBtn, selected && styles.priceBtnSelected]}
              onPress={() => onChange('price', p)}
            >
              <Text style={[styles.priceBtnText, selected && styles.priceBtnTextSelected]}>
                {PRICE_LABELS[p]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={[styles.input, styles.inputMultiline]}
        placeholder="Notes — what made it memorable?"
        placeholderTextColor="#c7c7cc"
        value={draft.notes || ''}
        onChangeText={(v) => onChange('notes', v)}
        multiline
        numberOfLines={3}
      />

      <View style={styles.btnRow}>
        <Pressable style={styles.btnSecondary} onPress={onBack}>
          <Text style={styles.btnSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.btnPrimary} onPress={onNext}>
          <Text style={styles.btnPrimaryText}>Next</Text>
        </Pressable>
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function TriageStep({ onPick }: { onPick: (t: Triage) => void }) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>First impression?</Text>
      <Text style={styles.stepSubtitle}>Step 3 of 5 · Narrows your comparisons</Text>
      <View style={styles.triageRow}>
        <Pressable style={[styles.triageBtn, { backgroundColor: '#fff2f2', borderColor: '#ff3b30' }]} onPress={() => onPick('bad')}>
          <Text style={styles.triageEmoji}>😬</Text>
          <Text style={[styles.triageLabel, { color: '#ff3b30' }]}>Bad</Text>
        </Pressable>
        <Pressable style={[styles.triageBtn, { backgroundColor: '#fff8ee', borderColor: '#ff9500' }]} onPress={() => onPick('okay')}>
          <Text style={styles.triageEmoji}>😐</Text>
          <Text style={[styles.triageLabel, { color: '#ff9500' }]}>Okay</Text>
        </Pressable>
        <Pressable style={[styles.triageBtn, { backgroundColor: '#f0fff4', borderColor: '#34c759' }]} onPress={() => onPick('great')}>
          <Text style={styles.triageEmoji}>🤩</Text>
          <Text style={[styles.triageLabel, { color: '#34c759' }]}>Great</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CompareStep({ newVenueName, opponent, comparisonNumber, onBetter, onWorse, onTooHard, onBack }: {
  newVenueName: string; opponent: Visit; comparisonNumber: number;
  onBetter: () => void; onWorse: () => void; onTooHard: () => void; onBack: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Which was better?</Text>
      <Text style={styles.stepSubtitle}>Step 4 of 5 · Comparison {comparisonNumber} of up to 7</Text>
      <View style={styles.compareRow}>
        <Pressable style={[styles.compareCard, styles.compareCardNew]} onPress={onBetter}>
          <Text style={styles.compareCardEmoji}>✨</Text>
          <Text style={styles.compareCardName} numberOfLines={2}>{newVenueName}</Text>
          <Text style={styles.compareCardLabel}>This one</Text>
        </Pressable>
        <View style={styles.compareVs}><Text style={styles.compareVsText}>vs</Text></View>
        <Pressable style={[styles.compareCard, styles.compareCardOld]} onPress={onWorse}>
          <View style={[styles.compareCardScorePill, { backgroundColor: ratingColor(opponent.rating) + '2E' }]}>
            <Text style={[styles.compareCardScoreText, { color: ratingColor(opponent.rating) }]}>{formatRating(opponent.rating)}</Text>
          </View>
          <Text style={styles.compareCardName} numberOfLines={2}>{opponent.venue_name}</Text>
          <Text style={styles.compareCardLabel}>That one</Text>
        </Pressable>
      </View>
      <Pressable style={styles.tooHardBtn} onPress={onTooHard}>
        <Text style={styles.tooHardText}>Too hard to compare</Text>
      </Pressable>
      <Pressable style={styles.btnSecondaryCenter} onPress={onBack}>
        <Text style={styles.btnSecondaryText}>Back to impression</Text>
      </Pressable>
    </View>
  );
}

function DoneStep({ venueName, onAnother, onClose }: {
  venueName: string; onAnother: () => void; onClose: () => void;
}) {
  return (
    <View style={[styles.stepContainer, styles.doneContainer]}>
      <Text style={styles.doneEmoji}>📍</Text>
      <Text style={styles.doneTitle}>Logged!</Text>
      <Text style={styles.doneSub}>{venueName} is on your map.</Text>
      <View style={styles.btnRow}>
        <Pressable style={styles.btnSecondary} onPress={onClose}>
          <Text style={styles.btnSecondaryText}>Done</Text>
        </Pressable>
        <Pressable style={styles.btnPrimary} onPress={onAnother}>
          <Text style={styles.btnPrimaryText}>Log another</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  pinBadge: {
    minWidth: 40, height: 26, borderRadius: 13,
    paddingHorizontal: 7,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4,
  },
  pinScore: { fontSize: 12, fontWeight: '800' },

  pinHint: {
    position: 'absolute', top: 60, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
  },
  pinHintText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  detailCard: {
    position: 'absolute', bottom: 90, left: 16, right: 16,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  detailName: { flex: 1, fontSize: 16, fontWeight: '700', color: T.primary },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailScorePill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  detailScoreText: { fontSize: 13, fontWeight: '800' },
  detailMetaText: { fontSize: 14, color: T.primary },
  detailMetaDot: { fontSize: 14, color: T.placeholder },
  detailNotes: { fontSize: 13, color: T.muted, marginTop: 10, lineHeight: 18 },
  detailTapHint: { fontSize: 12, color: T.placeholder, marginTop: 10, textAlign: 'right' },

  emptyState: {
    position: 'absolute', bottom: 90, left: 24, right: 24,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12, padding: 16, alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: T.muted, textAlign: 'center' },

  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: T.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },

  sheetBg: { backgroundColor: T.bg, borderRadius: 20 },
  handle: { backgroundColor: T.border },
  sheetContent: { flex: 1 },
  stepContainer: { paddingHorizontal: 24, paddingTop: 4 },
  stepTitle: { fontSize: 20, fontWeight: '700', color: T.primary, textAlign: 'center' },
  stepSubtitle: { fontSize: 13, color: T.muted, textAlign: 'center', marginTop: 4, marginBottom: 20 },

  circleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  circleBtn: { alignItems: 'center', flex: 1 },
  circle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  circleBtnLabel: { fontSize: 13, fontWeight: '600', color: T.primary, textAlign: 'center' },
  circleBtnSub: { fontSize: 11, color: T.muted, textAlign: 'center', marginTop: 2 },

  sectionLabel: { fontSize: 13, fontWeight: '600', color: T.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  photoScroll: { marginBottom: 16, marginHorizontal: -24 },
  photoScrollContent: { paddingHorizontal: 24, alignItems: 'center' },
  photoThumb: {
    width: 80, height: 80, borderRadius: 10, overflow: 'hidden',
    marginRight: 8,
  },
  photoThumbImg: { width: '100%', height: '100%' },
  photoAdd: {
    width: 80, height: 80, borderRadius: 10,
    borderWidth: 1.5, borderColor: T.border,
    backgroundColor: T.card,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    marginRight: 8,
  },
  photoAddLabel: { fontSize: 11, color: T.muted, fontWeight: '500' },

  chipScroll: { marginBottom: 16, marginHorizontal: -24 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.card, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9, marginRight: 8,
    borderWidth: 1.5, borderColor: T.border,
  },
  chipSelected: { backgroundColor: T.accentTint, borderColor: T.accent },
  chipEmoji: { fontSize: 15 },
  chipLabel: { fontSize: 14, fontWeight: '500', color: T.primary },
  chipLabelSelected: { color: T.accent, fontWeight: '700' },

  priceRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  priceBtn: {
    flex: 1, backgroundColor: T.inputBg, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  priceBtnSelected: { backgroundColor: T.accentTint, borderColor: T.accent },
  priceBtnText: { fontSize: 16, fontWeight: '600', color: T.primary },
  priceBtnTextSelected: { color: T.accent },

  input: {
    backgroundColor: T.inputBg, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: T.primary, marginBottom: 12,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  triageRow: { flexDirection: 'row', gap: 12 },
  triageBtn: {
    flex: 1, borderRadius: 16, paddingVertical: 20,
    alignItems: 'center', gap: 8,
    borderWidth: 2,
  },
  triageEmoji: { fontSize: 32 },
  triageLabel: { fontSize: 15, fontWeight: '700' },

  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  compareCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', gap: 8, minHeight: 120, justifyContent: 'center' },
  compareCardNew: { backgroundColor: T.accentTint, borderWidth: 2, borderColor: T.accent },
  compareCardOld: { backgroundColor: T.inputBg, borderWidth: 2, borderColor: T.border },
  compareCardEmoji: { fontSize: 24 },
  compareCardScorePill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  compareCardScoreText: { fontSize: 13, fontWeight: '800' },
  compareCardName: { fontSize: 14, fontWeight: '700', color: T.primary, textAlign: 'center', lineHeight: 18 },
  compareCardLabel: { fontSize: 11, color: T.muted, fontWeight: '500' },
  compareVs: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center' },
  compareVsText: { fontSize: 12, fontWeight: '700', color: T.muted },

  tooHardBtn: {
    backgroundColor: T.inputBg, borderRadius: 14,
    paddingVertical: 12, alignItems: 'center', marginBottom: 8,
  },
  tooHardText: { fontSize: 14, fontWeight: '600', color: T.muted },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: T.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: { flex: 1, backgroundColor: T.inputBg, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnSecondaryCenter: { backgroundColor: T.inputBg, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnSecondaryText: { color: T.primary, fontSize: 16, fontWeight: '600' },

  doneContainer: { alignItems: 'center', paddingTop: 16 },
  doneEmoji: { fontSize: 48, marginBottom: 12 },
  doneTitle: { fontSize: 24, fontWeight: '800', color: T.primary, marginBottom: 6 },
  doneSub: { fontSize: 15, color: T.muted, marginBottom: 24 },
});
