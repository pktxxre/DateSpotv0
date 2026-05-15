import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getProfile } from '@/lib/profile';

interface Props {
  size?: number;
  onPress?: () => void;
}

export function ProfileAvatar({ size = 36, onPress }: Props) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [initial, setInitial] = useState('?');

  useFocusEffect(useCallback(() => {
    getProfile().then(p => {
      setPhoto(p.profilePhotoUri ?? null);
      setInitial((p.username || 'You').charAt(0).toUpperCase());
    });
  }, []));

  const radius = size / 2;
  const containerStyle = {
    width: size, height: size, borderRadius: radius,
    backgroundColor: '#E8C5B8',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  };

  const content = photo ? (
    <Image source={{ uri: photo }} style={{ width: size, height: size }} resizeMode="cover" />
  ) : (
    <Text style={[s.initial, { fontSize: size * 0.42 }]}>{initial}</Text>
  );

  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [containerStyle, pressed && { opacity: 0.7 }]} onPress={onPress} hitSlop={8}>
        {content}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{content}</View>;
}

const s = StyleSheet.create({
  initial: { fontWeight: '700', color: '#A0523C' },
});
