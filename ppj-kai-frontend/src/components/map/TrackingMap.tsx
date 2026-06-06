'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchRailwayGeometry } from '../../lib/railway';

interface ActiveTracking {
  trackingId: number;
  startTime: string;
  startLat: number | null;
  startLong: number | null;
  lastLat: number | null;
  lastLong: number | null;
  tugas: {
    id: number;
    jalur: string;
    startPointName: string;
    endPointName: string;
    startPointLat: number;
    startPointLong: number;
    endPointLat: number;
    endPointLong: number;
  };
  petugas: { id: number; nama: string; nipp: string; foto: string | null };
}

interface TrackingMapProps {
  trackings: ActiveTracking[];
  selectedId: number | null;
  onSelectTracking?: (id: number) => void;
}

/**
 * Deterministic HSL color from a string (e.g. petugas NIPP).
 */
function petugasColor(nipp: string): string {
  let hash = 0;
  for (let i = 0; i < nipp.length; i++) {
    hash = nipp.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return `hsl(${(Math.abs(hash) * 137) % 360}, 65%, 42%)`;
}

function makeRoutePin(color: string, label: string) {
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:20px;height:20px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;color:white;opacity:0.8">${label}</div>
      <div style="width:2px;height:6px;background:${color};opacity:0.5;border-radius:0 0 2px 2px;"></div>
    </div>`,
    iconSize: [20, 28],
    iconAnchor: [10, 28],
  });
}

export default function TrackingMap({ trackings, selectedId, onSelectTracking }: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routesRef = useRef<L.LayerGroup | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = L.map(containerRef.current, { zoomControl: true, attributionControl: false }).setView([-6.2, 106.8], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
    markersRef.current = L.layerGroup().addTo(mapRef.current);
    routesRef.current = L.layerGroup().addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Update markers when trackings change
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;
    markersRef.current.clearLayers();

    const bounds: L.LatLngExpression[] = [];

    trackings.forEach(track => {
      const lat = track.lastLat ?? track.startLat;
      const lng = track.lastLong ?? track.startLong;
      if (lat == null || lng == null) return;

      const color = petugasColor(track.petugas.nipp);
      const isSelected = track.trackingId === selectedId;
      const size = isSelected ? 48 : 40;
      const innerSize = isSelected ? 20 : 16;
      const pulseSize = isSelected ? 52 : 44;

      // Pulsing petugas marker
      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <div style="position:absolute;width:${pulseSize}px;height:${pulseSize}px;background:${color.replace('42%', '42%').replace(')', ',0.2)')};border-radius:50%;animation:trackPing 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="position:absolute;width:${size}px;height:${size}px;background:${color.replace(')', ',0.15)')};border-radius:50%;${isSelected ? 'animation:trackPing 2s cubic-bezier(0,0,0.2,1) infinite 0.5s;' : ''}"></div>
          <div style="width:${innerSize}px;height:${innerSize}px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);z-index:10;"></div>
        </div>
        <style>@keyframes trackPing{75%,100%{transform:scale(1.8);opacity:0}}</style>`,
        iconSize: [pulseSize, pulseSize],
        iconAnchor: [pulseSize / 2, pulseSize / 2],
      });

      const marker = L.marker([lat, lng], { icon, zIndexOffset: isSelected ? 1000 : 0 })
        .bindTooltip(
          `<div style="text-align:center;">
            <b style="color:${color}">${track.petugas.nama}</b><br>
            <span style="font-size:11px;color:#666">${track.tugas.jalur}</span><br>
            <span style="font-size:10px;color:#999">${track.tugas.startPointName} → ${track.tugas.endPointName}</span>
          </div>`,
          { direction: 'top', offset: [0, -(pulseSize / 2 + 4)] }
        )
        .on('click', () => onSelectTracking?.(track.trackingId))
        .addTo(markersRef.current!);

      bounds.push([lat, lng]);
    });

    // Fit map to bounds if there are trackings
    if (bounds.length > 0 && mapRef.current) {
      if (bounds.length === 1) {
        mapRef.current.setView(bounds[0], 15);
      } else {
        mapRef.current.fitBounds(L.latLngBounds(bounds), { padding: [80, 80], maxZoom: 15 });
      }
    }
  }, [trackings, selectedId]);

  // Draw routes for active trackings
  useEffect(() => {
    if (!routesRef.current || !mapRef.current) return;
    routesRef.current.clearLayers();

    trackings.forEach(track => {
      const color = petugasColor(track.petugas.nipp);
      const layer = routesRef.current!;

      // Route start/end markers (smaller, semi-transparent)
      L.marker([track.tugas.startPointLat, track.tugas.startPointLong], { icon: makeRoutePin(color, 'A') })
        .bindTooltip(`<b>Titik Awal</b><br>${track.tugas.startPointName}`)
        .addTo(layer);
      L.marker([track.tugas.endPointLat, track.tugas.endPointLong], { icon: makeRoutePin(color, 'B') })
        .bindTooltip(`<b>Titik Akhir</b><br>${track.tugas.endPointName}`)
        .addTo(layer);

      // Fetch real railway geometry async
      fetchRailwayGeometry(
        track.tugas.startPointLat, track.tugas.startPointLong,
        track.tugas.endPointLat, track.tugas.endPointLong
      ).then(segments => {
        if (!routesRef.current) return;
        if (segments.length > 0) {
          segments.forEach(seg => {
            L.polyline(seg, { color, weight: 4, opacity: 0.5, dashArray: '8,6' }).addTo(routesRef.current!);
          });
        } else {
          L.polyline(
            [[track.tugas.startPointLat, track.tugas.startPointLong], [track.tugas.endPointLat, track.tugas.endPointLong]],
            { color, weight: 3, dashArray: '10,8', opacity: 0.35 }
          ).addTo(routesRef.current!);
        }
      });
    });
  }, [trackings]);

  // Pan to selected tracking
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const track = trackings.find(t => t.trackingId === selectedId);
    if (!track) return;
    const lat = track.lastLat ?? track.startLat;
    const lng = track.lastLong ?? track.startLong;
    if (lat != null && lng != null) {
      mapRef.current.setView([lat, lng], 16, { animate: true });
    }
  }, [selectedId]);

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
