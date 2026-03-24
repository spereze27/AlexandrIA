import { useEffect, useState } from 'react';
import type { FormField } from '../../../types/form';

interface GPSValue {
  lat: number;
  lng: number;
  accuracy?: number;
}

interface Props {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  lang: 'es' | 'en';
}

export default function GPSField({ field, value, onChange, lang }: Props) {
  const gps = value as GPSValue | undefined;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const captureGPS = () => {
    if (!navigator.geolocation) {
      setError(lang === 'es' ? 'GPS no disponible' : 'GPS not available');
      return;
    }

    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLoading(false);
      },
      (err) => {
        setError(
          lang === 'es'
            ? `Error GPS: ${err.message}`
            : `GPS error: ${err.message}`,
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  // Auto-capture on mount if configured
  useEffect(() => {
    if (field.auto_capture && !gps) {
      captureGPS();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {field.label[lang]}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {gps ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-green-600 text-lg">📍</span>
            <span className="text-sm font-medium text-green-800">
              {lang === 'es' ? 'Ubicación capturada' : 'Location captured'}
            </span>
          </div>
          <p className="text-xs text-green-700 font-mono">
            {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
          </p>
          {gps.accuracy && (
            <p className="text-xs text-green-600 mt-0.5">
              {lang === 'es' ? `Precisión: ±${gps.accuracy.toFixed(0)}m` : `Accuracy: ±${gps.accuracy.toFixed(0)}m`}
            </p>
          )}
          <button
            onClick={captureGPS}
            className="text-xs text-green-700 underline mt-2"
          >
            {lang === 'es' ? 'Recapturar' : 'Recapture'}
          </button>
        </div>
      ) : (
        <button
          onClick={captureGPS}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-4 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
              </svg>
              {lang === 'es' ? 'Obteniendo ubicación...' : 'Getting location...'}
            </>
          ) : (
            <>
              <span className="text-lg">📍</span>
              {lang === 'es' ? 'Capturar ubicación GPS' : 'Capture GPS location'}
            </>
          )}
        </button>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
