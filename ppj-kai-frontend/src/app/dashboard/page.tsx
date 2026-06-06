'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import api from '../../lib/api';

const DynamicMap = dynamic(() => import('../../components/map/DynamicMap'), { ssr: false });

interface Tugas {
  id: number;
  jalur: string;
  tanggal: string;
  startPointName: string;
  endPointName: string;
  startPointLat: number;
  startPointLong: number;
  endPointLat: number;
  endPointLong: number;
  status: string;
}

// GPS Hook
function useGPS() {
  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) { setError('GPS tidak didukung browser ini'); return; }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    return () => { if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  return { position, error };
}

export default function DashboardPage() {
  const router = useRouter();
  const { position: gpsPos, error: gpsError } = useGPS();

  const [user, setUser] = useState<{ nama: string; nipp: string } | null>(null);
  const [tasks, setTasks] = useState<Tugas[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Tugas | null>(null);

  // Tracking state
  const [trackingId, setTrackingId] = useState<number | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<'idle' | 'active'>('idle');
  const [trackPath, setTrackPath] = useState<[number, number][]>([]);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Identity Verification
  const [isVerified, setIsVerified] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Emergency Modal
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [jenisTemuan, setJenisTemuan] = useState('ringan');
  const [deskripsi, setDeskripsi] = useState('');
  const [isSubmittingLaporan, setIsSubmittingLaporan] = useState(false);
  const [emergencyPhoto, setEmergencyPhoto] = useState<string | null>(null);
  const [emergencyCameraActive, setEmergencyCameraActive] = useState(false);
  const emergencyVideoRef = useRef<HTMLVideoElement>(null);
  const emergencyStreamRef = useRef<MediaStream | null>(null);

  // Card state
  const [cardMinimized, setCardMinimized] = useState(false);

  // Dev test mode
  const [testMode, setTestMode] = useState(false);
  const isDevEnv = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userDataStr = localStorage.getItem('user');
    if (!token || !userDataStr) { router.push('/login'); return; }
    try { setUser(JSON.parse(userDataStr)); } catch (e) { console.error(e); }
    fetchData();
  }, [router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const tugasRes = await api.get('/tugas');
      const data: Tugas[] = tugasRes.data.data || [];
      setTasks(data);

      // Auto-select first active/pending task
      const active = data.find((t) => t.status === 'in_progress') || data.find((t) => t.status === 'pending');
      if (active) {
        setSelectedTask(active);
        // If task is in_progress, restore tracking session
        if (active.status === 'in_progress') {
          await restoreTracking(active);
        }
      } else if (data.length > 0) {
        setSelectedTask(data[0]);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const restoreTracking = async (tugas: Tugas) => {
    try {
      const trackRes = await api.get(`/tracking/active/${tugas.id}`).catch(() => null);
      if (trackRes?.data?.trackingId) {
        const backendStartTime = trackRes.data.startTime
          ? new Date(trackRes.data.startTime).getTime()
          : Date.now();
        const secondsElapsed = Math.floor((Date.now() - backendStartTime) / 1000);

        setTrackingId(trackRes.data.trackingId);
        setTrackingStatus('active');
        setElapsed(secondsElapsed > 0 ? secondsElapsed : 0);
        setIsVerified(true);

        // Restore path from localStorage
        const STORAGE_KEY = `tracking_session_${tugas.id}`;
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const session = JSON.parse(saved);
            if (Array.isArray(session.trackPath) && session.trackPath.length > 0) {
              setTrackPath(session.trackPath);
            }
          }
        } catch { /* path will restart from current position */ }
      }
    } catch { /* ignore */ }
  };

  // Track GPS path when active + send position to backend
  useEffect(() => {
    if (trackingStatus === 'active' && gpsPos && selectedTask) {
      setTrackPath(prev => {
        const updated: [number, number][] = [...prev, [gpsPos.lat, gpsPos.lng]];
        if (updated.length % 5 === 0) {
          // Persist to localStorage
          try {
            const STORAGE_KEY = `tracking_session_${selectedTask.id}`;
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
              const session = JSON.parse(saved);
              localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, trackPath: updated }));
            }
          } catch { /* ignore */ }
          // Send position update to backend (for admin live tracking)
          if (trackingId) {
            api.post(`/tracking/update/${trackingId}`, { lat: gpsPos.lat, lng: gpsPos.lng }).catch(() => {});
          }
        }
        return updated;
      });
    }
  }, [gpsPos, trackingStatus]);

  // Timer tick
  useEffect(() => {
    if (trackingStatus === 'active') {
      timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [trackingStatus]);

  // Haversine distance in meters
  const haversineM = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const GEOFENCE_RADIUS = 500;
  const distanceToStart = gpsPos && selectedTask
    ? haversineM(gpsPos.lat, gpsPos.lng, selectedTask.startPointLat, selectedTask.startPointLong)
    : null;
  const routeKm = selectedTask
    ? (haversineM(selectedTask.startPointLat, selectedTask.startPointLong, selectedTask.endPointLat, selectedTask.endPointLong) / 1000).toFixed(1)
    : null;
  const withinGeofence = testMode || (distanceToStart !== null && distanceToStart <= GEOFENCE_RADIUS);

  const formatTime = (s: number) => {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${ss}`;
  };

  // Camera functions for Identity Verification
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch { alert('Tidak dapat mengakses kamera.'); }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    setSelfieDataUrl(canvas.toDataURL('image/jpeg', 0.7));
    stopCamera();
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const confirmVerification = () => {
    if (!selfieDataUrl) { alert('Silakan ambil foto terlebih dahulu.'); return; }
    setIsVerified(true);
    setVerifyModalOpen(false);
  };

  // Emergency camera functions
  const openEmergencyCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      emergencyStreamRef.current = stream;
      setEmergencyCameraActive(true);
      setTimeout(() => {
        if (emergencyVideoRef.current) {
          emergencyVideoRef.current.srcObject = stream;
          emergencyVideoRef.current.play();
        }
      }, 100);
    } catch { alert('Tidak dapat mengakses kamera.'); }
  };

  const captureEmergencyPhoto = () => {
    if (!emergencyVideoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = emergencyVideoRef.current.videoWidth;
    canvas.height = emergencyVideoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(emergencyVideoRef.current, 0, 0);
    setEmergencyPhoto(canvas.toDataURL('image/jpeg', 0.7));
    stopEmergencyCamera();
  };

  const stopEmergencyCamera = () => {
    emergencyStreamRef.current?.getTracks().forEach(t => t.stop());
    emergencyStreamRef.current = null;
    setEmergencyCameraActive(false);
  };

  const handleStartTracking = async () => {
    if (!selectedTask) return;
    if (!isVerified) { setVerifyModalOpen(true); openCamera(); return; }
    if (!gpsPos) { alert('Menunggu sinyal GPS...'); return; }
    try {
      const res = await api.post(`/tracking/start/${selectedTask.id}`, { lat: gpsPos.lat, lng: gpsPos.lng });
      const newTrackingId = res.data.trackingId;
      const startedAt = Date.now();
      const initialPath: [number, number][] = [[gpsPos.lat, gpsPos.lng]];

      setTrackingId(newTrackingId);
      setTrackingStatus('active');
      setElapsed(0);
      setTrackPath(initialPath);

      const STORAGE_KEY = `tracking_session_${selectedTask.id}`;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        trackingId: newTrackingId,
        startedAt,
        trackPath: initialPath,
      }));
    } catch (err) {
      console.error('Failed to start tracking', err);
      alert('Gagal memulai inspeksi.');
    }
  };

  const handleStopTracking = async () => {
    if (!trackingId || !gpsPos || !selectedTask) return;
    try {
      await api.post(`/tracking/stop/${trackingId}`, { lat: gpsPos.lat, lng: gpsPos.lng });
      if (timerRef.current) clearInterval(timerRef.current);
      const STORAGE_KEY = `tracking_session_${selectedTask.id}`;
      localStorage.removeItem(STORAGE_KEY);
      setTrackingStatus('idle');
      setTrackingId(null);
      setElapsed(0);
      setTrackPath([]);
      // Refresh task list
      fetchData();
    } catch (err) {
      console.error('Failed to stop tracking', err);
      alert('Gagal menghentikan inspeksi.');
    }
  };

  const handleKirimLaporan = async () => {
    if (!trackingId || !gpsPos) { alert('Tracking belum aktif atau GPS belum tersedia.'); return; }
    try {
      setIsSubmittingLaporan(true);
      await api.post(`/laporan`, {
        trackingId,
        jenisTemuan,
        deskripsi,
        lat: gpsPos.lat,
        lng: gpsPos.lng,
        fotoUrl: emergencyPhoto || '',
      });
      alert('Laporan berhasil dikirim!');
      setIsEmergencyModalOpen(false);
      setDeskripsi('');
      setEmergencyPhoto(null);
    } catch (err) {
      console.error('Failed to send laporan', err);
      alert('Gagal mengirim laporan darurat.');
    } finally { setIsSubmittingLaporan(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  // Map center
  const mapLat = gpsPos?.lat ?? selectedTask?.startPointLat ?? -6.1754;
  const mapLng = gpsPos?.lng ?? selectedTask?.startPointLong ?? 106.8272;

  const activeTasks = tasks.filter((t) => t.status !== 'completed');

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-md text-on-surface-variant">
          <span className="material-symbols-outlined text-primary text-[48px] animate-spin">refresh</span>
          <p className="font-body-md">Memuat data...</p>
        </div>
      </div>
    );
  }

  // ========== EMPTY STATE — No tasks ==========
  if (tasks.length === 0 || activeTasks.length === 0) {
    return (
      <div className="bg-background text-on-background antialiased min-h-screen flex flex-col">
        {/* Header */}
        <header className="bg-surface/80 backdrop-blur-md shadow-sm sticky top-0 z-50 flex items-center justify-between w-full px-container-padding h-16">
          <h1 className="font-h2 text-h2 font-bold text-primary tracking-tight">RailTrack PPJ</h1>
          <button onClick={handleLogout} className="flex items-center gap-xs text-on-surface-variant hover:text-error transition-colors p-2 rounded-full hover:bg-error-container/20">
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-container-padding">
          <div className="text-center mb-lg">
            <h2 className="font-h2 text-h2 text-on-surface">
              Halo, <span className="text-primary">{user?.nama || 'Petugas'}</span>
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant p-xl flex flex-col items-center gap-md text-center max-w-sm w-full shadow-sm">
            <div className="w-24 h-24 rounded-full bg-primary-container/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[56px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                inbox
              </span>
            </div>
            <h3 className="font-h3 text-h3 text-on-surface">Belum Ada Tugas</h3>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Saat ini belum ada tugas inspeksi yang diberikan oleh admin. Tugas baru akan muncul di sini ketika admin memberikan penugasan.
            </p>
            <div className="flex items-center gap-xs text-on-surface-variant mt-sm">
              <span className="material-symbols-outlined text-[18px]">schedule</span>
              <span className="font-label-sm text-label-sm">Menunggu penugasan...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ========== MAIN VIEW — Map + Task ==========
  return (
    <div className="bg-surface text-on-surface font-body-lg h-screen w-screen overflow-hidden flex flex-col relative selection:bg-primary-container selection:text-on-primary-container">
      {/* Full-screen Map */}
      <div className="absolute inset-0 z-0 w-full h-full">
        <DynamicMap
          lat={mapLat}
          lng={mapLng}
          zoom={trackingStatus === 'active' ? 17 : 13}
          trackPath={trackingStatus === 'active' ? trackPath : undefined}
          routeStart={selectedTask ? { lat: selectedTask.startPointLat, lng: selectedTask.startPointLong, name: selectedTask.startPointName } : undefined}
          routeEnd={selectedTask ? { lat: selectedTask.endPointLat, lng: selectedTask.endPointLong, name: selectedTask.endPointName } : undefined}
        />
      </div>

      {/* Header */}
      <header className="top-0 z-50 sticky shadow-sm flex items-center justify-between w-full px-container-padding h-16 bg-surface/80 backdrop-blur-md">
        <div className="flex flex-col">
          <h1 className="font-h3 text-h3 text-primary font-bold tracking-tight">
            {trackingStatus === 'active' ? 'Inspeksi Berlangsung' : (selectedTask?.jalur || 'RailTrack PPJ')}
          </h1>
          <p className="font-label-sm text-label-sm text-on-surface-variant -mt-0.5">
            {user?.nama || 'Petugas'} • {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <button onClick={handleLogout} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-error-container/20 transition-colors text-on-surface-variant hover:text-error">
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full relative z-10 pointer-events-none">
        {trackingStatus === 'idle' ? (
          /* ========== PRE-START: Task Card ========== */
          <div className="absolute bottom-6 left-0 w-full px-container-padding pointer-events-auto">
            <div className="max-w-2xl mx-auto">
              {/* Task selector (if multiple active tasks) */}
              {activeTasks.length > 1 && (
                <div className="flex gap-xs mb-sm overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {activeTasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTask(t)}
                      className={`shrink-0 px-sm py-xs rounded-full font-label-sm text-label-sm transition-all ${
                        selectedTask?.id === t.id
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'bg-surface/80 backdrop-blur-sm text-on-surface-variant border border-outline-variant'
                      }`}
                    >
                      {t.jalur}
                    </button>
                  ))}
                </div>
              )}

              {/* Main Task Card */}
              <div className="bg-surface/90 backdrop-blur-xl rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)] border border-surface-variant flex flex-col w-full overflow-hidden">
                {/* Card Header */}
                <div className="flex items-center justify-between p-md">
                  <div className="flex items-center gap-sm">
                    <h2 className="font-h3 text-h3 text-on-surface">{selectedTask?.jalur}</h2>
                    <span className={`px-sm py-xs rounded-full font-label-sm text-[10px] uppercase border shrink-0 ${
                      selectedTask?.status === 'in_progress'
                        ? 'bg-primary-container/20 text-primary border-primary/30'
                        : 'bg-surface-container text-on-surface-variant border-outline-variant'
                    }`}>
                      {selectedTask?.status === 'in_progress' ? 'Berlangsung' : 'Pending'}
                    </span>
                  </div>
                  <button
                    onClick={() => setCardMinimized(m => !m)}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {cardMinimized ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                </div>

                {/* Card Body */}
                {!cardMinimized && (
                  <div className="flex flex-col gap-md px-md pb-md">
                    {/* GPS Status */}
                    <div className={`flex items-center gap-md p-sm rounded-lg border ${gpsPos ? 'bg-surface-container-low border-outline-variant/30' : 'bg-error-container/20 border-error/30'}`}>
                      <span className="material-symbols-outlined text-primary" style={gpsPos ? { fontVariationSettings: "'FILL' 1" } : {}}>
                        {gpsPos ? 'check_circle' : 'gps_off'}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-body-md text-body-md text-on-surface font-semibold">
                          {gpsPos ? 'GPS Terkunci' : (gpsError || 'Mencari sinyal GPS...')}
                        </span>
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          {gpsPos ? `Akurasi: ±${Math.round(gpsPos.accuracy)}m` : 'Pastikan GPS diaktifkan'}
                        </span>
                      </div>
                    </div>

                    {/* Identity Verification */}
                    <button
                      onClick={() => { setVerifyModalOpen(true); openCamera(); }}
                      className={`flex items-center justify-between p-sm rounded-lg border transition-colors focus:outline-none ${isVerified ? 'bg-surface-container-low border-outline-variant/30' : 'bg-surface-container-low hover:bg-surface-container border-error-container/50'}`}
                    >
                      <div className="flex items-center gap-md">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isVerified ? 'bg-primary-container text-on-primary-container' : 'bg-error-container text-on-error-container'}`}>
                          <span className="material-symbols-outlined text-sm">{isVerified ? 'check' : 'photo_camera'}</span>
                        </div>
                        <span className="font-body-md text-body-md text-on-surface">Verifikasi Identitas</span>
                      </div>
                      {isVerified ? (
                        <span className="text-primary font-label-sm text-label-sm uppercase flex items-center gap-xs">Verified ✓</span>
                      ) : (
                        <span className="text-error font-label-sm text-label-sm uppercase flex items-center gap-xs">
                          Required <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                        </span>
                      )}
                    </button>

                    {/* Route Info */}
                    {selectedTask && (
                      <div className="bg-surface-container-low rounded-lg p-sm flex items-center gap-sm">
                        <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>route</span>
                        <div className="flex-1">
                          <p className="font-label-sm text-[11px] text-on-surface-variant uppercase">Jarak Jalur</p>
                          <p className="font-data-heavy text-on-surface">{routeKm} km</p>
                          <p className="font-label-sm text-[10px] text-on-surface-variant">{selectedTask.startPointName} → {selectedTask.endPointName}</p>
                        </div>
                      </div>
                    )}

                    {/* Geofencing Distance */}
                    {distanceToStart !== null && (
                      <div className={`rounded-lg p-sm border ${withinGeofence ? 'bg-primary-container/10 border-primary/30' : 'bg-error-container/10 border-error/20'}`}>
                        <div className="flex items-center justify-between mb-xs">
                          <span className="font-label-sm text-[11px] text-on-surface-variant uppercase flex items-center gap-xs">
                            <span className="material-symbols-outlined text-[14px]">{withinGeofence ? 'location_on' : 'near_me'}</span>
                            Jarak ke Titik Awal
                          </span>
                          <span className={`font-label-sm text-[11px] font-bold ${withinGeofence ? 'text-primary' : 'text-error'}`}>
                            {distanceToStart < 1000 ? `${Math.round(distanceToStart)}m` : `${(distanceToStart/1000).toFixed(1)}km`}
                          </span>
                        </div>
                        <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${withinGeofence ? 'bg-primary' : 'bg-error'}`}
                            style={{ width: `${Math.min(100, (GEOFENCE_RADIUS / Math.max(distanceToStart, 1)) * 100)}%` }}
                          />
                        </div>
                        <p className={`font-label-sm text-[10px] mt-xs ${withinGeofence ? 'text-primary' : 'text-error'}`}>
                          {withinGeofence ? '✓ Anda sudah berada di lokasi, siap mulai!' : `Menuju titik awal, sisa ${GEOFENCE_RADIUS} meter`}
                        </p>
                      </div>
                    )}

                    {/* Test Mode Toggle — localhost only */}
                    {isDevEnv && (
                      <button
                        onClick={() => setTestMode(m => !m)}
                        className={`flex items-center justify-between p-sm rounded-lg border transition-colors ${
                          testMode
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-600'
                            : 'bg-surface-container border-outline-variant text-on-surface-variant'
                        }`}
                      >
                        <span className="flex items-center gap-sm font-label-sm text-[11px]">
                          <span className="material-symbols-outlined text-[16px]">science</span>
                          Mode Testing (bypass geofencing)
                        </span>
                        <span className={`w-9 h-5 rounded-full relative transition-colors ${testMode ? 'bg-amber-500' : 'bg-outline-variant'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${testMode ? 'left-4' : 'left-0.5'}`} />
                        </span>
                      </button>
                    )}

                    {/* Start Button */}
                    <button
                      onClick={handleStartTracking}
                      disabled={!gpsPos || !withinGeofence}
                      className={`w-full text-on-primary font-body-lg font-semibold h-[48px] rounded-lg flex items-center justify-center gap-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                        testMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-surface-tint'
                      }`}
                    >
                      <span className="material-symbols-outlined">play_circle</span>
                      {!gpsPos
                        ? 'Menunggu GPS...'
                        : testMode
                        ? 'Mulai Tracking (Test Mode)'
                        : !withinGeofence
                        ? `Mendekat ke Titik Awal (${Math.round(distanceToStart ?? 0)}m)`
                        : 'Mulai Tracking'
                      }
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ========== ACTIVE TRACKING ========== */}
            {/* Emergency FAB */}
            <div className="absolute right-container-padding bottom-[240px] pointer-events-auto">
              <button onClick={() => setIsEmergencyModalOpen(true)} className="w-16 h-16 bg-error text-on-error rounded-full shadow-[0px_8px_24px_rgba(186,26,26,0.3)] flex items-center justify-center hover:scale-105 transition-transform active:scale-95">
                <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              </button>
            </div>

            {/* Active Tracking Panel */}
            <div className="bg-white rounded-t-[32px] shadow-[0px_-8px_24px_rgba(0,0,0,0.08)] px-lg pt-lg pb-[40px] fixed bottom-0 left-0 right-0 z-40 pointer-events-auto">
              <div className="flex justify-between items-center mb-lg px-md">
                <div className="flex flex-col items-center">
                  <div className="text-on-surface-variant font-label-sm uppercase text-[10px] mb-1">Duration</div>
                  <div className="text-on-surface font-h2 font-bold">{formatTime(elapsed)}</div>
                </div>
                <div className="w-px h-8 bg-outline-variant/30" />
                <div className="flex flex-col items-center">
                  <div className="text-on-surface-variant font-label-sm uppercase text-[10px] mb-1">Points</div>
                  <div className="text-on-surface font-h2 font-bold">{trackPath.length}</div>
                </div>
                <div className="w-px h-8 bg-outline-variant/30" />
                <div className="flex flex-col items-center">
                  <div className="text-on-surface-variant font-label-sm uppercase text-[10px] mb-1">Accuracy</div>
                  <div className="text-on-surface font-h2 font-bold">±{gpsPos ? Math.round(gpsPos.accuracy) : '-'}m</div>
                </div>
              </div>
              <div className="flex gap-md items-center">
                <button onClick={handleStopTracking} className="flex-1 bg-error text-on-error rounded-full h-[56px] flex items-center justify-center gap-sm font-h3 shadow-lg active:scale-95 transition-transform">
                  <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>stop_circle</span>
                  Selesai
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ========== IDENTITY VERIFICATION MODAL ========== */}
      {verifyModalOpen && (
        <div className="fixed inset-0 z-[60] bg-on-surface/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 pointer-events-auto">
          <div className="bg-surface w-full max-w-lg rounded-t-xl md:rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-primary px-md py-sm flex items-center justify-between">
              <h3 className="font-h3 text-h3 text-on-primary flex items-center gap-sm">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span> Verifikasi Identitas
              </h3>
              <button onClick={() => { setVerifyModalOpen(false); stopCamera(); }} className="text-on-primary/80 hover:text-on-primary">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-md flex flex-col gap-md">
              {!selfieDataUrl ? (
                <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                    <button onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-primary shadow-lg flex items-center justify-center active:scale-90 transition-transform">
                      <span className="material-symbols-outlined text-primary text-[32px]">photo_camera</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden">
                  <img src={selfieDataUrl} alt="Selfie" className="w-full h-full object-cover" />
                  <button onClick={() => { setSelfieDataUrl(null); openCamera(); }} className="absolute top-2 right-2 bg-surface/80 backdrop-blur-sm rounded-full p-1.5">
                    <span className="material-symbols-outlined text-error">refresh</span>
                  </button>
                </div>
              )}
              <div className="flex items-center gap-sm p-sm bg-surface-container-low rounded-lg">
                <span className="material-symbols-outlined text-primary text-[20px]">location_on</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {gpsPos ? `${gpsPos.lat.toFixed(6)}, ${gpsPos.lng.toFixed(6)} (±${Math.round(gpsPos.accuracy)}m)` : 'Menunggu GPS...'}
                </span>
              </div>
            </div>
            <div className="p-md bg-surface-container-lowest border-t border-surface-variant flex gap-md">
              <button onClick={() => { setVerifyModalOpen(false); stopCamera(); setSelfieDataUrl(null); }} className="flex-1 py-3 rounded-xl border border-outline text-on-surface font-label-sm hover:bg-surface-container-low">
                Batal
              </button>
              <button onClick={confirmVerification} disabled={!selfieDataUrl} className="flex-[2] py-3 rounded-xl bg-primary text-on-primary font-label-sm flex items-center justify-center gap-sm shadow-sm disabled:opacity-50">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check</span> Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== EMERGENCY MODAL ========== */}
      {isEmergencyModalOpen && (
        <div className="fixed inset-0 z-[60] bg-on-surface/50 backdrop-blur-sm flex flex-col items-center justify-end md:justify-center p-0 md:p-container-padding pointer-events-auto">
          <div className="bg-surface w-full max-w-lg rounded-t-xl md:rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-error px-md py-sm flex items-center justify-between">
              <h3 className="font-h3 text-h3 text-on-error flex items-center gap-sm">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span> Lapor Kendala Darurat
              </h3>
              <button onClick={() => { setIsEmergencyModalOpen(false); stopEmergencyCamera(); setEmergencyPhoto(null); }} className="text-on-error/80 hover:text-on-error"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-md flex flex-col gap-md max-h-[60vh] overflow-y-auto">
              <div className="flex flex-col gap-xs">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">Kategori Kendala</label>
                <div className="grid grid-cols-2 gap-sm">
                  {[
                    { key: 'berat', icon: 'construction', label: 'Baut Lepas', color: 'error' },
                    { key: 'emergency', icon: 'broken_image', label: 'Rel Retak', color: 'error' },
                    { key: 'sedang', icon: 'block', label: 'Penghalang', color: 'primary' },
                    { key: 'ringan', icon: 'more_horiz', label: 'Lainnya', color: 'primary' },
                  ].map(c => (
                    <button key={c.key} onClick={() => setJenisTemuan(c.key)}
                      className={`flex flex-col items-center justify-center p-md rounded-xl border-2 transition-colors active:scale-95 ${jenisTemuan === c.key ? `border-${c.color} bg-${c.color}-container/20 text-${c.color}` : 'border-outline-variant bg-surface-container-lowest text-on-surface'}`}>
                      <span className="material-symbols-outlined text-h1" style={jenisTemuan === c.key ? { fontVariationSettings: "'FILL' 1" } : {}}>{c.icon}</span>
                      <span className="font-label-sm text-label-sm text-center">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-xs">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">Deskripsi Kendala</label>
                <textarea className="bg-surface-container-low border-outline-variant rounded-lg font-body-md text-on-surface focus:ring-2 focus:ring-primary p-sm min-h-[80px] resize-none" placeholder="Jelaskan detail kendala..." value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
              </div>

              {/* Photo Section */}
              <div className="flex flex-col gap-xs">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">Foto Kondisi Darurat</label>
                {emergencyCameraActive ? (
                  <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                    <video ref={emergencyVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-md">
                      <button onClick={captureEmergencyPhoto} className="w-14 h-14 bg-error rounded-full border-4 border-white shadow-lg flex items-center justify-center active:scale-90 transition-transform">
                        <span className="material-symbols-outlined text-white text-[28px]">photo_camera</span>
                      </button>
                      <button onClick={stopEmergencyCamera} className="w-10 h-10 bg-surface/80 backdrop-blur rounded-full flex items-center justify-center self-center">
                        <span className="material-symbols-outlined text-error text-[20px]">close</span>
                      </button>
                    </div>
                  </div>
                ) : emergencyPhoto ? (
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-outline-variant">
                    <img src={emergencyPhoto} alt="Foto darurat" className="w-full h-full object-cover" />
                    <button onClick={() => { setEmergencyPhoto(null); openEmergencyCamera(); }} className="absolute top-2 right-2 bg-surface/80 backdrop-blur-sm rounded-full p-1.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-error text-[18px]">refresh</span>
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-sm p-xs text-center">
                      <span className="text-white font-label-sm text-[10px]">📍 {gpsPos ? `${gpsPos.lat.toFixed(5)}, ${gpsPos.lng.toFixed(5)}` : 'GPS tidak tersedia'}</span>
                    </div>
                  </div>
                ) : (
                  <button onClick={openEmergencyCamera} className="w-full h-24 rounded-xl border-2 border-dashed border-error/40 bg-error-container/10 flex flex-col items-center justify-center text-error hover:bg-error-container/20 transition-colors cursor-pointer gap-1">
                    <span className="material-symbols-outlined text-[32px]">add_a_photo</span>
                    <span className="font-label-sm text-label-sm">Ambil Foto Kondisi</span>
                  </button>
                )}
              </div>
            </div>
            <div className="p-md bg-surface-container-lowest border-t border-surface-variant flex gap-md">
              <button onClick={() => setIsEmergencyModalOpen(false)} className="flex-1 py-3 rounded-xl border border-outline text-on-surface font-label-sm hover:bg-surface-container-low">Batal</button>
              <button onClick={handleKirimLaporan} disabled={isSubmittingLaporan} className="flex-[2] py-3 rounded-xl bg-error text-on-error font-label-sm flex items-center justify-center gap-sm shadow-sm disabled:opacity-70">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                {isSubmittingLaporan ? 'Mengirim...' : 'Kirim Laporan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
