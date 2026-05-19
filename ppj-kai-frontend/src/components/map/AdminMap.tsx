'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchRailwayGeometry, snapToRailwayPoint } from '../../lib/railway';

interface EmergencyPoint {
  id: number;
  latitude: number;
  longitude: number;
  jenisTemuan: string;
  deskripsi: string;
  foto: string | null;
  createdAt: string;
  petugasNama?: string;
  jalur?: string;
}

interface TaskPoint {
  id: number;
  jalur: string;
  startPointLat: number;
  startPointLong: number;
  endPointLat: number;
  endPointLong: number;
  startPointName: string;
  endPointName: string;
  status: string;
  petugasNama?: string;
  petugasNipp?: string;
}

interface TempMarker { lat: number; lng: number; }

interface AdminMapProps {
  emergencies: EmergencyPoint[];
  tasks: TaskPoint[];
  onEmergencyClick?: (e: EmergencyPoint) => void;
  onMapClick?: (lat: number, lng: number, name: string) => void;
  pickMode?: 'start' | 'end' | null;
  tempStart?: TempMarker;
  tempEnd?: TempMarker;
}

// Keep for sidebar status badges
const STATUS_COLOR: Record<string, string> = {
  pending: '#94a3b8',
  in_progress: '#005bac',
  completed: '#22c55e',
};

/**
 * Deterministic HSL color from a string (e.g. petugas NIPP).
 * Same NIPP → same hue always. Different NIPPs → visually distinct hues.
 */
