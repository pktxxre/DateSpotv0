import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Image,
  Alert, ScrollView, Dimensions, TextInput, Share, NativeModules,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getVisitById, deleteVisit, updateVisit, Visit,
  ACTIVITY_TYPES, PRICE_LABELS, Price, ActivityType,
  ratingColor, formatRating, friendlyDate,
} from '@/lib/visits';
import { uploadPhoto } from '@/lib/storage';
import { T } from '@/lib/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 20;
const PHOTO_COLS = 3;
const PHOTO_GAP = 4;
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
                <Text style={styles.tagText}>{info.emoji}  {info.label}</Text>
              </View>
            )}
            <View style={styles.tag}>
              <Text style={styles.tagText}>{PRICE_LABELS[visit.price as Price]}</Text>
            </View>
          </View>

          {/* Rating — smaller, secondary */}
          <View style={styles.ratingRow}>
            <View style={[styles.ratingBadge, { backgroundColor: color + '2E' }]}>
              <Text style={[styles.ratingScore, { color }]}>{formatRating(visit.rating)}</Text>
              <Text style={[styles.ratingSlash, { color: color + 'AA' }]}>/10</Text>
            </View>
            <Text style={styles.ratingCaption}>Overall rating</Text>
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
    </View>
  );
}

function EditModal({ visit, onClose, onSave }: { visit: Visit; onClose: () => void; onSave: (v: Visit) => void }) {
  const [name, setName] = useState(visit.venue_name);
  const [date, setDate] = useState(visit.visited_at);
  const [notes, setNotes] = useState(visit.notes ?? '');
  const [activity, setActivity] = useState<ActivityType>(visit.activity_type);
  const [price, setPrice] = useState<Price>(visit.price);
  const [photos, setPhotos] = useState<string[]>(visit.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function pickAndUploadPhoto() {
    if (!NativeModules.ExponentImagePicker) {
      Alert.alert('Not available', 'Run `npx expo run:ios` to enable photo upload.');
      return;
    }
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo library access.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) return;
      setUploading(true);
      const path = `spots/${visit.id}/${Date.now()}.jpg`;
      const url = await uploadPhoto(result.assets[0].uri, path);
      if (url) setPhotos(prev => [...prev, url]);
      else Alert.alert('Upload failed', 'Could not upload photo. Check your connection.');
    } catch {
      Alert.alert('Error', 'Something went wrong picking the photo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Name required', 'Give this spot a name.'); return; }
    setSaving(true);
    updateVisit(visit.id, {
      venue_name: name.trim(), visited_at: date,
      notes: notes.trim() || null, activity_type: activity, price, photos,
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
          <TextInput style={e.input} placeholder="Venue name" placeholderTextColor="#c7c7cc" value={name} onChangeText={setName} autoFocus returnKeyType="next" />
          <TextInput style={e.input} placeholder="Date (e.g. Apr 28)" placeholderTextColor="#c7c7cc" value={date} onChangeText={setDate} returnKeyType="next" />
          <Text style={e.label}>Type of spot</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={e.chipScroll}>
            {ACTIVITY_TYPES.map(a => {
              const sel = activity === a.value;
              return (
                <Pressable key={a.value} style={[e.chip, sel && e.chipSel]} onPress={() => setActivity(a.value)}>
                  <Text style={e.chipEmoji}>{a.emoji}</Text>
                  <Text style={[e.chipLabel, sel && e.chipLabelSel]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={e.label}>Price range</Text>
          <View style={e.priceRow}>
            {([1, 2, 3] as Price[]).map(p => {
              const sel = price === p;
              return (
                <Pressable key={p} style={[e.priceBtn, sel && e.priceBtnSel]} onPress={() => setPrice(p)}>
                  <Text style={[e.priceBtnText, sel && e.priceBtnTextSel]}>{PRICE_LABELS[p]}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput style={[e.input, e.inputMulti]} placeholder="Notes — what made it memorable?" placeholderTextColor="#c7c7cc" value={notes} onChangeText={setNotes} multiline numberOfLines={4} />

          {/* Photos */}
          <Text style={e.label}>Photos</Text>
          <View style={e.photoGrid}>
            {photos.map((uri, idx) => (
              <View key={idx} style={e.photoThumbWrap}>
                <Image source={{ uri }} style={e.photoThumb} resizeMode="cover" />
                <Pressable
                  style={e.photoRemove}
                  onPress={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                  hitSlop={4}
                >
                  <Ionicons name="close-circle" size={20} color="#fff" />
                </Pressable>
              </View>
            ))}
            <Pressable style={e.photoAdd} onPress={pickAndUploadPhoto} disabled={uploading}>
              {uploading
                ? <Text style={e.photoAddText}>Uploading…</Text>
                : <><Ionicons name="camera-outline" size={22} color="#8e8e93" /><Text style={e.photoAddText}>Add</Text></>
              }
            </Pressable>
          </View>

          <View style={{ height: 24 }} />
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

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'baseline', gap: 2,
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 10,
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
  label: { fontSize: 13, fontWeight: '600', color: T.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: T.inputBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: T.primary, marginBottom: 12 },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  chipScroll: { marginBottom: 16, marginHorizontal: -20 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.inputBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipSel: { backgroundColor: T.accentTint, borderColor: T.accent },
  chipEmoji: { fontSize: 15 },
  chipLabel: { fontSize: 14, fontWeight: '500', color: T.primary },
  chipLabelSel: { color: T.accent, fontWeight: '700' },
  priceRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  priceBtn: { flex: 1, backgroundColor: T.inputBg, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  priceBtnSel: { backgroundColor: T.accentTint, borderColor: T.accent },
  priceBtnText: { fontSize: 16, fontWeight: '600', color: T.primary },
  priceBtnTextSel: { color: T.accent },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 80, height: 80, borderRadius: 10 },
  photoRemove: { position: 'absolute', top: -6, right: -6 },
  photoAdd: {
    width: 80, height: 80, borderRadius: 10,
    backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1, borderColor: T.border, borderStyle: 'dashed',
  },
  photoAddText: { fontSize: 11, color: T.muted, fontWeight: '500' },
});
