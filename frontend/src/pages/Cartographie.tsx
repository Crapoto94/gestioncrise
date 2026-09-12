import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { api } from '../services/api';

interface Site {
  id: number | string;
  nom?: string;
  name?: string;
  adresse?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
}

// Centre par défaut (Ivry-sur-Seine) tant qu'aucun site n'est chargé.
const DEFAULT_CENTER: [number, number] = [48.8137, 2.3874];

export function Cartographie() {
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/cartographie/sites').then((r) => setSites(r.data)).catch((e) => setError(e.message));
  }, []);

  const points = sites
    .map((s) => ({ ...s, lat: s.latitude ?? s.lat, lng: s.longitude ?? s.lng }))
    .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number');

  return (
    <div className="p-6 space-y-4 h-full flex flex-col">
      <h1 className="text-2xl font-semibold">Cartographie</h1>
      {error && (
        <div className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded p-3">
          Référentiel des sites (Hub DSI) indisponible dans cet environnement : {error}
        </div>
      )}
      <div className="flex-1 rounded-lg overflow-hidden shadow-sm min-h-[400px]">
        <MapContainer center={DEFAULT_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((s) => (
            <Marker key={s.id} position={[s.lat as number, s.lng as number]}>
              <Popup>
                <strong>{s.nom || s.name}</strong>
                <br />{s.adresse}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
