import { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, ScrollView, Share,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { T } from '@/lib/theme';

export default function FriendsScreen() {
  const [query, setQuery] = useState('');

  async function handleShare() {
    try {
      await Share.share({ message: 'Join me on DateSpot! [invite link coming soon]' });
    } catch {}
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={T.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={T.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username or phone"
          placeholderTextColor={T.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={T.muted} />
          </Pressable>
        )}
      </View>

      {query.length > 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No users found</Text>
          <Text style={styles.emptyBody}>Try a different username or phone number</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Share invite */}
          <Pressable style={styles.inviteRow} onPress={handleShare}>
            <View style={styles.inviteIcon}>
              <Ionicons name="link" size={20} color={T.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inviteLabel}>Share invite link</Text>
              <Text style={styles.inviteSub}>Invite friends to join DateSpot</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={T.muted} />
          </Pressable>

          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No friends yet</Text>
            <Text style={styles.emptyBody}>
              Search by username or phone number above, or share your invite link to get started
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: {
    fontSize: 20, fontWeight: '700', color: T.primary,
    fontFamily: 'Georgia', letterSpacing: -0.2,
  },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: T.card, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 11,
    borderWidth: 1, borderColor: T.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: T.primary },

  content: { paddingBottom: 40 },

  inviteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  inviteIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.accentTint,
    alignItems: 'center', justifyContent: 'center',
  },
  inviteLabel: { fontSize: 15, fontWeight: '600', color: T.primary },
  inviteSub: { fontSize: 13, color: T.muted, marginTop: 1 },

  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: {
    fontSize: 18, fontWeight: '700', color: T.primary,
    fontFamily: 'Georgia', marginBottom: 8,
  },
  emptyBody: { fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 20 },
});
