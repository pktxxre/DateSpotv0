import { StyleSheet, View, Text, Pressable, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { T } from '@/lib/theme';

export default function FriendsScreen() {
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.statLabel, { opacity: 0 }]}> </Text>
          <Text style={s.title}>Friends</Text>
        </View>
        <View style={s.headerActions}>
          <Pressable style={s.iconBtn} hitSlop={8}>
            <Ionicons name="person-add-outline" size={20} color={T.primary} />
          </Pressable>
          <ProfileAvatar onPress={() => router.push('/(tabs)/profile')} />
        </View>
      </View>

      <View style={s.emptyWrap}>
        <Ionicons name="people-outline" size={52} color={T.border} />
        <Text style={s.emptyTitle}>No friends yet</Text>
        <Text style={s.emptySub}>Invite people you trust to share spots and see what they love.</Text>
        <Pressable
          style={s.inviteBtn}
          onPress={() => Share.share({ message: 'Join me on DateSpot!' }).catch(() => {})}
        >
          <Ionicons name="link-outline" size={16} color="#fff" />
          <Text style={s.inviteBtnText}>Share invite link</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: T.bg,
  },
  statLabel: { fontSize: 11, fontWeight: '700', color: T.muted, letterSpacing: 1.5, marginBottom: 2 },
  title: { fontSize: 32, fontWeight: '700', color: T.primary, fontFamily: 'InstrumentSerif-Regular', lineHeight: 36 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: T.primary, fontFamily: 'InstrumentSerif-Regular' },
  emptySub: { fontSize: 15, color: T.muted, textAlign: 'center', lineHeight: 22 },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.accent, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  inviteBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
