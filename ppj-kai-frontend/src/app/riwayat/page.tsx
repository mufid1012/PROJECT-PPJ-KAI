'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../lib/api';
import BottomNav from '../../components/layout/BottomNav';

interface Tugas {
  id: number;
  jalur: string;
  tanggal: string;
  startPointName: string;
  endPointName: string;
  status: string;
  tracking?: {
    durasi: number;
  }[];
}

export default function RiwayatPage() {
  const [tasks, setTasks] = useState<Tugas[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tugas');
      const completedTasks = (res.data.data || []).filter((t: Tugas) => t.status === 'completed');
      setTasks(completedTasks);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-lg antialiased">
      {/* Header */}
      <header className="bg-surface/80 backdrop-blur-md shadow-sm sticky top-0 z-50 flex items-center justify-center w-full px-container-padding h-16">
        <h1 className="font-h2 text-h2 font-bold text-primary tracking-tight">Riwayat Inspeksi</h1>
      </header>

      <main className="flex-grow px-container-padding pb-32">
        {/* Search & Filter Section */}
        <section className="mt-md space-y-md">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input 
              className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border-1.5 border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-md text-body-md shadow-sm" 
              placeholder="Cari lokasi atau tugas..." 
              type="text"
            />
          </div>
          <div className="flex items-center gap-sm overflow-x-auto hide-scrollbar pb-1">
            <button className="flex items-center gap-xs px-md py-sm bg-primary text-on-primary rounded-full font-label-sm text-label-sm shadow-sm whitespace-nowrap">
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
              7 Hari Terakhir
            </button>
            <button className="flex items-center gap-xs px-md py-sm bg-surface-container-high text-on-surface-variant rounded-full font-label-sm text-label-sm whitespace-nowrap hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined text-[18px]">filter_list</span>
              Semua Jalur
            </button>
            <button className="flex items-center gap-xs px-md py-sm bg-surface-container-high text-on-surface-variant rounded-full font-label-sm text-label-sm whitespace-nowrap hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined text-[18px]">sort</span>
              Terbaru
            </button>
          </div>
        </section>

        {/* History List */}
        <section className="mt-xl space-y-md">
          {loading ? (
            <p className="text-on-surface-variant font-body-md text-center py-4">Memuat riwayat...</p>
          ) : tasks.length === 0 ? (
            <p className="text-on-surface-variant font-body-md text-center py-4">Belum ada riwayat inspeksi selesai.</p>
          ) : (
            tasks.map((tugas) => (
              <Link key={tugas.id} href={`/inspeksi/${tugas.id}/selesai`} className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant shadow-sm flex gap-md relative overflow-hidden active:scale-[0.98] transition-transform duration-150 block">
                <div className="flex-grow">
                  <div className="flex justify-between items-start mb-xs">
                    <h2 className="font-data-heavy text-data-heavy text-primary">{tugas.jalur}</h2>
                    <span className="bg-primary-fixed text-on-primary-fixed-variant px-sm py-xs rounded-full font-label-sm text-[10px] uppercase">Selesai</span>
                  </div>
                  <div className="flex items-center gap-xs text-on-surface-variant font-body-md text-body-md mb-md">
                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                    <span>{new Date(tugas.tanggal).toLocaleDateString('id-ID')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-md pt-sm border-t border-surface-variant">
                    <div>
                      <p className="text-on-surface-variant font-label-sm text-label-sm mb-xs">Jarak</p>
                      <p className="font-data-heavy text-primary">- km</p>
                    </div>
                    <div>
                      <p className="text-on-surface-variant font-label-sm text-label-sm mb-xs">Durasi</p>
                      <p className="font-data-heavy text-primary">{
                        (() => {
                          const d = tugas.tracking?.[0]?.durasi || 0;
                          if (d >= 3600) return `${Math.floor(d / 3600)}j ${Math.floor((d % 3600) / 60)}m`;
                          if (d >= 60) return `${Math.floor(d / 60)} menit`;
                          if (d > 0) return `${d} detik`;
                          return '-';
                        })()
                      }</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
