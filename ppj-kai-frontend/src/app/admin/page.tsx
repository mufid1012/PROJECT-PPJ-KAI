'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import api from '../../lib/api';
import { useRouter } from 'next/navigation';

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

// ===== STATION DATA =====
const STATIONS = [
  { name: 'Stasiun Gambir', lat: -6.1766, lng: 106.8309 },
  { name: 'Stasiun Jakarta Kota', lat: -6.1376, lng: 106.8145 },
  { name: 'Stasiun Manggarai', lat: -6.2099, lng: 106.8505 },
  { name: 'Stasiun Jatinegara', lat: -6.2149, lng: 106.8705 },
  { name: 'Stasiun Tanah Abang', lat: -6.1854, lng: 106.8109 },
  { name: 'Stasiun Pasar Senen', lat: -6.1745, lng: 106.8447 },
  { name: 'Stasiun Cikini', lat: -6.1898, lng: 106.8412 },
  { name: 'Stasiun Gondangdia', lat: -6.1856, lng: 106.8345 },
  { name: 'Stasiun Juanda', lat: -6.1669, lng: 106.8303 },
  { name: 'Stasiun Sawah Besar', lat: -6.1607, lng: 106.8277 },
  { name: 'Stasiun Kemayoran', lat: -6.1529, lng: 106.8461 },
  { name: 'Stasiun Rajawali', lat: -6.1459, lng: 106.8383 },
  { name: 'Stasiun Kampung Bandan', lat: -6.1377, lng: 106.8255 },
  { name: 'Stasiun Angke', lat: -6.1448, lng: 106.8008 },
  { name: 'Stasiun Duri', lat: -6.1517, lng: 106.8007 },
  { name: 'Stasiun Grogol', lat: -6.1617, lng: 106.7930 },
  { name: 'Stasiun Pesing', lat: -6.1668, lng: 106.7758 },
  { name: 'Stasiun Taman Kota', lat: -6.1660, lng: 106.7584 },
  { name: 'Stasiun Bojong Indah', lat: -6.1656, lng: 106.7355 },
  { name: 'Stasiun Rawa Buaya', lat: -6.1651, lng: 106.7144 },
  { name: 'Stasiun Kalideres', lat: -6.1618, lng: 106.6950 },
  { name: 'Stasiun Tangerang', lat: -6.1765, lng: 106.6326 },
  { name: 'Stasiun Sudimara', lat: -6.3193, lng: 106.7099 },
  { name: 'Stasiun Serpong', lat: -6.3204, lng: 106.6664 },
  { name: 'Stasiun Bogor', lat: -6.5953, lng: 106.7898 },
  { name: 'Stasiun Depok', lat: -6.3868, lng: 106.8173 },
  { name: 'Stasiun Depok Baru', lat: -6.3927, lng: 106.8197 },
  { name: 'Stasiun Citayam', lat: -6.4468, lng: 106.8307 },
  { name: 'Stasiun Bojong Gede', lat: -6.4853, lng: 106.7954 },
  { name: 'Stasiun Cilebut', lat: -6.5363, lng: 106.7857 },
  { name: 'Stasiun Bekasi', lat: -6.2365, lng: 107.0018 },
  { name: 'Stasiun Kranji', lat: -6.2221, lng: 106.9699 },
  { name: 'Stasiun Cakung', lat: -6.2189, lng: 106.9279 },
  { name: 'Stasiun Klender', lat: -6.2170, lng: 106.9016 },
  { name: 'Stasiun Buaran', lat: -6.2172, lng: 106.9110 },
  { name: 'Stasiun Cipinang', lat: -6.2157, lng: 106.8844 },
  { name: 'Stasiun Bandung', lat: -6.9122, lng: 107.6089 },
  { name: 'Stasiun Cirebon', lat: -6.7063, lng: 108.5570 },
  { name: 'Stasiun Semarang Tawang', lat: -6.9643, lng: 110.4279 },
  { name: 'Stasiun Surabaya Gubeng', lat: -7.2652, lng: 112.7519 },
  { name: 'Stasiun Yogyakarta', lat: -7.7890, lng: 110.3636 },
];

