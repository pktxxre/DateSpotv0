import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Alert, ScrollView, Share,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getFutureSpotById, deleteFutureSpot, updateFutureSpot, FutureSpot,
} from '@/lib/future';
import { T } from '@/lib/theme';

const H_PAD = 20;

export default function FutureSpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<FutureSpot | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);

  useFocusEffect(useCallback(() => {
    if (id) setSpot(getFutureSpotById(id));
  }, [id]));

  if (!spot) return null;

  const dateStr = (() => {
    const raw = spot.created_at;
    if (!raw || !/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
    const [year, month, day] = raw.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((todayStart.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  })();

  async function handleShare() {
    try {
      await Share.share({ message: `Saving ${spot!.venue_name} to check out on DateSpot.` });
    } catch {}
  }

  function handleEdit() {
    Alert.prompt(
      'Rename',
      'Update the name of this spot',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (text) => {
            const name = text?.trim();
            if (!name) return;
            updateFutureSpot(spot!.id, name);
            setSpot(s => s ? { ...s, venue_name: name } : s);
          },
        },
      ],
      'plain-text',
      spot.venue_name,
    );
  }

  function handleDelete() {
    Alert.alert('Remove Spot', `Remove "${spot!.venue_name}" from your want-to-go list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: () => {
          deleteFutureSpot(id);
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
          <Pressable onPress={handleEdit} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="pencil-outline" size={20} color={T.primary} />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="trash-outline" size={20} color={T.danger} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.venueName}>{spot.venue_name}</Text>
          <Text style={styles.dateStr}>Added {dateStr}</Text>

          <View style={styles.tags}>
            <View style={styles.tag}>
              <Ionicons name="bookmark" size={13} color="#5856d6" style={{ marginRight: 4 }} />
              <Text style={[styles.tagText, { color: '#5856d6' }]}>Want to go</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {spot.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{spot.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* Map */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Location</Text>
          <Pressable style={styles.mapCard} onPress={() => setMapExpanded(true)}>
            <MapView
              style={StyleSheet.absoluteFill}
              region={{ latitude: spot.lat, longitude: spot.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 }}
              scrollEnabled={false} zoomEnabled={false} rotateEnabled={false}
              pitchEnabled={false} showsUserLocation={false} showsPointsOfInterest={false}
              showsCompass={false} showsScale={false} mapType="standard" pointerEvents="none"
            >
              <Marker coordinate={{ latitude: spot.lat, longitude: spot.lng }}>
                <View style={styles.pin}>
                  <Ionicons name="bookmark" size={14} color="#fff" />
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
            initialRegion={{ latitude: spot.lat, longitude: spot.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
            showsUserLocation={false} showsPointsOfInterest={false} mapType="standard"
          >
            <Marker coordinate={{ latitude: spot.lat, longitude: spot.lng }}>
              <View style={styles.pin}>
                <Ionicons name="bookmark" size={14} color="#fff" />
              </View>
            </Marker>
          </MapView>
          <SafeAreaView style={styles.modalOverlay} edges={['top']} pointerEvents="box-none">
            <View style={styles.modalHeader} pointerEvents="auto">
              <Pressable onPress={() => setMapExpanded(false)} hitSlop={16} style={styles.modalBackBtn}>
                <Ionicons name="chevron-back" size={22} color="#1c1c1e" />
              </Pressable>
              <View style={styles.modalPill}>
                <Text style={styles.modalPillText} numberOfLines={1}>{spot.venue_name}</Text>
              </View>
              <View style={{ width: 44 }} />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
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

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EEEEFF', borderWidth: 1, borderColor: '#5856d6',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  tagText: { fontSize: 13, fontWeight: '600' },

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

  mapCard: { height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#e8e8ed' },
  mapHint: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  mapHintText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  pin: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#5856d6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3,
  },

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
