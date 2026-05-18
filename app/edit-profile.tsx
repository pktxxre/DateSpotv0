import { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable,
  Image, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getProfile, saveProfile } from '@/lib/profile';
import { uploadPhoto } from '@/lib/storage';
import { T } from '@/lib/theme';

export default function EditProfileScreen() {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingLocalUri, setPendingLocalUri] = useState<string | null>(null);

  useEffect(() => {
    getProfile().then(p => {
      setUsername(p.username);
      setBio(p.bio);
      setPhotoUri(p.profilePhotoUri);
    });
  }, []);

  const pickPhoto = async () => {
    let ImagePicker: any;
    try { ImagePicker = require('expo-image-picker'); } catch {}
    if (!ImagePicker?.requestMediaLibraryPermissionsAsync) {
      Alert.alert('Photo picking unavailable', 'Run `npx expo run:ios` once to compile the native photo module.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const localUri = result.assets[0].uri;
      setPhotoUri(localUri);        // preview immediately
      setPendingLocalUri(localUri); // will upload on save
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert('Username required', 'Please enter a username.');
      return;
    }
    setSaving(true);
    let finalPhotoUri = photoUri;
    if (pendingLocalUri) {
      const path = `profile/${Date.now()}.jpg`;
      const url = await uploadPhoto(pendingLocalUri, path);
      if (url) finalPhotoUri = url;
    }
    await saveProfile({ username: username.trim(), bio: bio.trim(), profilePhotoUri: finalPhotoUri });
    setSaving(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <View style={styles.backBtnCircle}>
            <Ionicons name="chevron-back" size={20} color={T.primary} />
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Photo picker */}
          <View style={styles.photoSection}>
            <Pressable
              style={({ pressed }) => [styles.avatarWrap, pressed && { opacity: 0.8 }]}
              onPress={pickPhoto}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={46} color="#B0A090" />
                </View>
              )}
              <View style={styles.cameraOverlay}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </Pressable>
            <Text style={styles.photoHint}>Tap to change photo</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.fieldLabel}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Your username"
              placeholderTextColor={T.muted}
              autoCorrect={false}
              autoCapitalize="none"
              maxLength={30}
              returnKeyType="next"
            />
            <Text style={styles.charCount}>{username.length}/30</Text>

            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell people a bit about yourself…"
              placeholderTextColor={T.muted}
              multiline
              maxLength={150}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{bio.length}/150</Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14,
  },
  backBtn: {},
  backBtnCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: T.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 18, fontWeight: '700', color: T.primary,
    fontFamily: 'InstrumentSerif-Regular', letterSpacing: -0.2,
  },
  saveBtn: { marginLeft: 'auto' },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: T.accent },

  photoSection: { alignItems: 'center', paddingVertical: 24 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: {
    backgroundColor: T.placeholder,
    alignItems: 'center', justifyContent: 'center',
  },
  cameraOverlay: {
    position: 'absolute', bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: T.bg,
  },
  photoHint: { fontSize: 13, color: T.muted, marginTop: 8 },

  form: { paddingHorizontal: 20 },
  fieldLabel: {
    fontSize: 12, fontWeight: '600', color: T.muted,
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
  },
  input: {
    backgroundColor: T.card, borderRadius: 14, borderWidth: 1,
    borderColor: T.border, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: T.primary,
  },
  bioInput: { height: 110, paddingTop: 14 },
  charCount: { fontSize: 12, color: T.muted, textAlign: 'right', marginTop: 4 },
});