interface Petugas { id: number; nipp: string; nama: string; tugasPpj: { id: number; jalur: string; status: string }[] }
interface Tugas { id: number; jalur: string; tanggal: string; startPointLat: number; startPointLong: number; endPointLat: number; endPointLong: number; startPointName: string; endPointName: string; status: string; jamMulai?: string; jamBerakhir?: string; user: { nama: string; nipp: string } }
interface Emergency { id: number; latitude: number; longitude: number; jenisTemuan: string; deskripsi: string; foto: string | null; createdAt: string; tracking: { tugas: { jalur: string; user: { nama: string; nipp: string } } } }
interface Stats { totalPetugas: number; tugasAktif: number; tugasSelesai: number; laporanDarurat: number }
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

  const [sidebarPage, setSidebarPage] = useState<'dashboard' | 'view'>('dashboard');
  const [dashboardTab, setDashboardTab] = useState<'ppj' | 'petugas' | 'darurat'>('ppj');

  const [filterYear, setFilterYear] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const [activeTrackings, setActiveTrackings] = useState<ActiveTracking[]>([]);
  const [selectedTracking, setSelectedTracking] = useState<ActiveTracking | null>(null);

  const [form, setForm] = useState({ jalur: '', tanggal: '', assignedTo: '', startPointName: '', endPointName: '', startPointLat: '', startPointLong: '', endPointLat: '', endPointLong: '', jamMulai: '', jamBerakhir: '' });
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

  const fetchActiveTracking = useCallback(async () => {
    try {
      const res = await api.get('/admin/tracking/active');
      setActiveTrackings(res.data.data || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) setUser(JSON.parse(userStr));
    fetchAll();
    fetchActiveTracking();
    const interval = setInterval(() => { fetchAll(); fetchActiveTracking(); }, 10000);
    return () => clearInterval(interval);
  }, [fetchAll, fetchActiveTracking]);

  const filteredTugas = useMemo(() => {
    return tugas.filter(t => {
      const d = new Date(t.tanggal);
      if (filterYear && d.getFullYear().toString() !== filterYear) return false;
      if (filterMonth && (d.getMonth() + 1).toString() !== filterMonth) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      return true;
    });
  }, [tugas, filterYear, filterMonth, filterStatus]);

  const availableYears = useMemo(() => {
    const years = new Set(tugas.map(t => new Date(t.tanggal).getFullYear().toString()));
    return Array.from(years).sort().reverse();
  }, [tugas]);

  const handleLogout = () => { localStorage.clear(); router.push('/login'); };

  const handleMapClick = (lat: number, lng: number, name: string) => {
    if (!pickMode) return;
    if (pickMode === 'start') {
      setForm(f => ({ ...f, startPointLat: lat.toFixed(6), startPointLong: lng.toFixed(6), startPointName: f.startPointName || name }));
    } else {
      setForm(f => ({ ...f, endPointLat: lat.toFixed(6), endPointLong: lng.toFixed(6), endPointName: f.endPointName || name }));
    }
    setPickMode(null);
    setShowTaskModal(true);
  };

  const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
  };

  // Station selection handlers
  const handleStationSelect = (type: 'start' | 'end', stationIdx: string) => {
    if (!stationIdx) {
      if (type === 'start') setForm(f => ({ ...f, startPointName: '', startPointLat: '', startPointLong: '' }));
      else setForm(f => ({ ...f, endPointName: '', endPointLat: '', endPointLong: '' }));
      return;
    }
    const station = STATIONS[parseInt(stationIdx)];
    if (!station) return;
    if (type === 'start') {
      setForm(f => ({ ...f, startPointName: station.name, startPointLat: station.lat.toFixed(6), startPointLong: station.lng.toFixed(6) }));
    } else {
      setForm(f => ({ ...f, endPointName: station.name, endPointLat: station.lat.toFixed(6), endPointLong: station.lng.toFixed(6) }));
    }
  };

  const handleCreateTugas = async () => {
    if (!form.jalur || !form.tanggal || !form.assignedTo || !form.startPointLat || !form.endPointLat) {
      alert('Lengkapi semua field!'); return;
    }
    try {
      setSubmitting(true);
      await api.post('/admin/tugas', form);
      setShowTaskModal(false);
      setForm({ jalur: '', tanggal: '', assignedTo: '', startPointName: '', endPointName: '', startPointLat: '', startPointLong: '', endPointLat: '', endPointLong: '', jamMulai: '', jamBerakhir: '' });
      fetchAll();
    } catch (e) { console.error(e); alert('Gagal membuat tugas.'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteTugas = async (id: number) => {
    if (!confirm('Hapus tugas ini?')) return;
    try { await api.delete(`/admin/tugas/${id}`); fetchAll(); } catch { alert('Gagal menghapus.'); }
  };

  const formatElapsed = (startTime: string) => {
    const ms = Date.now() - new Date(startTime).getTime();
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return h > 0 ? `${h}j ${m}m` : `${m}m`;
  };

  const mapEmergencies = emergencies.map(e => ({ id: e.id, latitude: e.latitude, longitude: e.longitude, jenisTemuan: e.jenisTemuan, deskripsi: e.deskripsi, foto: e.foto, createdAt: e.createdAt, petugasNama: e.tracking?.tugas?.user?.nama, jalur: e.tracking?.tugas?.jalur }));
  const mapTasks = tugas.map(t => ({ id: t.id, jalur: t.jalur, startPointLat: t.startPointLat, startPointLong: t.startPointLong, endPointLat: t.endPointLat, endPointLong: t.endPointLong, startPointName: t.startPointName, endPointName: t.endPointName, status: t.status, petugasNama: t.user?.nama, petugasNipp: t.user?.nipp }));

  const navItems = [
    { key: 'dashboard' as const, icon: 'dashboard', label: 'Dashboard' },
    { key: 'view' as const, icon: 'map', label: 'View' },
  ];

  // Status counts for dashboard overview
  const statusCounts = useMemo(() => {
    const counts = { pending: 0, in_progress: 0, completed: 0 };
    tugas.forEach(t => { if (counts[t.status as keyof typeof counts] !== undefined) counts[t.status as keyof typeof counts]++; });
    return counts;
  }, [tugas]);

  // Get currently selected station index from form data
  const getStationIdx = (name: string) => {
    const idx = STATIONS.findIndex(s => s.name === name);
    return idx >= 0 ? idx.toString() : '';
  };

  // ====== INPUT CLASSES ======
  const inputCls = "w-full border border-outline-variant rounded-xl px-md py-sm font-body-md text-on-surface bg-surface-container-lowest focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all";
  const labelCls = "font-label-sm text-[11px] text-on-surface-variant uppercase tracking-wider block mb-xs font-semibold";

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* ===== HEADER ===== */}
      <header className="h-[60px] bg-surface border-b border-outline-variant flex items-center justify-between px-lg shrink-0 z-50">
        <div className="flex items-center gap-md">
          <img src="/logo-kai.png" alt="KAI Logo" className="h-9 w-auto object-contain" />
          <div>
            <h1 className="font-h3 text-[18px] font-bold text-primary leading-tight">RailTrack PPJ</h1>
            <p className="font-label-sm text-[9px] text-on-surface-variant uppercase tracking-widest">Panel Administrasi</p>
          </div>
        </div>
        <div className="flex items-center gap-md">
          {activeTrackings.length > 0 && (
            <button onClick={() => setSidebarPage('view')} className="flex items-center gap-xs bg-primary-container/20 text-primary px-sm py-xs rounded-full font-label-sm text-[11px] hover:bg-primary-container/30 transition-colors">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              {activeTrackings.length} Petugas Aktif
            </button>
          )}
          <div className="flex items-center gap-sm bg-surface-container rounded-full px-sm py-xs">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[14px] text-on-primary">person</span>
            </div>
            <span className="font-label-sm text-on-surface hidden sm:block">{user?.nama}</span>
          </div>
          <button onClick={handleLogout} className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error-container/20 hover:text-error transition-all" title="Keluar">
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ===== NAV SIDEBAR ===== */}
        <nav className="w-[72px] bg-surface border-r border-outline-variant flex flex-col items-center py-md gap-xs shrink-0">
          {navItems.map(item => (
            <button key={item.key} onClick={() => setSidebarPage(item.key)}
              className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 ${sidebarPage === item.key ? 'bg-primary-container text-on-primary-container shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
              title={item.label}>
              <span className="material-symbols-outlined text-[22px]" style={sidebarPage === item.key ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
              <span className="font-label-sm text-[9px] leading-none">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* ===== DASHBOARD ===== */}
        {sidebarPage === 'dashboard' && (
          <main className="flex-1 overflow-y-auto bg-[#f0f2f8]">
            {/* Welcome + Quick Stats Banner */}
            <div className="bg-gradient-to-r from-[#003366] via-[#004a8f] to-[#005bac] px-xl py-lg">
              <div className="flex items-center justify-between mb-md">
                <div>
                  <h2 className="text-white/60 font-label-sm text-[11px] uppercase tracking-widest">Selamat Datang</h2>
                  <p className="text-white font-h2 text-h2 font-bold">{user?.nama || 'Admin'}</p>
                </div>
                <div className="text-white/60 text-right font-label-sm text-[11px]">
                  <p>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p className="text-white/40 text-[10px] mt-0.5">Auto-refresh setiap 10 detik</p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm">
                {[
                  { label: 'Total Petugas', value: stats?.totalPetugas ?? 0, icon: 'group', gradient: 'from-blue-500/20 to-blue-600/10', iconBg: 'bg-blue-500/30' },
                  { label: 'Tugas Aktif', value: stats?.tugasAktif ?? 0, icon: 'pending_actions', gradient: 'from-amber-500/20 to-amber-600/10', iconBg: 'bg-amber-500/30' },
                  { label: 'Tugas Selesai', value: stats?.tugasSelesai ?? 0, icon: 'check_circle', gradient: 'from-emerald-500/20 to-emerald-600/10', iconBg: 'bg-emerald-500/30' },
                  { label: 'Laporan Darurat', value: stats?.laporanDarurat ?? 0, icon: 'emergency', gradient: 'from-red-500/20 to-red-600/10', iconBg: 'bg-red-500/30' },
                ].map(s => (
                  <div key={s.label} className={`bg-gradient-to-br ${s.gradient} bg-white/10 backdrop-blur-md rounded-2xl p-md border border-white/10`}>
                    <div className="flex items-center justify-between mb-sm">
                      <div className={`w-10 h-10 ${s.iconBg} rounded-xl flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-[20px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                      </div>
                    </div>
                    <p className="text-white font-bold text-[28px] leading-none">{s.value}</p>
                    <p className="text-white/50 font-label-sm text-[10px] uppercase tracking-wider mt-xs">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="px-xl pt-lg pb-0 flex items-center justify-between">
              <div className="flex gap-xs">
                {([
                  { key: 'ppj' as const, icon: 'assignment', label: 'Data PPJ', count: tugas.length },
                  { key: 'petugas' as const, icon: 'group', label: 'Petugas', count: petugas.length },
                  { key: 'darurat' as const, icon: 'emergency', label: 'Darurat', count: emergencies.length },
                ] as const).map(tab => (
                  <button key={tab.key} onClick={() => setDashboardTab(tab.key)}
                    className={`px-lg py-sm rounded-xl font-label-sm text-[12px] flex items-center gap-xs transition-all duration-200 ${
                      dashboardTab === tab.key
                        ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                        : 'bg-white text-on-surface-variant hover:bg-surface-container border border-outline-variant/50'
                    }`}>
                    <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                    {tab.label}
                    <span className={`ml-xs px-xs py-0 rounded-full text-[9px] font-bold ${dashboardTab === tab.key ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'}`}>{tab.count}</span>
                  </button>
                ))}
              </div>

              {dashboardTab === 'ppj' && (
                <button onClick={() => setShowTaskModal(true)} className="px-lg py-sm bg-primary text-on-primary rounded-xl font-label-sm text-[12px] flex items-center gap-xs hover:shadow-md hover:shadow-primary/20 transition-all active:scale-95">
                  <span className="material-symbols-outlined text-[16px]">add_circle</span> Buat Tugas Baru
                </button>
              )}
            </div>

            {/* Content Area */}
            <div className="px-xl py-md">
              {/* ===== DATA PPJ ===== */}
              {dashboardTab === 'ppj' && (
                <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
                  {/* Filters Row */}
                  <div className="px-md py-sm border-b border-outline-variant/30 flex flex-wrap items-center gap-sm bg-surface-container-lowest">
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">filter_alt</span>
                    <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="border border-outline-variant/50 rounded-lg px-sm py-xs font-label-sm text-[11px] text-on-surface bg-white focus:ring-2 focus:ring-primary/30 outline-none">
                      <option value="">Semua Tahun</option>
                      {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border border-outline-variant/50 rounded-lg px-sm py-xs font-label-sm text-[11px] text-on-surface bg-white focus:ring-2 focus:ring-primary/30 outline-none">
                      <option value="">Semua Bulan</option>
                      {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'].map((m, i) => (
                        <option key={i + 1} value={(i + 1).toString()}>{m}</option>
                      ))}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-outline-variant/50 rounded-lg px-sm py-xs font-label-sm text-[11px] text-on-surface bg-white focus:ring-2 focus:ring-primary/30 outline-none">
                      <option value="">Semua Status</option>
                      <option value="pending">Pending</option>
                      <option value="in_progress">Berlangsung</option>
                      <option value="completed">Selesai</option>
                    </select>
                    <div className="ml-auto flex items-center gap-sm">
                      {(filterYear || filterMonth || filterStatus) && (
                        <button onClick={() => { setFilterYear(''); setFilterMonth(''); setFilterStatus(''); }} className="font-label-sm text-[10px] text-primary hover:underline flex items-center gap-xs">
                          <span className="material-symbols-outlined text-[12px]">close</span> Reset
                        </button>
                      )}
                      <span className="font-label-sm text-[10px] text-on-surface-variant">{filteredTugas.length} dari {tugas.length} tugas</span>
                    </div>
                  </div>

                  {/* Status Summary Chips */}
                  <div className="px-md py-sm flex gap-sm border-b border-outline-variant/20">
                    {[
                      { key: 'pending', label: 'Pending', count: statusCounts.pending, dot: 'bg-amber-400' },
                      { key: 'in_progress', label: 'Berlangsung', count: statusCounts.in_progress, dot: 'bg-blue-500' },
                      { key: 'completed', label: 'Selesai', count: statusCounts.completed, dot: 'bg-emerald-500' },
                    ].map(s => (
                      <button key={s.key} onClick={() => setFilterStatus(filterStatus === s.key ? '' : s.key)}
                        className={`flex items-center gap-xs px-sm py-xs rounded-full text-[10px] font-label-sm transition-all ${filterStatus === s.key ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}>
                        <span className={`w-2 h-2 rounded-full ${filterStatus === s.key ? 'bg-white' : s.dot}`} />
                        {s.label} <b>{s.count}</b>
                      </button>
                    ))}
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-surface-container-low/50">
                          {['No', 'Jalur', 'Petugas', 'Tanggal', 'Jadwal', 'Rute', 'Jarak', 'Status', ''].map(h => (
                            <th key={h} className={`${h === '' ? 'text-right' : 'text-left'} px-md py-sm font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTugas.length === 0 ? (
                          <tr><td colSpan={9} className="text-center py-xl">
                            <span className="material-symbols-outlined text-[40px] text-outline/30 block mb-sm">inbox</span>
                            <p className="text-on-surface-variant font-body-md text-[13px]">Tidak ada data tugas PPJ</p>
                          </td></tr>
                        ) : filteredTugas.map((t, idx) => (
                          <tr key={t.id} className="border-b border-outline-variant/20 hover:bg-primary-container/5 transition-colors group">
                            <td className="px-md py-sm text-on-surface-variant font-label-sm text-[11px]">{idx + 1}</td>
                            <td className="px-md py-sm"><span className="font-label-sm text-[12px] font-semibold text-on-surface">{t.jalur}</span></td>
                            <td className="px-md py-sm">
                              <div className="flex items-center gap-xs">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ background: petugasColor(t.user?.nipp || '') }}>
                                  {t.user?.nama?.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-label-sm text-[11px] text-on-surface leading-tight">{t.user?.nama}</p>
                                  <p className="font-label-sm text-[9px] text-on-surface-variant">{t.user?.nipp}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-md py-sm font-label-sm text-[11px] text-on-surface">{new Date(t.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="px-md py-sm font-label-sm text-[10px] text-on-surface-variant">
                              {t.jamMulai && t.jamBerakhir ? `${t.jamMulai} - ${t.jamBerakhir}` : <span className="text-outline">—</span>}
                            </td>
                            <td className="px-md py-sm"><span className="font-label-sm text-[10px] text-on-surface-variant">{t.startPointName || '—'} → {t.endPointName || '—'}</span></td>
                            <td className="px-md py-sm font-mono font-label-sm text-[11px] text-on-surface">{haversineKm(t.startPointLat, t.startPointLong, t.endPointLat, t.endPointLong)} km</td>
                            <td className="px-md py-sm">
                              <span className={`inline-flex items-center gap-xs px-sm py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                t.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : t.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  t.status === 'completed' ? 'bg-emerald-500'
                                  : t.status === 'in_progress' ? 'bg-blue-500'
                                  : 'bg-amber-500'
                                }`} />
                                {STATUS_LABEL[t.status]}
                              </span>
                            </td>
                            <td className="px-md py-sm text-right">
                              <button onClick={() => handleDeleteTugas(t.id)} className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all w-8 h-8 rounded-lg hover:bg-error-container/20 flex items-center justify-center" title="Hapus">
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===== PETUGAS ===== */}
              {dashboardTab === 'petugas' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-md">
                  {petugas.map(p => {
                    const aktif = p.tugasPpj.find(t => t.status === 'in_progress');
                    const totalTasks = p.tugasPpj.length;
                    const color = petugasColor(p.nipp);
                    return (
                      <div key={p.id} className="bg-white rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden hover:shadow-md transition-all group">
                        <div className="h-2" style={{ background: color }} />
                        <div className="p-md">
                          <div className="flex items-center gap-sm mb-md">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-[14px] text-white shadow-sm" style={{ background: color }}>
                              {p.nama.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-label-sm text-[13px] font-semibold text-on-surface truncate">{p.nama}</p>
                              <p className="font-label-sm text-[10px] text-on-surface-variant">{p.nipp}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-label-sm text-[10px] text-on-surface-variant">{totalTasks} tugas</span>
                            <span className={`inline-flex items-center gap-xs px-sm py-0.5 rounded-full text-[9px] font-bold uppercase ${aktif ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-surface-container text-on-surface-variant border border-outline-variant/50'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${aktif ? 'bg-emerald-500 animate-pulse' : 'bg-outline'}`} />
                              {aktif ? 'Aktif' : 'Idle'}
                            </span>
                          </div>
                          {aktif && <p className="font-label-sm text-[10px] text-primary mt-sm truncate border-t border-outline-variant/20 pt-sm">{aktif.jalur}</p>}
                        </div>
                      </div>
                    );
                  })}
                  {petugas.length === 0 && (
                    <div className="col-span-full text-center py-xl bg-white rounded-2xl border border-outline-variant/30">
                      <span className="material-symbols-outlined text-[40px] text-outline/30 block mb-sm">person_off</span>
                      <p className="text-on-surface-variant font-body-md">Tidak ada data petugas</p>
                    </div>
                  )}
                </div>
              )}

              {/* ===== DARURAT ===== */}
              {dashboardTab === 'darurat' && (
                <>
                  {emergencies.length === 0 ? (
                    <div className="text-center py-xl bg-white rounded-2xl border border-outline-variant/30">
                      <span className="material-symbols-outlined text-[40px] text-outline/30 block mb-sm">verified_user</span>
                      <p className="text-on-surface-variant font-body-md">Tidak ada laporan darurat</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
                      {emergencies.map(e => (
                        <button key={e.id} onClick={() => setSelectedEmergency(e)} className="w-full text-left bg-white rounded-2xl border border-outline-variant/30 overflow-hidden hover:shadow-md hover:border-red-200 transition-all group">
                          {e.foto && <img src={e.foto} alt="" className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300" />}
                          <div className="p-md">
                            <div className="flex items-center justify-between mb-sm">
                              <span className="inline-flex items-center gap-xs px-sm py-0.5 rounded-full text-[9px] font-bold uppercase bg-red-50 text-red-700 border border-red-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                {JENIS_LABEL[e.jenisTemuan] ?? e.jenisTemuan}
                              </span>
                              <span className="text-on-surface-variant font-label-sm text-[10px]">{new Date(e.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="font-label-sm text-[12px] text-on-surface font-semibold">{e.tracking?.tugas?.user?.nama}</p>
                            <p className="font-label-sm text-[10px] text-on-surface-variant">{e.tracking?.tugas?.jalur}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </main>
        )}

        {/* ===== VIEW PAGE (MAP) ===== */}
        {sidebarPage === 'view' && (
          <>
            <aside className="w-80 bg-surface border-r border-outline-variant flex flex-col overflow-hidden shrink-0">
              <div className="p-md border-b border-outline-variant">
                <div className="flex items-center justify-between mb-sm">
                  <h2 className="font-h3 text-h3 font-bold text-on-surface flex items-center gap-sm">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>radar</span>
                    Monitoring
                  </h2>
                  <span className={`px-sm py-xs rounded-full font-label-sm text-[10px] uppercase font-bold ${activeTrackings.length > 0 ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface-variant'}`}>
                    {activeTrackings.length} aktif
                  </span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant">Pantau petugas inspeksi secara real-time.</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {activeTrackings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-xl px-md text-center">
                    <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-md">
                      <span className="material-symbols-outlined text-[32px] text-on-surface-variant">person_off</span>
                    </div>
                    <p className="font-body-md text-on-surface font-semibold mb-xs">Tidak Ada Petugas Aktif</p>
                    <p className="font-body-md text-body-md text-on-surface-variant">Belum ada inspeksi berlangsung.</p>
                  </div>
                ) : (
                  <div className="p-sm space-y-sm">
                    {activeTrackings.map(track => {
                      const color = petugasColor(track.petugas.nipp);
                      const isSelected = selectedTracking?.trackingId === track.trackingId;
                      return (
                        <button key={track.trackingId} onClick={() => setSelectedTracking(isSelected ? null : track)}
                          className={`w-full text-left rounded-xl p-md border-2 transition-all duration-200 ${isSelected ? 'border-primary bg-primary-container/10 shadow-md' : 'border-outline-variant bg-surface-container-lowest hover:border-primary/30'}`}>
                          <div className="flex items-center gap-sm mb-sm">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white shadow-sm" style={{ background: color }}>{track.petugas.nama.substring(0, 2).toUpperCase()}</div>
                            <div className="flex-1 min-w-0">
                              <p className="font-label-sm font-semibold text-on-surface truncate">{track.petugas.nama}</p>
                              <p className="font-label-sm text-[10px] text-on-surface-variant">{track.petugas.nipp}</p>
                            </div>
                            <div className="flex items-center gap-xs shrink-0">
                              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                              <span className="font-label-sm text-[10px] text-primary font-bold uppercase">Live</span>
                            </div>
                          </div>
                          <div className="bg-surface-container-low/50 rounded-lg p-sm space-y-xs">
                            <div className="flex items-center gap-xs">
                              <span className="material-symbols-outlined text-[14px] text-primary">route</span>
                              <span className="font-label-sm text-[11px] text-on-surface font-semibold truncate">{track.tugas.jalur}</span>
                            </div>
                            <p className="font-label-sm text-[10px] text-on-surface-variant pl-[18px]">{track.tugas.startPointName} → {track.tugas.endPointName}</p>
                          </div>
                          <div className="flex items-center justify-between mt-sm pt-sm border-t border-outline-variant/50">
                            <div className="flex items-center gap-xs text-on-surface-variant">
                              <span className="material-symbols-outlined text-[14px]">schedule</span>
                              <span className="font-label-sm text-[10px]">Durasi: <b className="text-on-surface">{formatElapsed(track.startTime)}</b></span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-sm border-t border-outline-variant bg-surface-container-lowest">
                <div className="flex items-center gap-xs text-on-surface-variant">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  <span className="font-label-sm text-[10px]">Auto-refresh 10 detik</span>
                </div>
              </div>
            </aside>

            <main className="flex-1 relative overflow-hidden isolate">
              <AdminMap emergencies={mapEmergencies} tasks={mapTasks}
                onEmergencyClick={(em) => { setSelectedEmergency(emergencies.find(e => e.id === em.id) || null); }}
                onMapClick={handleMapClick} pickMode={pickMode}
                tempStart={form.startPointLat ? { lat: parseFloat(form.startPointLat), lng: parseFloat(form.startPointLong) } : undefined}
                tempEnd={form.endPointLat ? { lat: parseFloat(form.endPointLat), lng: parseFloat(form.endPointLong) } : undefined}
              />
              {pickMode && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-lg py-sm rounded-full shadow-lg font-label-sm flex items-center gap-sm z-[1000]">
                  <span className="material-symbols-outlined text-[16px]">my_location</span>
                  Klik peta untuk titik {pickMode === 'start' ? 'AWAL' : 'AKHIR'}
                  <button onClick={() => setPickMode(null)} className="ml-sm text-on-primary/70 hover:text-on-primary"><span className="material-symbols-outlined text-[16px]">close</span></button>
                </div>
              )}
              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl p-sm shadow-lg text-[10px] font-label-sm z-[1000] space-y-xs">
                <p className="text-on-surface-variant uppercase font-bold mb-xs">Legend</p>
                {[['#94a3b8','Pending'],['#005bac','Berlangsung'],['#22c55e','Selesai']].map(([c,l]) => (
                  <div key={l} className="flex items-center gap-xs"><div className="w-4 h-1 rounded" style={{ background: c }} /><span className="text-on-surface">{l}</span></div>
                ))}
                <div className="flex items-center gap-xs"><span className="text-error">⚠</span><span className="text-on-surface">Darurat</span></div>
              </div>
              <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm rounded-full px-sm py-xs text-[10px] text-on-surface-variant font-label-sm flex items-center gap-xs z-[1000]">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                Live • {activeTrackings.length} petugas
              </div>
            </main>
          </>
        )}
      </div>

      {/* ===== EMERGENCY DETAIL MODAL ===== */}
      {selectedEmergency && (
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-md" onClick={() => setSelectedEmergency(null)}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-red-600 to-red-500 px-md py-sm flex items-center justify-between">
              <h3 className="font-h3 text-h3 text-white flex items-center gap-sm">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                Laporan Darurat
              </h3>
              <button onClick={() => setSelectedEmergency(null)} className="text-white/70 hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            {selectedEmergency.foto && <img src={selectedEmergency.foto} alt="" className="w-full aspect-video object-cover" />}
            <div className="p-md space-y-sm">
              <div className="flex justify-between items-center">
                <span className="bg-red-50 text-red-700 border border-red-200 px-sm py-xs rounded-full font-label-sm text-[11px] uppercase font-bold">{JENIS_LABEL[selectedEmergency.jenisTemuan] ?? selectedEmergency.jenisTemuan}</span>
                <span className="font-label-sm text-[11px] text-on-surface-variant">{new Date(selectedEmergency.createdAt).toLocaleString('id-ID')}</span>
              </div>
              {selectedEmergency.deskripsi && <p className="font-body-md text-on-surface">{selectedEmergency.deskripsi}</p>}
              <div className="bg-surface-container-low rounded-xl p-sm space-y-xs">
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

      {/* ===== CREATE TASK MODAL ===== */}
      {showTaskModal && (
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-md" onClick={() => { setShowTaskModal(false); setPickMode(null); }}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-[#003366] to-[#005bac] px-lg py-md flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-white font-h3 text-h3 flex items-center gap-sm"><span className="material-symbols-outlined">add_task</span> Buat Tugas Baru</h3>
                <p className="text-white/50 font-label-sm text-[10px] mt-xs">Isi formulir penugasan inspeksi jalur</p>
              </div>
              <button onClick={() => { setShowTaskModal(false); setPickMode(null); }} className="text-white/60 hover:text-white w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-y-auto p-lg space-y-lg flex-1">
              {/* Petugas */}
              <div>
                <label className={labelCls}>Pilih Petugas</label>
                <select value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} className={inputCls}>
                  <option value="">— Pilih Petugas —</option>
                  {petugas.map(p => <option key={p.id} value={p.id}>{p.nama} ({p.nipp})</option>)}
                </select>
              </div>

              {/* Nama Jalur */}
              <div>
                <label className={labelCls}>Nama Jalur</label>
                <input value={form.jalur} onChange={e => setForm(f => ({ ...f, jalur: e.target.value }))} placeholder="Jalur Utama Jakarta-Bandung" className={inputCls} />
              </div>

              {/* Tanggal */}
              <div>
                <label className={labelCls}>Tanggal Inspeksi</label>
                <input type="date" value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} className={inputCls} />
              </div>

              {/* Jam Mulai & Jam Berakhir */}
              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className={labelCls}>Jam Mulai</label>
                  <input type="time" value={form.jamMulai} onChange={e => setForm(f => ({ ...f, jamMulai: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Jam Berakhir</label>
                  <input type="time" value={form.jamBerakhir} onChange={e => setForm(f => ({ ...f, jamBerakhir: e.target.value }))} className={inputCls} />
                </div>
              </div>

              {/* Stasiun Awal & Akhir */}
              <div>
                <label className={labelCls}>Stasiun Awal</label>
                <select value={getStationIdx(form.startPointName)} onChange={e => handleStationSelect('start', e.target.value)} className={inputCls}>
                  <option value="">— Pilih Stasiun Awal —</option>
                  {STATIONS.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                </select>
                {form.startPointLat && (
                  <p className="font-mono text-[9px] text-on-surface-variant mt-xs flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[12px] text-primary">location_on</span>
                    {form.startPointLat}, {form.startPointLong}
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>Stasiun Akhir</label>
                <select value={getStationIdx(form.endPointName)} onChange={e => handleStationSelect('end', e.target.value)} className={inputCls}>
                  <option value="">— Pilih Stasiun Akhir —</option>
                  {STATIONS.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                </select>
                {form.endPointLat && (
                  <p className="font-mono text-[9px] text-on-surface-variant mt-xs flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[12px] text-error">location_on</span>
                    {form.endPointLat}, {form.endPointLong}
                  </p>
                )}
              </div>

              {/* Estimasi Jarak */}
              {form.startPointLat && form.endPointLat && (
                <div className="bg-primary-container/10 border border-primary/10 rounded-xl p-md flex items-center justify-between">
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-primary text-[20px]">straighten</span>
                    <span className="font-label-sm text-[11px] text-on-surface-variant">Estimasi Jarak</span>
                  </div>
                  <span className="font-h3 text-[18px] font-bold text-primary">{haversineKm(parseFloat(form.startPointLat), parseFloat(form.startPointLong), parseFloat(form.endPointLat), parseFloat(form.endPointLong))} km</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-lg border-t border-outline-variant/30 flex gap-sm shrink-0 bg-surface-container-lowest">
              <button onClick={() => { setShowTaskModal(false); setPickMode(null); }} className="flex-1 py-sm rounded-xl border border-outline-variant text-on-surface font-label-sm hover:bg-surface-container-low transition-colors">Batal</button>
              <button onClick={handleCreateTugas} disabled={submitting} className="flex-[2] py-sm rounded-xl bg-gradient-to-r from-[#003366] to-[#005bac] text-white font-label-sm flex items-center justify-center gap-sm disabled:opacity-60 hover:shadow-md hover:shadow-primary/20 transition-all active:scale-[0.98]">
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
