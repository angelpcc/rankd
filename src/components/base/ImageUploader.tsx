import { useRef, useState, useCallback } from 'react';

interface Props {
  value: string | null;
  onChange: (file: File) => void;
  onClear?: () => void;
  uploading?: boolean;
  label?: string;
  hint?: string;
  aspectRatio?: 'square' | 'landscape' | 'portrait';
  accentColor?: string;
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;

export default function ImageUploader({
  value,
  onChange,
  onClear,
  uploading = false,
  label = 'Subir imagen',
  hint = 'JPG, PNG o WEBP · Máx. 5 MB',
  aspectRatio = 'landscape',
  accentColor = 'emerald',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const heightClass = aspectRatio === 'square' ? 'aspect-square' : aspectRatio === 'portrait' ? 'aspect-[3/4]' : 'h-44';

  const accentClasses: Record<string, { border: string; text: string; bg: string }> = {
    yellow: { border: 'border-yellow-500/40', text: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    emerald: { border: 'border-emerald-500/40', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    red: { border: 'border-red-500/40', text: 'text-red-400', bg: 'bg-red-500/10' },
  };
  const ac = accentClasses[accentColor] || accentClasses.emerald;

  const validate = (file: File): string | null => {
    if (!ALLOWED.includes(file.type)) return 'Solo JPG, PNG o WEBP';
    if (file.size > MAX_MB * 1024 * 1024) return `Máximo ${MAX_MB} MB`;
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const err = validate(file);
    if (err) { setLocalError(err); return; }
    setLocalError(null);
    onChange(file);
  }, [onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-2">
      {/* Drop zone / preview */}
      <div
        className={`relative ${heightClass} rounded-xl overflow-hidden border-2 border-dashed transition-all cursor-pointer
          ${dragOver ? `${ac.border} ${ac.bg}` : value ? 'border-zinc-700' : 'border-zinc-700 hover:border-zinc-500'}
        `}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {value ? (
          <>
            <img src={value} alt="Preview" className="w-full h-full object-cover object-top" />
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/50 transition-colors flex items-center justify-center group">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-2">
                {uploading ? (
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                      <i className="ri-camera-line text-white text-lg"></i>
                    </div>
                    <span className="text-white text-xs font-semibold">Cambiar imagen</span>
                  </>
                )}
              </div>
            </div>
            {/* Clear button */}
            {onClear && !uploading && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors cursor-pointer z-10"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
            {uploading ? (
              <>
                <div className={`w-10 h-10 border-2 ${ac.text.replace('text-', 'border-')} border-t-transparent rounded-full animate-spin`}></div>
                <span className="text-zinc-400 text-xs">Subiendo imagen...</span>
              </>
            ) : (
              <>
                <div className={`w-12 h-12 flex items-center justify-center rounded-xl ${ac.bg} ${ac.text}`}>
                  <i className="ri-image-add-line text-2xl"></i>
                </div>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${ac.text}`}>{label}</p>
                  <p className="text-zinc-600 text-xs mt-0.5">o arrastra aquí</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {localError && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <i className="ri-error-warning-line"></i>
          {localError}
        </p>
      )}

      {/* Hint */}
      {!localError && (
        <p className="text-xs text-zinc-600">{hint}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
