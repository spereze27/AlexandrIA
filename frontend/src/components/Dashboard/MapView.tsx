import { useCallback, useMemo, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import type { MapPoint } from '../../types/form';

interface Props {
  points: MapPoint[];
}

const SEVERITY_COLORS: Record<string, string> = {
  green: '#16a34a',
  yellow: '#ca8a04',
  red: '#dc2626',
  gray: '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  ready: 'Listo para ejecutar',
  review: 'Requiere revisión',
  not_executable: 'No ejecutable',
  pending: 'Pendiente',
};

const ISSUE_LABELS: Record<string, string> = {
  underground_present: 'Underground presente',
  cable_too_short: 'Cable muy corto',
  pole_poor_condition: 'Poste en mal estado',
  electrical_interference: 'Interferencia eléctrica',
  vegetation: 'Vegetación',
  blocked_access: 'Acceso bloqueado',
  already_completed: 'Ya completado',
};

function createMarkerIcon(color: string): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 10,
  };
}

export default function MapView({ points }: Props) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  // Center map on the centroid of all points, or default to US center
  const center = useMemo(() => {
    if (points.length === 0) return { lat: 39.8283, lng: -98.5795 };
    const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    return { lat: avgLat, lng: avgLng };
  }, [points]);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    if (points.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      map.fitBounds(bounds, 50);
    }
  }, [points]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
        Cargando mapa...
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={center}
      zoom={points.length === 0 ? 4 : 13}
      onLoad={onLoad}
      options={{
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      }}
    >
      {points.map((point) => (
        <Marker
          key={point.submission_id}
          position={{ lat: point.lat, lng: point.lng }}
          icon={createMarkerIcon(SEVERITY_COLORS[point.severity] || SEVERITY_COLORS.gray)}
          onClick={() => setSelectedPoint(point)}
          title={point.pole_id || point.submission_id}
        />
      ))}

      {selectedPoint && (
        <InfoWindow
          position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
          onCloseClick={() => setSelectedPoint(null)}
        >
          <div className="p-1 max-w-xs">
            {/* Header with severity indicator */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: SEVERITY_COLORS[selectedPoint.severity] }}
              />
              <span className="font-semibold text-sm text-gray-900">
                {selectedPoint.pole_id || 'Sin ID'}
              </span>
            </div>

            {/* Status */}
            <p className="text-xs text-gray-600 mb-1">
              <span className="font-medium">Estado:</span>{' '}
              {STATUS_LABELS[selectedPoint.status] || selectedPoint.status}
            </p>

            {/* Coordinates */}
            <p className="text-xs text-gray-400 font-mono mb-1">
              {selectedPoint.lat.toFixed(6)}, {selectedPoint.lng.toFixed(6)}
            </p>

            {/* Issues */}
            {selectedPoint.issues.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-gray-700 mb-1">Problemas:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedPoint.issues.map((issue) => (
                    <span
                      key={issue}
                      className="inline-block bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded"
                    >
                      {ISSUE_LABELS[issue] || issue}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
