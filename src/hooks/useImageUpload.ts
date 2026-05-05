import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface UseImageUploadOptions {
  bucket: string;
  folder: string;
  maxSizeMB?: number;
}

interface UseImageUploadReturn {
  uploading: boolean;
  uploadImage: (file: File) => Promise<string | null>;
  deleteImage: (url: string) => Promise<void>;
  error: string | null;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function useImageUpload({ bucket, folder, maxSizeMB = 5 }: UseImageUploadOptions): UseImageUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WEBP');
      return null;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`La imagen no puede superar ${maxSizeMB} MB`);
      return null;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = `${folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: false, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al subir la imagen';
      setError(msg);
      return null;
    } finally {
      setUploading(false);
    }
  }, [bucket, folder, maxSizeMB]);

  const deleteImage = useCallback(async (url: string): Promise<void> => {
    try {
      // Extract path from URL: everything after /storage/v1/object/public/{bucket}/
      const marker = `/object/public/${bucket}/`;
      const idx = url.indexOf(marker);
      if (idx === -1) return;
      const filePath = url.slice(idx + marker.length).split('?')[0];
      await supabase.storage.from(bucket).remove([filePath]);
    } catch {
      // silent — DB record will be deleted regardless
    }
  }, [bucket]);

  return { uploading, uploadImage, deleteImage, error };
}
