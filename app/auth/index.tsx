import React, { useRef, useState } from 'react';
import {
  Animated, Dimensions, Keyboard, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { saveProfile } from '@/lib/profile';
import { T } from '@/lib/theme';

const { width: W } = Dimensions.get('window');

type Step = 'welcome' | 'signup' | 'verify-email' | 'name' | 'profile' | 'city' | 'login';
const FORM_STEPS: Step[] = ['signup', 'name', 'profile', 'city'];

function stepNum(s: Step) {
  const i = FORM_STEPS.indexOf(s);
  return i === -1 ? 0 : i + 1;
}

// ─── Video ────────────────────────────────────────────────────────────────────
let _VideoView: any = null;
let _useVideoPlayer: any = null;
try {
  const m = require('expo-video');
  _VideoView = m.VideoView;
  _useVideoPlayer = m.useVideoPlayer;
} catch {}

function VideoBackgroundInner() {
  const player = _useVideoPlayer(require('@/assets/onboarding.mp4'), (p: any) => {
    p.loop = true; p.muted = true; p.play();
  });
  return (
    <_VideoView player={player} style={StyleSheet.absoluteFillObject}
      contentFit="cover" nativeControls={false} />
  );
}
function VideoBackground() {
  if (!_VideoView || !_useVideoPlayer) return null;
  return <VideoBackgroundInner />;
}
class VideoErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? null : this.props.children; }
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ current }: { current: number }) {
  return (
    <View style={pb.row}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={[pb.seg, i <= current && pb.active]} />
      ))}
    </View>
  );
}
const pb = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' },
  active: { backgroundColor: T.accent },
});

