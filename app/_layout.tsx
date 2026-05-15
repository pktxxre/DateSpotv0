import { Stack, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { initDb, clearUserData } from '@/lib/db';
import { recomputeRatings } from '@/lib/visits';
import { supabase } from '@/lib/supabase';
import { getProfile, clearProfile, getLastUserId, setLastUserId, clearLastUserId } from '@/lib/profile';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    'InstrumentSerif-Regular': require('../assets/fonts/InstrumentSerif-Regular.ttf'),
    'InstrumentSans-Variable': require('../assets/fonts/InstrumentSans-Variable.ttf'),
    'IBMPlexMono-Regular': require('../assets/fonts/IBMPlexMono-Regular.ttf'),
  });
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    initDb()
      .then(() => { recomputeRatings(); setDbReady(true); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    // Handle auth deep links (e.g. email confirmation: datespot://...)
    async function handleUrl(url: string) {
      const { error } = await supabase!.auth.exchangeCodeForSession(url);
      if (error) console.warn('exchangeCodeForSession error:', error.message);
    }
    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_OUT') {
        await clearUserData();
        await clearProfile();
        await clearLastUserId();
        router.replace('/auth');
      } else if (_event === 'SIGNED_IN' && session) {
        // If a different user signed in, wipe the previous user's local data
        const lastUserId = await getLastUserId();
        if (lastUserId && lastUserId !== session.user.id) {
          await clearUserData();
          await clearProfile();
        }
        await setLastUserId(session.user.id);

        // auth/index.tsx manages its own navigation through the signup flow,
        // so don't interrupt it mid-step when SIGNED_IN fires from signUp().
        if (pathnameRef.current.startsWith('/auth')) return;
        const profile = await getProfile();
        if (!profile.username || profile.username === 'You') {
          router.replace('/onboarding');
        } else {
          router.replace('/(tabs)');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!dbReady || !fontsLoaded || !authChecked) return;
    SplashScreen.hideAsync();
    if (!session) {
      router.replace('/auth');
    }
  }, [dbReady, fontsLoaded, authChecked]);

  if (!dbReady || !fontsLoaded || !authChecked) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/signup" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="spot/[id]" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
