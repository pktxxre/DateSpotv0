import { useCallback, useState, useMemo } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable, FlatList,
  Modal, TextInput,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getAllVisits, Visit, ACTIVITY_TYPES, PRICE_LABELS, Price,
  formatRating, ratingColor, friendlyDate,
} from '@/lib/visits';
import {
  getAllStacks, createStack, deleteStack, StackSummary,
} from '@/lib/stacks';
import { useSelectionMode } from '@/lib/useSelectionMode';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { T } from '@/lib/theme';

type TabOption = 'spots' | 'date-nights';
type SortOption = 'best' | 'recent';
type CategoryFilter = string | null;

function sortVisits(visits: Visit[], sort: SortOption): Visit[] {
  const copy = [...visits];
  if (sort === 'best') return copy.sort((a, b) => b.rating - a.rating);
  return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function autoStackName(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' Date';
}

// ─── Name Stack Modal ─────────────────────────────────────────────────────────

function NameStackModal({ visitIds, onConfirm, onCancel }: {
  visitIds: string[];
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(autoStackName());

  return (
    <Modal visible animationType="slide" presentationStyle="formSheet" transparent>
      <Pressable style={ns.backdrop} onPress={onCancel}>
        <Pressable style={ns.sheet} onPress={() => {}}>
          <View style={ns.handle} />
          <Text style={ns.title}>Name this stack</Text>
          <Text style={ns.subtitle}>{visitIds.length} spots selected</Text>
          <TextInput
            style={ns.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Saturday Night Out"
            placeholderTextColor={T.placeholder}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => name.trim() && onConfirm(name.trim())}
          />
          <Pressable
            style={[ns.confirmBtn, !name.trim() && ns.confirmBtnDisabled]}
            onPress={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
          >
            <Text style={[ns.confirmBtnText, !name.trim() && ns.confirmBtnTextDisabled]}>
              Create Stack
            </Text>
          </Pressable>
          <Pressable style={ns.cancelBtn} onPress={onCancel}>
            <Text style={ns.cancelBtnText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Stack Card ───────────────────────────────────────────────────────────────

function StackCard({ stack }: { stack: StackSummary }) {
  return (
    <Pressable
      style={({ pressed }) => [sc.card, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/stack/${stack.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${stack.name}, ${stack.spot_count} spots`}
    >
      <View style={sc.cardTop}>
        <Text style={sc.cardName} numberOfLines={1}>{stack.name}</Text>
        <View style={sc.spotBadge}>
          <Text style={sc.spotBadgeText}>{stack.spot_count}</Text>
        </View>
      </View>

      {stack.first_spot && stack.last_spot && stack.first_spot !== stack.last_spot && (
        <Text style={sc.journey} numberOfLines={1}>
          {stack.first_spot} → {stack.last_spot}
        </Text>
      )}
    </Pressable>
  );
}

// ─── Spot Row with selection support ─────────────────────────────────────────

function SpotRow({ visit, selectionMode, isSelected, onSelect, onLongPress }: {
  visit: Visit;
  selectionMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onLongPress: () => void;
}) {
  const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
  const priceLabel = PRICE_LABELS[visit.price as Price];
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);
  const color = ratingColor(visit.rating);

  const metaParts = [
    info?.label,
    visit.price === 0 ? 'Free' : priceLabel,
    dateStr,
  ].filter(Boolean);

  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && { opacity: 0.75 }]}
      onPress={selectionMode ? onSelect : () => router.push(`/spot/${visit.id}`)}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityLabel={`${isSelected ? 'Selected' : 'Not selected'}, ${visit.venue_name}`}
    >
      <View style={[s.rowLeftBar, { backgroundColor: color }]} />
      {selectionMode && (
        <View style={[s.checkbox, isSelected && s.checkboxChecked]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      )}
      <View style={s.rowMain}>
        <View style={s.rowTop}>
          <Text style={s.rowName} numberOfLines={1}>{visit.venue_name}</Text>
          {visit.rating > 0 && (
            <View style={[s.scorePill, { borderColor: color }]}>
              <Text style={[s.scorePillText, { color }]}>{formatRating(visit.rating)}</Text>
            </View>
          )}
        </View>
        <Text style={s.rowMeta} numberOfLines={1}>{metaParts.join(' · ')}</Text>
        {visit.notes ? (
          <Text style={s.note} numberOfLines={1}>"{visit.notes.trim().slice(0, 70)}"</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RankedScreen() {
  const [activeTab, setActiveTab] = useState<TabOption>('spots');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [stacks, setStacks] = useState<StackSummary[]>([]);
  const [sort, setSort] = useState<SortOption>('best');
  const [category, setCategory] = useState<CategoryFilter>(null);
  const [search, setSearch] = useState('');
  const [naming, setNaming] = useState(false);

  const { selectionMode, selectedIds, enter, exit, toggle, canStack } = useSelectionMode();

  useFocusEffect(
    useCallback(() => {
      setVisits(getAllVisits().filter(v => !(v as any).is_seed));
      setStacks(getAllStacks());
    }, [])
  );

  // Also refresh stacks when tab changes
  function handleTabChange(tab: TabOption) {
    setActiveTab(tab);
    if (tab === 'date-nights') setStacks(getAllStacks());
    if (tab === 'spots') exit();
  }

  const categoryCounts: Record<string, number> = {};
  for (const v of visits) {
    categoryCounts[v.activity_type] = (categoryCounts[v.activity_type] ?? 0) + 1;
  }

  const filtered = useMemo(() => {
    let list = category ? visits.filter(v => v.activity_type === category) : visits;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(v =>
        v.venue_name.toLowerCase().includes(q) ||
        (v.notes ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [visits, category, search]);
  const sorted = sortVisits(filtered, sort);

  function handleStackConfirm(name: string) {
    const visitIds = Array.from(selectedIds);
    createStack(name, visitIds);
    setNaming(false);
    exit();
    setStacks(getAllStacks());
    setActiveTab('date-nights');
  }

  function handleNewStackFromDateNights() {
    setActiveTab('spots');
    enter();
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.statLabel}>
            {activeTab === 'spots'
              ? `${visits.length} SPOTS LOGGED`
              : `${stacks.length} DATE NIGHTS`}
          </Text>
          <Text style={s.statNum}>Your list</Text>
        </View>
        <ProfileAvatar onPress={() => router.push('/(tabs)/profile')} />
      </View>

      {/* Tab toggle */}
      <View style={s.tabRow}>
        <Pressable
          style={[s.tabPill, activeTab === 'spots' && s.tabPillActive]}
          onPress={() => handleTabChange('spots')}
        >
          <Text style={[s.tabPillText, activeTab === 'spots' && s.tabPillTextActive]}>Spots</Text>
        </Pressable>
        <Pressable
          style={[s.tabPill, activeTab === 'date-nights' && s.tabPillActive]}
          onPress={() => handleTabChange('date-nights')}
        >
          <Text style={[s.tabPillText, activeTab === 'date-nights' && s.tabPillTextActive]}>Date Nights</Text>
        </Pressable>
      </View>

      {/* ── Spots Tab ── */}
      {activeTab === 'spots' && (
        <View style={{ flex: 1 }}>
          {/* Search + filter always visible at top */}
          {!selectionMode && (
            <>
              <View style={s.searchBar}>
                <Ionicons name="search-outline" size={16} color={T.placeholder} style={{ marginRight: 8 }} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search your spots and notes"
                  placeholderTextColor={T.placeholder}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.chipScroll}
                contentContainerStyle={s.chipRow}
              >
                <Pressable
                  style={[s.chip, category === null && s.chipActive]}
                  onPress={() => setCategory(null)}
                >
                  <Text style={[s.chipText, category === null && s.chipTextActive]}>
                    All {visits.length}
                  </Text>
                </Pressable>
                {ACTIVITY_TYPES.map(a => {
                  const count = categoryCounts[a.value] ?? 0;
                  if (count === 0) return null;
                  const active = category === a.value;
                  return (
                    <Pressable
                      key={a.value}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => setCategory(active ? null : a.value)}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>
                        {a.label} {count}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          {selectionMode && (
            <View style={s.selectionHeader}>
              <Text style={s.selectionHint}>
                {selectedIds.size === 0
                  ? 'Tap spots to select'
                  : `${selectedIds.size} selected`}
              </Text>
              <Pressable onPress={exit} hitSlop={8}>
                <Text style={s.cancelSelection}>Cancel</Text>
              </Pressable>
            </View>
          )}

          {visits.length === 0 && !selectionMode ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No dates logged yet</Text>
              <View style={s.emptyHintRow}>
                <Text style={s.emptyHint}>Tap </Text>
                <View style={s.plusCircle}><Text style={s.plusCircleText}>+</Text></View>
                <Text style={s.emptyHint}> below to log your first date spot</Text>
              </View>
            </View>
          ) : (
            <>
              {!selectionMode && (
                <View style={s.sortRow}>
                  <Text style={s.countLabel}>{sorted.length} spot{sorted.length !== 1 ? 's' : ''}</Text>
                  <Pressable
                    style={s.sortToggle}
                    onPress={() => setSort(sort === 'best' ? 'recent' : 'best')}
                  >
                    <Text style={s.sortToggleText}>
                      Sort: {sort === 'best' ? 'Best' : 'Recent'} ↓
                    </Text>
                  </Pressable>
                </View>
              )}

              {sorted.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyTitle}>No {ACTIVITY_TYPES.find(a => a.value === category)?.label} spots yet</Text>
                  <Pressable onPress={() => setCategory(null)}>
                    <Text style={s.clearFilter}>Clear filter</Text>
                  </Pressable>
                </View>
              ) : (
                <FlatList
                  data={selectionMode ? visits : sorted}
                  keyExtractor={v => v.id}
                  renderItem={({ item }) => (
                    <SpotRow
                      visit={item}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(item.id)}
                      onSelect={() => toggle(item.id)}
                      onLongPress={() => { if (!selectionMode) { enter(); toggle(item.id); } }}
                    />
                  )}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={s.listContent}
                />
              )}
            </>
          )}

          {/* Floating stack action bar */}
          {selectionMode && (
            <View style={s.floatingBar}>
              <Pressable
                style={[s.stackBtn, !canStack && s.stackBtnDisabled]}
                onPress={() => canStack && setNaming(true)}
                disabled={!canStack}
                accessibilityRole="button"
                accessibilityLabel={`Stack these, ${selectedIds.size} selected`}
              >
                <Ionicons
                  name="layers-outline"
                  size={18}
                  color={canStack ? '#fff' : T.muted}
                />
                <Text style={[s.stackBtnText, !canStack && s.stackBtnTextDisabled]}>
                  Stack these ({selectedIds.size})
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* ── Date Nights Tab ── */}
      {activeTab === 'date-nights' && (
        <View style={{ flex: 1 }}>
          {/* New Stack button */}
          <View style={s.dateNightsToolbar}>
            <Text style={s.dnCount}>{stacks.length} stack{stacks.length !== 1 ? 's' : ''}</Text>
            <Pressable style={s.newStackBtn} onPress={handleNewStackFromDateNights}>
              <Ionicons name="add" size={16} color={T.accent} />
              <Text style={s.newStackBtnText}>New Stack</Text>
            </Pressable>
          </View>

          {stacks.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyInvite}>
                <Ionicons name="layers-outline" size={36} color={T.muted} style={{ marginBottom: 12 }} />
                <Text style={s.emptyTitle}>No stacks yet</Text>
                <Text style={s.emptySubtitle}>
                  Group spots from the same date night into a single story.
                </Text>
                <Pressable style={s.tryItBtn} onPress={handleNewStackFromDateNights}>
                  <Text style={s.tryItBtnText}>Try it</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <FlatList
              data={stacks}
              keyExtractor={s => s.id}
              renderItem={({ item }) => (
                <StackCard stack={item} />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.listContent}
            />
          )}
        </View>
      )}

      {naming && (
        <NameStackModal
          visitIds={Array.from(selectedIds)}
          onConfirm={handleStackConfirm}
          onCancel={() => setNaming(false)}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: T.bg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  statNum: {
    fontSize: 32,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'InstrumentSerif-Regular',
    lineHeight: 36,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: T.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: T.primary,
  },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: T.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  tabPill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: T.inputBg,
    borderWidth: 1,
    borderColor: T.border,
  },
  tabPillActive: { backgroundColor: T.primary, borderColor: T.primary },
  tabPillText: { fontSize: 14, fontWeight: '600', color: T.muted },
  tabPillTextActive: { color: '#fff' },

  chipScroll: { flexShrink: 0, flexGrow: 0 },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    alignSelf: 'center',
  },
  chipActive: { backgroundColor: T.primary, borderColor: T.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: T.muted },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  countLabel: { fontSize: 13, color: T.muted },
  sortToggle: { paddingVertical: 4, paddingHorizontal: 2 },
  sortToggleText: { fontSize: 13, fontWeight: '600', color: T.primary },

  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: T.accentTint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  selectionHint: { fontSize: 14, fontWeight: '600', color: T.accent },
  cancelSelection: { fontSize: 14, fontWeight: '500', color: T.muted },

  listContent: { paddingBottom: 120 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  rowLeftBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: T.border,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.bg,
  },
  checkboxChecked: { backgroundColor: T.accent, borderColor: T.accent },
  rowMain: { flex: 1 },
  rowTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 3,
  },
  rowName: {
    fontSize: 15, fontWeight: '600', color: T.primary,
    fontFamily: 'InstrumentSerif-Regular', flex: 1, marginRight: 10,
  },
  scorePill: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: 'transparent', minWidth: 42, alignItems: 'center',
  },
  scorePillText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  rowMeta: { fontSize: 12, color: T.muted, marginBottom: 3 },
  note: { fontSize: 12, color: '#A0927E', fontStyle: 'italic', lineHeight: 17 },

  floatingBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  stackBtn: {
    backgroundColor: T.accent,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  stackBtnDisabled: { backgroundColor: T.inputBg, shadowOpacity: 0 },
  stackBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  stackBtnTextDisabled: { color: T.muted },

  // Date Nights tab
  dateNightsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  dnCount: { fontSize: 13, color: T.muted },
  newStackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.accent,
    backgroundColor: T.accentTint,
  },
  newStackBtnText: { fontSize: 13, fontWeight: '600', color: T.accent },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyInvite: { alignItems: 'center' },
  emptyTitle: {
    fontSize: 16, fontWeight: '700', color: T.primary,
    fontFamily: 'InstrumentSerif-Regular', textAlign: 'center',
  },
  emptySubtitle: { fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  tryItBtn: {
    marginTop: 16,
    backgroundColor: T.accent,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  tryItBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  clearFilter: { fontSize: 14, color: T.accent, fontWeight: '600' },
  emptyHintRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  emptyHint: { fontSize: 15, color: T.muted },
  plusCircle: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#E76F51',
    borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  plusCircleText: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 14, includeFontPadding: false },
});

const sc = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: T.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardName: { fontSize: 16, fontWeight: '700', color: T.primary, fontFamily: 'InstrumentSerif-Regular', flex: 1, marginRight: 10 },
  spotBadge: { backgroundColor: T.inputBg, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  spotBadgeText: { fontSize: 12, fontWeight: '700', color: T.muted },
  journey: { fontSize: 13, color: T.muted, fontStyle: 'italic' },
});

const ns = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: T.border, alignSelf: 'center', marginBottom: 20,
  },
  title: {
    fontSize: 20, fontWeight: '700', color: T.primary,
    fontFamily: 'InstrumentSerif-Regular', marginBottom: 4, textAlign: 'center',
  },
  subtitle: { fontSize: 13, color: T.muted, textAlign: 'center', marginBottom: 20 },
  input: {
    backgroundColor: T.inputBg, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 18, fontWeight: '600', color: T.primary,
    marginBottom: 16, textAlign: 'center',
  },
  confirmBtn: {
    backgroundColor: T.accent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 10,
  },
  confirmBtnDisabled: { backgroundColor: T.inputBg },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  confirmBtnTextDisabled: { color: T.muted },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { fontSize: 15, color: T.muted, fontWeight: '500' },
});