// ─── Main component ───────────────────────────────────────────────────────────
export default function OnboardingFlow() {
  const [step, setStep] = useState<Step>('welcome');

  // Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Name
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Profile
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // City
  const [city, setCity] = useState('');

  // Email verification
  const [otp, setOtp] = useState('');

  const [loading, setLoading] = useState(false);

  // Animation refs
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  function go(next: Step, dir: 'forward' | 'back' = 'forward') {
    Keyboard.dismiss();
    const sign = dir === 'forward' ? 1 : -1;
    Animated.parallel([
      Animated.timing(translateX, { toValue: -sign * W * 0.22, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.94, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      translateX.setValue(sign * W * 0.22);
      scale.setValue(0.94);
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, damping: 24, stiffness: 240, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, damping: 24, stiffness: 240, useNativeDriver: true }),
      ]).start();
    });
  }

  function goBack() {
    if (step === 'signup' || step === 'login') go('welcome', 'back');
    else if (step === 'name') go('signup', 'back');
    else if (step === 'profile') go('name', 'back');
    else if (step === 'city') go('profile', 'back');
  }

  async function handleSignup() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and a password.');
      return;
    }
    const pwValid = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password);
    if (!pwValid) {
      Alert.alert('Password requirements', 'Password needs 8+ characters, an uppercase letter, a number, and a symbol.');
      return;
    }
    setLoading(true);
    // If already have a session (went back from name step), just proceed
    const { data: { session } } = await supabase!.auth.getSession();
    if (session) { setLoading(false); go('name'); return; }

    const { error } = await supabase!.auth.signUp({ email: email.trim(), password });
    if (error) { setLoading(false); Alert.alert('Sign Up Failed', error.message); return; }
    // Try immediate sign-in (works when Supabase email confirmation is disabled)
    await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    go('name');
  }

  async function handleVerifyEmail() {
    if (otp.length < 8) return;
    setLoading(true);
    const { error } = await supabase!.auth.verifyOtp({
      email: email.trim(),
      token: otp,
      type: 'signup',
    });
    setLoading(false);
    if (error) { Alert.alert('Verification Failed', error.message); return; }
    go('name');
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) { Alert.alert('Login Failed', error.message); return; }
    router.replace('/(tabs)');
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to set a profile picture.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function handleFinish() {
    setLoading(true);
    const userEmail = (await supabase?.auth.getUser())?.data?.user?.email ?? email;
    const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || 'You';
    await saveProfile({
      username: displayName,
      handle: handle.trim(),
      bio: bio.trim(),
      profilePhotoUri: photoUri,
      email: userEmail,
      city,
    });
    setLoading(false);
    router.replace('/(tabs)');
  }

  const isFormStep = FORM_STEPS.includes(step);
  const showBack = step !== 'welcome';
  const num = stepNum(step);

  // Per-step config
  let canContinue = false;
  let onContinue: () => void = () => {};
  let continueLabel = 'Continue';

  if (step === 'signup') {
    const pwValid = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password);
    canContinue = email.trim().length > 0 && pwValid;
    onContinue = handleSignup;
  } else if (step === 'verify-email') {
    canContinue = otp.length === 8;
    onContinue = handleVerifyEmail;
    continueLabel = 'Verify Email';
  } else if (step === 'name') {
    canContinue = firstName.trim().length > 0;
    onContinue = () => go('profile');
  } else if (step === 'profile') {
    canContinue = handle.trim().length > 0;
    onContinue = () => go('city');
  } else if (step === 'city') {
    canContinue = city.length > 0;
    onContinue = handleFinish;
    continueLabel = 'Get Started';
  } else if (step === 'login') {
    canContinue = email.trim().length > 0 && password.length > 0;
    onContinue = handleLogin;
    continueLabel = 'Log In';
  }

  return (
    <View style={s.root}>
      <VideoErrorBoundary>
        <VideoBackground />
      </VideoErrorBoundary>
      <View style={s.overlay} />

      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[{ flex: 1 }, step !== 'welcome' && s.card, { transform: [{ translateX }, { scale }], opacity }]}>

            {/* Top bar */}
            <View style={s.topBar}>
              {showBack ? (
                <Pressable
                  style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.5 }]}
                  onPress={goBack}
                  hitSlop={12}
                >
                  <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.9)" />
                </Pressable>
              ) : (
                <View style={s.backBtnSpacer} />
              )}
              {isFormStep && (
                <>
                  <ProgressBar current={num} />
                  <View style={s.backBtnSpacer} />
                </>
              )}
            </View>

            {/* Scrollable content */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={s.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {step === 'welcome' && <WelcomeContent onSignup={() => go('signup')} onLogin={() => go('login')} />}
              {step === 'signup' && (
                <SignupContent
                  email={email} setEmail={setEmail}
                  password={password} setPassword={setPassword}
                  showPassword={showPassword} setShowPassword={setShowPassword}
                  onSwitchToLogin={() => go('login')}
                />
              )}
              {step === 'verify-email' && (
                <VerifyEmailContent email={email} otp={otp} setOtp={setOtp} />
              )}
              {step === 'name' && (
                <NameContent
                  firstName={firstName} setFirstName={setFirstName}
                  lastName={lastName} setLastName={setLastName}
                  onSubmit={() => canContinue && go('profile')}
                />
              )}
              {step === 'profile' && (
                <ProfileContent
                  photoUri={photoUri} onPickPhoto={pickPhoto}
                  handle={handle} setHandle={setHandle}
                  bio={bio} setBio={setBio}
                />
              )}
              {step === 'city' && (
                <CityContent city={city} setCity={setCity} />
              )}
              {step === 'login' && (
                <LoginContent
                  email={email} setEmail={setEmail}
                  password={password} setPassword={setPassword}
                  showPassword={showPassword} setShowPassword={setShowPassword}
                  onSwitchToSignup={() => go('signup')}
                />
              )}
            </ScrollView>

            {/* Bottom button */}
            {step !== 'welcome' && (
              <View style={s.btnArea}>
                <Pressable
                  style={({ pressed }) => [
                    s.primaryBtn,
                    !canContinue && s.primaryBtnOff,
                    pressed && canContinue && { opacity: 0.85 },
                  ]}
                  onPress={onContinue}
                  disabled={!canContinue || loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.primaryBtnText}>{continueLabel}</Text>
                  }
                </Pressable>
              </View>
            )}

          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── Step content components ──────────────────────────────────────────────────
function WelcomeContent({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  return (
    <View style={c.welcomeWrap}>
      <View style={c.welcomeHero}>
        <Text style={c.logo}>DateSpot</Text>
        <Text style={c.logoSub}>Discover, log, and revisit{'\n'}your favorite date spots.</Text>
      </View>
      <View style={c.welcomeActions}>
        <Pressable style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85 }]} onPress={onSignup}>
          <Text style={s.primaryBtnText}>Create Account</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [c.ghostBtn, pressed && { opacity: 0.7 }]} onPress={onLogin}>
          <Text style={c.ghostBtnText}>Log In</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SignupContent({ email, setEmail, password, setPassword, showPassword, setShowPassword, onSwitchToLogin }: {
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  showPassword: boolean; setShowPassword: (v: boolean) => void;
  onSwitchToLogin: () => void;
}) {
  return (
    <View style={c.formWrap}>
      <Text style={c.stepTitle}>Create your account</Text>
      <Text style={c.stepSub}>Enter an email and choose a password.</Text>
      <View style={c.fields}>
        <View style={c.fieldWrap}>
          <Text style={c.label}>EMAIL</Text>
          <TextInput style={c.input} value={email} onChangeText={setEmail}
            placeholder="you@example.com" placeholderTextColor={c.ph.color as string}
            autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        </View>
        <View style={c.fieldWrap}>
          <Text style={c.label}>PASSWORD</Text>
          <View>
            <TextInput style={c.input} value={password} onChangeText={setPassword}
              placeholder="Min 8 chars, uppercase, number, symbol" placeholderTextColor={c.ph.color as string}
              secureTextEntry={!showPassword} autoComplete="new-password" />
            <Pressable style={c.eyeBtn} onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>
          <View style={c.pwReqs}>
            <PwReq met={password.length >= 8} label="8+ characters" />
            <PwReq met={/[A-Z]/.test(password)} label="Uppercase letter" />
            <PwReq met={/[0-9]/.test(password)} label="Number" />
            <PwReq met={/[^a-zA-Z0-9]/.test(password)} label="Symbol (!@#$…)" />
          </View>
        </View>
      </View>
      <Pressable style={({ pressed }) => [c.switchLink, pressed && { opacity: 0.6 }]} onPress={onSwitchToLogin}>
        <Text style={c.switchText}>Already have an account? <Text style={c.switchAccent}>Log in</Text></Text>
      </Pressable>
    </View>
  );
}

