import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, Pressable, TextInput, Alert, ScrollView, Image, LayoutAnimation,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import MapView, { Marker, Region, MapPressEvent } from 'react-native-maps';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Direct callbacks allow immediate response when map tab is already focused.
let _openLogCallback: (() => void) | null = null;
let _openFutureCallback: (() => void) | null = null;
let _pendingOpenLog = false;
let _pendingOpenFuture = false;

export function scheduleOpenLog() {
  if (_openLogCallback) { _openLogCallback(); }
  else { _pendingOpenLog = true; }
}
export function scheduleOpenFutureDate() {
  if (_openFutureCallback) { _openFutureCallback(); }
  else { _pendingOpenFuture = true; }
}
import * as Crypto from 'expo-crypto';
import {
  getAllVisits, insertVisit, ratingColor, formatRating, friendlyDate, Visit,
  ActivityType, Price, DateType, ACTIVITY_TYPES, PRICE_LABELS, DATE_TYPES,
} from '@/lib/visits';
import {
  startComparison, advance, resolveRankOrder, resolveAtMid,
  currentComparison, ComparisonState,
} from '@/lib/ranking';
import type { Triage } from '@/lib/visits';
import { saveDraft, loadDraft, clearDraft } from '@/lib/draft';
import { getAllFutureSpots, insertFutureSpot, deleteFutureSpot, FutureSpot } from '@/lib/future';
import { getProfile } from '@/lib/profile';
import { T } from '@/lib/theme';

