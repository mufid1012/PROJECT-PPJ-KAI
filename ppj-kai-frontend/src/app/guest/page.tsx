'use client';

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import api from '../../lib/api';

// Deterministic color from NIPP
function petugasColor(nipp: string): string {
  let hash = 0;
  for (let i = 0; i < nipp.length; i++) {
    hash = nipp.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return `hsl(${(Math.abs(hash) * 137) % 360}, 65%, 42%)`;
}

const AdminMap = dynamic(() => import('../../components/map/AdminMap'), { ssr: false });

interface Tugas {
  id: number;
  jalur: string;
  tanggal: string;
  startPointLat: number;
  startPointLong: number;
  endPointLat: number;
  endPointLong: number;
  startPointName: string;
  endPointName: string;
  status: string;
  user: { nama: string; nipp: string };
}

interface Emergency {
  id: number;
  latitude: number;
  longitude: number;
  jenisTemuan: string;
  deskripsi: string;
  foto: string | null;
  createdAt: string;
  tracking?: {
    tugas: {
      jalur: string;
      user: { nama: string; nipp: string };
    };
  };
}

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

const JENIS_LABEL: Record<string, string> = { berat: 'Baut Lepas', emergency: 'Rel Retak', sedang: 'Penghalang', ringan: 'Lainnya' };

export default function GuestPage() {
  const [activeTrackings, setActiveTrackings] = useState<ActiveTracking[]>([]);
  const [tasks, setTasks] = useState<Tugas[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [selectedEmergency, setSelectedEmergency] = useState<Emergency | null>(null);
  const [selectedTracking, setSelectedTracking] = useState<ActiveTracking | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMonitoringData = useCallback(async () => {
    try {
      const res = await api.get('/guest/monitoring');
      if (res.data.success) {
        setActiveTrackings(res.data.data.activeTrackings || []);
        setTasks(res.data.data.tasks || []);
        setEmergencies(res.data.data.emergencies || []);
      }
    } catch (e) {
      console.error('Failed to fetch guest monitoring data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchMonitoringData]);

  const formatElapsed = (startTime: string) => {
    const ms = Date.now() - new Date(startTime).getTime();
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return h > 0 ? `${h}j ${m}m` : `${m}m`;
  };

  const mapEmergencies = emergencies.map(e => ({
    id: e.id,
    latitude: e.latitude,
    longitude: e.longitude,
    jenisTemuan: e.jenisTemuan,
    deskripsi: e.deskripsi,
    foto: e.foto,
    createdAt: e.createdAt,
    petugasNama: e.tracking?.tugas?.user?.nama,
    jalur: e.tracking?.tugas?.jalur
  }));

  const mapTasks = tasks.map(t => ({
    id: t.id,
    jalur: t.jalur,
    startPointLat: t.startPointLat,
    startPointLong: t.startPointLong,
    endPointLat: t.endPointLat,
    endPointLong: t.endPointLong,
    startPointName: t.startPointName,
    endPointName: t.endPointName,
    status: t.status,
    petugasNama: t.user?.nama,
    petugasNipp: t.user?.nipp
  }));

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* ===== HEADER ===== */}
      <header className="h-[60px] bg-slate-900 border-b border-slate-800 flex items-center justify-between px-lg shrink-0 z-50">
        <div className="flex items-center gap-md">
          <img src="/logo-kai.png" alt="KAI Logo" className="h-9 w-auto object-contain brightness-95" />
          <div>
            <h1 className="font-h3 text-[18px] font-bold text-slate-100 leading-tight">RailTrack PPJ</h1>
            <p className="font-label-sm text-[9px] text-emerald-400 uppercase tracking-widest font-semibold">Pantauan Publik (Guest)</p>
          </div>
        </div>
        <div className="flex items-center gap-md">
          <div className="flex items-center gap-xs bg-slate-800 border border-slate-700 px-sm py-xs rounded-full font-label-sm text-[11px] text-slate-300">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            {activeTrackings.length} Live Inspeksi
          </div>
        </div>
      </header>

      {/* ===== CONTENT AREA ===== */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside className="w-80 bg-slate-950 border-r border-slate-800 flex flex-col overflow-hidden shrink-0 text-slate-100 z-10">
          <div className="p-md border-b border-slate-800 bg-slate-900/40">
            <h2 className="font-h3 text-h3 font-bold text-slate-100 flex items-center gap-sm">
              <span className="material-symbols-outlined text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
              Live Monitoring
            </h2>
            <p className="font-body-md text-slate-400 text-xs mt-1">Status dan jalur patroli petugas PPJ saat ini.</p>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-950">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-xs">
                <span className="material-symbols-outlined animate-spin text-[32px] text-emerald-400">refresh</span>
                <p className="text-xs">Memuat data...</p>
              </div>
            ) : activeTrackings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-xl px-md text-center">
                <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-md border border-slate-800">
                  <span className="material-symbols-outlined text-[32px] text-slate-400">person_off</span>
                </div>
                <p className="font-body-md text-slate-300 font-semibold mb-xs">Tidak Ada Petugas Aktif</p>
                <p className="font-body-md text-xs text-slate-500">Saat ini tidak ada inspeksi jalur yang berlangsung.</p>
              </div>
            ) : (
              <div className="p-sm space-y-sm">
                {activeTrackings.map(track => {
                  const color = petugasColor(track.petugas.nipp);
                  const isSelected = selectedTracking?.trackingId === track.trackingId;
                  return (
                    <button key={track.trackingId} onClick={() => setSelectedTracking(isSelected ? null : track)}
                      className={`w-full text-left rounded-xl p-md border-2 transition-all duration-200 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-950/20 shadow-md'
                          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                      }`}>
                      <div className="flex items-center gap-sm mb-sm">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white shadow-md" style={{ background: color }}>
                          {track.petugas.nama.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-label-sm font-semibold text-slate-200 truncate text-sm">{track.petugas.nama}</p>
                          <p className="font-label-sm text-[10px] text-slate-500">{track.petugas.nipp}</p>
                        </div>
                        <div className="flex items-center gap-xs shrink-0 bg-slate-800 px-xs py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          <span className="font-label-sm text-[9px] text-emerald-400 font-bold uppercase">Live</span>
                        </div>
                      </div>
                      <div className="bg-slate-950/50 rounded-lg p-sm space-y-xs border border-slate-800/80">
                        <div className="flex items-center gap-xs">
                          <span className="material-symbols-outlined text-[14px] text-emerald-400">route</span>
                          <span className="font-label-sm text-[11px] text-slate-300 font-semibold truncate">{track.tugas.jalur}</span>
                        </div>
                        <p className="font-label-sm text-[10px] text-slate-500 pl-[18px]">{track.tugas.startPointName} → {track.tugas.endPointName}</p>
                      </div>
                      <div className="flex items-center justify-between mt-sm pt-sm border-t border-slate-800">
                        <div className="flex items-center gap-xs text-slate-400">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          <span className="font-label-sm text-[10px]">Durasi: <b className="text-slate-200">{formatElapsed(track.startTime)}</b></span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="p-sm border-t border-slate-800 bg-slate-900/20 text-center">
            <span className="font-label-sm text-[9px] text-slate-600 tracking-wider">REFRESHING AUTOMATICALLY • SECURED PORTAL</span>
          </div>
        </aside>

        {/* Map View */}
        <main className="flex-1 relative overflow-hidden isolate">
          <AdminMap 
            emergencies={mapEmergencies} 
            tasks={mapTasks}
            onEmergencyClick={(em) => setSelectedEmergency(emergencies.find(e => e.id === em.id) || null)}
          />
          <div className="absolute bottom-4 left-4 bg-slate-950/90 border border-slate-800 backdrop-blur-sm rounded-xl p-sm shadow-lg text-[10px] font-label-sm z-[1000] space-y-xs text-slate-300">
            <p className="text-slate-400 uppercase font-bold mb-xs text-[9px] tracking-wider">Legend</p>
            {[['#94a3b8','Pending'],['#005bac','Berlangsung'],['#22c55e','Selesai']].map(([c,l]) => (
              <div key={l} className="flex items-center gap-xs">
                <div className="w-4 h-1 rounded" style={{ background: c }} />
                <span className="text-slate-300">{l}</span>
              </div>
            ))}
            <div className="flex items-center gap-xs">
              <span className="text-error">⚠</span>
              <span className="text-slate-300">Darurat</span>
            </div>
          </div>
          <div className="absolute top-4 right-4 bg-slate-950/80 border border-slate-800 backdrop-blur-sm rounded-full px-sm py-xs text-[10px] text-slate-300 font-label-sm flex items-center gap-xs z-[1000]">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Live • {activeTrackings.length} petugas
          </div>
        </main>
      </div>

      {/* ===== EMERGENCY DETAIL MODAL ===== */}
      {selectedEmergency && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-md animate-in fade-in duration-200" onClick={() => setSelectedEmergency(null)}>
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden text-slate-200" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-red-700 to-red-600 px-md py-sm flex items-center justify-between">
              <h3 className="font-h3 text-h3 text-white flex items-center gap-sm">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                Laporan Darurat
              </h3>
              <button onClick={() => setSelectedEmergency(null)} className="text-white/70 hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            {selectedEmergency.foto && <img src={selectedEmergency.foto} alt="" className="w-full aspect-video object-cover border-b border-slate-850" />}
            <div className="p-md space-y-sm">
              <div className="flex justify-between items-center">
                <span className="bg-red-950/50 text-red-400 border border-red-800 px-sm py-xs rounded-full font-label-sm text-[11px] uppercase font-bold">
                  {JENIS_LABEL[selectedEmergency.jenisTemuan] ?? selectedEmergency.jenisTemuan}
                </span>
                <span className="font-label-sm text-[11px] text-slate-400">
                  {new Date(selectedEmergency.createdAt).toLocaleString('id-ID')}
                </span>
              </div>
              {selectedEmergency.deskripsi && <p className="font-body-md text-slate-300 text-sm leading-relaxed">{selectedEmergency.deskripsi}</p>}
              <div className="bg-slate-950/60 rounded-xl p-sm space-y-xs border border-slate-850">
                <p className="font-label-sm text-[9px] text-slate-500 uppercase tracking-wider">Petugas PPJ</p>
                <p className="font-body-md text-slate-200 text-xs font-semibold">{selectedEmergency.tracking?.tugas?.user?.nama} — {selectedEmergency.tracking?.tugas?.user?.nipp}</p>
                <p className="font-label-sm text-[9px] text-slate-500 uppercase tracking-wider mt-xs">Jalur</p>
                <p className="font-body-md text-slate-200 text-xs font-semibold">{selectedEmergency.tracking?.tugas?.jalur}</p>
                <p className="font-label-sm text-[9px] text-slate-500 uppercase tracking-wider mt-xs">Koordinat GPS</p>
                <p className="font-body-md text-slate-200 text-xs font-mono">{selectedEmergency.latitude.toFixed(6)}, {selectedEmergency.longitude.toFixed(6)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
