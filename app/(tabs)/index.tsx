import { useCallback, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, FlatList } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllVisits, Visit, ACTIVITY_TYPES, Price, PRICE_LABELS, ratingColor, formatRating } from '@/lib/visits';

export default function HomeScreen() {
  const [visits, setVisits] = useState<Visit[]>([]);

  useFocusEffect(
    useCallback(() => { setVisits(getAllVisits()); }, [])
  );

  const topPicks = visits.filter((v) => v.rating >= 7).slice(0, 10);
  const tryAgain = visits.filter((v) => v.rating >= 4 && v.rating < 7).slice(0, 10);
  const ranked = [...visits].sort((a, b) => b.rank_order - a.rank_order);

  if (visits.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>DateSpot</Text>
          <Text style={styles.headerSub}>Your date spot guide</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🗺</Text>
          <Text style={styles.emptyTitle}>No spots yet</Text>
          <Text style={styles.emptyBody}>Log your first date spot and it'll show up here.</Text>
          <Pressable style={styles.logCta} onPress={() => router.push('/(tabs)/log')}>
            <Text style={styles.logCtaText}>Log a spot</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>DateSpot</Text>
          <Text style={styles.headerSub}>Your date spot guide</Text>
        </View>

        {topPicks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your picks</Text>
            <Text style={styles.sectionSub}>Spots you've rated highest</Text>
            <FlatList
              data={topPicks}
              keyExtractor={(v) => v.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }}
              renderItem={({ item }) => <SpotCard visit={item} />}
              scrollEnabled
            />
          </View>
        )}

        {tryAgain.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Try again</Text>
            <Text style={styles.sectionSub}>Good spots worth a second date</Text>
            <FlatList
              data={tryAgain}
              keyExtractor={(v) => v.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }}
              renderItem={({ item }) => <SpotCard visit={item} />}
              scrollEnabled
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All your spots</Text>
          <Text style={styles.sectionSub}>Ranked best to worst</Text>
          {ranked.map((v, i) => (
            <RankedRow key={v.id} visit={v} rank={i + 1} />
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SpotCard({ visit }: { visit: Visit }) {
  const info = ACTIVITY_TYPES.find((a) => a.value === visit.activity_type);
  return (
    <View style={styles.card}>
      <View style={[styles.cardScore, { backgroundColor: ratingColor(visit.rating) }]}>
        <Text style={styles.cardScoreText}>{formatRating(visit.rating)}</Text>
      </View>
      <Text style={styles.cardName} numberOfLines={2}>{visit.venue_name}</Text>
      <View style={styles.cardMeta}>
        <Text style={styles.cardMetaText}>{info?.emoji} {info?.label}</Text>
        <Text style={styles.cardMetaDot}>·</Text>
        <Text style={styles.cardMetaText}>{PRICE_LABELS[visit.price as Price]}</Text>
      </View>
    </View>
  );
}

function RankedRow({ visit, rank }: { visit: Visit; rank: number }) {
  const info = ACTIVITY_TYPES.find((a) => a.value === visit.activity_type);
  return (
    <View style={styles.rankedRow}>
      <Text style={styles.rankNumber}>{rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rankName} numberOfLines={1}>{visit.venue_name}</Text>
        <Text style={styles.rankMeta}>
          {info?.emoji} {info?.label} · {PRICE_LABELS[visit.price as Price]}
        </Text>
      </View>
      <View style={[styles.rankBadge, { backgroundColor: ratingColor(visit.rating) + '22' }]}>
        <Text style={[styles.rankBadgeText, { color: ratingColor(visit.rating) }]}>
          {formatRating(visit.rating)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1c1c1e', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: '#8e8e93', marginTop: 2 },
  section: { paddingHorizontal: 20, marginTop: 28 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1c1c1e', marginBottom: 2 },
  sectionSub: { fontSize: 13, color: '#8e8e93', marginBottom: 14 },
  card: { width: 160, backgroundColor: '#f9f9f9', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0' },
  cardScore: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 10 },
  cardScoreText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  cardName: { fontSize: 14, fontWeight: '700', color: '#1c1c1e', marginBottom: 8, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: { fontSize: 12, color: '#8e8e93' },
  cardMetaDot: { fontSize: 12, color: '#c7c7cc' },
  rankedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  rankNumber: { fontSize: 16, fontWeight: '700', color: '#c7c7cc', width: 24, textAlign: 'center' },
  rankName: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  rankMeta: { fontSize: 12, color: '#8e8e93', marginTop: 2 },
  rankBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  rankBadgeText: { fontSize: 12, fontWeight: '700' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1c1c1e', marginBottom: 8 },
  emptyBody: { fontSize: 15, color: '#8e8e93', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  logCta: { backgroundColor: '#ff3b5c', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  logCtaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
