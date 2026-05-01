import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Region, MapPressEvent } from 'react-native-maps';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import {
  getAllVisits,
  insertVisit,
  ratingColor,
  Visit,
  ActivityType,
  Price,
  ACTIVITY_TYPES,
  PRICE_LABELS,
} from '@/lib/visits';
import {
  startComparison,
  advance,
  resolveRankOrder,
  currentComparison,
  ComparisonState,
} from '@/lib/ranking';
import { saveDraft, loadDraft, clearDraft } from '@/lib/draft';

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
}

export default function LogScreen() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [step, setStep] = useState<Step>('location');
  const [draft, setDraft] = useState<Partial<DraftVisit>>({});
  const [droppingPin, setDroppingPin] = useState(false);
  const [cmpState, setCmpState] = useState<ComparisonState | null>(null);
  const sheetRef = useRef<BottomSheet>(null);

  useFocusEffect(
    useCallback(() => {
      setVisits(getAllVisits());
      loadDraft().then((saved) => {
        if (saved && saved.step !== 'done') {
          Alert.alert(
            'Resume logging?',
            `You were logging "${saved.venue_name || 'a spot'}" — continue?`,
            [
              { text: 'Start fresh', style: 'destructive', onPress: () => { clearDraft(); resetFlow(); } },
              {
                text: 'Resume', onPress: () => {
                  setDraft({
                    lat: saved.lat,
                    lng: saved.lng,
                    venue_name: saved.venue_name,
                    visited_at: saved.visited_at,
                    notes: saved.notes,
                  });
                  setStep(saved.step === 'compare' ? 'details' : saved.step);
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
    if (step === 'location') return;
    saveDraft({ ...draft, step, savedAt: new Date().toISOString() });
  }, [step, draft]);

  function resetFlow() {
    setStep('location');
    setDraft({});
    setDroppingPin(false);
    setCmpState(null);
    clearDraft();
    sheetRef.current?.snapToIndex(0);
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
    sheetRef.current?.snapToIndex(1);
  }

  function handleDropPin() {
    setDroppingPin(true);
    sheetRef.current?.snapToIndex(0);
  }

  function handleMapPress(e: MapPressEvent) {
    if (!droppingPin) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setDraft((d) => ({ ...d, lat: latitude, lng: longitude }));
    setDroppingPin(false);
    setStep('details');
    sheetRef.current?.snapToIndex(1);
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
    const initial = startComparison(existing);
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
    });
    setVisits(getAllVisits());
    setStep('done');
    sheetRef.current?.snapToIndex(1);
  }

  const snapPoints = ['30%', '68%'];

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={SF_REGION}
        mapType="standard"
        showsUserLocation={false}
        onPress={handleMapPress}
      >
        {visits.map((v) => (
          <Marker key={v.id} coordinate={{ latitude: v.lat, longitude: v.lng }}>
            <View style={[styles.pin, { backgroundColor: ratingColor(v.rating) }]} />
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

      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
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
              onBack={resetFlow}
            />
          )}
          {step === 'compare' && cmpState && (
            <CompareStep
              newVenueName={draft.venue_name || ''}
              opponent={currentComparison(cmpState)}
              comparisonNumber={cmpState.count + 1}
              onBetter={() => handleCompare('better')}
              onWorse={() => handleCompare('worse')}
              onBack={() => { setStep('details'); sheetRef.current?.snapToIndex(1); }}
            />
          )}
          {step === 'done' && (
            <DoneStep venueName={draft.venue_name || ''} onAnother={resetFlow} />
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

function LocationStep({ onUseLocation, onDropPin, onSearch }: {
  onUseLocation: () => void; onDropPin: () => void; onSearch: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Where did you go?</Text>
      <Text style={styles.stepSubtitle}>Step 1 of 4</Text>
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
  return (
    <ScrollView style={styles.stepContainer} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>Tell me about it</Text>
      <Text style={styles.stepSubtitle}>Step 2 of 4</Text>

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

      <Text style={styles.sectionLabel}>What kind of spot?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
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
          <Text style={styles.btnSecondaryText}>Back</Text>
        </Pressable>
        <Pressable style={styles.btnPrimary} onPress={onNext}>
          <Text style={styles.btnPrimaryText}>Next</Text>
        </Pressable>
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function CompareStep({ newVenueName, opponent, comparisonNumber, onBetter, onWorse, onBack }: {
  newVenueName: string; opponent: Visit; comparisonNumber: number;
  onBetter: () => void; onWorse: () => void; onBack: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Which was better?</Text>
      <Text style={styles.stepSubtitle}>Ranking · {comparisonNumber} of up to 7</Text>
      <View style={styles.compareRow}>
        <Pressable style={[styles.compareCard, styles.compareCardNew]} onPress={onBetter}>
          <Text style={styles.compareCardEmoji}>✨</Text>
          <Text style={styles.compareCardName} numberOfLines={2}>{newVenueName}</Text>
          <Text style={styles.compareCardLabel}>This one</Text>
        </Pressable>
        <View style={styles.compareVs}><Text style={styles.compareVsText}>vs</Text></View>
        <Pressable style={[styles.compareCard, styles.compareCardOld]} onPress={onWorse}>
          <View style={[styles.compareCardBadge, { backgroundColor: ratingColor(opponent.rating) }]} />
          <Text style={styles.compareCardName} numberOfLines={2}>{opponent.venue_name}</Text>
          <Text style={styles.compareCardLabel}>That one</Text>
        </Pressable>
      </View>
      <Pressable style={styles.btnSecondaryCenter} onPress={onBack}>
        <Text style={styles.btnSecondaryText}>Start over</Text>
      </Pressable>
    </View>
  );
}

function DoneStep({ venueName, onAnother }: { venueName: string; onAnother: () => void }) {
  return (
    <View style={[styles.stepContainer, styles.doneContainer]}>
      <Text style={styles.doneEmoji}>📍</Text>
      <Text style={styles.doneTitle}>Logged!</Text>
      <Text style={styles.doneSub}>{venueName} is on your map.</Text>
      <Pressable style={styles.btnPrimary} onPress={onAnother}>
        <Text style={styles.btnPrimaryText}>Log another</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  pin: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2.5, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  pinHint: {
    position: 'absolute', top: 60, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
  },
  pinHintText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sheetBg: { backgroundColor: '#fff', borderRadius: 20 },
  handle: { backgroundColor: '#d1d1d6' },
  sheetContent: { flex: 1 },
  stepContainer: { paddingHorizontal: 24, paddingTop: 4 },
  stepTitle: { fontSize: 20, fontWeight: '700', color: '#1c1c1e', textAlign: 'center' },
  stepSubtitle: { fontSize: 13, color: '#8e8e93', textAlign: 'center', marginTop: 4, marginBottom: 20 },
  circleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  circleBtn: { alignItems: 'center', flex: 1 },
  circle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  circleBtnLabel: { fontSize: 13, fontWeight: '600', color: '#1c1c1e', textAlign: 'center' },
  circleBtnSub: { fontSize: 11, color: '#8e8e93', textAlign: 'center', marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#8e8e93', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipScroll: { marginBottom: 16, marginHorizontal: -24 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f2f2f7', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9, marginRight: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipSelected: { backgroundColor: '#fff0f3', borderColor: '#ff3b5c' },
  chipEmoji: { fontSize: 15 },
  chipLabel: { fontSize: 14, fontWeight: '500', color: '#3a3a3c' },
  chipLabelSelected: { color: '#ff3b5c', fontWeight: '700' },
  priceRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  priceBtn: {
    flex: 1, backgroundColor: '#f2f2f7', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  priceBtnSelected: { backgroundColor: '#fff0f3', borderColor: '#ff3b5c' },
  priceBtnText: { fontSize: 16, fontWeight: '600', color: '#3a3a3c' },
  priceBtnTextSelected: { color: '#ff3b5c' },
  input: {
    backgroundColor: '#f2f2f7', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#1c1c1e', marginBottom: 12,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: '#ff3b5c', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: { flex: 1, backgroundColor: '#f2f2f7', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnSecondaryCenter: { backgroundColor: '#f2f2f7', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnSecondaryText: { color: '#1c1c1e', fontSize: 16, fontWeight: '600' },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  compareCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', gap: 8, minHeight: 120, justifyContent: 'center' },
  compareCardNew: { backgroundColor: '#fff5f7', borderWidth: 2, borderColor: '#ff3b5c' },
  compareCardOld: { backgroundColor: '#f2f2f7', borderWidth: 2, borderColor: '#e5e5ea' },
  compareCardEmoji: { fontSize: 24 },
  compareCardBadge: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#fff' },
  compareCardName: { fontSize: 14, fontWeight: '700', color: '#1c1c1e', textAlign: 'center', lineHeight: 18 },
  compareCardLabel: { fontSize: 11, color: '#8e8e93', fontWeight: '500' },
  compareVs: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f2f2f7', alignItems: 'center', justifyContent: 'center' },
  compareVsText: { fontSize: 12, fontWeight: '700', color: '#8e8e93' },
  doneContainer: { alignItems: 'center', paddingTop: 16 },
  doneEmoji: { fontSize: 48, marginBottom: 12 },
  doneTitle: { fontSize: 24, fontWeight: '800', color: '#1c1c1e', marginBottom: 6 },
  doneSub: { fontSize: 15, color: '#8e8e93', marginBottom: 24 },
});
