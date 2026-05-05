import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';


interface Props {
  userId: string;
  currentAvatarUrl: string | null;
  displayName: string;
  onUploadSuccess: (url: string) => void;
  onError: (msg: string) => void;
}

export default function AvatarUpload({ userId, currentAvatarUrl, displayName, onUploadSuccess, onError }: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = (displayName || 'F')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      onError('Solo se permiten imágenes JPG, PNG, WEBP o GIF');
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      onError('La imagen no puede superar 5 MB');
      return;
    }

    // Local preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      const ext = file.name.split('.').pop();
      const filePath = `${userId}/avatar.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      // Update profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) throw updateError;

      setPreview(publicUrl);
      onUploadSuccess(publicUrl);
    } catch (err) {
      console.error('Avatar upload error:', err);
      setPreview(currentAvatarUrl);
      onError('Error al subir la imagen. Inténtalo de nuevo.');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar display */}
      <div className="relative group">
        <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-zinc-700 flex-shrink-0">
          {preview ? (
            <img
              src={preview}
              alt={displayName}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white text-2xl font-bold">
              {initials}
            </div>
          )}
        </div>

        {/* Overlay on hover */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 rounded-2xl bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
        >
          {uploading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <i className="ri-camera-line text-white text-lg"></i>
              <span className="text-white text-xs mt-1 font-medium">Cambiar</span>
            </>
          )}
        </button>
      </div>

      {/* Upload button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
      >
        {uploading ? (
          <><div className="w-3 h-3 border border-zinc-400 border-t-transparent rounded-full animate-spin"></div> Subiendo...</>
        ) : (
          <><i className="ri-upload-2-line"></i> {preview ? 'Cambiar foto' : 'Subir foto'}</>
        )}
      </button>

      <p className="text-xs text-zinc-600 text-center">JPG, PNG, WEBP · Máx. 5 MB</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