const SEATTLE_REGION: Region = {
  latitude: 47.6062,
  longitude: -122.3321,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const CITY_REGIONS: Record<string, Region> = {
  'Seattle, WA': SEATTLE_REGION,
};

type Step = 'location' | 'details' | 'triage' | 'compare' | 'done' | 'future-pin' | 'future-name';
type MapFilter = 'been' | 'want';

interface DraftVisit {
  lat: number;
  lng: number;
  venue_name: string;
  visited_at: string;
  notes: string;
  activity_type: ActivityType;
  price: Price;
  date_type: DateType;
  photos: string[];
}

export default function MapScreen() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [futureSpots, setFutureSpots] = useState<FutureSpot[]>([]);
  const [mapFilter, setMapFilter] = useState<MapFilter>('been');
  const [region, setRegion] = useState<Region>(SEATTLE_REGION);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [selectedFuture, setSelectedFuture] = useState<FutureSpot | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [draft, setDraft] = useState<Partial<DraftVisit>>({});
  const [droppingPin, setDroppingPin] = useState(false);
  const [cmpState, setCmpState] = useState<ComparisonState<Visit> | null>(null);
  const [currentTriage, setCurrentTriage] = useState<Triage>('okay');
  const sheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);
  const toModalRef = useRef(false);
  const lastPinPressAt = useRef(0);

  useEffect(() => {
    _openLogCallback = () => {
      setSelectedVisit(null);
      setStep('location');
      sheetRef.current?.snapToIndex(1);
    };
    _openFutureCallback = () => {
      setSelectedVisit(null);
      setMapFilter('want');
      setStep('future-pin');
      sheetRef.current?.snapToIndex(1);
    };
    return () => {
      _openLogCallback = null;
      _openFutureCallback = null;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setVisits(getAllVisits());
      setFutureSpots(getAllFutureSpots());
      if (_pendingOpenLog) {
        _pendingOpenLog = false;
        setSelectedVisit(null);
        setStep('location');
        sheetRef.current?.snapToIndex(1);
      }
      if (_pendingOpenFuture) {
        _pendingOpenFuture = false;
        setSelectedVisit(null);
        setMapFilter('want');
        setStep('future-pin');
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
    if (step === null || step === 'location' || step === 'future-pin' || step === 'future-name') return;
    saveDraft({ ...draft, step, savedAt: new Date().toISOString() });
  }, [step, draft]);

  const [cityRegion, setCityRegion] = useState<Region | null>(null);
  useEffect(() => {
    getProfile().then(profile => {
      const r = CITY_REGIONS[profile.city];
      if (r) { setRegion(r); setCityRegion(r); }
    });
  }, []);

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
    setCurrentTriage('okay');
    clearDraft();
  }

  function handleFutureDropPin() {
    setDroppingPin(true);
    sheetRef.current?.snapToIndex(0);
  }

  async function handleFutureUseLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location access needed', 'Enable location in Settings.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setDraft((d) => ({ ...d, lat: loc.coords.latitude, lng: loc.coords.longitude }));
    setStep('future-name');
    sheetRef.current?.snapToIndex(1);
  }

  function saveFutureSpot() {
    if (!draft.lat || !draft.lng || !draft.venue_name?.trim()) return;
    insertFutureSpot({
      id: Crypto.randomUUID(),
      venue_name: draft.venue_name.trim(),
      lat: draft.lat,
      lng: draft.lng,
      created_at: new Date().toISOString(),
    });
    setFutureSpots(getAllFutureSpots());
    setStep(null);
    setDraft({});
    sheetRef.current?.close();
  }

  async function handleUseLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location access needed', 'Enable location in Settings to use this feature.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setDraft((d) => ({ ...d, lat: loc.coords.latitude, lng: loc.coords.longitude }));
    toModalRef.current = true;
    setStep('details');
    sheetRef.current?.close();
  }

  function handleDropPin() {
    setDroppingPin(true);
    sheetRef.current?.snapToIndex(0);
  }

  function handleMapPress(e: MapPressEvent) {
    if (Date.now() - lastPinPressAt.current < 300) return;
    if (!droppingPin) {
      setSelectedVisit(null);
      setSelectedFuture(null);
      return;
    }
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setDraft((d) => ({ ...d, lat: latitude, lng: longitude }));
    setDroppingPin(false);
    if (step === 'future-pin' || mapFilter === 'want') {
      setStep('future-name');
      sheetRef.current?.snapToIndex(1);
    } else {
      toModalRef.current = true;
      setStep('details');
      sheetRef.current?.close();
    }
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
    if (draft.visited_at) {
      const iso = draft.visited_at.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        const picked = new Date(+iso[1], +iso[2] - 1, +iso[3]);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (picked > today) {
          Alert.alert('Future date', 'The date can\'t be in the future.');
          return;
        }
      }
    }
    setStep('triage');
  }

  function handleTriage(triage: Triage) {
    setCurrentTriage(triage);
    const existing = getAllVisits();
    const initial = startComparison(existing, (v) => v.triage === triage);
    setCmpState(initial);
    setStep('compare'); // always go to step 4; NoCompareStep handles the null case
  }

  function handleCompare(result: 'better' | 'worse') {
    if (!cmpState) return;
    const next = advance(cmpState, result);
    if (next === null) {
      const existing = getAllVisits();
      const finalLo = result === 'better' ? cmpState.lo : cmpState.mid + 1;
      const rank_order = resolveRankOrder({ ...cmpState, lo: finalLo }, existing);
      saveVisitWithTriage(rank_order, currentTriage);
    } else {
      setCmpState(next);
    }
  }

  function handleTooHard() {
    if (!cmpState) return;
    const existing = getAllVisits();
    const rank_order = resolveAtMid(cmpState, existing);
    saveVisitWithTriage(rank_order, currentTriage);
  }

  function saveVisitWithTriage(rank_order: number, triage: Triage) {
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
      price: draft.price ?? 2,
      triage,
      date_type: draft.date_type || undefined,
      photos: draft.photos || [],
    });
    setVisits(getAllVisits());
    setStep('done');
  }

  function saveVisit(rank_order: number) {
    saveVisitWithTriage(rank_order, currentTriage);
  }

  function handlePinPress(visit: Visit) {
    if (step !== null) return;
    lastPinPressAt.current = Date.now();
    setSelectedVisit((prev) => (prev?.id === visit.id ? null : visit));
  }

  const snapPoints = ['12%', '68%', '95%'];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={SEATTLE_REGION}
        mapType="standard"
        showsUserLocation={false}
        showsMyLocationButton={false}
        onPress={handleMapPress}
        onRegionChangeComplete={(r) => setRegion(r)}
        onMapReady={() => {
          if (cityRegion) mapRef.current?.animateToRegion(cityRegion, 600);
        }}
      >
        {mapFilter === 'been' && visits.map((v) => {
          const showLabel = region.latitudeDelta < 0.02;
          return (
            <Marker
              key={v.id}
              coordinate={{ latitude: v.lat, longitude: v.lng }}
              onPress={() => handlePinPress(v)}
              tracksViewChanges
            >
              <View style={{ alignItems: 'center' }} pointerEvents="none">
                {showLabel && (
                  <Text style={styles.pinLabelText} numberOfLines={1}>{v.venue_name}</Text>
                )}
                <View style={[styles.pinBadge, { borderColor: ratingColor(v.rating) }]}>
                  <Text style={[styles.pinScore, { color: ratingColor(v.rating) }]}>{formatRating(v.rating)}</Text>
                </View>
              </View>
            </Marker>
          );
        })}
        {mapFilter === 'want' && futureSpots.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            onPress={() => { if (step === null) setSelectedFuture((p) => p?.id === s.id ? null : s); }}
          >
            <View style={styles.futurePinBadge} pointerEvents="none">
              <Ionicons name="bookmark" size={13} color="#fff" />
            </View>
          </Marker>
        ))}
        {draft.lat != null && draft.lng != null && (
          <Marker coordinate={{ latitude: draft.lat, longitude: draft.lng }} pinColor="#ff3b5c" />
        )}
      </MapView>

      {/* Filter toggle */}
      {step === null && (
        <View style={styles.filterRow} pointerEvents="box-none">
          <View style={styles.filterPills} pointerEvents="auto">
            <Pressable
              style={[styles.filterPill, mapFilter === 'been' && styles.filterPillActive]}
              onPress={() => { setMapFilter('been'); setSelectedFuture(null); setSelectedVisit(null); }}
            >
              <Text style={[styles.filterPillText, mapFilter === 'been' && styles.filterPillTextActive]}>Been To</Text>
            </Pressable>
            <Pressable
              style={[styles.filterPill, mapFilter === 'want' && styles.filterPillActive]}
              onPress={() => { setMapFilter('want'); setSelectedVisit(null); setSelectedFuture(null); }}
            >
              <Text style={[styles.filterPillText, mapFilter === 'want' && styles.filterPillTextActive]}>Want to Go</Text>
            </Pressable>
          </View>
        </View>
      )}

      {droppingPin && (
        <View style={styles.pinHint} pointerEvents="none">
          <Text style={styles.pinHintText}>Tap the map to drop a pin</Text>
        </View>
      )}

      {selectedVisit && step === null && mapFilter === 'been' && (
        <VisitDetail visit={selectedVisit} onClose={() => setSelectedVisit(null)} />
      )}

      {selectedFuture && step === null && mapFilter === 'want' && (
        <FutureDetail
          spot={selectedFuture}
          onClose={() => setSelectedFuture(null)}
          onDelete={() => {
            deleteFutureSpot(selectedFuture.id);
            setFutureSpots(getAllFutureSpots());
            setSelectedFuture(null);
          }}
        />
      )}


      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={() => {
          if (toModalRef.current) { toModalRef.current = false; return; }
          resetFlow();
        }}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={{ backgroundColor: 'transparent' }}
      >
        <BottomSheetView style={styles.sheetContent}>
          {step === 'location' && (
            <LocationStep
              onUseLocation={handleUseLocation}
              onDropPin={handleDropPin}
              onFutureDate={() => { setStep('future-pin'); setMapFilter('want'); }}
            />
          )}
          {step === 'future-pin' && (
            <FuturePinStep
              onUseLocation={handleFutureUseLocation}
              onDropPin={handleFutureDropPin}
              onBack={() => sheetRef.current?.close()}
            />
          )}
          {step === 'future-name' && (
            <FutureNameStep
              value={draft.venue_name || ''}
              onChange={(v) => setDraft((d) => ({ ...d, venue_name: v }))}
              onSave={saveFutureSpot}
              onBack={() => { setStep('future-pin'); sheetRef.current?.snapToIndex(1); }}
            />
          )}
        </BottomSheetView>
      </BottomSheet>

      {/* Modal overlay for steps 2-5 */}
      <Modal
        visible={['details', 'triage', 'compare', 'done'].includes(step ?? '')}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            {step === 'details' ? (
              <View style={styles.modalCard}>
                <DetailsStep
                  draft={draft}
                  onChange={(key, val) => setDraft((d) => ({ ...d, [key]: val }))}
                  onNext={handleDetailsDone}
                  onBack={resetFlow}
                />
              </View>
            ) : (
              <View style={styles.modalCardCompact}>
                {step === 'triage' && (
                  <TriageStep onPick={handleTriage} />
                )}
                {step === 'compare' && !cmpState && (
                  <NoCompareStep
                    triage={currentTriage}
                    onSave={() => saveVisitWithTriage(1000, currentTriage)}
                  />
                )}
                {step === 'compare' && cmpState && (
                  <CompareStep
                    newVenueName={draft.venue_name || ''}
                    opponent={currentComparison(cmpState)}
                    onBetter={() => handleCompare('better')}
                    onWorse={() => handleCompare('worse')}
                    onTooHard={handleTooHard}
                    onBack={() => setStep('triage')}
                  />
                )}
                {step === 'done' && (
                  <DoneStep
                    venueName={draft.venue_name || ''}
                    onAnother={() => { resetFlow(); openLog(); }}
                    onClose={resetFlow}
                  />
                )}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function VisitDetail({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const info = ACTIVITY_TYPES.find((a) => a.value === visit.activity_type);
  const color = ratingColor(visit.rating);
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);
  const preview = visit.notes?.trim().slice(0, 70) ?? null;
  return (
    <Pressable style={styles.visitBanner} onPress={() => router.push(`/spot/${visit.id}`)}>
      <View style={styles.visitBannerInner}>
        <View style={styles.visitBannerBody}>
          <View style={styles.visitBannerTop}>
            <Text style={styles.visitBannerName} numberOfLines={1}>{visit.venue_name}</Text>
            <View style={[styles.visitBannerPill, { borderColor: color }]}>
              <Text style={[styles.visitBannerPillText, { color }]}>{formatRating(visit.rating)}</Text>
            </View>
          </View>
          <Text style={styles.visitBannerMeta}>
            {info?.label} · {PRICE_LABELS[visit.price as Price]} · {dateStr}
          </Text>
          {preview ? (
            <Text style={styles.visitBannerPreview} numberOfLines={1}>{preview}</Text>
          ) : null}
        </View>
        <Pressable onPress={onClose} hitSlop={12} style={styles.visitBannerClose}>
          <Ionicons name="close" size={18} color={T.muted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function ProgressDots({ currentStep }: { currentStep: number }) {
  return (
    <View style={styles.dotsRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <View
          key={i}
          style={[
            styles.dot,
            i === currentStep && styles.dotActive,
            i < currentStep && styles.dotDone,
          ]}
        />
      ))}
    </View>
  );
}

function LocationStep({ onUseLocation, onDropPin, onFutureDate }: {
  onUseLocation: () => void; onDropPin: () => void; onFutureDate: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <ProgressDots currentStep={1} />
      <Text style={styles.stepTitle}>Where did you go?</Text>
      <Text style={styles.stepSubtitle}>Step 1 of 5</Text>
      <View style={styles.circleRow}>
        <CircleButton icon="location" label="Use location" sublabel="Where I am now" onPress={onUseLocation} tint="#e8f0fe" />
        <CircleButton icon="map" label="Drop a pin" sublabel="Tap the map" onPress={onDropPin} tint="#f2f2f7" />
        <CircleButton icon="bookmark-outline" label="Future Date" sublabel="Want to go" onPress={onFutureDate} tint="#f0f0ff" />
      </View>
    </View>
  );
}

function FuturePinStep({ onUseLocation, onDropPin, onBack }: {
  onUseLocation: () => void; onDropPin: () => void; onBack: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Where do you want to go?</Text>
      <Text style={styles.stepSubtitle}>Pick a location</Text>
      <View style={styles.circleRow}>
        <CircleButton icon="location" label="Use location" sublabel="Where I am now" onPress={onUseLocation} tint="#e8f0fe" />
        <CircleButton icon="map" label="Drop a pin" sublabel="Tap the map" onPress={onDropPin} tint="#f2f2f7" />
      </View>
      <Pressable style={[styles.btnSecondaryCenter, { marginTop: 16 }]} onPress={onBack}>
        <Text style={styles.btnSecondaryText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function FutureNameStep({ value, onChange, onSave, onBack }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onBack: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's it called?</Text>
      <Text style={styles.stepSubtitle}>Give it a name to remember</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Lazy Bear"
        placeholderTextColor="#c7c7cc"
        value={value}
        onChangeText={onChange}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={onSave}
      />
      <View style={styles.btnRow}>
        <Pressable style={styles.btnSecondary} onPress={onBack}>
          <Text style={styles.btnSecondaryText}>Back</Text>
        </Pressable>
        <Pressable style={styles.btnPrimary} onPress={onSave}>
          <Text style={styles.btnPrimaryText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FutureDetail({ spot, onClose, onDelete }: {
  spot: FutureSpot; onClose: () => void; onDelete: () => void;
}) {
  return (
    <Pressable style={styles.visitBanner} onPress={() => router.push(`/future/${spot.id}` as any)}>
      <View style={styles.visitBannerInner}>
        <View style={styles.visitBannerBody}>
          <View style={styles.visitBannerTop}>
            <Text style={styles.visitBannerName} numberOfLines={1}>{spot.venue_name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="bookmark" size={12} color="#5856d6" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#5856d6' }}>Want to go</Text>
            </View>
          </View>
          <Text style={styles.visitBannerMeta}>Added {friendlyDate(spot.created_at)}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12} style={styles.visitBannerClose}>
          <Ionicons name="close" size={18} color={T.muted} />
        </Pressable>
      </View>
    </Pressable>
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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const NOW = new Date();
const YEARS = Array.from({ length: 11 }, (_, i) => String(NOW.getFullYear() - i));
const DATE_OPTION_H = 46;
const DATE_DROPDOWN_H = DATE_OPTION_H * 2.5; // 2.5 rows visible before fade

type DateField = 'month' | 'day' | 'year';

function DatePicker({ month, day, year, onMonthChange, onDayChange, onYearChange, error }: {
  month: string; day: string; year: string;
  onMonthChange: (v: string) => void;
  onDayChange: (v: string) => void;
  onYearChange: (v: string) => void;
  error?: boolean;
}) {
  const [open, setOpen] = useState<DateField | null>(null);
  const [tabRowH, setTabRowH] = useState(68);
  const [tabLayouts, setTabLayouts] = useState<Partial<Record<DateField, { x: number; width: number }>>>({});
  const listRef = useRef<ScrollView>(null);

  function toggle(field: DateField) {
    LayoutAnimation.configureNext({
      duration: 240,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'easeInEaseOut' },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
    setOpen(prev => prev === field ? null : field);
  }

  useEffect(() => {
    if (!open) return;
    const items = open === 'month' ? MONTHS : open === 'day' ? DAYS : YEARS;
    const val = open === 'month' ? month : open === 'day' ? day : year;
    const idx = items.indexOf(val);
    if (idx >= 0) {
      setTimeout(() => listRef.current?.scrollTo({ y: idx * DATE_OPTION_H, animated: false }), 40);
    }
  }, [open]);

  function pick(field: DateField, val: string) {
    if (field === 'month') onMonthChange(val);
    else if (field === 'day') onDayChange(val);
    else onYearChange(val);
    LayoutAnimation.configureNext({
      duration: 180,
      update: { type: 'easeInEaseOut' },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
    setOpen(null);
  }

  const fields: { key: DateField; label: string; value: string; flex?: number }[] = [
    { key: 'month', label: 'Month', value: month, flex: 1.3 },
    { key: 'day',   label: 'Day',   value: day },
    { key: 'year',  label: 'Year',  value: year, flex: 1.4 },
  ];

  const openItems = open === 'month' ? MONTHS : open === 'day' ? DAYS : YEARS;
  const openVal   = open === 'month' ? month  : open === 'day' ? day   : year;
  const dropLayout = open ? tabLayouts[open] : null;

  return (
    <View style={{ marginBottom: 12, zIndex: 20 }}>
      <View
        style={styles.dateTabRow}
        onLayout={e => setTabRowH(e.nativeEvent.layout.height)}
      >
        {fields.map(f => (
          <Pressable
            key={f.key}
            style={[styles.dateTab, { flex: f.flex ?? 1 }, open === f.key && styles.dateTabOpen, error && !open && styles.dateTabError]}
            onPress={() => toggle(f.key)}
            onLayout={e => {
              const { x, width } = e.nativeEvent.layout;
              setTabLayouts(prev => ({ ...prev, [f.key]: { x, width } }));
            }}
          >
            <Text style={styles.dateTabLabel}>{f.label}</Text>
            <Text style={[styles.dateTabValue, open === f.key && styles.dateTabValueOpen]}>{f.value}</Text>
            <Ionicons name={open === f.key ? 'chevron-up' : 'chevron-down'} size={11} color={open === f.key ? T.accent : T.muted} />
          </Pressable>
        ))}
      </View>

      {open && dropLayout && (
        <View style={[styles.dateDropdown, {
          position: 'absolute',
          top: tabRowH + 4,
          left: dropLayout.x,
          width: dropLayout.width,
          height: DATE_DROPDOWN_H,
        }]}>
          <ScrollView
            ref={listRef}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            style={{ flex: 1 }}
          >
            {openItems.map(item => {
              const selected = item === openVal;
              return (
                <Pressable
                  key={item}
                  style={[styles.dateOption, selected && styles.dateOptionSelected]}
                  onPress={() => pick(open, item)}
                >
                  <Text style={[styles.dateOptionText, selected && styles.dateOptionTextSelected]}>{item}</Text>
                  {selected && <Ionicons name="checkmark" size={16} color={T.accent} />}
                </Pressable>
              );
            })}
          </ScrollView>
          {/* Bottom fade — signals scrollability */}
          <View style={styles.dateFade} pointerEvents="none">
            <View style={{ flex: 1, backgroundColor: 'rgba(252,249,242,0)' }} />
            <View style={{ flex: 1, backgroundColor: 'rgba(252,249,242,0.55)' }} />
            <View style={{ flex: 1, backgroundColor: 'rgba(252,249,242,0.9)' }} />
          </View>
        </View>
      )}
    </View>
  );
}

function initDateState(dateStr?: string): { month: string; day: string; year: string } {
  if (dateStr) {
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return {
        month: MONTHS[parseInt(m[2]) - 1] ?? MONTHS[NOW.getMonth()],
        day: String(parseInt(m[3])),
        year: m[1],
      };
    }
  }
  return { month: MONTHS[NOW.getMonth()], day: String(NOW.getDate()), year: String(NOW.getFullYear()) };
}

function DetailsStep({ draft, onChange, onNext, onBack }: {
  draft: Partial<DraftVisit>;
  onChange: (key: string, val: any) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const initDate = initDateState(draft.visited_at);
  const [month, setMonth] = useState(initDate.month);
  const [day, setDay] = useState(initDate.day);
  const [year, setYear] = useState(initDate.year);

  useEffect(() => {
    const mi = MONTHS.indexOf(month) + 1;
    const di = parseInt(day);
    const yi = parseInt(year);
    if (mi >= 1 && di >= 1 && di <= 31 && yi >= 2000) {
      onChange('visited_at', `${yi}-${String(mi).padStart(2, '0')}-${String(di).padStart(2, '0')}`);
    }
  }, [month, day, year]);

  const isFutureDate = (() => {
    const mi = MONTHS.indexOf(month);
    const di = parseInt(day);
    const yi = parseInt(year);
    if (isNaN(di) || isNaN(yi)) return false;
    const picked = new Date(yi, mi, di);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return picked > today;
  })();

  const photos: string[] = draft.photos || [];

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    // Store local URIs immediately — they're valid for this session.
    // Upload happens in the edit flow once Supabase storage is configured.
    onChange('photos', [...photos, ...result.assets.map(a => a.uri)]);
  }

  function removePhoto(index: number) {
    onChange('photos', photos.filter((_, i) => i !== index));
  }

  return (
    <ScrollView style={styles.detailsScroll} contentContainerStyle={styles.stepContainer} keyboardShouldPersistTaps="handled">
      <ProgressDots currentStep={2} />
      <Text style={styles.stepTitle}>Tell me about it</Text>
      <Text style={styles.stepSubtitle}>Step 2 of 5</Text>

      <TextInput
        style={styles.input}
        placeholder="Name your date!"
        placeholderTextColor="#c7c7cc"
        value={draft.venue_name || ''}
        onChangeText={(v) => onChange('venue_name', v)}
        autoFocus
        returnKeyType="next"
      />

      <Text style={styles.sectionLabel}>Date</Text>
      <DatePicker
        month={month} day={day} year={year}
        onMonthChange={setMonth}
        onDayChange={setDay}
        onYearChange={setYear}
        error={isFutureDate}
      />
      {isFutureDate && (
        <Text style={styles.dateError}>Date can't be in the future</Text>
      )}

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
        <Pressable style={styles.photoAdd} onPress={pickPhoto}>
          <Ionicons name="camera-outline" size={22} color={T.muted} />
          <Text style={styles.photoAddLabel}>Add photo</Text>
        </Pressable>
      </ScrollView>

      <Text style={styles.sectionLabel}>What kind of spot?</Text>
      <View style={styles.chipWrap}>
        {ACTIVITY_TYPES.map((a) => {
          const selected = draft.activity_type === a.value;
          return (
            <Pressable
              key={a.value}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange('activity_type', selected ? null : a.value)}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Price range</Text>
      <View style={styles.priceRow}>
        {([0, 1, 2, 3] as Price[]).map((p) => {
          const selected = draft.price === p;
          return (
            <Pressable
              key={p}
              style={[styles.priceBtn, selected && styles.priceBtnSelected]}
              onPress={() => onChange('price', selected ? undefined : p)}
            >
              <Text style={[styles.priceBtnText, selected && styles.priceBtnTextSelected]}>
                {PRICE_LABELS[p]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>What kind of date?</Text>
      <View style={styles.chipWrap}>
        {DATE_TYPES.map((d) => {
          const selected = draft.date_type === d.value;
          return (
            <Pressable
              key={d.value}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange('date_type', selected ? null : d.value)}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{d.label}</Text>
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
      <ProgressDots currentStep={3} />
      <Text style={styles.stepTitle}>First impression?</Text>
      <Text style={styles.stepSubtitle}>Step 3 of 5 · Narrows your comparisons</Text>
      <View style={styles.triageRow}>
        <Pressable style={[styles.triageBtn, { backgroundColor: '#fff2f2', borderColor: '#ff3b30' }]} onPress={() => onPick('bad')}>
          <Text style={[styles.triageLabel, { color: '#ff3b30' }]}>Bad</Text>
        </Pressable>
        <Pressable style={[styles.triageBtn, { backgroundColor: '#fff8ee', borderColor: '#ff9500' }]} onPress={() => onPick('okay')}>
          <Text style={[styles.triageLabel, { color: '#ff9500' }]}>Okay</Text>
        </Pressable>
        <Pressable style={[styles.triageBtn, { backgroundColor: '#f0fff4', borderColor: '#34c759' }]} onPress={() => onPick('great')}>
          <Text style={[styles.triageLabel, { color: '#34c759' }]}>Great</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NoCompareStep({ triage, onSave }: { triage: Triage; onSave: () => void }) {
  const tierLabel = triage === 'great' ? 'great' : triage === 'okay' ? 'okay' : 'bad';
  return (
    <View style={styles.stepContainer}>
      <ProgressDots currentStep={4} />
      <Text style={styles.stepTitle}>First of its kind</Text>
      <Text style={styles.stepSubtitle}>
        You don't have other {tierLabel} spots to compare yet. Once you log more, they'll rank against each other here.
      </Text>
      <Pressable style={styles.btnPrimaryCenter} onPress={onSave}>
        <Text style={styles.btnPrimaryText}>Save spot</Text>
      </Pressable>
    </View>
  );
}

function CompareStep({ newVenueName, opponent, onBetter, onWorse, onTooHard, onBack }: {
  newVenueName: string; opponent: Visit;
  onBetter: () => void; onWorse: () => void; onTooHard: () => void; onBack: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <ProgressDots currentStep={4} />
      <Text style={styles.stepTitle}>Which was better?</Text>
      <Text style={styles.stepSubtitle}>Step 4 of 5</Text>
      <View style={styles.compareRow}>
        <Pressable style={[styles.compareCard, styles.compareCardNew]} onPress={onBetter}>
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
      <ProgressDots currentStep={5} />
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

  futurePinBadge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#5856d6',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#5856d6', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4,
  },

  filterRow: {
    position: 'absolute', top: 56, left: 0, right: 0,
    alignItems: 'center',
  },
  filterPills: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20, padding: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6,
  },
  filterPill: {
    paddingHorizontal: 18, paddingVertical: 7, borderRadius: 17,
  },
  filterPillActive: { backgroundColor: T.accent },
  filterPillText: { fontSize: 14, fontWeight: '600', color: T.muted },
  filterPillTextActive: { color: '#fff' },


  pinHint: {
    position: 'absolute', top: 60, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
  },
  pinHintText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  visitBanner: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
    backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  visitBannerInner: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 8 },
  visitBannerBody: { flex: 1 },
  visitBannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  visitBannerName: { fontSize: 15, fontWeight: '600', color: T.primary, flex: 1, marginRight: 8 },
  visitBannerMeta: { fontSize: 12, color: T.muted, marginBottom: 3 },
  visitBannerPreview: { fontSize: 12, color: '#A0927E', fontStyle: 'italic', lineHeight: 16 },
  visitBannerPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1.5, backgroundColor: 'transparent' },
  visitBannerPillText: { fontSize: 12, fontWeight: '800' },
  visitBannerClose: { paddingTop: 1 },

  pinLabelText: {
    fontSize: 11, fontWeight: '700', color: T.primary,
    marginBottom: 3, maxWidth: 130, textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.9)', textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },


  sheetBg: { backgroundColor: T.bg, borderRadius: 20 },
  sheetContent: { flex: 1 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: T.bg,
    borderRadius: 24,
    height: '84%',
    overflow: 'hidden',
    opacity: 0.9,
  },
  modalCardCompact: {
    backgroundColor: T.bg,
    borderRadius: 24,
    overflow: 'hidden',
    paddingVertical: 32,
    minHeight: 360,
    justifyContent: 'center',
    opacity: 0.9,
  },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.border },
  dotActive: { width: 18, borderRadius: 3, backgroundColor: T.accent },
  dotDone: { backgroundColor: '#c9b89e' },

  detailsScroll: { flex: 1 },
  stepContainer: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 72 },
  stepTitle: { fontSize: 18, fontWeight: '700', color: T.primary, textAlign: 'center', fontFamily: 'InstrumentSerif-Regular' },
  stepSubtitle: { fontSize: 13, color: T.muted, textAlign: 'center', marginTop: 8, marginBottom: 28 },

  circleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  circleBtn: { alignItems: 'center', flex: 1 },
  circle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  circleBtnLabel: { fontSize: 13, fontWeight: '600', color: T.primary, textAlign: 'center' },
  circleBtnSub: { fontSize: 11, color: T.muted, textAlign: 'center', marginTop: 2 },

  sectionLabel: { fontSize: 12, fontWeight: '600', color: T.muted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.5 },
  photoScroll: { marginBottom: 12, marginHorizontal: -24 },
  photoScrollContent: { paddingHorizontal: 24, alignItems: 'center' },
  photoThumb: {
    width: 64, height: 64, borderRadius: 9, overflow: 'hidden',
    marginRight: 7,
  },
  photoThumbImg: { width: '100%', height: '100%' },
  photoAdd: {
    width: 64, height: 64, borderRadius: 9,
    borderWidth: 1.5, borderColor: T.border,
    backgroundColor: T.card,
    alignItems: 'center', justifyContent: 'center', gap: 3,
    marginRight: 7,
  },
  photoAddLabel: { fontSize: 10, color: T.muted, fontWeight: '500' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: T.card, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1.5, borderColor: T.border,
  },
  chipSelected: { backgroundColor: T.accentTint, borderColor: T.accent },
  chipLabel: { fontSize: 13, fontWeight: '600', color: T.primary },
  chipLabelSelected: { color: T.accent },

  priceRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  priceBtn: {
    flex: 1, backgroundColor: T.inputBg, borderRadius: 10,
    paddingVertical: 9, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  priceBtnSelected: { backgroundColor: T.accentTint, borderColor: T.accent },
  priceBtnText: { fontSize: 14, fontWeight: '600', color: T.primary },
  priceBtnTextSelected: { color: T.accent },

  input: {
    backgroundColor: T.inputBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: T.primary, marginBottom: 10,
  },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },

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

  dateTabRow: { flexDirection: 'row', gap: 8 },
  dateTab: {
    flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: T.border,
    paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center', gap: 2,
  },
  dateTabOpen: { borderColor: T.accent, backgroundColor: T.accentTint },
  dateTabError: { borderColor: '#ff3b30', backgroundColor: '#fff2f2' },
  dateError: { fontSize: 12, color: '#ff3b30', fontWeight: '600', marginTop: 6, marginBottom: 4 },
  dateTabLabel: { fontSize: 10, fontWeight: '600', color: T.muted, letterSpacing: 0.5 },
  dateTabValue: { fontSize: 18, fontWeight: '700', color: T.primary },
  dateTabValueOpen: { color: T.accent },

  dateDropdown: {
    borderRadius: 12, borderWidth: 1.5, borderColor: T.accent,
    backgroundColor: T.card, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13, shadowRadius: 14, elevation: 10,
  },
  dateOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, height: DATE_OPTION_H,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  dateOptionSelected: { backgroundColor: T.accentTint },
  dateOptionText: { fontSize: 15, fontWeight: '500', color: T.primary },
  dateOptionTextSelected: { color: T.accent, fontWeight: '700' },

  dateFade: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
  },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: T.accent },
  btnPrimaryCenter: { backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: T.accent, marginTop: 8 },
  btnPrimaryText: { color: T.accent, fontSize: 16, fontWeight: '700' },
  btnSecondary: { flex: 1, backgroundColor: T.inputBg, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnSecondaryCenter: { backgroundColor: T.inputBg, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnSecondaryText: { color: T.primary, fontSize: 16, fontWeight: '600' },

  doneContainer: { alignItems: 'center', paddingTop: 16 },
  doneEmoji: { fontSize: 48, marginBottom: 12 },
  doneTitle: { fontSize: 24, fontWeight: '800', color: T.primary, marginBottom: 6 },
  doneSub: { fontSize: 15, color: T.muted, marginBottom: 24 },
});
