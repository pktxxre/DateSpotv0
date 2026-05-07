import { supabase } from './supabase';

const BUCKET = 'photos';

// Upload any local file URI to Supabase Storage and return the public URL.
// Uses fetch → blob so no extra native deps are needed.
export async function uploadPhoto(localUri: string, storagePath: string): Promise<string | null> {
  try {
    const response = await fetch(localUri);
    const blob = await response.blob();

    const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, blob, { contentType, upsert: true });

    if (error) {
      console.error('Supabase upload error:', error.message);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return publicUrl;
  } catch (e) {
    console.error('uploadPhoto failed:', e);
    return null;
  }
}

// Delete a photo from Supabase Storage by its public URL.
export async function deletePhoto(publicUrl: string): Promise<void> {
  try {
    const urlObj = new URL(publicUrl);
    // path after /object/public/<bucket>/
    const parts = urlObj.pathname.split(`/object/public/${BUCKET}/`);
    if (parts.length < 2) return;
    await supabase.storage.from(BUCKET).remove([parts[1]]);
  } catch (e) {
    console.error('deletePhoto failed:', e);
  }
}