function NameContent({ firstName, setFirstName, lastName, setLastName, onSubmit }: {
  firstName: string; setFirstName: (v: string) => void;
  lastName: string; setLastName: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={c.formWrap}>
      <Text style={c.stepTitle}>What should we{'\n'}call you?</Text>
      <Text style={c.stepSub}>Real name, nickname, the one your barista uses — your call.</Text>
      <View style={c.fields}>
        <View style={c.fieldWrap}>
          <Text style={c.label}>FIRST NAME</Text>
          <TextInput style={c.input} value={firstName} onChangeText={setFirstName}
            placeholder="First name" placeholderTextColor={c.ph.color as string}
            autoCapitalize="words" autoFocus returnKeyType="next" />
        </View>
        <View style={c.fieldWrap}>
          <Text style={c.label}>LAST NAME (OPTIONAL)</Text>
          <TextInput style={c.input} value={lastName} onChangeText={setLastName}
            placeholder="Last name" placeholderTextColor={c.ph.color as string}
            autoCapitalize="words" returnKeyType="done" onSubmitEditing={onSubmit} />
        </View>
      </View>
    </View>
  );
}

function ProfileContent({ photoUri, onPickPhoto, handle, setHandle, bio, setBio }: {
  photoUri: string | null; onPickPhoto: () => void;
  handle: string; setHandle: (v: string) => void;
  bio: string; setBio: (v: string) => void;
}) {
  return (
    <View style={c.formWrap}>
      <Text style={c.stepTitle}>Set up your profile</Text>
      <Text style={c.stepSub}>This is what other DateSpotters will see when you share.</Text>

      <Pressable style={c.photoWrap} onPress={onPickPhoto}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={c.photo} />
        ) : (
          <View style={c.photoEmpty}>
            <Ionicons name="arrow-up-outline" size={22} color="rgba(255,255,255,0.55)" />
            <Text style={c.photoEmptyText}>Add photo</Text>
          </View>
        )}
        <View style={c.photoEditBadge}>
          <Ionicons name="pencil" size={11} color="#fff" />
        </View>
      </Pressable>

      <View style={c.fields}>
        <View style={c.fieldWrap}>
          <Text style={c.label}>USERNAME</Text>
          <View style={c.prefixWrap}>
            <Text style={c.prefix}>@</Text>
            <TextInput
              style={[c.input, c.inputNoLeftPad]}
              value={handle}
              onChangeText={t => setHandle(t.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase())}
              placeholder="yourname"
              placeholderTextColor={c.ph.color as string}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
        <View style={c.fieldWrap}>
          <Text style={c.label}>BIO</Text>
          <View>
            <TextInput
              style={[c.input, c.bioInput]}
              value={bio}
              onChangeText={t => setBio(t.slice(0, 150))}
              placeholder={'A line or two — your vibe, your favorite\ncuisine, what you\'re looking for.'}
              placeholderTextColor={c.ph.color as string}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={c.charCount}>{bio.length}/150</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function PwReq({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons
        name={met ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={met ? '#34c759' : 'rgba(255,255,255,0.35)'}
      />
      <Text style={{ fontSize: 12, color: met ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)' }}>{label}</Text>
    </View>
  );
}

function VerifyEmailContent({ email, otp, setOtp }: {
  email: string; otp: string; setOtp: (v: string) => void;
}) {
  return (
    <View style={c.formWrap}>
      <Text style={c.stepTitle}>Check your email</Text>
      <Text style={c.stepSub}>
        We sent an 8-digit code to{'\n'}<Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '600' }}>{email}</Text>
      </Text>
      <View style={c.fields}>
        <View style={c.fieldWrap}>
          <Text style={c.label}>VERIFICATION CODE</Text>
          <TextInput
            style={[c.input, { letterSpacing: 6, textAlign: 'center', fontSize: 24, fontWeight: '700', paddingVertical: 16 }]}
            value={otp}
            onChangeText={t => setOtp(t.replace(/[^0-9]/g, '').slice(0, 8))}
            placeholder="12345678"
            placeholderTextColor={c.ph.color as string}
            keyboardType="number-pad"
            autoFocus
            maxLength={8}
          />
        </View>
      </View>
      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 16, lineHeight: 20 }}>
        Didn't receive it? Check your spam folder{'\n'}or go back and try again.
      </Text>
    </View>
  );
}

