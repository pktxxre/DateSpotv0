import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'datespot:log_draft';

export interface LogDraft {
  lat?: number;
  lng?: number;
  venue_name?: string;
  visited_at?: string;
  notes?: string;
  step: 'location' | 'details' | 'triage' | 'compare' | 'done';
  savedAt: string;
}

export async function saveDraft(draft: LogDraft): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(draft));
}

export async function loadDraft(): Promise<LogDraft | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LogDraft;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
