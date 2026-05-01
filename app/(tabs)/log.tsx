import { useCallback, useRef, useState } from 'react';
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
import { getAllVisits, insertVisit, ratingColor, Rating, Visit } from '@/lib/visits';

const SF_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type Step = 'location' | 'details' | 'rating' | 'done';

interface DraftVisit {
  lat: number;
  lng: number;
  venue_name: string;
  visited_at: string;
  notes: string;
  rating: Rating;
}

export default function LogScreen() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [step, setStep] = useState<Step>('location');
  const [draft, setDraft] = useState<Partial<DraftVisit>>({});
  const [droppingPin, setDroppingPin] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);

  useFocusEffect(
    useCallback(() => {
      setVisits(getAllVisits());
      resetFlow();
    }, [])
  );

  function resetFlow() {
    setStep('location');
    setDraft({});
    setDroppingPin(false);
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
    setDraft((d) => ({ ...d, visited_at: d.visited_at || new Date().toISOString() }));
    setStep('rating');
    sheetRef.current?.snapToIndex(1);
  }

  function handleRatingSelect(rating: Rating) {
    if (!draft.lat || !draft.lng || !draft.venue_name) return;

    const existingVisits = getAllVisits();
    const rank_order = computeRankOrder(rating, existingVisits);

    insertVisit({
      id: Crypto.randomUUID(),
      venue_name: draft.venue_name.trim(),
      lat: draft.lat,
      lng: draft.lng,
      visited_at: draft.visited_at || new Date().toISOString(),
      rating,
      rank_order,
      notes: draft.notes || undefined,
    });

    setVisits(getAllVisits());
    setStep('done');
    sheetRef.current?.snapToIndex(1);
  }

  // Placeholder rank_order — full pairwise comparison ships in Phase 2
  function computeRankOrder(rating: Rating, existing: Visit[]): number {
    const same = existing.filter((v) => v.rating === rating);
    if (same.length === 0) {
      return rating === 3 ? 1000 : rating === 2 ? 500 : 100;
    }
    const ranks = same.map((v) => v.rank_order);
    return Math.max(...ranks) + 1;
  }

  const snapPoints = ['30%', '60%'];

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
          {step === 'rating' && (
            <RatingStep
              venueName={draft.venue_name || ''}
              onSelect={handleRatingSelect}
              onBack={() => { setStep('details'); sheetRef.current?.snapToIndex(1); }}
            />
          )}
          {step === 'done' && (
            <DoneStep
              venueName={draft.venue_name || ''}
              onAnother={resetFlow}
            />
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

function LocationStep({ onUseLocation, onDropPin, onSearch }: {
  onUseLocation: () => void;
  onDropPin: () => void;
  onSearch: () => void;
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
  icon: string;
  label: string;
  sublabel: string;
  onPress: () => void;
  tint: string;
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
  onChange: (key: string, val: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <ScrollView style={styles.stepContainer} keyboardShouldPersistTaps="handled">
      <Text style={styles.stepTitle}>Name this spot</Text>
      <Text style={styles.stepSubtitle}>Step 2 of 4</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Tartine Bakery"
        placeholderTextColor="#c7c7cc"
        value={draft.venue_name || ''}
        onChangeText={(v) => onChange('venue_name', v)}
        autoFocus
        returnKeyType="next"
      />
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        placeholder="Notes (optional) — what made it good or bad?"
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
    </ScrollView>
  );
}

function RatingStep({ venueName, onSelect, onBack }: {
  venueName: string;
  onSelect: (r: Rating) => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>How was it?</Text>
      <Text style={styles.stepSubtitle}>{venueName} · Step 3 of 4</Text>
      <View style={styles.ratingRow}>
        <Pressable style={[styles.ratingBtn, { backgroundColor: '#ff3b30' }]} onPress={() => onSelect(1)}>
          <Text style={styles.ratingBtnText}>😬{'\n'}Bad</Text>
        </Pressable>
        <Pressable style={[styles.ratingBtn, { backgroundColor: '#ff9500' }]} onPress={() => onSelect(2)}>
          <Text style={styles.ratingBtnText}>😐{'\n'}OK</Text>
        </Pressable>
        <Pressable style={[styles.ratingBtn, { backgroundColor: '#34c759' }]} onPress={() => onSelect(3)}>
          <Text style={styles.ratingBtnText}>😍{'\n'}Great</Text>
        </Pressable>
      </View>
      <Pressable style={styles.btnSecondaryCenter} onPress={onBack}>
        <Text style={styles.btnSecondaryText}>Back</Text>
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
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  pinHint: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  pinHintText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sheetBg: { backgroundColor: '#fff', borderRadius: 20 },
  handle: { backgroundColor: '#d1d1d6' },
  sheetContent: { flex: 1 },

  stepContainer: { paddingHorizontal: 24, paddingTop: 4 },
  stepTitle: { fontSize: 20, fontWeight: '700', color: '#1c1c1e', textAlign: 'center' },
  stepSubtitle: { fontSize: 13, color: '#8e8e93', textAlign: 'center', marginTop: 4, marginBottom: 24 },

  circleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  circleBtn: { alignItems: 'center', flex: 1 },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  circleBtnLabel: { fontSize: 13, fontWeight: '600', color: '#1c1c1e', textAlign: 'center' },
  circleBtnSub: { fontSize: 11, color: '#8e8e93', textAlign: 'center', marginTop: 2 },

  input: {
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1c1c1e',
    marginBottom: 12,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#ff3b5c',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#f2f2f7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnSecondaryCenter: {
    backgroundColor: '#f2f2f7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  btnSecondaryText: { color: '#1c1c1e', fontSize: 16, fontWeight: '600' },

  ratingRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  ratingBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  ratingBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 22 },

  doneContainer: { alignItems: 'center', paddingTop: 16 },
  doneEmoji: { fontSize: 48, marginBottom: 12 },
  doneTitle: { fontSize: 24, fontWeight: '800', color: '#1c1c1e', marginBottom: 6 },
  doneSub: { fontSize: 15, color: '#8e8e93', marginBottom: 24 },
});
