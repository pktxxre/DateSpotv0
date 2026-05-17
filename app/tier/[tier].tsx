import { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Image } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getAllStacks, stackTier, TIER_CONFIG, TierKey, StackSummary,
} from '@/lib/stacks';
import { friendlyDate } from '@/lib/visits';
import { T } from '@/lib/theme';
import { useState } from 'react';

export default function TierScreen() {
  const { tier } = useLocalSearchParams<{ tier: string }>();
  const [stacks, setStacks] = useState<StackSummary[]>([]);

  const tierKey = (tier as TierKey) ?? 'S';
  const cfg = TIER_CONFIG[tierKey] ?? TIER_CONFIG['S'];

  useFocusEffect(
    useCallback(() => {
      const all = getAllStacks();
      setStacks(all.filter(s => stackTier(s) === tierKey));
    }, [tierKey])
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={T.primary} />
          </Pressable>
          <View style={[s.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[s.badgeText, { color: cfg.text }]}>{tierKey}</Text>
          </View>
          <View style={s.headerText}>
            <Text style={s.title}>{tierKey} Tier</Text>
            <Text style={s.subtitle}>{stacks.length} stack{stacks.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>

        {stacks.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="layers-outline" size={36} color={T.muted} style={{ marginBottom: 12 }} />
            <Text style={s.emptyTitle}>No stacks in {tierKey} tier yet</Text>
            <Text style={s.emptySub}>Create stacks and rank them to fill this tier.</Text>
          </View>
        ) : (
          <FlatList
            data={stacks}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.list}
            renderItem={({ item }) => <StackRow stack={item} tierColor={cfg.bg} />}
          />
        )}
      </SafeAreaView>
    </>
  );
}

function StackRow({ stack, tierColor }: { stack: StackSummary; tierColor: string }) {
  return (
    <Pressable
      style={({ pressed }) => [sr.row, pressed && { opacity: 0.75 }]}
      onPress={() => router.push(`/stack/${stack.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={stack.name}
    >
      {stack.cover_photo ? (
        <Image source={{ uri: stack.cover_photo }} style={sr.thumb} resizeMode="cover" />
      ) : (
        <View style={[sr.thumbPlaceholder, { backgroundColor: tierColor + '22' }]}>
          <Ionicons name="images-outline" size={20} color={tierColor} />
        </View>
      )}
      <View style={sr.main}>
        <View style={sr.topRow}>
          <Text style={sr.name} numberOfLines={1}>{stack.name}</Text>
          <Ionicons name="chevron-forward" size={14} color={T.muted} />
        </View>
        {stack.first_spot && stack.last_spot && stack.first_spot !== stack.last_spot && (
          <Text style={sr.journey} numberOfLines={1}>
            {stack.first_spot} → {stack.last_spot}
          </Text>
        )}
        <Text style={sr.date}>{friendlyDate(stack.created_at)}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'InstrumentSerif-Regular',
  },
  subtitle: { fontSize: 13, color: T.muted, marginTop: 1 },
  list: { paddingTop: 8, paddingBottom: 100 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'InstrumentSerif-Regular',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySub: { fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 20 },
});

const sr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    gap: 14,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: T.inputBg,
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'InstrumentSerif-Regular',
    flex: 1,
    marginRight: 8,
  },
  journey: { fontSize: 12, color: T.muted, fontStyle: 'italic', marginBottom: 3 },
  date: { fontSize: 11, color: T.placeholder },
});
