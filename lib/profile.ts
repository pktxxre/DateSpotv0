import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  username: string;       // display name e.g. "Alex Berry"
  handle: string;         // @ handle e.g. "alexberry"
  bio: string;
  profilePhotoUri: string | null;
  email: string;
  phone: string;
  city: string;
}

const KEY = 'datespot:profile';
const LAST_USER_KEY = 'datespot:last_user_id';

const DEFAULT: UserProfile = {
  username: 'You',
  handle: '',
  bio: '',
  profilePhotoUri: null,
  email: '',
  phone: '',
  city: '',
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

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export async function getLastUserId(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_USER_KEY);
}

export async function setLastUserId(id: string): Promise<void> {
  await AsyncStorage.setItem(LAST_USER_KEY, id);
}

export async function clearLastUserId(): Promise<void> {
  await AsyncStorage.removeItem(LAST_USER_KEY);
}