function CityContent({ city, setCity }: { city: string; setCity: (v: string) => void }) {
  return (
    <View style={c.formWrap}>
      <Text style={c.stepTitle}>Where do you date?</Text>
      <Text style={c.stepSub}>We'll prioritize spots near you. You can change this anytime.</Text>
      <View style={c.fields}>
        <View style={c.fieldWrap}>
          <Text style={c.label}>AVAILABLE NOW</Text>
          <Pressable
            style={[c.cityRow, city === 'Seattle, WA' && c.cityRowSelected]}
            onPress={() => setCity('Seattle, WA')}
          >
            <View style={[c.cityIconWrap, city === 'Seattle, WA' && c.cityIconWrapSelected]}>
              <Ionicons
                name="location-outline"
                size={16}
                color={city === 'Seattle, WA' ? T.accent : 'rgba(255,255,255,0.55)'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={c.cityName}>Seattle</Text>
              <Text style={c.cityState}>WA</Text>
            </View>
            {city === 'Seattle, WA' && (
              <Ionicons name="checkmark" size={18} color={T.accent} />
            )}
          </Pressable>
        </View>
        <Text style={c.moreNote}>More cities coming soon.</Text>
      </View>
    </View>
  );
}

function LoginContent({ email, setEmail, password, setPassword, showPassword, setShowPassword, onSwitchToSignup }: {
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  showPassword: boolean; setShowPassword: (v: boolean) => void;
  onSwitchToSignup: () => void;
}) {
  return (
    <View style={c.formWrap}>
      <Text style={c.stepTitle}>Welcome back</Text>
      <Text style={c.stepSub}>Log in to your DateSpot account.</Text>
      <View style={c.fields}>
        <View style={c.fieldWrap}>
          <Text style={c.label}>EMAIL</Text>
          <TextInput style={c.input} value={email} onChangeText={setEmail}
            placeholder="you@example.com" placeholderTextColor={c.ph.color as string}
            autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        </View>
        <View style={c.fieldWrap}>
          <Text style={c.label}>PASSWORD</Text>
          <View>
            <TextInput style={c.input} value={password} onChangeText={setPassword}
              placeholder="Your password" placeholderTextColor={c.ph.color as string}
              secureTextEntry={!showPassword} autoComplete="password" />
            <Pressable style={c.eyeBtn} onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>
        </View>
      </View>
      <Pressable style={({ pressed }) => [c.switchLink, pressed && { opacity: 0.6 }]} onPress={onSwitchToSignup}>
        <Text style={c.switchText}>No account? <Text style={c.switchAccent}>Sign up</Text></Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1410' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  safe: { flex: 1 },
  card: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
    gap: 10,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  backBtnSpacer: { width: 32 },
  scrollContent: { flexGrow: 1 },
  btnArea: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8 },
  primaryBtn: {
    backgroundColor: T.accent, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  primaryBtnOff: { backgroundColor: 'rgba(231,111,81,0.4)' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});

// Content styles
const c = StyleSheet.create({
  // Placeholder proxy (used as c.ph.color)
  ph: { color: 'rgba(255,255,255,0.35)' } as any,

  welcomeWrap: { flex: 1, padding: 24, justifyContent: 'space-between' },
  welcomeHero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  logo: { fontSize: 40, fontFamily: 'InstrumentSerif-Regular', fontWeight: '700', color: '#fff', letterSpacing: -1 },
  logoSub: { fontSize: 16, color: 'rgba(255,255,255,0.72)', textAlign: 'center', lineHeight: 24 },
  welcomeActions: { gap: 10 },
  ghostBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  ghostBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '600' },

  formWrap: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  stepTitle: {
    fontSize: 23, fontFamily: 'InstrumentSerif-Regular', fontWeight: '700',
    color: '#fff', letterSpacing: -0.3, marginBottom: 6, lineHeight: 30,
  },
  stepSub: { fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 22 },
  fields: { gap: 18, marginTop: 22 },
  fieldWrap: { gap: 7 },
  label: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.8 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 16, color: '#fff',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },

  prefixWrap: { flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', paddingLeft: 14,
  },
  prefix: { fontSize: 16, color: 'rgba(255,255,255,0.55)', marginRight: 2 },
  inputNoLeftPad: {
    flex: 1, backgroundColor: 'transparent', borderWidth: 0,
    paddingLeft: 0, borderRadius: 0,
  },
  bioInput: { minHeight: 90, paddingTop: 13 },
  charCount: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'right', marginTop: 4 },

  photoWrap: {
    alignSelf: 'center', marginTop: 20, marginBottom: 4,
    width: 88, height: 88,
  },
  photo: { width: 88, height: 88, borderRadius: 44 },
  photoEmpty: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  photoEmptyText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  photoEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },

  cityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  cityRowSelected: { borderColor: T.accent, backgroundColor: 'rgba(231,111,81,0.12)' },
  cityIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  cityIconWrapSelected: { backgroundColor: 'rgba(231,111,81,0.2)' },
  cityName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  cityState: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  moreNote: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 4 },

  pwReqs: { gap: 5, marginTop: 10, paddingLeft: 2 },

  switchLink: { marginTop: 18, alignItems: 'center' },
  switchText: { fontSize: 14, color: 'rgba(255,255,255,0.55)' },
  switchAccent: { color: T.accent, fontWeight: '600' },
});
