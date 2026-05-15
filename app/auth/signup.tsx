import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { saveProfile } from '@/lib/profile';
import { T } from '@/lib/theme';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  async function handleSignup() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and a password.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Password too short', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error: signUpError } = await supabase!.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setLoading(false);
      Alert.alert('Sign Up Failed', signUpError.message);
      return;
    }

    // Clear any stale local profile so the auth listener routes to /onboarding
    await saveProfile({ username: '' });

    // Sign in immediately after account creation (requires email confirmation disabled in Supabase dashboard)
    const { error: signInError } = await supabase!.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (signInError) {
      // Fall back to email confirmation flow if auto-sign-in fails
      setConfirmed(true);
    } else {
      router.replace('/onboarding');
    }
  }

  if (confirmed) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', gap: 16 }]}>
          <Text style={{ fontSize: 48 }}>📬</Text>
          <Text style={[styles.title, { textAlign: 'center' }]}>Check your email</Text>
          <Text style={[styles.subtitle, { textAlign: 'center' }]}>
            We sent a confirmation link to{'\n'}<Text style={{ color: T.accent }}>{email.trim()}</Text>
          </Text>
          <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8 }]}>
            Tap the link in the email to finish creating your account.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <View style={styles.backCircle}>
                <Ionicons name="chevron-back" size={20} color={T.primary} />
              </View>
            </Pressable>
          </View>

          <View style={styles.body}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Join to discover and log date spots.</Text>

            <View style={styles.fields}>
              <View style={styles.inputWrap}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={T.placeholder}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              <View style={styles.inputWrap}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="At least 6 characters"
                    placeholderTextColor={T.placeholder}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                  />
                  <Pressable
                    onPress={() => setShowPassword(v => !v)}
                    style={styles.eyeBtn}
                    hitSlop={8}
                  >
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={T.muted} />
                  </Pressable>
                </View>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Create Account</Text>
              }
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.loginLink, pressed && { opacity: 0.6 }]}
              onPress={() => router.replace('/auth/login')}
            >
              <Text style={styles.loginLinkText}>Already have an account? <Text style={styles.loginLinkAccent}>Log in</Text></Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1, paddingHorizontal: 24 },
  header: { paddingTop: 8, paddingBottom: 16 },
  backCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: T.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, gap: 0 },
  title: {
    fontSize: 26, fontWeight: '700', color: T.primary,
    fontFamily: 'InstrumentSerif-Regular', letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16, color: T.muted, marginBottom: 32,
  },
  fields: { gap: 20, marginBottom: 28 },
  inputWrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: T.muted, letterSpacing: 0.3 },
  input: {
    backgroundColor: T.inputBg,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 16, color: T.primary,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  eyeBtn: {
    position: 'absolute', right: 14,
    height: '100%', justifyContent: 'center',
  },
  submitBtn: {
    backgroundColor: T.accent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  loginLink: { marginTop: 20, alignItems: 'center' },
  loginLinkText: { fontSize: 15, color: T.muted },
  loginLinkAccent: { color: T.accent, fontWeight: '600' },
});
