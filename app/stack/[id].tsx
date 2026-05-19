import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Alert,
  ScrollView, TextInput, FlatList, Image,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getStackDetail, getAllStacks, updateStack, deleteStack,
  addVisitToStack, removeVisitFromStack, updateStackRankOrder,
  StackDetail, StackVisitRow,
} from '@/lib/stacks';
import {
  startComparison, advance, resolveRankOrder, resolveAtMid,
  currentComparison, ComparisonState,
} from '@/lib/ranking';
import { ratingColor, formatRating, friendlyDate, getAllVisits, Visit, ACTIVITY_TYPES } from '@/lib/visits';
import type { Stack as StackType } from '@/lib/stacks';
import { T } from '@/lib/theme';

// ─── Rank Stack Modal ────────────────────────────────────────────────────────

function RankStackModal({ stack, onClose, onDone }: {
  stack: StackType;
  onClose: () => void;
  onDone: () => void;
}) {
  const others = getAllStacks().filter(s => s.id !== stack.id);
  const [cmpState, setCmpState] = useState<ComparisonState<StackType> | null>(
    () => startComparison(others, () => true)
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

  function handleTooHard() {
    saveRank(resolveAtMid(cmpState!, others));
  }

  function saveRank(rank_order: number) {
    updateStackRankOrder(stack.id, rank_order);
    onDone();
  }

  const opponent = cmpState ? currentComparison(cmpState) : null;
  const oppColor = ratingColor(opponent?.rating ?? 0);

  const cardContent = others.length === 0 ? (
    <>
      <Text style={rm.title}>Nothing to compare</Text>
      <Text style={rm.subtitle}>Create more stacks to start ranking.</Text>
      <Pressable style={rm.secBtn} onPress={onClose}><Text style={rm.secBtnText}>Got it</Text></Pressable>
    </>
  ) : opponent ? (
    <>
      <Text style={rm.title}>Which was a better date night?</Text>
      <Text style={rm.subtitle}>Tap to rank</Text>
      <View style={rm.compareRow}>
        <Pressable style={[rm.card, rm.cardThis]} onPress={() => handleResult('better')}>
          <Text style={rm.cardName} numberOfLines={3}>{stack.name}</Text>
          <Text style={rm.cardLabel}>This one</Text>
        </Pressable>
        <View style={rm.vs}><Text style={rm.vsText}>vs</Text></View>
        <Pressable style={[rm.card, rm.cardThat]} onPress={() => handleResult('worse')}>
          {opponent.rating > 0 && (
            <View style={[rm.scorePill, { backgroundColor: oppColor + '2E' }]}>
              <Text style={[rm.scoreText, { color: oppColor }]}>{formatRating(opponent.rating)}</Text>
            </View>
          )}
          <Text style={rm.cardName} numberOfLines={3}>{opponent.name}</Text>
          <Text style={rm.cardLabel}>That one</Text>
        </Pressable>
      </View>
      <Pressable style={rm.tooHardBtn} onPress={handleTooHard}>
        <Text style={rm.tooHardText}>Too hard to compare</Text>
      </Pressable>
      <Pressable style={rm.secBtn} onPress={onClose}><Text style={rm.secBtnText}>Cancel</Text></Pressable>
    </>
  ) : (
    <>
      <Text style={rm.title}>Ranking complete!</Text>
      <Pressable style={rm.secBtn} onPress={onDone}><Text style={rm.secBtnText}>Done</Text></Pressable>
    </>
  );

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent>
      <Pressable style={rm.overlay} onPress={onClose}>
        <Pressable style={rm.floatingCard} onPress={() => {}}>
          {cardContent}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Edit Stack Modal ─────────────────────────────────────────────────────────

function EditStackModal({ stack, onClose, onSave }: {
  stack: StackDetail;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(stack.name);
  const [saving, setSaving] = useState(false);
  const [visits, setVisits] = useState<StackVisitRow[]>(stack.visits);

  function handleRemoveSpot(visitId: string) {
    if (visits.length <= 2) {
      Alert.alert(
        'Cannot Remove',
        'A stack needs at least 2 spots. Remove another spot first or delete the stack.'
      );
      return;
    }
    setVisits(prev => prev.filter(v => v.visit_id !== visitId));
  }

  function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give this stack a name.');
      return;
    }
    setSaving(true);
    updateStack(stack.id, name.trim());
    // Apply spot removals
    const removedIds = stack.visits
      .map(v => v.visit_id)
      .filter(id => !visits.find(v => v.visit_id === id));
    for (const visitId of removedIds) {
      removeVisitFromStack(stack.id, visitId);
    }
    setSaving(false);
    onSave();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={em.root} edges={['top', 'bottom']}>
        <View style={em.header}>
          <Pressable onPress={onClose} hitSlop={8}><Text style={em.cancel}>Cancel</Text></Pressable>
          <Text style={em.title}>Edit Stack</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={8}>
            <Text style={em.save}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
        <ScrollView style={em.form} keyboardShouldPersistTaps="handled">
          <Text style={em.label}>Stack name</Text>
          <TextInput
            style={em.input}
            value={name}
            onChangeText={setName}
            placeholder="Name this date night"
            placeholderTextColor={T.placeholder}
            autoFocus
          />
          <Text style={em.label}>Spots ({visits.length})</Text>
          {visits.map((v, idx) => {
            const color = ratingColor(v.rating);
            return (
              <View key={v.visit_id} style={em.spotRow}>
                <View style={[em.spotAccent, { backgroundColor: color }]} />
                <Text style={em.spotName} numberOfLines={1}>{v.venue_name}</Text>
                <Pressable
                  onPress={() => handleRemoveSpot(v.visit_id)}
                  hitSlop={8}
                  style={em.removeBtn}
                  accessibilityLabel={`Remove ${v.venue_name}`}
                >
                  <Ionicons name="close-circle" size={20} color={T.muted} />
                </Pressable>
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Spot Mini Card ───────────────────────────────────────────────────────────

function SpotMiniCard({ visit, index }: { visit: StackVisitRow; index: number }) {
  const color = ratingColor(visit.rating);
  const dateStr = friendlyDate(visit.visited_at);

  return (
    <Pressable
      style={({ pressed }) => [s.spotCard, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/spot/${visit.visit_id}`)}
    >
      <View style={[s.accentBar, { backgroundColor: color }]} />
      <Text style={s.spotIndex}>{index + 1}</Text>
      <View style={s.spotInfo}>
        <Text style={s.spotName} numberOfLines={1}>{visit.venue_name}</Text>
        <Text style={s.spotMeta}>{ACTIVITY_TYPES.find(a => a.value === visit.activity_type)?.label ?? visit.activity_type} · {dateStr}</Text>
      </View>
      {visit.rating > 0 && (
        <View style={[s.scorePill, { borderColor: color }]}>
          <Text style={[s.scorePillText, { color }]}>{formatRating(visit.rating)}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<StackDetail | null>(null);
  const [ranking, setRanking] = useState(false);
  const [editing, setEditing] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    setDetail(getStackDetail(id));
  }, [id]));

  if (!detail) return null;

  const avgRating = detail.visits.length > 0
    ? detail.visits.reduce((sum, v) => sum + v.rating, 0) / detail.visits.length
    : 0;
  const qualityColor = ratingColor(avgRating);
  const dateStr = friendlyDate(detail.created_at);
  const allPhotos = detail.visits.flatMap(v => v.photos).filter(Boolean);

  function handleDelete() {
    Alert.alert(
      'Delete Stack',
      `Delete "${detail!.name}"? The individual spots will remain in your log.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: () => {
            deleteStack(id);
            router.back();
          },
        },
      ]
    );
  }

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={s.headerSafe} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.headerBtn}>
            <Ionicons name="chevron-back" size={26} color={T.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setEditing(true)} hitSlop={12} style={s.headerBtn}>
            <Ionicons name="pencil-outline" size={20} color={T.primary} />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={12} style={s.headerBtn}>
            <Ionicons name="trash-outline" size={20} color={T.danger} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroName}>{detail.name}</Text>
          <View style={s.heroMeta}>
            <View style={s.spotCountBadge}>
              <Text style={s.spotCountText}>{detail.visits.length} spot{detail.visits.length !== 1 ? 's' : ''}</Text>
            </View>
            {avgRating > 0 && (
              <View style={[s.qualityDot, { borderColor: qualityColor }]}>
                <Text style={[s.qualityLabel, { color: qualityColor }]}>{formatRating(avgRating)} avg</Text>
              </View>
            )}
          </View>

          {detail.visits.length >= 2 && (
            <Text style={s.journeyLine} numberOfLines={1}>
              {detail.visits[0].venue_name} → {detail.visits[detail.visits.length - 1].venue_name}
            </Text>
          )}

        </View>

        {/* Spots */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>SPOTS</Text>
          {detail.visits.map((v, idx) => (
            <SpotMiniCard key={v.visit_id} visit={v} index={idx} />
          ))}
        </View>

        {/* Photos */}
        {allPhotos.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>PHOTOS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.photoStrip}
              contentContainerStyle={s.photoStripContent}
            >
              {allPhotos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={s.photoThumb} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>

      {ranking && (
        <RankStackModal
          stack={detail}
          onClose={() => setRanking(false)}
          onDone={() => {
            setRanking(false);
            setDetail(getStackDetail(id));
          }}
        />
      )}

      {editing && (
        <EditStackModal
          stack={detail}
          onClose={() => setEditing(false)}
          onSave={() => {
            setEditing(false);
            const refreshed = getStackDetail(id);
            if (refreshed) {
              setDetail(refreshed);
            } else {
              router.back();
            }
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  headerSafe: { backgroundColor: T.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 2 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '800',
    color: T.primary,
    fontFamily: 'InstrumentSerif-Regular',
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroDate: { fontSize: 14, color: T.muted, fontWeight: '500', marginBottom: 12 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' },

  spotCountBadge: {
    backgroundColor: T.inputBg,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  spotCountText: { fontSize: 13, fontWeight: '600', color: T.muted },

  qualityDot: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  qualityLabel: { fontSize: 13, fontWeight: '700' },

  journeyLine: {
    fontSize: 13,
    color: T.muted,
    fontStyle: 'italic',
  },

  photoStrip: {
    marginHorizontal: -20,
  },
  photoStripContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  photoThumb: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: T.inputBg,
  },

  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  spotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 10,
    minHeight: 36,
  },
  spotIndex: { fontSize: 13, fontWeight: '500', color: T.muted, width: 20, textAlign: 'center', marginRight: 10 },
  spotInfo: { flex: 1, marginRight: 10 },
  spotName: { fontSize: 15, fontWeight: '600', color: T.primary, marginBottom: 2 },
  spotMeta: { fontSize: 12, color: T.muted, textTransform: 'capitalize' },
  scorePill: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: 'transparent', minWidth: 44, alignItems: 'center',
  },
  scorePillText: { fontSize: 12, fontWeight: '800' },

  rankBtn: {
    backgroundColor: T.accent,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rankBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

const rm = StyleSheet.create({
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
  secBtn: { borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  secBtnText: { fontSize: 14, fontWeight: '500', color: T.muted },
});

const em = StyleSheet.create({
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
  label: { fontSize: 12, fontWeight: '600', color: T.muted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: T.inputBg, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: T.primary, marginBottom: 20,
  },
  spotRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
    gap: 10,
    minHeight: 44,
  },
  spotAccent: { width: 4, height: 36, borderRadius: 2 },
  spotName: { flex: 1, fontSize: 14, fontWeight: '600', color: T.primary },
  removeBtn: { padding: 4 },
});
