import { StyleSheet, View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { T } from '@/lib/theme';

type SettingRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
};

function SettingRow({ icon, label, onPress, danger }: SettingRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      onPress={onPress}
    >
      <View style={[styles.rowIconWrap, danger && styles.rowIconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? T.danger : T.primary} />
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {!danger && <Ionicons name="chevron-forward" size={16} color={T.muted} />}
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function SettingsScreen() {
  const stub = (label: string) => () => {
    Alert.alert(label, 'This feature is coming soon.');
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => {} },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {} },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={20} color={T.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Account */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <SettingRow
            icon="mail-outline"
            label="Change Email"
            onPress={stub('Change Email')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="call-outline"
            label="Change Phone Number"
            onPress={stub('Change Phone Number')}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="lock-closed-outline"
            label="Change Password"
            onPress={stub('Change Password')}
          />
        </View>

        {/* Privacy */}
        <SectionHeader title="Privacy" />
        <View style={styles.card}>
          <SettingRow
            icon="eye-outline"
            label="Privacy Settings"
            onPress={stub('Privacy Settings')}
          />
        </View>

        {/* Danger zone */}
        <SectionHeader title="Account Actions" />
        <View style={styles.card}>
          <SettingRow
            icon="log-out-outline"
            label="Log Out"
            onPress={handleLogout}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="trash-outline"
            label="Delete Account"
            onPress={handleDeleteAccount}
            danger
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: T.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    position: 'absolute', left: 0, right: 0, textAlign: 'center',
    fontSize: 20, fontWeight: '700', color: T.primary,
    fontFamily: 'Georgia', letterSpacing: -0.2,
  },

  sectionHeader: {
    fontSize: 12, fontWeight: '600', color: T.muted,
    letterSpacing: 0.6, textTransform: 'uppercase',
    paddingHorizontal: 20, marginTop: 24, marginBottom: 8,
  },

  card: {
    backgroundColor: T.card, marginHorizontal: 16, borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  rowIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: T.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: T.dangerBg },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: T.primary },
  rowLabelDanger: { color: T.danger },

  divider: { height: 1, backgroundColor: T.border, marginLeft: 60 },
});
