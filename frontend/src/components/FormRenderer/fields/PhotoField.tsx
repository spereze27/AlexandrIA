import { useRef, useState } from 'react';
import type { FormField } from '../../../types/form';

interface PhotoData {
  dataUrl: string;
  file: File;
  timestamp: string;
  gps?: { lat: number; lng: number };
}

interface Props {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  lang: 'es' | 'en';
}

export default function PhotoField({ field, value, onChange, lang }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const photos = (value as PhotoData[]) || [];
  const maxPhotos = field.max_photos || 1;
  const [capturing, setCapturing] = useState(false);

  const captureGPS = (): Promise<{ lat: number; lng: number } | undefined> => {
    if (!field.metadata?.includes('gps')) return Promise.resolve(undefined);
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(undefined); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(undefined),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setCapturing(true);

    const newPhotos: PhotoData[] = [];
    for (let i = 0; i < files.length && photos.length + newPhotos.length < maxPhotos; i++) {
      const file = files[i];
      const dataUrl = await readFileAsDataUrl(file);
      const gps = await captureGPS();
      newPhotos.push({
        dataUrl,
        file,
        timestamp: new Date().toISOString(),
        gps,
      });
    }

    onChange([...photos, ...newPhotos]);
    setCapturing(false);

    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    onChange(updated.length > 0 ? updated : undefined);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {field.label[lang]}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {photos.map((photo, i) => (
            <div key={i} className="relative group">
              <img
                src={photo.dataUrl}
                alt={`Foto ${i + 1}`}
                className="w-full h-32 object-cover rounded-lg border border-gray-200"
              />
              <button
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
              <div className="absolute bottom-1 left-1 right-1 flex gap-1">
                {photo.timestamp && (
                  <span className="bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {new Date(photo.timestamp).toLocaleTimeString()}
                  </span>
                )}
                {photo.gps && (
                  <span className="bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                    📍 {photo.gps.lat.toFixed(4)}, {photo.gps.lng.toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Capture button */}
      {photos.length < maxPhotos && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            className="hidden"
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={capturing}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-4 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
          >
            {capturing ? (
              'Capturando...'
            ) : (
              <>
                <span className="text-lg">📸</span>
                {lang === 'es' ? 'Tomar foto' : 'Take photo'}
                {maxPhotos > 1 && ` (${photos.length}/${maxPhotos})`}
              </>
            )}
          </button>
        </div>
      )}

      {/* Metadata requirements hint */}
      {field.metadata && field.metadata.length > 0 && (
        <p className="text-xs text-gray-400 mt-1.5">
          {lang === 'es' ? 'Incluye: ' : 'Includes: '}
          {field.metadata.join(', ')}
        </p>
      )}
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
