'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import BottomNav from '@/components/layout/BottomNav';
import api from '../../lib/api';
import { useRouter } from 'next/navigation';

interface Tugas {
  id: number;
  jalur: string;
  tanggal: string;
  startPointName: string;
  endPointName: string;
  status: string;
}

interface Summary {
  totalTasks: number;
  completed: number;
  inProgress: number;
  pending: number;
  emergencyReports: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ nama: string; nipp: string } | null>(null);
  const [tasks, setTasks] = useState<Tugas[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

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
      const [tugasRes, summaryRes] = await Promise.all([
        api.get('/tugas'),
        api.get('/tugas/summary'),
      ]);
      setTasks(tugasRes.data.data || []);
      setSummary(summaryRes.data.data || null);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeTasks = tasks.filter((t) => t.status !== 'completed');

  return (
    <div className="bg-background text-on-background antialiased pb-24 min-h-screen">
      {/* Header */}
      <header className="bg-surface/80 backdrop-blur-md shadow-sm sticky top-0 z-50 flex items-center justify-center w-full px-container-padding h-16">
        <h1 className="font-h2 text-h2 font-bold text-primary tracking-tight">Dashboard</h1>
      </header>

      <main className="px-container-padding py-md space-y-lg max-w-2xl mx-auto">
        {/* Welcome */}
        <section>
          <h2 className="font-h2 text-h2 text-on-surface">Selamat Datang, <span className="text-primary">{user?.nama || 'Petugas'}</span></h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 gap-sm">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-md flex flex-col gap-xs">
            <div className="flex items-center gap-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">assignment</span>
              <span className="font-label-sm text-label-sm uppercase">Total Tugas</span>
            </div>
            <div className="font-h1 text-h1 text-primary">{summary?.totalTasks ?? tasks.length}</div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-md flex flex-col gap-xs">
            <div className="flex items-center gap-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span className="font-label-sm text-label-sm uppercase">Selesai</span>
            </div>
            <div className="font-h1 text-h1 text-primary">{summary?.completed ?? 0}</div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-md flex flex-col gap-xs">
            <div className="flex items-center gap-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">pending</span>
              <span className="font-label-sm text-label-sm uppercase">Pending</span>
            </div>
            <div className="font-h1 text-h1 text-on-surface">{summary?.pending ?? 0}</div>
          </div>

          <div className="bg-error-container rounded-xl border border-error/20 shadow-sm p-md flex flex-col gap-xs">
            <div className="flex items-center gap-xs text-on-error-container">
              <span className="material-symbols-outlined text-[18px]">emergency</span>
              <span className="font-label-sm text-label-sm uppercase">Laporan Darurat</span>
            </div>
            <div className="font-h1 text-h1 text-on-error-container">{summary?.emergencyReports ?? 0}</div>
          </div>
        </section>

        {/* Active Tasks */}
        <section>
          <div className="flex justify-between items-center mb-md">
            <h3 className="font-h3 text-h3 text-on-surface">Tugas Aktif</h3>
            <Link href="/inspeksi" className="font-label-sm text-label-sm text-primary hover:underline">
              Lihat Semua
            </Link>
          </div>

          <div className="space-y-sm">
            {loading ? (
              <p className="text-on-surface-variant font-body-md text-center py-4">Memuat tugas...</p>
            ) : activeTasks.length === 0 ? (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg flex flex-col items-center gap-sm text-center">
                <span className="material-symbols-outlined text-[40px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                <p className="font-body-md text-on-surface font-semibold">Semua tugas selesai!</p>
                <p className="font-body-sm text-on-surface-variant">Lihat riwayat di tab History.</p>
              </div>
            ) : (
              activeTasks.map((tugas) => (
                <Link key={tugas.id} href={`/inspeksi/${tugas.id}`} className="block active:scale-[0.98] transition-transform">
                  <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-md flex flex-col gap-sm">
                    <div className="flex justify-between items-start gap-sm">
                      <div className="flex-1">
                        <h4 className="font-data-heavy text-data-heavy text-on-surface">{tugas.jalur}</h4>
                        <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
                          {tugas.startPointName} → {tugas.endPointName}
                        </p>
                      </div>
                      <span className={`px-sm py-xs rounded-full font-label-sm text-[10px] uppercase border shrink-0 ${
                        tugas.status === 'in_progress'
                          ? 'bg-primary-container/20 text-primary border-primary/30'
                          : 'bg-surface-container text-on-surface-variant border-outline-variant'
                      }`}>
                        {tugas.status === 'in_progress' ? 'Berlangsung' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[14px] text-outline">calendar_today</span>
                      <span className="font-body-md text-body-md text-outline">
                        {new Date(tugas.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
