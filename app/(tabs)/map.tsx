import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, Pressable, TextInput, Alert, ScrollView, Image, LayoutAnimation,
  Modal, KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
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
let _openLogWithLocationCallback: ((name: string, lat: number, lng: number) => void) | null = null;
let _pendingOpenLog = false;
let _pendingOpenFuture = false;
let _pendingOpenLogWithLocation: { name: string; lat: number; lng: number } | null = null;
let _skipNextResumePrompt = false;

export function scheduleOpenLog() {
  if (_openLogCallback) { _openLogCallback(); }
  else { _pendingOpenLog = true; }
}
export function scheduleOpenFutureDate() {
  if (_openFutureCallback) { _openFutureCallback(); }
  else { _pendingOpenFuture = true; }
}
export function scheduleOpenLogWithLocation(name: string, lat: number, lng: number) {
  if (_openLogWithLocationCallback) { _openLogWithLocationCallback(name, lat, lng); }
  else { _pendingOpenLogWithLocation = { name, lat, lng }; }
}
import * as Crypto from 'expo-crypto';
import {
  getAllVisits, insertVisit, ratingColor, formatRating, friendlyDate, Visit,
  ActivityType, OccasionType, Price, ACTIVITY_TYPES, OCCASION_TYPES, PRICE_LABELS,
} from '@/lib/visits';
import {
  startComparison, advance, resolveRankOrder, resolveAtMid,
  currentComparison, ComparisonState,
} from '@/lib/ranking';
import type { Triage } from '@/lib/visits';
import { saveDraft, loadDraft, clearDraft } from '@/lib/draft';
import { getAllFutureSpots, insertFutureSpot, deleteFutureSpot, FutureSpot } from '@/lib/future';
import { getProfile, saveProfile } from '@/lib/profile';
import { getSeedSpotsRaw, SeedSpot } from '@/lib/seeds';
import { T } from '@/lib/theme';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name: string;
  type: string;
  category: string;
}


const LABEL_NEIGHBOR_THRESHOLD = 0.008; // ~800m in degrees
const LABEL_ZOOM_THRESHOLD = 0.04; // show pin labels when latitudeDelta is below this

const SEATTLE_REGION: Region = {
  latitude: 47.6062,
  longitude: -122.3321,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const CITY_REGIONS: Record<string, Region> = {
  'Seattle, WA': SEATTLE_REGION,
};

type Step = 'mode-select' | 'location' | 'details' | 'triage' | 'compare' | 'done' | 'future-pin' | 'future-name';
type MapFilter = 'been' | 'want' | 'spots';
type SpotsCategory = string;

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

interface DraftVisit {
  lat: number;
  lng: number;
  venue_name: string;
  visited_at: string;
  notes: string;
  activity_type: ActivityType;
  occasion_type: OccasionType;
  price: Price;
  photos: string[];
  isPinOnly: boolean;
  address: string;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'DateSpotApp/1.0' } }
    );
    const data = await res.json();
    return data.name || null;
  } catch {
    return null;
  }
}