function petugasColor(nipp: string): string {
  let hash = 0;
  for (let i = 0; i < nipp.length; i++) {
    hash = nipp.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  // Use golden angle (137.5°) distribution for maximum perceptual spread
  const hue = ((Math.abs(hash) * 137) % 360);
  return `hsl(${hue}, 65%, 42%)`;
}

function makePin(color: string, label: string) {
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:28px;height:28px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:white">${label}</div>
      <div style="width:3px;height:10px;background:${color};opacity:0.7;border-radius:0 0 2px 2px;"></div>
    </div>`,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
  });
}

// snapToRailway and fetchRailwayGeometry are imported from lib/railway.ts
// which has automatic failover to multiple Overpass API mirrors

export default function AdminMap({ emergencies, tasks, onEmergencyClick, onMapClick, pickMode, tempStart, tempEnd }: AdminMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const tempLayerRef = useRef<L.LayerGroup | null>(null);
  const [snapping, setSnapping] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, { zoomControl: true, attributionControl: false }).setView([-6.2, 106.8], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
    layerGroupRef.current = L.layerGroup().addTo(mapRef.current);
    tempLayerRef.current = L.layerGroup().addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Handle map click with railway snap
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const handleClick = async (e: L.LeafletMouseEvent) => {
      if (!pickMode || !onMapClick) return;

      setSnapError(null);
      setSnapping(true);
      map.getContainer().style.cursor = 'wait';

      try {
        const snapped = await snapToRailwayPoint(e.latlng.lat, e.latlng.lng);

        if (snapped) {
          onMapClick(snapped.lat, snapped.lng, snapped.name);
        } else {
          // Fallback to raw coordinates
          onMapClick(e.latlng.lat, e.latlng.lng, 'Titik Manual');
        }
      } catch (err) {
        console.error('Map click snap error:', err);
        onMapClick(e.latlng.lat, e.latlng.lng, 'Titik Manual');
      } finally {
        setSnapping(false);
        map.getContainer().style.cursor = pickMode ? 'crosshair' : '';
      }
    };

    map.on('click', handleClick);
    return () => { map.off('click', handleClick); };
  }, [pickMode, onMapClick]);

  // Cursor style
  useEffect(() => {
    if (!mapRef.current || snapping) return;
    mapRef.current.getContainer().style.cursor = pickMode ? 'crosshair' : '';
  }, [pickMode, snapping]);

  // Geometry cache — persists across re-renders, keyed by task coordinates
  const geometryCacheRef = useRef<Map<string, [number, number][][]>>(new Map());

  // Draw task routes + emergency markers
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;
    layerGroupRef.current.clearLayers();

    // Draw markers immediately, then load real railway geometry per task async
    tasks.forEach(task => {
      // Use petugas color as primary identifier; status shown via line style
      const color = task.petugasNipp ? petugasColor(task.petugasNipp) : (STATUS_COLOR[task.status] ?? '#94a3b8');
      const opacity = task.status === 'completed' ? 0.45 : 0.85;
      const dash = task.status === 'pending' ? '10,6' : undefined;
      const layer = layerGroupRef.current!;

      // A/B markers with petugas color
      L.marker([task.startPointLat, task.startPointLong], { icon: makePin(color, 'A') })
        .bindTooltip(
          `<b>${task.startPointName || 'Awal'}</b><br>
           <span style="font-size:11px;color:${color};font-weight:600">${task.petugasNama || ''}</span>`
        )
        .addTo(layer);

      L.marker([task.endPointLat, task.endPointLong], { icon: makePin(color, 'B') })
        .bindTooltip(`<b>${task.endPointName || 'Akhir'}</b>`)
        .addTo(layer);

      // Cache key based on start/end coordinates
      const cacheKey = `${task.startPointLat},${task.startPointLong}-${task.endPointLat},${task.endPointLong}`;
      const cached = geometryCacheRef.current.get(cacheKey);

      const drawRoute = (segments: [number, number][][]) => {
        if (!layerGroupRef.current || segments.length === 0) return;
        segments.forEach(seg => {
          L.polyline(seg, { color, weight: 5, opacity, dashArray: dash }).addTo(layerGroupRef.current!);
        });
      };

      if (cached) {
        // Use cached geometry — no API call
        drawRoute(cached);
      } else {
        // Fetch and cache (only cache non-empty results)
        fetchRailwayGeometry(
          task.startPointLat, task.startPointLong,
          task.endPointLat, task.endPointLong
        ).then(segments => {
          if (segments.length > 0) {
            geometryCacheRef.current.set(cacheKey, segments);
          }
          drawRoute(segments);
        });
      }
    });

    emergencies.forEach(em => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:36px;height:36px;background:rgba(220,38,38,0.2);border-radius:50%;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></div>
          <div style="width:22px;height:22px;background:#dc2626;border:2.5px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:10;font-size:12px;color:white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">⚠</div>
        </div><style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      L.marker([em.latitude, em.longitude], { icon })
        .on('click', () => onEmergencyClick?.(em))
        .bindTooltip(`<b>⚠ ${em.jenisTemuan}</b><br><span style="font-size:11px">${em.petugasNama || ''}</span>`)
        .addTo(layerGroupRef.current!);
    });
  }, [emergencies, tasks]);

  // Draw temp markers for task assignment preview
  useEffect(() => {
    if (!tempLayerRef.current) return;
    tempLayerRef.current.clearLayers();
    setLoadingRoute(false);

    if (tempStart) {
      L.marker([tempStart.lat, tempStart.lng], { icon: makePin('#16a34a', 'A') })
        .bindTooltip('<b>Titik Awal</b>', { permanent: true, direction: 'top', offset: [0, -38] })
        .addTo(tempLayerRef.current);
    }

    if (tempEnd) {
      L.marker([tempEnd.lat, tempEnd.lng], { icon: makePin('#dc2626', 'B') })
        .bindTooltip('<b>Titik Akhir</b>', { permanent: true, direction: 'top', offset: [0, -38] })
        .addTo(tempLayerRef.current);
    }

    if (tempStart && tempEnd) {
      mapRef.current?.fitBounds(
        L.latLngBounds([tempStart.lat, tempStart.lng], [tempEnd.lat, tempEnd.lng]),
        { padding: [60, 60] }
      );

      // Fetch real railway geometry
      setLoadingRoute(true);
      const layer = tempLayerRef.current;
      fetchRailwayGeometry(tempStart.lat, tempStart.lng, tempEnd.lat, tempEnd.lng)
        .then(segments => {
          if (!layer) return;
          if (segments.length > 0) {
            segments.forEach(seg => {
              L.polyline(seg, { color: '#005bac', weight: 4, opacity: 0.8 }).addTo(layer);
            });
          }
        })
        .finally(() => setLoadingRoute(false));
    } else if (tempStart) {
      mapRef.current?.setView([tempStart.lat, tempStart.lng], 15);
    } else if (tempEnd) {
      mapRef.current?.setView([tempEnd.lat, tempEnd.lng], 15);
    }
  }, [tempStart, tempEnd]);

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />

      {/* Fetching railway geometry */}
      {loadingRoute && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface/95 backdrop-blur-sm rounded-full px-lg py-xs shadow-md flex items-center gap-sm font-label-sm text-on-surface z-[500] pointer-events-none">
          <span className="material-symbols-outlined text-primary text-[14px] animate-spin">refresh</span>
          Memuat jalur rel...
        </div>
      )}

      {/* Snapping loading overlay */}
      {snapping && (
        <div className="absolute inset-0 flex items-end justify-center pb-16 pointer-events-none z-[500]">
          <div className="bg-surface/95 backdrop-blur-sm rounded-full px-lg py-sm shadow-lg flex items-center gap-sm font-label-sm text-on-surface">
            <span className="material-symbols-outlined text-primary text-[16px] animate-spin">refresh</span>
            Mendeteksi jalur rel terdekat...
          </div>
        </div>
      )}

      {/* Error toast */}
      {snapError && (
        <div className="absolute inset-0 flex items-end justify-center pb-16 pointer-events-none z-[500]">
          <div className="bg-error text-on-error rounded-xl px-lg py-sm shadow-lg flex items-center gap-sm font-label-sm max-w-xs text-center">
            <span className="material-symbols-outlined text-[16px] shrink-0">warning</span>
            {snapError}
          </div>
        </div>
      )}
    </div>
  );
}
