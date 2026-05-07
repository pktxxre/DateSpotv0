import { useCallback, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable, Image,
  Share, Alert,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAllVisits, Visit, ACTIVITY_TYPES, friendlyDate } from '@/lib/visits';
import { getProfile, UserProfile } from '@/lib/profile';
import { T } from '@/lib/theme';

type ActivityItem = {
  id: string;
  type: 'log' | 'saved' | 'friend';
  label: string;
  sublabel: string;
  date: string;
  emoji: string;
};

function buildActivity(visits: Visit[]): ActivityItem[] {
  return visits
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3)
    .map(v => {
      const info = ACTIVITY_TYPES.find(a => a.value === v.activity_type);
      return {
        id: v.id,
        type: 'log' as const,
        label: `Logged ${v.venue_name}`,
        sublabel: info?.label ?? 'Spot',
        date: v.visited_at,
        emoji: info?.emoji ?? '📍',
      };
    });
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);

  useFocusEffect(
    useCallback(() => {
      getProfile().then(setProfile);
      setVisits(getAllVisits());
    }, [])
  );

  const activity = buildActivity(visits);

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out my DateSpot profile — ${profile?.username ?? 'Me'}` });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable
          style={styles.gearBtn}
          onPress={() => router.push('/settings')}
          hitSlop={12}
        >
          <Ionicons name="settings-outline" size={22} color={T.primary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar + username */}
        <View style={styles.heroSection}>
          <View style={styles.avatarWrap}>
            {profile?.profilePhotoUri ? (
              <Image source={{ uri: profile.profilePhotoUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={46} color="#B0A090" />
              </View>
            )}
          </View>
          <Text style={styles.username}>{profile?.username ?? 'You'}</Text>
          {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox value={visits.length} label="Logs" />
          <View style={styles.statDivider} />
          <StatBox value={0} label="Friends" />
          <View style={styles.statDivider} />
          <StatBox value={0} label="Following" />
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.actionBtnPrimary, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/edit-profile')}
          >
            <Ionicons name="pencil-outline" size={15} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnPrimaryText}>Edit Profile</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.actionBtnSecondary, pressed && { opacity: 0.8 }]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={15} color={T.primary} style={{ marginRight: 6 }} />
            <Text style={styles.actionBtnSecondaryText}>Share Profile</Text>
          </Pressable>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {activity.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyEmoji}>🗺</Text>
              <Text style={styles.emptyText}>No activity yet. Start logging spots!</Text>
            </View>
          ) : (
            activity.map(item => <ActivityRow key={item.id} item={item} />)
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <View style={styles.activityRow}>
      <Text style={styles.activityEmoji}>{item.emoji}</Text>
      <View style={styles.activityInfo}>
        <Text style={styles.activityLabel}>{item.label}</Text>
        <Text style={styles.activitySub}>{item.sublabel} · {friendlyDate(item.date)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 20, fontWeight: '700', color: T.primary,
    fontFamily: 'Georgia', letterSpacing: -0.2,
  },
  gearBtn: {
    position: 'absolute', right: 20,
  },

  heroSection: { alignItems: 'center', paddingTop: 20, paddingBottom: 12 },
  avatarWrap: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
    marginBottom: 14,
  },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    backgroundColor: T.placeholder,
    alignItems: 'center', justifyContent: 'center',
  },
  username: {
    fontSize: 22, fontWeight: '700', color: T.primary,
    fontFamily: 'Georgia', letterSpacing: -0.3, marginBottom: 6,
  },
  bio: {
    fontSize: 14, color: T.muted, textAlign: 'center',
    paddingHorizontal: 32, lineHeight: 20,
  },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.card, marginHorizontal: 20, borderRadius: 16,
    paddingVertical: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: T.primary, marginBottom: 2 },
  statLabel: { fontSize: 12, fontWeight: '600', color: T.muted, letterSpacing: 0.4 },
  statDivider: { width: 1, height: 32, backgroundColor: T.border },

  actionRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 28,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: 14,
  },
  actionBtnPrimary: { backgroundColor: T.accent },
  actionBtnSecondary: { backgroundColor: T.card, borderWidth: 1, borderColor: T.border },
  actionBtnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  actionBtnSecondaryText: { color: T.primary, fontSize: 15, fontWeight: '600' },

  activitySection: { paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 18, fontWeight: '700', color: T.primary,
    fontFamily: 'Georgia', marginBottom: 14,
  },

  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  activityEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: 14, fontWeight: '600', color: T.primary, marginBottom: 2 },
  activitySub: { fontSize: 12, color: T.muted },

  emptyActivity: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 14, color: T.muted, textAlign: 'center' },
});