export default function MapScreen() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [futureSpots, setFutureSpots] = useState<FutureSpot[]>([]);
  const [seedSpots, setSeedSpots] = useState<SeedSpot[]>([]);
  const [mapFilter, setMapFilter] = useState<MapFilter>('been');
  const [spotsCategory, setSpotsCategory] = useState<SpotsCategory>('all');
  const [selectedSeedSpot, setSelectedSeedSpot] = useState<SeedSpot | null>(null);
  const [region, setRegion] = useState<Region>(SEATTLE_REGION);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [selectedFuture, setSelectedFuture] = useState<FutureSpot | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [draft, setDraft] = useState<Partial<DraftVisit>>({});
  const [droppingPin, setDroppingPin] = useState(false);
  const [cmpState, setCmpState] = useState<ComparisonState<Visit> | null>(null);
  const [currentTriage, setCurrentTriage] = useState<Triage>('okay');
  const [geocodeSuggestion, setGeocodeSuggestion] = useState<string | null>(null);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);
  const toModalRef = useRef(false);
  const lastPinPressAt = useRef(0);
  const lastSavedLatLng = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    _openLogCallback = () => {
      setSelectedVisit(null);
      setStep('mode-select');
      sheetRef.current?.snapToIndex(1);
    };
    _openFutureCallback = () => {
      setSelectedVisit(null);
      setMapFilter('want');
      setStep('future-pin');
      sheetRef.current?.snapToIndex(1);
    };
    _openLogWithLocationCallback = (name: string, lat: number, lng: number) => {
      _skipNextResumePrompt = true;
      setSelectedVisit(null);
      setDraft({ venue_name: name, lat, lng });
      toModalRef.current = true;
      setStep('details');
    };
    return () => {
      _openLogCallback = null;
      _openFutureCallback = null;
      _openLogWithLocationCallback = null;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setVisits(getAllVisits());
      setFutureSpots(getAllFutureSpots());
      getSeedSpotsRaw().then(setSeedSpots);
      if (_pendingOpenLog) {
        _pendingOpenLog = false;
        setSelectedVisit(null);
        setStep('mode-select');
        sheetRef.current?.snapToIndex(1);
      }
      if (_pendingOpenFuture) {
        _pendingOpenFuture = false;
        setSelectedVisit(null);
        setMapFilter('want');
        setStep('future-pin');
        sheetRef.current?.snapToIndex(1);
      }
      if (_pendingOpenLogWithLocation) {
        const { name, lat, lng } = _pendingOpenLogWithLocation;
        _pendingOpenLogWithLocation = null;
        _skipNextResumePrompt = true;
        setSelectedVisit(null);
        setDraft({ venue_name: name, lat, lng });
        toModalRef.current = true;
        setStep('details');
      }
      if (_skipNextResumePrompt) {
        _skipNextResumePrompt = false;
        return;
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
    if (step === null || step === 'mode-select' || step === 'location' || step === 'future-pin' || step === 'future-name') return;
    saveDraft({ ...draft, step, savedAt: new Date().toISOString() });
  }, [step, draft]);

  const [cityRegion, setCityRegion] = useState<Region | null>(null);
  useEffect(() => {
    getProfile().then(async profile => {
      let r: Region | undefined;
      if (profile.cityLat != null && profile.cityLng != null) {
        r = { latitude: profile.cityLat, longitude: profile.cityLng, latitudeDelta: 0.08, longitudeDelta: 0.08 };
      } else {
        r = CITY_REGIONS[profile.city];
      }
      // Fall back to device GPS if city isn't recognized
      if (!r) {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            r = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 };
            // Persist coords so we don't GPS-fetch every open
            await saveProfile({ cityLat: loc.coords.latitude, cityLng: loc.coords.longitude });
          }
        } catch {}
      }
      if (r) { setRegion(r); setCityRegion(r); }
    });
  }, []);

  // Animate to city region whenever it resolves (handles race with onMapReady)
  useEffect(() => {
    if (cityRegion) mapRef.current?.animateToRegion(cityRegion, 0);
  }, [cityRegion]);

  function openLog() {
    setSelectedVisit(null);
    setStep('mode-select');
    sheetRef.current?.snapToIndex(1);
  }

  function resetFlow() {
    setStep(null);
    setDraft({});
    setDroppingPin(false);
    setCmpState(null);
    setCurrentTriage('okay');
    setGeocodeSuggestion(null);
    setGeocodeLoading(false);
    clearDraft();
    const saved = lastSavedLatLng.current;
    if (saved) {
      lastSavedLatLng.current = null;
      setTimeout(() => {
        mapRef.current?.animateToRegion(
          { latitude: saved.lat, longitude: saved.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
          500
        );
      }, 150);
    }
  }

  function handleFutureDropPin() {
    setDroppingPin(true);
    sheetRef.current?.snapToIndex(0);
  }


  function saveFutureSpot() {
    if (!draft.lat || !draft.lng || !draft.venue_name?.trim()) return;
    const { lat, lng } = draft;
    insertFutureSpot({
      id: Crypto.randomUUID(),
      venue_name: draft.venue_name.trim(),
      lat,
      lng,
      created_at: new Date().toISOString(),
    });
    setFutureSpots(getAllFutureSpots());
    setMapFilter('want');
    setStep(null);
    setDraft({});
    sheetRef.current?.close();
    setTimeout(() => {
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
        500
      );
    }, 150);
  }

  async function handleUseLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = loc.coords;
    setDraft((d) => ({ ...d, lat: latitude, lng: longitude }));
    setGeocodeSuggestion(null);
    setGeocodeLoading(true);
    reverseGeocode(latitude, longitude).then(name => {
      setGeocodeSuggestion(name);
      setGeocodeLoading(false);
    });
    toModalRef.current = true;
    setStep('details');
    sheetRef.current?.close();
  }

  function handleSearchSelect(name: string, lat: number, lng: number, address?: string) {
    setDraft(d => ({ ...d, venue_name: name, lat, lng, address: address ?? '' }));
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      500
    );
    toModalRef.current = true;
    setStep('details');
    sheetRef.current?.close();
  }

  function handleFutureSearchSelect(name: string, lat: number, lng: number, address?: string) {
    setDraft(d => ({ ...d, venue_name: name, lat, lng, address: address ?? '' }));
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      500
    );
    setStep('future-name');
    sheetRef.current?.snapToIndex(1);
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
    setGeocodeSuggestion(null);
    setGeocodeLoading(true);
    reverseGeocode(latitude, longitude).then(name => {
      setGeocodeSuggestion(name);
      setGeocodeLoading(false);
    });
    if (step === 'future-pin' || mapFilter === 'want') {
      setStep('future-name');
      sheetRef.current?.snapToIndex(1);
    } else {
      setDraft((d) => ({ ...d, isPinOnly: true }));
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
    if (!draft.occasion_type) {
      Alert.alert('What kind of date?', 'Was this Romantic, Friend, or Solo?');
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
    const occasion = draft.occasion_type || 'romantic';
    const initial = startComparison(existing, (v) => v.triage === triage && v.occasion_type === occasion);
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
      address: draft.address || undefined,
      visited_at: draft.visited_at || new Date().toISOString(),
      rank_order,
      notes: draft.notes || undefined,
      activity_type: draft.activity_type || 'other',
      occasion_type: draft.occasion_type || 'romantic',
      price: draft.price ?? 2,
      triage,
      photos: draft.photos || [],
    }, undefined, draft.isPinOnly === true);
    setVisits(getAllVisits());
    lastSavedLatLng.current = { lat: draft.lat, lng: draft.lng };
    setMapFilter('been');
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

  const displayedSeedSpots = spotsCategory === 'all'
    ? seedSpots.slice(0, 100)
    : seedSpots.filter(s => s.activity_type === spotsCategory);

  type ClusterItem =
    | { kind: 'spot'; spot: SeedSpot }
    | { kind: 'cluster'; lat: number; lng: number; count: number; key: string };

  // Quantize latitudeDelta into fixed zoom tiers so the grid never shifts while panning.
  // Cell sizes are fixed constants — not derived from the live delta.
  const zoomTier = region.latitudeDelta < 0.04 ? 'dissolved'
    : region.latitudeDelta < 0.12 ? 'close'
    : region.latitudeDelta < 0.35 ? 'mid'
    : 'far';

  const CELL_SIZES: Record<string, number> = { close: 0.018, mid: 0.05, far: 0.12 };

  const clusteredItems = useMemo<ClusterItem[]>(() => {
    if (zoomTier === 'dissolved') {
      return [...displayedSeedSpots]
        .sort((a, b) => a.rank_order - b.rank_order)
        .map(spot => ({ kind: 'spot' as const, spot }));
    }
    const cellSize = CELL_SIZES[zoomTier];
    const cells = new Map<string, SeedSpot[]>();
    for (const spot of displayedSeedSpots) {
      const row = Math.floor(spot.lat / cellSize);
      const col = Math.floor(spot.lng / cellSize);
      const key = `${row},${col}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(spot);
    }
    const result: ClusterItem[] = [];
    for (const [key, group] of cells) {
      if (group.length >= 10) {
        const lat = group.reduce((s, g) => s + g.lat, 0) / group.length;
        const lng = group.reduce((s, g) => s + g.lng, 0) / group.length;
        result.push({ kind: 'cluster', lat, lng, count: group.length, key });
      } else {
        [...group]
          .sort((a, b) => a.rank_order - b.rank_order)
          .forEach(spot => result.push({ kind: 'spot', spot }));
      }
    }
    return result;
  }, [displayedSeedSpots, zoomTier]);


  const seedLabelSides = useMemo<Map<string, 'left' | 'right'>>(() => {
    if (mapFilter !== 'spots') return new Map();
    const spots = clusteredItems
      .filter(item => item.kind === 'spot')
      .map(item => (item as { kind: 'spot'; spot: SeedSpot }).spot);
    return new Map(spots.map((s, i) => {
      const hasRightNeighbor = spots.some((other, j) =>
        i !== j &&
        Math.abs(other.lat - s.lat) < LABEL_NEIGHBOR_THRESHOLD &&
        other.lng > s.lng && other.lng - s.lng < LABEL_NEIGHBOR_THRESHOLD
      );
      return [s.id, hasRightNeighbor ? 'left' : 'right'];
    }));
  }, [clusteredItems, mapFilter]);

  const beenLabelSides = useMemo<Map<string, 'left' | 'right'>>(() => {
    if (mapFilter !== 'been') return new Map();
    return new Map(visits.map((v, i) => {
      const hasRightNeighbor = visits.some((other, j) =>
        i !== j &&
        Math.abs(other.lat - v.lat) < LABEL_NEIGHBOR_THRESHOLD &&
        other.lng > v.lng && other.lng - v.lng < LABEL_NEIGHBOR_THRESHOLD
      );
      return [v.id, hasRightNeighbor ? 'left' : 'right'];
    }));
  }, [visits, mapFilter]);

  const wantLabelSides = useMemo<Map<string, 'left' | 'right'>>(() => {
    if (mapFilter !== 'want') return new Map();
    return new Map(futureSpots.map((s, i) => {
      const hasRightNeighbor = futureSpots.some((other, j) =>
        i !== j &&
        Math.abs(other.lat - s.lat) < LABEL_NEIGHBOR_THRESHOLD &&
        other.lng > s.lng && other.lng - s.lng < LABEL_NEIGHBOR_THRESHOLD
      );
      return [s.id, hasRightNeighbor ? 'left' : 'right'];
    }));
  }, [futureSpots, mapFilter]);

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
      >
        {mapFilter === 'been' && (() => {
          const top3ids = new Set(
            [...visits].sort((a, b) => b.rating - a.rating).slice(0, 3).map(v => v.id)
          );
          return visits.map((v) => {
            const isSelected = selectedVisit?.id === v.id;
            const isTop3 = top3ids.has(v.id);
            const color = ratingColor(v.rating);
            const showLabel = region.latitudeDelta < LABEL_ZOOM_THRESHOLD;
            const labelSide = beenLabelSides.get(v.id) ?? 'right';
            return (
              <Marker
                key={isSelected ? `sel-${v.id}` : v.id}
                coordinate={{ latitude: v.lat, longitude: v.lng }}
                onPress={() => handlePinPress(v)}
                tracksViewChanges={false}
                zIndex={isSelected ? 9999 : Math.round(v.rating * 10)}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View pointerEvents="none" style={{ overflow: 'visible' }}>
                  <View style={[styles.pinBadge, { borderColor: color }, isSelected && { backgroundColor: color }]}>
                    <Text style={[styles.pinScore, { color: isSelected ? '#fff' : color }, isTop3 && { fontWeight: '900' }]}>{formatRating(v.rating)}</Text>
                  </View>
                  {showLabel && (
                    <Text
                      style={[styles.pinLabel, labelSide === 'right' ? styles.pinLabelRight : styles.pinLabelLeft, { color: '#000' }, isTop3 && { fontWeight: '900' }]}
                      numberOfLines={1}
                    >{v.venue_name}</Text>
                  )}
                </View>
              </Marker>
            );
          });
        })()}
        {mapFilter === 'want' && futureSpots.map((s) => {
          const showLabel = region.latitudeDelta < LABEL_ZOOM_THRESHOLD;
          const labelSide = wantLabelSides.get(s.id) ?? 'right';
          return (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => {
                if (step === null) {
                  lastPinPressAt.current = Date.now();
                  setSelectedFuture((p) => p?.id === s.id ? null : s);
                }
              }}
            >
              <View pointerEvents="none" style={{ overflow: 'visible' }}>
                <View style={styles.futurePinBadge}>
                  <Ionicons name="bookmark" size={13} color="#fff" />
                </View>
                {showLabel && (
                  <Text
                    style={[styles.pinLabel, labelSide === 'right' ? styles.pinLabelRight : styles.pinLabelLeft, { color: '#000' }]}
                    numberOfLines={1}
                  >{s.venue_name}</Text>
                )}
              </View>
            </Marker>
          );
        })}
        {mapFilter === 'spots' && clusteredItems.map((item) => {
          if (item.kind === 'cluster') {
            return (
              <Marker
                key={item.key}
                coordinate={{ latitude: item.lat, longitude: item.lng }}
                tracksViewChanges={false}
              >
                <View style={styles.clusterBadge} pointerEvents="none">
                  <Text style={styles.clusterText}>{item.count}</Text>
                </View>
              </Marker>
            );
          }
          const s = item.spot;
          const isSelected = selectedSeedSpot?.id === s.id;
          const pinColor = ratingColor(s.rating);
          const showLabel = region.latitudeDelta < LABEL_ZOOM_THRESHOLD;
          const labelSide = seedLabelSides.get(s.id) ?? 'right';
          return (
            <Marker
              key={isSelected ? `sel-${s.id}` : s.id}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              onPress={() => { if (step === null) setSelectedSeedSpot(p => p?.id === s.id ? null : s); }}
              tracksViewChanges={false}
              zIndex={isSelected ? 9999 : Math.round(s.rating * 10)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View pointerEvents="none" style={{ overflow: 'visible' }}>
                <View style={[styles.seedPinBadge, { borderColor: pinColor }, isSelected && { backgroundColor: pinColor }]}>
                  <Text style={[styles.seedPinScore, { color: isSelected ? '#fff' : pinColor }]}>{formatRating(s.rating)}</Text>
                </View>
                {showLabel && (
                  <Text
                    style={[styles.pinLabel, labelSide === 'right' ? styles.pinLabelRight : styles.pinLabelLeft, { color: '#000' }]}
                    numberOfLines={1}
                  >{s.venue_name}</Text>
                )}
              </View>
            </Marker>
          );
        })}
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
              onPress={() => { setMapFilter('been'); setSelectedFuture(null); setSelectedVisit(null); setSelectedSeedSpot(null); }}
            >
              <Text style={[styles.filterPillText, mapFilter === 'been' && styles.filterPillTextActive]}>Been To</Text>
            </Pressable>
            <Pressable
              style={[styles.filterPill, mapFilter === 'want' && styles.filterPillActive]}
              onPress={() => { setMapFilter('want'); setSelectedVisit(null); setSelectedFuture(null); setSelectedSeedSpot(null); }}
            >
              <Text style={[styles.filterPillText, mapFilter === 'want' && styles.filterPillTextActive]}>Want to Go</Text>
            </Pressable>
            <Pressable
              style={[styles.filterPill, mapFilter === 'spots' && styles.filterPillActive]}
              onPress={() => { setMapFilter('spots'); setSelectedVisit(null); setSelectedFuture(null); setSpotsCategory('all'); }}
            >
              <Text style={[styles.filterPillText, mapFilter === 'spots' && styles.filterPillTextActive]}>Top Spots</Text>
            </Pressable>
          </View>
          {mapFilter === 'spots' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryRow}
              contentContainerStyle={styles.categoryRowContent}
              pointerEvents="auto"
            >
              <Pressable
                style={[styles.categoryPill, spotsCategory === 'all' && styles.categoryPillActive]}
                onPress={() => { setSpotsCategory('all'); setSelectedSeedSpot(null); }}
              >
                <Text style={[styles.categoryPillText, spotsCategory === 'all' && styles.categoryPillTextActive]}>All</Text>
              </Pressable>
              {SEED_VENUE_TYPES.map(a => (
                <Pressable
                  key={a.value}
                  style={[styles.categoryPill, spotsCategory === a.value && styles.categoryPillActive]}
                  onPress={() => { setSpotsCategory(a.value); setSelectedSeedSpot(null); }}
                >
                  <Text style={[styles.categoryPillText, spotsCategory === a.value && styles.categoryPillTextActive]}>
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {droppingPin && (
        <View style={styles.pinHint} pointerEvents="none">
          <Text style={styles.pinHintText}>Tap the map to drop a pin</Text>
        </View>
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
          {step === 'mode-select' && (
            <ModeSelectStep
              onBeenTo={() => setStep('location')}
              onWantToGo={() => { setMapFilter('want'); setStep('future-pin'); }}
            />
          )}
          {step === 'location' && (
            <LocationStep
              onDropPin={handleDropPin}
              onSelect={handleSearchSelect}
              onBack={() => setStep('mode-select')}
              region={region}
            />
          )}
          {step === 'future-pin' && (
            <FuturePinStep
              onDropPin={handleFutureDropPin}
              onBack={() => { setMapFilter('been'); setStep('mode-select'); }}
              onSelect={handleFutureSearchSelect}
              region={region}
            />
          )}
          {step === 'future-name' && (
            <FutureNameStep
              value={draft.venue_name || ''}
              onChange={(v) => setDraft((d) => ({ ...d, venue_name: v }))}
              onSave={saveFutureSpot}
              onBack={() => { setStep('future-pin'); sheetRef.current?.snapToIndex(1); }}
              suggestion={geocodeSuggestion}
              geocodeLoading={geocodeLoading}
              onDismissSuggestion={() => setGeocodeSuggestion(null)}
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
                  suggestion={geocodeSuggestion}
                  geocodeLoading={geocodeLoading}
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
                    activityLabel={OCCASION_TYPES.find(a => a.value === (draft.occasion_type || 'romantic'))?.label ?? 'Romantic'}
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

      {/* Banners render last so they sit above the BottomSheet gesture layer */}
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
      {selectedSeedSpot && step === null && mapFilter === 'spots' && (
        <SeedSpotDetail
          spot={selectedSeedSpot}
          onClose={() => setSelectedSeedSpot(null)}
          onSaved={() => setFutureSpots(getAllFutureSpots())}
        />
      )}
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

function SeedSpotDetail({ spot, onClose, onSaved }: { spot: SeedSpot; onClose: () => void; onSaved: () => void }) {
  const info = SEED_VENUE_TYPES.find(a => a.value === spot.activity_type);
  const preview = spot.notes?.trim().slice(0, 70) ?? null;
  const [savedFutureId, setSavedFutureId] = useState<string | null>(() => {
    const existing = getAllFutureSpots().find(
      f => f.venue_name === spot.venue_name && Math.abs(f.lat - spot.lat) < 0.001
    );
    return existing?.id ?? null;
  });
  const toastAnimRef = useRef(new Animated.Value(0));
  const toastAnim = toastAnimRef.current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const existing = getAllFutureSpots().find(
      f => f.venue_name === spot.venue_name && Math.abs(f.lat - spot.lat) < 0.001
    );
    setSavedFutureId(existing?.id ?? null);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastAnim.setValue(0);
  }, [spot.id]);

  function showSavedToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, 1500);
  }

  function handleLog() {
    scheduleOpenLogWithLocation(spot.venue_name, spot.lat, spot.lng);
    onClose();
  }

  function toggleSave() {
    if (savedFutureId) {
      deleteFutureSpot(savedFutureId);
      setSavedFutureId(null);
      onSaved();
    } else {
      const newId = Crypto.randomUUID();
      insertFutureSpot({ id: newId, venue_name: spot.venue_name, lat: spot.lat, lng: spot.lng, created_at: new Date().toISOString() });
      setSavedFutureId(newId);
      onSaved();
      showSavedToast();
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.savedToast, {
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
        }]}
        pointerEvents="none"
      >
        <Ionicons name="bookmark" size={13} color="#5856d6" />
        <Text style={styles.savedToastText}>Saved!</Text>
      </Animated.View>
      <Pressable style={styles.visitBanner} onPress={() => router.push(`/spot/${spot.id}`)}>
        <View style={styles.visitBannerInner}>
          <View style={styles.visitBannerBody}>
            <View style={styles.visitBannerTop}>
              <Text style={styles.visitBannerName} numberOfLines={1}>{spot.venue_name}</Text>
              <View style={[styles.visitBannerPill, { borderColor: ratingColor(spot.rating) }]}>
                <Text style={[styles.visitBannerPillText, { color: ratingColor(spot.rating) }]}>{formatRating(spot.rating)}</Text>
              </View>
            </View>
            <Text style={styles.visitBannerMeta}>
              {info?.label ?? 'Other'} · {PRICE_LABELS[spot.price as Price]}
            </Text>
            {preview ? (
              <Text style={styles.visitBannerPreview} numberOfLines={1}>{preview}</Text>
            ) : null}
          </View>
          <View style={styles.visitBannerActions}>
            <View style={styles.visitBannerActionGroup}>
              <Pressable onPress={handleLog} hitSlop={8} style={styles.visitBannerActionBtn}>
                <Ionicons name="add" size={20} color={T.accent} />
              </Pressable>
              <Pressable onPress={toggleSave} hitSlop={8} style={styles.visitBannerActionBtn}>
                <Ionicons name={savedFutureId ? 'bookmark' : 'bookmark-outline'} size={17} color="#5856d6" />
              </Pressable>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.visitBannerClose}>
              <Ionicons name="close" size={18} color={T.muted} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
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

function useNominatimSearch(fallbackRegion: Region) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    // Bias to the home city region (set from profile). Never use device GPS here —
    // GPS can override the user's chosen city when on a simulator or traveling.
    const lat = fallbackRegion.latitude;
    const lng = fallbackRegion.longitude;
    let cancelled = false;
    // viewbox biases results toward the user's city; countrycodes=us hard-blocks
    // international results. No bounded=1 — bounded causes Nominatim to return
    // empty rather than reach outside the box, which breaks landmark searches.
    const vb = `${lng - 4},${lat + 3},${lng + 4},${lat - 3}`;
    const timer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&viewbox=${vb}&addressdetails=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'DateSpotApp/1.0' } });
        const data: NominatimResult[] = await res.json();
        if (!cancelled) setResults(data);
      } catch { if (!cancelled) setResults([]); }
      if (!cancelled) setLoading(false);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  return { query, setQuery, results, loading };
}

function SearchResultsList({ results, loading, query, onSelect }: {
  results: NominatimResult[];
  loading: boolean;
  query: string;
  onSelect: (name: string, lat: number, lng: number, address: string) => void;
}) {
  return (
    <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
      {loading && (
        <View style={styles.searchLoadingRow}>
          <ActivityIndicator size="small" color="#A0927E" />
          <Text style={[styles.searchMsg, { paddingVertical: 0 }]}>Searching…</Text>
        </View>
      )}
      {!loading && query.length >= 2 && results.length === 0 && (
        <Text style={styles.searchMsg}>No results found nearby</Text>
      )}
      {results.map(r => {
        const name = r.name || r.display_name.split(', ')[0];
        const parts = r.display_name.split(', ');
        const addr = parts.slice(1, 3).join(', ');
        return (
          <Pressable
            key={r.place_id}
            style={styles.searchResult}
            onPress={() => onSelect(name, parseFloat(r.lat), parseFloat(r.lon), r.display_name)}
          >
            <Ionicons name="location-outline" size={16} color={T.muted} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.searchResultName} numberOfLines={1}>{name}</Text>
              {addr ? <Text style={styles.searchResultAddr} numberOfLines={1}>{addr}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ModeSelectStep({ onBeenTo, onWantToGo }: {
  onBeenTo: () => void;
  onWantToGo: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What are you logging?</Text>
      <Text style={styles.stepSubtitle}>Choose one to get started</Text>
      <View style={{ gap: 12, marginTop: 8 }}>
        <Pressable
          style={({ pressed }) => [styles.modeCard, { opacity: pressed ? 0.85 : 1 }]}
          onPress={onBeenTo}
        >
          <Ionicons name="checkmark-circle" size={28} color={T.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.modeCardTitle}>Been To</Text>
            <Text style={styles.modeCardSub}>Log a place you've visited</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.muted} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.modeCard, { opacity: pressed ? 0.85 : 1 }]}
          onPress={onWantToGo}
        >
          <Ionicons name="bookmark" size={28} color="#5856d6" />
          <View style={{ flex: 1 }}>
            <Text style={styles.modeCardTitle}>Want to Go</Text>
            <Text style={styles.modeCardSub}>Save a place for later</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.muted} />
        </Pressable>
      </View>
    </View>
  );
}

function LocationStep({ onDropPin, onSelect, onBack, region }: {
  onDropPin: () => void;
  onSelect: (name: string, lat: number, lng: number, address: string) => void;
  onBack: () => void;
  region: Region;
}) {
  const { query, setQuery, results, loading } = useNominatimSearch(region);
  return (
    <View style={styles.stepContainer}>
      <ProgressDots currentStep={1} />
      <Text style={styles.stepTitle}>Where did you go?</Text>
      <Text style={styles.stepSubtitle}>Search by name, address, or neighborhood</Text>
      <TextInput
        style={[styles.input, { marginBottom: 4 }]}
        placeholder="Search for a place…"
        placeholderTextColor="#c7c7cc"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoFocus
      />
      <SearchResultsList results={results} loading={loading} query={query} onSelect={onSelect} />
      <View style={styles.pinFallbackRow}>
        <Pressable onPress={onDropPin} style={styles.pinFallbackBtn}>
          <Ionicons name="map-outline" size={15} color={T.muted} />
          <Text style={styles.pinFallbackText}>Can't find it? Drop a pin on the map</Text>
        </Pressable>
        <Pressable onPress={onBack}>
          <Text style={[styles.pinFallbackText, { color: T.muted }]}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FuturePinStep({ onDropPin, onBack, onSelect, region }: {
  onDropPin: () => void; onBack: () => void;
  onSelect: (name: string, lat: number, lng: number, address: string) => void;
  region: Region;
}) {
  const { query, setQuery, results, loading } = useNominatimSearch(region);
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Where do you want to go?</Text>
      <Text style={styles.stepSubtitle}>Search by name, address, or neighborhood</Text>
      <TextInput
        style={[styles.input, { marginBottom: 4 }]}
        placeholder="Search for a place…"
        placeholderTextColor="#c7c7cc"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoFocus
      />
      <SearchResultsList results={results} loading={loading} query={query} onSelect={onSelect} />
      <View style={styles.pinFallbackRow}>
        <Pressable onPress={onDropPin} style={styles.pinFallbackBtn}>
          <Ionicons name="map-outline" size={15} color={T.muted} />
          <Text style={styles.pinFallbackText}>Can't find it? Drop a pin on the map</Text>
        </Pressable>
        <Pressable onPress={onBack}>
          <Text style={[styles.pinFallbackText, { color: T.muted }]}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FutureNameStep({ value, onChange, onSave, onBack, suggestion, geocodeLoading, onDismissSuggestion }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onBack: () => void;
  suggestion: string | null; geocodeLoading: boolean; onDismissSuggestion: () => void;
}) {
  const showConfirm = !!suggestion && !value;
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's it called?</Text>
      {showConfirm ? (
        <View style={styles.suggestionCard}>
          <Text style={styles.suggestionPrompt}>Is this right?</Text>
          <Text style={styles.suggestionName}>{suggestion}</Text>
          <View style={styles.btnRow}>
            <Pressable style={styles.btnSecondary} onPress={onDismissSuggestion}>
              <Text style={styles.btnSecondaryText}>No</Text>
            </Pressable>
            <Pressable style={styles.btnPrimary} onPress={() => { onChange(suggestion); setTimeout(onSave, 0); }}>
              <Text style={styles.btnPrimaryText}>Yes, that's it</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.stepSubtitle}>
            {geocodeLoading && !value ? 'Looking up the spot…' : 'Give it a name to remember'}
          </Text>
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
        </>
      )}
    </View>
  );
}

function FutureDetail({ spot, onClose, onDelete }: {
  spot: FutureSpot; onClose: () => void; onDelete: () => void;
}) {
  function handleLog() {
    scheduleOpenLogWithLocation(spot.venue_name, spot.lat, spot.lng);
    onClose();
  }

  return (
    <View style={styles.visitBanner}>
      <View style={styles.visitBannerInner}>
        <Pressable style={styles.visitBannerBody} onPress={() => router.push(`/future/${spot.id}` as any)}>
          <View style={styles.visitBannerTop}>
            <Text style={styles.visitBannerName} numberOfLines={1}>{spot.venue_name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="bookmark" size={12} color="#5856d6" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#5856d6' }}>Want to go</Text>
            </View>
          </View>
          <Text style={styles.visitBannerMeta}>Added {friendlyDate(spot.created_at)}</Text>
        </Pressable>
        <View style={styles.visitBannerActions}>
          <Pressable onPress={handleLog} hitSlop={8} style={styles.visitBannerActionBtn}>
            <Ionicons name="add" size={20} color={T.accent} />
          </Pressable>
          <Pressable onPress={onClose} hitSlop={12} style={styles.visitBannerClose}>
            <Ionicons name="close" size={18} color={T.muted} />
          </Pressable>
        </View>
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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CAL_DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function CalendarPicker({ value, onChange }: {
  value: string;
  onChange: (date: string) => void;
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const parseDate = (s: string) => {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return null;
  };

  const selectedDate = value ? parseDate(value) : null;
  const initDisplay = selectedDate || today;

  const [displayYear, setDisplayYear] = useState(initDisplay.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(initDisplay.getMonth());

  const isCurrentMonth = displayYear === today.getFullYear() && displayMonth === today.getMonth();

  function prevMonth() {
    if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(y => y - 1); }
    else { setDisplayMonth(m => m - 1); }
  }

  function nextMonth() {
    if (isCurrentMonth) return;
    if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear(y => y + 1); }
    else { setDisplayMonth(m => m + 1); }
  }

  function selectDay(day: number) {
    const d = new Date(displayYear, displayMonth, day);
    if (d > today) return;
    const mo = String(displayMonth + 1).padStart(2, '0');
    const da = String(day).padStart(2, '0');
    onChange(`${displayYear}-${mo}-${da}`);
  }

  const firstDayOfWeek = new Date(displayYear, displayMonth, 1).getDay();
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeader}>
        <Pressable onPress={prevMonth} hitSlop={12} style={styles.calendarNavBtn}>
          <Ionicons name="chevron-back" size={20} color={T.primary} />
        </Pressable>
        <Text style={styles.calendarMonthTitle}>{MONTHS[displayMonth]} {displayYear}</Text>
        <Pressable onPress={nextMonth} hitSlop={12} style={styles.calendarNavBtn}>
          <Ionicons name="chevron-forward" size={20} color={isCurrentMonth ? T.border : T.primary} />
        </Pressable>
      </View>
      <View style={styles.calendarDayHeaders}>
        {CAL_DAY_HEADERS.map((h, i) => (
          <Text key={i} style={styles.calendarDayHeader}>{h}</Text>
        ))}
      </View>
      <View style={styles.calendarGrid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={styles.calendarCell} />;
          const cellDate = new Date(displayYear, displayMonth, day);
          const isFuture = cellDate > today;
          const isSelected = !!(selectedDate &&
            selectedDate.getFullYear() === displayYear &&
            selectedDate.getMonth() === displayMonth &&
            selectedDate.getDate() === day);
          const isTodayCell = today.getFullYear() === displayYear &&
            today.getMonth() === displayMonth &&
            today.getDate() === day;
          return (
            <Pressable
              key={day}
              style={styles.calendarCell}
              onPress={() => !isFuture && selectDay(day)}
              disabled={isFuture}
            >
              <View style={[styles.calendarCellInner, isSelected && styles.calendarCellSelected]}>
                <Text style={[
                  styles.calendarCellText,
                  isFuture && styles.calendarCellTextFuture,
                  isSelected && styles.calendarCellTextSelected,
                ]}>
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DetailsStep({ draft, onChange, onNext, onBack, suggestion, geocodeLoading }: {
  draft: Partial<DraftVisit>;
  onChange: (key: string, val: any) => void;
  onNext: () => void;
  onBack: () => void;
  suggestion: string | null;
  geocodeLoading: boolean;
}) {
  const autofilled = useRef(false);
  useEffect(() => {
    if (suggestion && !draft.venue_name && !autofilled.current) {
      autofilled.current = true;
      onChange('venue_name', suggestion);
    }
  }, [suggestion]);

  const [showCalendar, setShowCalendar] = useState(false);
  const calendarAnim = useRef(new Animated.Value(0)).current;

  function toggleCalendar() {
    const next = !showCalendar;
    setShowCalendar(next);
    Animated.timing(calendarAnim, {
      toValue: next ? 1 : 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  const dateValue = draft.visited_at?.match(/^\d{4}-\d{2}-\d{2}/)
    ? draft.visited_at.slice(0, 10)
    : todayStr;

  useEffect(() => {
    if (!draft.visited_at) onChange('visited_at', todayStr);
  }, []);

  const isFutureDate = (() => {
    if (!dateValue) return false;
    const picked = new Date(dateValue + 'T00:00:00');
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
    onChange('photos', [...photos, ...result.assets.map(a => a.uri)]);
  }

  function removePhoto(index: number) {
    onChange('photos', photos.filter((_, i) => i !== index));
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.detailsScroll} contentContainerStyle={styles.stepContainer} keyboardShouldPersistTaps="handled">
        <ProgressDots currentStep={2} />
        <Text style={styles.stepTitle}>Tell me about it</Text>
        <Text style={styles.stepSubtitle}>Step 2 of 5</Text>

        <Text style={styles.sectionLabel}>Name</Text>
        <TextInput
          style={styles.input}
          value={draft.venue_name || ''}
          onChangeText={(v) => onChange('venue_name', v)}
          placeholder={geocodeLoading ? 'Looking up the spot…' : 'Name this spot'}
          placeholderTextColor="#c7c7cc"
          returnKeyType="done"
        />

        <Text style={styles.sectionLabel}>Date</Text>
        <Pressable style={styles.calendarToggleBtn} onPress={toggleCalendar}>
          <Ionicons name="calendar-outline" size={18} color={T.accent} />
          <Text style={styles.calendarToggleBtnText}>{dateValue || 'Pick a date'}</Text>
          <Ionicons name={showCalendar ? 'chevron-up' : 'chevron-down'} size={16} color={T.muted} />
        </Pressable>
        <Animated.View style={{
          height: calendarAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 380] }),
          overflow: 'hidden',
        }}>
          <CalendarPicker value={dateValue} onChange={(date) => {
            onChange('visited_at', date);
            setShowCalendar(false);
            Animated.timing(calendarAnim, { toValue: 0, duration: 260, useNativeDriver: false }).start();
          }} />
        </Animated.View>
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

        <Text style={styles.sectionLabel}>Category</Text>
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

        <Text style={styles.sectionLabel}>What kind of date?</Text>
        <View style={styles.occasionRow}>
          {OCCASION_TYPES.map((a) => {
            const selected = draft.occasion_type === a.value;
            return (
              <Pressable
                key={a.value}
                style={[styles.occasionBtn, selected && styles.occasionBtnSelected]}
                onPress={() => onChange('occasion_type', selected ? null : a.value)}
              >
                <Text style={[styles.occasionLabel, selected && styles.occasionLabelSelected]}>{a.label}</Text>
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

        <Text style={styles.sectionLabel}>Notes</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="What made it memorable?"
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
    </View>
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

function NoCompareStep({ triage, activityLabel, onSave }: { triage: Triage; activityLabel: string; onSave: () => void }) {
  const tierLabel = triage === 'great' ? 'great' : triage === 'okay' ? 'okay' : 'bad';
  return (
    <View style={styles.stepContainer}>
      <ProgressDots currentStep={4} />
      <Text style={styles.stepTitle}>First {activityLabel} spot</Text>
      <Text style={styles.stepSubtitle}>
        You don't have other {tierLabel} {activityLabel.toLowerCase()} spots to compare yet. Once you log more, they'll rank against each other here.
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
  const opponentColor = ratingColor(opponent.rating);
  return (
    <View style={styles.stepContainer}>
      <ProgressDots currentStep={4} />
      <Text style={styles.stepTitle}>Which was better?</Text>
      <Text style={styles.stepSubtitle}>Step 4 of 5</Text>
      <View style={styles.compareRow}>
        <Pressable style={[styles.compareCard, styles.compareCardNew]} onPress={onBetter}>
          <View style={[styles.comparePill, styles.compareNewPill]}>
            <Text style={[styles.comparePillText, { color: '#B0A090' }]}>?</Text>
          </View>
          <Text style={styles.compareCardName} numberOfLines={3}>{newVenueName}</Text>
          <Text style={styles.compareCardLabel}>This one</Text>
        </Pressable>
        <View style={styles.compareVs}><Text style={styles.compareVsText}>vs</Text></View>
        <Pressable style={[styles.compareCard, styles.compareCardOld]} onPress={onWorse}>
          <View style={[styles.comparePill, { borderColor: opponentColor }]}>
            <Text style={[styles.comparePillText, { color: opponentColor }]}>{formatRating(opponent.rating)}</Text>
          </View>
          <Text style={styles.compareCardName} numberOfLines={3}>{opponent.venue_name}</Text>
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
  pinLabel: {
    position: 'absolute',
    top: 0, bottom: 0,
    fontSize: 11, fontWeight: '700', color: '#000',
    maxWidth: 80,
    textAlignVertical: 'center',
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  pinLabelRight: { left: '100%', marginLeft: 5 },
  pinLabelLeft: { right: '100%', marginRight: 5 },

  futurePinBadge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#5856d6',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#5856d6', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4,
  },

  seedPinBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 4, borderRadius: 13,
    backgroundColor: '#fff', borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  seedPinScore: { fontSize: 11, fontWeight: '800' },

  clusterBadge: {
    minWidth: 34, height: 34, borderRadius: 17,
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  clusterText: { fontSize: 13, fontWeight: '800', color: '#000' },

  filterRow: {
    position: 'absolute', top: 56, left: 0, right: 0,
    alignItems: 'center', gap: 8,
  },
  filterPills: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20, padding: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6,
  },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 17,
  },
  filterPillActive: { backgroundColor: T.accent },
  filterPillText: { fontSize: 14, fontWeight: '600', color: T.muted },
  filterPillTextActive: { color: '#fff' },

  categoryRow: { maxHeight: 40 },
  categoryRowContent: {
    paddingHorizontal: 12, gap: 6, flexDirection: 'row', alignItems: 'center',
  },
  categoryPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3,
  },
  categoryPillActive: { backgroundColor: '#F5A623' },
  categoryPillText: { fontSize: 13, fontWeight: '600', color: T.muted },
  categoryPillTextActive: { color: '#fff' },


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
  visitBannerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visitBannerActionGroup: { flexDirection: 'column', alignItems: 'center', gap: 6 },
  visitBannerActionBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center',
  },
  visitBannerClose: { paddingTop: 1 },
  savedToast: {
    position: 'absolute', bottom: 110, alignSelf: 'center', zIndex: 30,
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10,
  },
  savedToastText: { fontSize: 13, fontWeight: '600', color: '#5856d6' },


  searchResults: { maxHeight: 300, marginTop: 4 },
  searchResult: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 11, paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  searchResultName: { fontSize: 14, fontWeight: '600', color: T.primary },
  searchResultAddr: { fontSize: 12, color: T.muted, marginTop: 2 },
  searchMsg: { fontSize: 13, color: T.muted, textAlign: 'center', paddingVertical: 16 },


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
    paddingVertical: 20,
    justifyContent: 'center',
    opacity: 0.9,
  },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.border },
  dotActive: { width: 18, borderRadius: 3, backgroundColor: T.accent },
  dotDone: { backgroundColor: '#c9b89e' },

  detailsScroll: { flex: 1 },
  stepContainer: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  stepTitle: { fontSize: 18, fontWeight: '700', color: T.primary, textAlign: 'center', fontFamily: 'InstrumentSerif-Regular' },
  stepSubtitle: { fontSize: 13, color: T.muted, textAlign: 'center', marginTop: 8, marginBottom: 28 },

  modeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: T.card, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 16,
    borderWidth: 1.5, borderColor: T.border,
  },
  modeCardTitle: { fontSize: 15, fontWeight: '700', color: T.primary },
  modeCardSub: { fontSize: 12, color: T.muted, marginTop: 2 },

  pinFallbackRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingHorizontal: 2,
  },
  pinFallbackBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pinFallbackText: { fontSize: 13, color: T.accent },

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
  occasionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  occasionBtn: {
    flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.inputBg, gap: 4,
  },
  occasionBtnSelected: { backgroundColor: T.accentTint, borderColor: T.accent },
  occasionLabel: { fontSize: 14, fontWeight: '600', color: T.primary },
  occasionLabelSelected: { color: T.accent },
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
  compareCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6, height: 148, justifyContent: 'center' },
  compareCardNew: { backgroundColor: T.accentTint, borderWidth: 2, borderColor: T.accent },
  compareCardOld: { backgroundColor: T.inputBg, borderWidth: 2, borderColor: T.border },
  comparePill: {
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
    borderWidth: 1.5, backgroundColor: 'transparent',
  },
  comparePillText: { fontSize: 12, fontWeight: '800' },
  compareNewPill: { borderColor: '#B0A090' },
  compareCardName: { fontSize: 13, fontWeight: '700', color: T.primary, textAlign: 'center', lineHeight: 18 },
  compareCardLabel: { fontSize: 11, color: T.muted, fontWeight: '500' },
  compareVs: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center' },
  compareVsText: { fontSize: 12, fontWeight: '700', color: T.muted },

  tooHardBtn: {
    backgroundColor: T.inputBg, borderRadius: 14,
    paddingVertical: 12, alignItems: 'center', marginBottom: 8,
  },
  tooHardText: { fontSize: 14, fontWeight: '600', color: T.muted },

  dateError: { fontSize: 12, color: '#ff3b30', fontWeight: '600', marginTop: -8, marginBottom: 8 },

  calendarContainer: {
    borderRadius: 14, borderWidth: 1.5, borderColor: T.border,
    backgroundColor: T.card, padding: 10, marginBottom: 12,
  },
  calendarHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  calendarNavBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  calendarMonthTitle: { fontSize: 15, fontWeight: '700', color: T.primary },
  calendarDayHeaders: { flexDirection: 'row', marginBottom: 2 },
  calendarDayHeader: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600', color: T.muted, paddingBottom: 4 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.285714%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calendarCellInner: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  calendarCellSelected: { backgroundColor: T.accent },
  calendarCellText: { fontSize: 13, fontWeight: '500', color: T.primary },
  calendarCellTextFuture: { color: T.primary, opacity: 0.25 },
  calendarCellTextSelected: { color: '#fff', fontWeight: '700' },

  calendarToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: T.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: T.card, marginBottom: 8,
  },
  calendarToggleBtnText: { flex: 1, fontSize: 15, color: T.primary, fontWeight: '500' },

  searchLoadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },

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

  suggestionCard: {
    backgroundColor: T.accentTint,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: T.accent,
    padding: 20,
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
    gap: 6,
  },
  suggestionPrompt: { fontSize: 13, color: T.muted, fontWeight: '500' },
  suggestionName: { fontSize: 20, fontWeight: '700', color: T.primary, textAlign: 'center', marginBottom: 8 },

  geocodeHint: { fontSize: 11, color: T.muted, marginTop: -6, marginBottom: 8, marginLeft: 2 },
});
