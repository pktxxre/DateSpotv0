import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  username: string;
  bio: string;
  profilePhotoUri: string | null;
  email: string;
  phone: string;
}

const KEY = 'datespot:profile';

const DEFAULT: UserProfile = {
  username: 'You',
  bio: '',
  profilePhotoUri: null,
  email: '',
  phone: '',
};

export async function getProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return DEFAULT;
  return { ...DEFAULT, ...JSON.parse(raw) };
}

export async function saveProfile(updates: Partial<UserProfile>): Promise<void> {
  const current = await getProfile();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...updates }));
}
