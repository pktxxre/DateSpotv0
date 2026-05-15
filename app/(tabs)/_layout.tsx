import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleOpenLog } from './map';
import { T } from '@/lib/theme';

const TIP_KEY = 'fab_tip_dismissed';

function AddTabButton() {
  const [tipVisible, setTipVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(TIP_KEY).then(val => {
      if (val !== 'true') {
        setTipVisible(true);
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 250, useNativeDriver: true,
        }).start();
      }
    });
  }, []);

  function dismissTip() {
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 180, useNativeDriver: true,
    }).start(() => setTipVisible(false));
    AsyncStorage.setItem(TIP_KEY, 'true');
  }

  function handlePress() {
    dismissTip();
    scheduleOpenLog();
    router.navigate('/(tabs)/map');
  }

  return (
    <View style={fab.wrap} pointerEvents="box-none">
      {tipVisible && (
        <Animated.View style={[fab.tip, { opacity: fadeAnim }]} pointerEvents="auto">
          <Text style={fab.tipText}>Tap + to log your first date spot</Text>
          <Pressable
            style={fab.tipClose}
            onPress={dismissTip}
            hitSlop={8}
          >
            <Ionicons name="close" size={14} color={T.muted} />
          </Pressable>
        </Animated.View>
      )}
      <Pressable
        style={({ pressed }) => [fab.btn, pressed && { opacity: 0.85 }]}
        onPress={handlePress}
        hitSlop={4}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

const fab = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    marginTop: -18,
  },
  btn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 8,
  },
  tip: {
    position: 'absolute',
    bottom: 74,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    width: 230,
    left: '50%',
    // center the 230px bubble over the button
    marginLeft: -115,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: T.primary,
    fontWeight: '500',
  },
  tipClose: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4B3621',
        tabBarInactiveTintColor: '#B0A090',
        tabBarStyle: {
          backgroundColor: '#FCF9F2',
          borderTopColor: '#EDE8E0',
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: 'Ranked',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarButton: () => <AddTabButton />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
