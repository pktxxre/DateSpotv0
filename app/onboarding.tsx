import { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { saveProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { T, Fonts } from '@/lib/theme';

const STEPS = ['name', 'handle', 'city', 'bio'] as const;
type Step = typeof STEPS[number];

const STEP_META: Record<Step, { emoji: string; title: string; subtitle: string; placeholder: string; hint?: string }> = {
  name: {
    emoji: '👋',
    title: 'What should we call you?',
    subtitle: 'Your display name, shown to friends.',
    placeholder: 'Your name',
  },
  handle: {
    emoji: '✏️',
    title: 'Pick a username',
    subtitle: 'Your unique @handle in the app.',
    placeholder: 'yourhandle',
    hint: 'Lowercase letters, numbers, and underscores only.',
  },
  city: {
    emoji: '📍',
    title: 'What city are you in?',
    subtitle: 'We\'ll use this to show spots near you.',
    placeholder: 'e.g. San Francisco',
  },
  bio: {
    emoji: '🌟',
    title: 'Tell us about yourself',
    subtitle: 'A short bio shown on your profile. Optional.',
    placeholder: 'Brunch fanatic, always hunting for the perfect ramen…',
  },
};

export default function OnboardingScreen() {
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  const step = STEPS[stepIndex];
  const meta = STEP_META[step];
  const isLast = stepIndex === STEPS.length - 1;

  const valueMap: Record<Step, string> = { name, handle, city, bio };
  const setterMap: Record<Step, (v: string) => void> = {
    name: setName,
    handle: (v) => setHandle(v.toLowerCase().replace(/[^a-z0-9_]/g, '')),
    city: setCity,
    bio: setBio,
  };

  const currentValue = valueMap[step];
  const canSkip = step === 'bio';
  const canContinue = canSkip || currentValue.trim().length > 0;

  function goBack() {
    if (stepIndex === 0) router.back();
    else setStepIndex(i => i - 1);
  }

  async function handleNext() {
    if (!isLast) {
      setStepIndex(i => i + 1);
      return;
    }

    setLoading(true);
    const email = (await supabase?.auth.getUser())?.data?.user?.email ?? '';
    await saveProfile({
      username: name.trim() || 'You',
      handle: handle.trim(),
      city: city.trim(),
      bio: bio.trim(),
      email,
    });
    setLoading(false);
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={goBack} hitSlop={12} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
              <View style={styles.backCircle}>
                <Ionicons name="chevron-back" size={20} color={T.primary} />
              </View>
            </Pressable>

            {/* Progress dots */}
            <View style={styles.dots}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === stepIndex && styles.dotActive, i < stepIndex && styles.dotDone]}
                />
              ))}
            </View>

            {canSkip ? (
              <Pressable onPress={handleNext} hitSlop={12} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            ) : (
              <View style={{ width: 36 }} />
            )}
          </View>

          {/* Body */}
          <View style={styles.body}>
            <View style={styles.hero}>
              <Text style={styles.emoji}>{meta.emoji}</Text>
              <Text style={styles.title}>{meta.title}</Text>
              <Text style={styles.subtitle}>{meta.subtitle}</Text>
            </View>

            <View style={styles.form}>
              {step === 'bio' ? (
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={currentValue}
                  onChangeText={setterMap[step]}
                  placeholder={meta.placeholder}
                  placeholderTextColor={T.placeholder}
                  autoFocus
                  autoCapitalize="sentences"
                  multiline
                  numberOfLines={4}
                  returnKeyType="default"
                />
              ) : (
                <TextInput
                  style={styles.input}
                  value={currentValue}
                  onChangeText={setterMap[step]}
                  placeholder={meta.placeholder}
                  placeholderTextColor={T.placeholder}
                  autoFocus
                  autoCapitalize={step === 'name' || step === 'city' ? 'words' : 'none'}
                  keyboardType="default"
                  returnKeyType="done"
                  onSubmitEditing={() => canContinue && handleNext()}
                />
              )}

              {meta.hint && (
                <Text style={styles.hint}>{meta.hint}</Text>
              )}

              <Pressable
                style={({ pressed }) => [styles.btn, (!canContinue || loading) && styles.btnDisabled, pressed && canContinue && { opacity: 0.85 }]}
                onPress={handleNext}
                disabled={!canContinue || loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>{isLast ? 'Finish' : 'Continue'}</Text>
                }
              </Pressable>
            </View>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1, paddingHorizontal: 24 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 8, paddingBottom: 16,
  },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: T.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: T.border,
  },
  dotActive: { backgroundColor: T.accent, width: 18 },
  dotDone: { backgroundColor: T.muted },
  skipText: { fontSize: 15, color: T.muted, fontWeight: '500' },

  body: { flex: 1, justifyContent: 'center', gap: 40, paddingBottom: 32 },

  hero: { alignItems: 'center', gap: 10 },
  emoji: { fontSize: 52 },
  title: {
    fontSize: 24, fontWeight: '700', color: T.primary,
    fontFamily: Fonts.serif, letterSpacing: -0.4, textAlign: 'center',
  },
  subtitle: { fontSize: 15, color: T.muted, textAlign: 'center', lineHeight: 22 },

  form: { gap: 12 },
  input: {
    backgroundColor: T.inputBg, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 18, color: T.primary, textAlign: 'center',
  },
  textArea: {
    textAlign: 'left', textAlignVertical: 'top',
    minHeight: 100, fontSize: 16, paddingTop: 14,
  },
  hint: { fontSize: 12, color: T.placeholder, textAlign: 'center', marginTop: -4 },

  btn: {
    backgroundColor: T.accent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});
