import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Image,
  ActionSheetIOS, Alert, ScrollView, Dimensions, TextInput,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getVisitById, deleteVisit, updateVisit, Visit,
  ACTIVITY_TYPES, PRICE_LABELS, Price, ActivityType,
  ratingColor, formatRating,
} from '@/lib/visits';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 20;
const PHOTO_COLS = 3;
const PHOTO_GAP = 2;
const PHOTO_SIZE = (SCREEN_W - H_PAD * 2 - PHOTO_GAP * (PHOTO_COLS - 1)) / PHOTO_COLS;

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  useFocusEffect(useCallback(() => {
    if (id) setVisit(getVisitById(id));
  }, [id]));

  if (!visit) return null;

  function handleMenu() {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', 'Edit', 'Delete spot'], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
      (i) => {
        if (i === 1) setEditing(true);
        if (i === 2) {
          Alert.alert('Delete spot', `Remove "${visit!.venue_name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive', onPress: () => {
                deleteVisit(id);
                router.back();
              },
            },
          ]);
        }
      }
    );
  }

  const info = ACTIVITY_TYPES.find((a) => a.value === visit.activity_type);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeHeader} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={28} color="#1c1c1e" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{visit.venue_name}</Text>
          <Pressable onPress={handleMenu} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#1c1c1e" />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Rating + meta */}
        <View style={styles.metaRow}>
          <View style={[styles.scorePill, { backgroundColor: ratingColor(visit.rating) }]}>
            <Text style={styles.scoreText}>{formatRating(visit.rating)}</Text>
          </View>
          <Text style={styles.metaText}>{info?.emoji} {info?.label}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{PRICE_LABELS[visit.price as Price]}</Text>
          {visit.visited_at ? (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{visit.visited_at}</Text>
            </>
          ) : null}
        </View>

        {/* Photos grid */}
        {visit.photos.length > 0 && (
          <View style={styles.photosSection}>
            <View style={styles.photosSectionHeader}>
              <Text style={styles.sectionLabel}>Photos</Text>
            </View>
            <View style={styles.photosGrid}>
              {visit.photos.map((uri, idx) => (
                <Image
                  key={idx}
                  source={{ uri }}
                  style={styles.photoThumb}
                  resizeMode="cover"
                />
              ))}
            </View>
          </View>
        )}

        {/* Map + Notes squares */}
        <View style={styles.squaresRow}>
          {/* Mini map */}
          <Pressable style={styles.squareWrap} onPress={() => setMapExpanded(true)}>
            <MapView
              style={StyleSheet.absoluteFill}
              region={{
                latitude: visit.lat,
                longitude: visit.lng,
                latitudeDelta: 0.004,
                longitudeDelta: 0.004,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              showsUserLocation={false}
              showsPointsOfInterest={false}
              showsCompass={false}
              showsScale={false}
              mapType="standard"
              pointerEvents="none"
            >
              <Marker coordinate={{ latitude: visit.lat, longitude: visit.lng }}>
                <View style={[styles.pinBadge, { backgroundColor: ratingColor(visit.rating) }]}>
                  <Text style={styles.pinScore}>{formatRating(visit.rating)}</Text>
                </View>
              </Marker>
            </MapView>
            <View style={styles.expandBadge}>
              <Ionicons name="expand-outline" size={13} color="#fff" />
            </View>
          </Pressable>

          {/* Notes */}
          <View style={[styles.squareWrap, styles.notesWrap]}>
            {visit.notes ? (
              <Text style={styles.notesText} numberOfLines={8}>{visit.notes}</Text>
            ) : (
              <Text style={styles.notesEmpty}>No notes</Text>
            )}
          </View>
        </View>

      </ScrollView>

      {/* Full-screen map modal */}
      <Modal visible={mapExpanded} animationType="slide">
        <View style={styles.fullMapRoot}>
          <SafeAreaView style={styles.modalSafe} edges={['top']}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setMapExpanded(false)} hitSlop={12} style={styles.headerBtn}>
                <Ionicons name="chevron-back" size={28} color="#1c1c1e" />
              </Pressable>
              <Text style={styles.modalTitle} numberOfLines={1}>{visit.venue_name}</Text>
              <View style={{ width: 40 }} />
            </View>
          </SafeAreaView>
          <MapView
            style={{ flex: 1 }}
            initialRegion={{
              latitude: visit.lat,
              longitude: visit.lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={false}
            showsPointsOfInterest={false}
            mapType="standard"
          >
            <Marker coordinate={{ latitude: visit.lat, longitude: visit.lng }}>
              <View style={[styles.pinBadge, { backgroundColor: ratingColor(visit.rating) }]}>
                <Text style={styles.pinScore}>{formatRating(visit.rating)}</Text>
              </View>
            </Marker>
          </MapView>
        </View>
      </Modal>

      {/* Edit modal */}
      {editing && (
        <EditModal
          visit={visit}
          onClose={() => setEditing(false)}
          onSave={(updated) => { setVisit(updated); setEditing(false); }}
        />
      )}
    </View>
  );
}

function EditModal({
  visit, onClose, onSave,
}: {
  visit: Visit;
  onClose: () => void;
  onSave: (updated: Visit) => void;
}) {
  const [name, setName] = useState(visit.venue_name);
  const [date, setDate] = useState(visit.visited_at);
  const [notes, setNotes] = useState(visit.notes ?? '');
  const [activity, setActivity] = useState<ActivityType>(visit.activity_type);
  const [price, setPrice] = useState<Price>(visit.price);

  function handleSave() {
    if (!name.trim()) { Alert.alert('Name required', 'Give this spot a name.'); return; }
    updateVisit(visit.id, {
      venue_name: name.trim(),
      visited_at: date,
      notes: notes.trim() || null,
      activity_type: activity,
      price,
    });
    const updated = getVisitById(visit.id);
    if (updated) onSave(updated);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={editStyles.root} edges={['top', 'bottom']}>
        <View style={editStyles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={editStyles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={editStyles.title}>Edit spot</Text>
          <Pressable onPress={handleSave} hitSlop={8}>
            <Text style={editStyles.save}>Save</Text>
          </Pressable>
        </View>

        <ScrollView style={editStyles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TextInput
            style={editStyles.input}
            placeholder="Venue name"
            placeholderTextColor="#c7c7cc"
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="next"
          />
          <TextInput
            style={editStyles.input}
            placeholder="Date (e.g. Apr 28)"
            placeholderTextColor="#c7c7cc"
            value={date}
            onChangeText={setDate}
            returnKeyType="next"
          />

          <Text style={editStyles.sectionLabel}>What kind of spot?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={editStyles.chipScroll}>
            {ACTIVITY_TYPES.map((a) => {
              const sel = activity === a.value;
              return (
                <Pressable
                  key={a.value}
                  style={[editStyles.chip, sel && editStyles.chipSelected]}
                  onPress={() => setActivity(a.value)}
                >
                  <Text style={editStyles.chipEmoji}>{a.emoji}</Text>
                  <Text style={[editStyles.chipLabel, sel && editStyles.chipLabelSel]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={editStyles.sectionLabel}>Price range</Text>
          <View style={editStyles.priceRow}>
            {([1, 2, 3] as Price[]).map((p) => {
              const sel = price === p;
              return (
                <Pressable
                  key={p}
                  style={[editStyles.priceBtn, sel && editStyles.priceBtnSel]}
                  onPress={() => setPrice(p)}
                >
                  <Text style={[editStyles.priceBtnText, sel && editStyles.priceBtnTextSel]}>
                    {PRICE_LABELS[p]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={[editStyles.input, editStyles.inputMultiline]}
            placeholder="Notes — what made it memorable?"
            placeholderTextColor="#c7c7cc"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  safeHeader: { backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 6,
  },
  headerBtn: { width: 40, alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: '#1c1c1e', textAlign: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    gap: 8, paddingHorizontal: H_PAD, paddingTop: 20, paddingBottom: 4,
  },
  scorePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  scoreText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  metaText: { fontSize: 14, color: '#3a3a3c' },
  metaDot: { fontSize: 14, color: '#c7c7cc' },

  photosSection: { paddingHorizontal: H_PAD, marginTop: 24 },
  photosSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#8e8e93', textTransform: 'uppercase', letterSpacing: 0.5 },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PHOTO_GAP,
  },
  photoThumb: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 6,
    backgroundColor: '#f2f2f7',
  },

  squaresRow: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: H_PAD, marginTop: 24,
  },
  squareWrap: {
    flex: 1, aspectRatio: 1,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#f2f2f7',
  },
  expandBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6, padding: 4,
  },
  pinBadge: {
    minWidth: 38, height: 24, borderRadius: 12,
    paddingHorizontal: 7,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 3,
  },
  pinScore: { fontSize: 11, fontWeight: '800', color: '#fff' },

  notesWrap: { padding: 16 },
  notesText: { fontSize: 14, color: '#3a3a3c', lineHeight: 20 },
  notesEmpty: { fontSize: 14, color: '#c7c7cc', fontStyle: 'italic' },

  fullMapRoot: { flex: 1, backgroundColor: '#fff' },
  modalSafe: { backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 6,
  },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: '#1c1c1e', textAlign: 'center' },
});

const editStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea',
  },
  cancel: { fontSize: 16, color: '#8e8e93' },
  title: { fontSize: 17, fontWeight: '600', color: '#1c1c1e' },
  save: { fontSize: 16, fontWeight: '600', color: '#ff3b5c' },
  form: { paddingHorizontal: 20, paddingTop: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#8e8e93', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#f2f2f7', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#1c1c1e', marginBottom: 12,
  },
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },
  chipScroll: { marginBottom: 16, marginHorizontal: -20 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f2f2f7', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9, marginRight: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipSelected: { backgroundColor: '#fff0f3', borderColor: '#ff3b5c' },
  chipEmoji: { fontSize: 15 },
  chipLabel: { fontSize: 14, fontWeight: '500', color: '#3a3a3c' },
  chipLabelSel: { color: '#ff3b5c', fontWeight: '700' },
  priceRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  priceBtn: {
    flex: 1, backgroundColor: '#f2f2f7', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  priceBtnSel: { backgroundColor: '#fff0f3', borderColor: '#ff3b5c' },
  priceBtnText: { fontSize: 16, fontWeight: '600', color: '#3a3a3c' },
  priceBtnTextSel: { color: '#ff3b5c' },
});
