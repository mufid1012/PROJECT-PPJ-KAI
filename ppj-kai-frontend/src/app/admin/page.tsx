'use client';

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import api from '../../lib/api';
import { useRouter } from 'next/navigation';

// Same deterministic color as AdminMap — NIPP → unique HSL color
function petugasColor(nipp: string): string {
  let hash = 0;
  for (let i = 0; i < nipp.length; i++) {
    hash = nipp.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return `hsl(${(Math.abs(hash) * 137) % 360}, 65%, 42%)`;
}

const AdminMap = dynamic(() => import('../../components/map/AdminMap'), { ssr: false });

interface Petugas { id: number; nipp: string; nama: string; tugasPpj: { id: number; jalur: string; status: string }[] }
interface Tugas { id: number; jalur: string; tanggal: string; startPointLat: number; startPointLong: number; endPointLat: number; endPointLong: number; startPointName: string; endPointName: string; status: string; user: { nama: string; nipp: string } }
interface Emergency { id: number; latitude: number; longitude: number; jenisTemuan: string; deskripsi: string; foto: string | null; createdAt: string; tracking: { tugas: { jalur: string; user: { nama: string; nipp: string } } } }
interface Stats { totalPetugas: number; tugasAktif: number; tugasSelesai: number; laporanDarurat: number }

const STATUS_COLOR: Record<string, string> = { pending: 'bg-surface-container text-on-surface-variant border-outline-variant', in_progress: 'bg-primary-container/20 text-primary border-primary/30', completed: 'bg-primary-fixed text-on-primary-fixed-variant border-transparent' };
const STATUS_LABEL: Record<string, string> = { pending: 'Pending', in_progress: 'Berlangsung', completed: 'Selesai' };
const JENIS_LABEL: Record<string, string> = { berat: 'Baut Lepas', emergency: 'Rel Retak', sedang: 'Penghalang', ringan: 'Lainnya' };

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ nama: string } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [petugas, setPetugas] = useState<Petugas[]>([]);
  const [tugas, setTugas] = useState<Tugas[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [selectedEmergency, setSelectedEmergency] = useState<Emergency | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'tasks' | 'emergency'>('map');

  // Task form state
  const [form, setForm] = useState({ jalur: '', tanggal: '', assignedTo: '', startPointName: '', endPointName: '', startPointLat: '', startPointLong: '', endPointLat: '', endPointLong: '' });
  const [pickMode, setPickMode] = useState<'start' | 'end' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, petugasRes, tugasRes, emRes] = await Promise.all([
        api.get('/admin/stats'), api.get('/admin/petugas'), api.get('/admin/tugas'), api.get('/admin/emergency'),
      ]);
      setStats(statsRes.data.data);
      setPetugas(petugasRes.data.data);
      setTugas(tugasRes.data.data);
      setEmergencies(emRes.data.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) setUser(JSON.parse(userStr));
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleLogout = () => { localStorage.clear(); router.push('/login'); };

  const handleMapClick = (lat: number, lng: number, name: string) => {
    if (!pickMode) return;
    if (pickMode === 'start') {
      setForm(f => ({
        ...f,
        startPointLat: lat.toFixed(6),
        startPointLong: lng.toFixed(6),
        startPointName: f.startPointName || name, // auto-fill if empty
      }));
    } else {
      setForm(f => ({
        ...f,
        endPointLat: lat.toFixed(6),
        endPointLong: lng.toFixed(6),
        endPointName: f.endPointName || name, // auto-fill if empty
      }));
    }
    setPickMode(null);
    setShowTaskModal(true);
  };

  const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
  };

  const handleCreateTugas = async () => {
    if (!form.jalur || !form.tanggal || !form.assignedTo || !form.startPointLat || !form.endPointLat) { alert('Lengkapi semua field dan titik di peta!'); return; }
    try {
      setSubmitting(true);
      await api.post('/admin/tugas', form);
      setShowTaskModal(false);
      setForm({ jalur: '', tanggal: '', assignedTo: '', startPointName: '', endPointName: '', startPointLat: '', startPointLong: '', endPointLat: '', endPointLong: '' });
      fetchAll();
    } catch (e) { console.error(e); alert('Gagal membuat tugas.'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteTugas = async (id: number) => {
    if (!confirm('Hapus tugas ini?')) return;
    try { await api.delete(`/admin/tugas/${id}`); fetchAll(); } catch { alert('Gagal menghapus.'); }
  };

  const mapEmergencies = emergencies.map(e => ({ id: e.id, latitude: e.latitude, longitude: e.longitude, jenisTemuan: e.jenisTemuan, deskripsi: e.deskripsi, foto: e.foto, createdAt: e.createdAt, petugasNama: e.tracking?.tugas?.user?.nama, jalur: e.tracking?.tugas?.jalur }));
  const mapTasks = tugas.map(t => ({ id: t.id, jalur: t.jalur, startPointLat: t.startPointLat, startPointLong: t.startPointLong, endPointLat: t.endPointLat, endPointLong: t.endPointLong, startPointName: t.startPointName, endPointName: t.endPointName, status: t.status, petugasNama: t.user?.nama, petugasNipp: t.user?.nipp }));

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-surface border-b border-outline-variant flex items-center justify-between px-lg shrink-0 z-50">
        <div className="flex items-center gap-sm">
          <img src="/logo-kai.png" alt="KAI Logo" className="h-8 w-auto object-contain" />
          <h1 className="font-h3 text-h3 font-bold text-primary">RailTrack Admin</h1>
          <span className="ml-sm px-sm py-0.5 bg-error-container text-on-error-container font-label-sm text-[10px] rounded-full uppercase">Admin</span>
        </div>
        <div className="flex items-center gap-md">
          <span className="font-body-md text-on-surface-variant hidden sm:block">{user?.nama}</span>
          <button onClick={handleLogout} className="flex items-center gap-xs text-on-surface-variant hover:text-error transition-colors font-label-sm">
            <span className="material-symbols-outlined text-[18px]">logout</span> Keluar
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-surface border-r border-outline-variant flex flex-col overflow-hidden shrink-0">
          {/* Stats */}
          <div className="p-md grid grid-cols-2 gap-sm border-b border-outline-variant">
            {[
              { label: 'Petugas', value: stats?.totalPetugas ?? '-', icon: 'group', color: 'text-primary' },
              { label: 'Tugas Aktif', value: stats?.tugasAktif ?? '-', icon: 'task_alt', color: 'text-primary' },
              { label: 'Selesai', value: stats?.tugasSelesai ?? '-', icon: 'check_circle', color: 'text-primary' },
              { label: 'Darurat', value: stats?.laporanDarurat ?? '-', icon: 'emergency', color: 'text-error' },
            ].map(s => (
              <div key={s.label} className="bg-surface-container-lowest rounded-lg p-sm border border-outline-variant">
                <div className="flex items-center gap-xs text-on-surface-variant mb-xs">
                  <span className={`material-symbols-outlined text-[14px] ${s.color}`}>{s.icon}</span>
                  <span className="font-label-sm text-[10px] uppercase">{s.label}</span>
                </div>
                <div className={`font-h3 text-h3 font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-outline-variant shrink-0">
            {(['map', 'tasks', 'emergency'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-sm font-label-sm text-label-sm capitalize transition-colors ${activeTab === tab ? 'text-primary border-b-2 border-primary bg-primary-container/10' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
                {tab === 'map' ? 'Petugas' : tab === 'tasks' ? 'Tugas' : 'Darurat'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Petugas Tab */}
            {activeTab === 'map' && (
              <div className="p-md space-y-sm">
                {petugas.map(p => {
                  const aktif = p.tugasPpj.find(t => t.status === 'in_progress');
                  const color = petugasColor(p.nipp);
                  return (
                    <div key={p.id} className="bg-surface-container-lowest rounded-lg p-sm border border-outline-variant flex items-center gap-sm">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white" style={{ background: color }}>
                        {p.nama.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-label-sm font-semibold text-on-surface truncate">{p.nama}</p>
                        <p className="font-label-sm text-[10px] text-on-surface-variant">{p.nipp}</p>
                      </div>
                      <span className={`px-xs py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${aktif ? 'bg-primary-container/20 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                        {aktif ? 'Aktif' : 'Idle'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === 'tasks' && (
              <div className="flex flex-col h-full">
                <div className="p-sm border-b border-outline-variant">
                  <button onClick={() => setShowTaskModal(true)} className="w-full py-sm bg-primary text-on-primary rounded-lg font-label-sm flex items-center justify-center gap-xs hover:opacity-90 transition-opacity">
                    <span className="material-symbols-outlined text-[16px]">add</span> Buat Tugas Baru
                  </button>
                </div>
                <div className="overflow-y-auto flex-1 p-sm space-y-sm">
                  {tugas.map(t => (
                    <div key={t.id} className="bg-surface-container-lowest rounded-lg p-sm border border-outline-variant">
                      <div className="flex justify-between items-start gap-xs mb-xs">
                        <p className="font-label-sm font-semibold text-on-surface text-[11px] leading-tight">{t.jalur}</p>
                        <button onClick={() => handleDeleteTugas(t.id)} className="text-on-surface-variant hover:text-error shrink-0">
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                      <p className="font-label-sm text-[10px] text-primary">{t.user?.nama}</p>
                      <div className="flex items-center justify-between mt-xs">
                        <span className={`px-xs py-0.5 rounded-full text-[9px] font-bold uppercase border ${STATUS_COLOR[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                        <span className="font-label-sm text-[10px] text-on-surface-variant">
                          {haversineKm(t.startPointLat, t.startPointLong, t.endPointLat, t.endPointLong)} km
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Emergency Tab */}
            {activeTab === 'emergency' && (
              <div className="p-sm space-y-sm">
                {emergencies.length === 0 && <p className="text-center text-on-surface-variant font-body-md py-lg">Tidak ada laporan darurat.</p>}
                {emergencies.map(e => (
                  <button key={e.id} onClick={() => setSelectedEmergency(e)} className="w-full text-left bg-surface-container-lowest rounded-lg border border-outline-variant overflow-hidden hover:border-error/40 transition-colors">
                    {e.foto && <img src={e.foto} alt="foto darurat" className="w-full h-20 object-cover" />}
                    <div className="p-sm">
                      <div className="flex items-center justify-between mb-xs">
                        <span className="bg-error-container/30 text-error font-label-sm text-[10px] px-xs py-0.5 rounded-full uppercase font-bold">{JENIS_LABEL[e.jenisTemuan] ?? e.jenisTemuan}</span>
                        <span className="text-on-surface-variant font-label-sm text-[10px]">{new Date(e.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="font-label-sm text-[11px] text-on-surface">{e.tracking?.tugas?.user?.nama}</p>
                      <p className="font-label-sm text-[10px] text-on-surface-variant">{e.latitude.toFixed(5)}, {e.longitude.toFixed(5)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Map Area */}
        <main className="flex-1 relative overflow-hidden isolate">
          <AdminMap
            emergencies={mapEmergencies}
            tasks={mapTasks}
            onEmergencyClick={(em) => { setSelectedEmergency(emergencies.find(e => e.id === em.id) || null); setActiveTab('emergency'); }}
            onMapClick={handleMapClick}
            pickMode={pickMode}
            tempStart={form.startPointLat ? { lat: parseFloat(form.startPointLat), lng: parseFloat(form.startPointLong) } : undefined}
            tempEnd={form.endPointLat ? { lat: parseFloat(form.endPointLat), lng: parseFloat(form.endPointLong) } : undefined}
          />

          {/* Pick Mode Banner */}
          {pickMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-lg py-sm rounded-full shadow-lg font-label-sm flex items-center gap-sm z-[1000]">
              <span className="material-symbols-outlined text-[16px]">my_location</span>
              Klik peta untuk titik {pickMode === 'start' ? 'AWAL (Hijau)' : 'AKHIR (Merah)'}
              <button onClick={() => setPickMode(null)} className="ml-sm text-on-primary/70 hover:text-on-primary"><span className="material-symbols-outlined text-[16px]">close</span></button>
            </div>
          )}

          {/* Map Legend */}
          <div className="absolute bottom-4 left-4 bg-surface/90 backdrop-blur-sm rounded-xl p-sm shadow-lg text-[10px] font-label-sm z-[1000] space-y-xs">
            <p className="text-on-surface-variant uppercase font-bold mb-xs">Legend</p>
            {[['#94a3b8','Pending'],['#005bac','Berlangsung'],['#22c55e','Selesai']].map(([c,l]) => (
              <div key={l} className="flex items-center gap-xs"><div className="w-4 h-1 rounded" style={{ background: c }} /><span className="text-on-surface">{l}</span></div>
            ))}
            <div className="flex items-center gap-xs"><span className="text-error">⚠</span><span className="text-on-surface">Darurat</span></div>
          </div>

          {/* Auto-refresh indicator */}
          <div className="absolute top-4 right-4 bg-surface/80 backdrop-blur-sm rounded-full px-sm py-xs text-[10px] text-on-surface-variant font-label-sm flex items-center gap-xs z-[1000]">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Auto-refresh 15s
          </div>
        </main>
      </div>

      {/* Emergency Detail Panel */}
      {selectedEmergency && (
        <div className="fixed inset-0 z-[9999] bg-on-surface/50 backdrop-blur-sm flex items-center justify-center p-md">
          <div className="bg-surface w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-error px-md py-sm flex items-center justify-between">
              <h3 className="font-h3 text-h3 text-on-error flex items-center gap-sm">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                Laporan Darurat
              </h3>
              <button onClick={() => setSelectedEmergency(null)} className="text-on-error/80 hover:text-on-error"><span className="material-symbols-outlined">close</span></button>
            </div>
            {selectedEmergency.foto && <img src={selectedEmergency.foto} alt="darurat" className="w-full aspect-video object-cover" />}
            <div className="p-md space-y-sm">
              <div className="flex justify-between items-center">
                <span className="bg-error-container text-error px-sm py-xs rounded-full font-label-sm text-[11px] uppercase font-bold">{JENIS_LABEL[selectedEmergency.jenisTemuan] ?? selectedEmergency.jenisTemuan}</span>
                <span className="font-label-sm text-[11px] text-on-surface-variant">{new Date(selectedEmergency.createdAt).toLocaleString('id-ID')}</span>
              </div>
              {selectedEmergency.deskripsi && <p className="font-body-md text-on-surface">{selectedEmergency.deskripsi}</p>}
              <div className="bg-surface-container-low rounded-lg p-sm space-y-xs">
                <p className="font-label-sm text-[10px] text-on-surface-variant uppercase">Petugas</p>
                <p className="font-body-md text-on-surface">{selectedEmergency.tracking?.tugas?.user?.nama} — {selectedEmergency.tracking?.tugas?.user?.nipp}</p>
                <p className="font-label-sm text-[10px] text-on-surface-variant uppercase mt-xs">Jalur</p>
                <p className="font-body-md text-on-surface">{selectedEmergency.tracking?.tugas?.jalur}</p>
                <p className="font-label-sm text-[10px] text-on-surface-variant uppercase mt-xs">Koordinat GPS</p>
                <p className="font-body-md text-on-surface font-mono">{selectedEmergency.latitude.toFixed(6)}, {selectedEmergency.longitude.toFixed(6)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-[9999] bg-on-surface/50 backdrop-blur-sm flex items-center justify-center p-md">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-primary px-md py-sm flex items-center justify-between shrink-0">
              <h3 className="font-h3 text-h3 text-on-primary flex items-center gap-sm"><span className="material-symbols-outlined">add_task</span> Buat Tugas Baru</h3>
              <button onClick={() => { setShowTaskModal(false); setPickMode(null); }} className="text-on-primary/80 hover:text-on-primary"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="overflow-y-auto p-md space-y-md flex-1">
              {/* Petugas */}
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-xs">Pilih Petugas</label>
                <select value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} className="w-full border border-outline-variant rounded-lg p-sm font-body-md text-on-surface bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none">
                  <option value="">-- Pilih Petugas --</option>
                  {petugas.map(p => <option key={p.id} value={p.id}>{p.nama} ({p.nipp})</option>)}
                </select>
              </div>

              {/* Nama Jalur */}
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-xs">Nama Jalur</label>
                <input value={form.jalur} onChange={e => setForm(f => ({ ...f, jalur: e.target.value }))} placeholder="Jalur Utama Jakarta-Bandung" className="w-full border border-outline-variant rounded-lg p-sm font-body-md text-on-surface bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" />
              </div>

              {/* Tanggal */}
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-xs">Tanggal Inspeksi</label>
                <input type="date" value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} className="w-full border border-outline-variant rounded-lg p-sm font-body-md text-on-surface bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" />
              </div>

              {/* Point Picker */}
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-xs">Titik Jalur — klik tombol lalu klik peta</label>
                <div className="grid grid-cols-2 gap-sm">
                  <div className="flex flex-col gap-xs">
                    <button onClick={() => { setShowTaskModal(false); setPickMode('start'); }} className="py-sm rounded-lg border-2 border-dashed border-primary/40 bg-primary-container/10 text-primary font-label-sm text-[11px] flex items-center justify-center gap-xs hover:bg-primary-container/20 transition-colors">
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      {form.startPointLat ? '✓ Titik Awal' : 'Set Titik Awal'}
                    </button>
                    <input value={form.startPointName} onChange={e => setForm(f => ({ ...f, startPointName: e.target.value }))} placeholder="Nama stasiun awal" className="w-full border border-outline-variant rounded-lg px-sm py-xs font-body-md text-[11px] text-on-surface bg-surface-container-lowest outline-none focus:ring-1 focus:ring-primary" />
                    {form.startPointLat && <p className="font-mono text-[9px] text-on-surface-variant">{form.startPointLat}, {form.startPointLong}</p>}
                  </div>
                  <div className="flex flex-col gap-xs">
                    <button onClick={() => { setShowTaskModal(false); setPickMode('end'); }} className="py-sm rounded-lg border-2 border-dashed border-error/40 bg-error-container/10 text-error font-label-sm text-[11px] flex items-center justify-center gap-xs hover:bg-error-container/20 transition-colors">
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      {form.endPointLat ? '✓ Titik Akhir' : 'Set Titik Akhir'}
                    </button>
                    <input value={form.endPointName} onChange={e => setForm(f => ({ ...f, endPointName: e.target.value }))} placeholder="Nama stasiun akhir" className="w-full border border-outline-variant rounded-lg px-sm py-xs font-body-md text-[11px] text-on-surface bg-surface-container-lowest outline-none focus:ring-1 focus:ring-primary" />
                    {form.endPointLat && <p className="font-mono text-[9px] text-on-surface-variant">{form.endPointLat}, {form.endPointLong}</p>}
                  </div>
                </div>
                {form.startPointLat && form.endPointLat && (
                  <p className="mt-sm text-center font-label-sm text-primary text-[11px]">
                    Estimasi jarak: <b>{haversineKm(parseFloat(form.startPointLat), parseFloat(form.startPointLong), parseFloat(form.endPointLat), parseFloat(form.endPointLong))} km</b>
                  </p>
                )}
              </div>
            </div>

            <div className="p-md border-t border-outline-variant flex gap-sm shrink-0">
              <button onClick={() => { setShowTaskModal(false); setPickMode(null); }} className="flex-1 py-sm rounded-xl border border-outline text-on-surface font-label-sm hover:bg-surface-container-low">Batal</button>
              <button onClick={handleCreateTugas} disabled={submitting} className="flex-[2] py-sm rounded-xl bg-primary text-on-primary font-label-sm flex items-center justify-center gap-sm disabled:opacity-60">
                <span className="material-symbols-outlined text-[16px]">send</span>
                {submitting ? 'Menyimpan...' : 'Buat Tugas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
