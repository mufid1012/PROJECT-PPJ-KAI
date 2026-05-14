'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../lib/api';

interface Tugas {
  id: number;
  jalur: string;
  tanggal: string;
  startPointName: string;
  endPointName: string;
  status: string;
}

const statusLabel: Record<string, string> = {
  pending: 'Menunggu',
  in_progress: 'Sedang Berlangsung',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const statusColor: Record<string, string> = {
  pending: 'bg-surface-container text-on-surface-variant border-outline-variant',
  in_progress: 'bg-primary-container/20 text-primary border-primary/30',
  completed: 'bg-primary-fixed text-on-primary-fixed-variant border-transparent',
  cancelled: 'bg-error-container/20 text-error border-error/30',
};

export default function InspeksiIndexPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Tugas[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await api.get('/tugas');
        const allTasks: Tugas[] = res.data.data || [];
        setTasks(allTasks);

        // Auto-redirect jika hanya ada 1 task atau ada task aktif
        if (allTasks.length === 0) {
          router.replace('/dashboard');
          return;
        }

        // Jika hanya ada 1 tugas langsung masuk
        if (allTasks.length === 1) {
          router.replace(`/inspeksi/${allTasks[0].id}`);
          return;
        }

        // Jika ada task in_progress langsung masuk
        const activeTask = allTasks.find(t => t.status === 'in_progress');
        if (activeTask) {
          router.replace(`/inspeksi/${activeTask.id}`);
          return;
        }
        // Otherwise show the list
      } catch (error) {
        console.error('Error fetching tasks:', error);
        router.replace('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-md text-on-surface-variant">
          <span className="material-symbols-outlined text-primary text-[48px] animate-spin">refresh</span>
          <p className="font-body-md">Memuat tugas inspeksi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface min-h-screen font-body-lg antialiased">
      {/* Header */}
      <header className="bg-surface/80 backdrop-blur-md shadow-sm top-0 z-50 sticky flex items-center gap-md w-full px-container-padding h-16">
        <Link href="/dashboard" className="material-symbols-outlined text-primary">arrow_back</Link>
        <h1 className="font-h2 text-h2 font-bold text-primary">Pilih Tugas Inspeksi</h1>
      </header>

      <main className="max-w-xl mx-auto px-container-padding pt-lg pb-32">
        <p className="font-body-md text-on-surface-variant mb-lg">
          Pilih tugas yang ingin Anda lanjutkan atau mulai:
        </p>
        <div className="flex flex-col gap-md">
          {tasks.map(tugas => (
            <Link
              key={tugas.id}
              href={`/inspeksi/${tugas.id}`}
              className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant shadow-sm flex flex-col gap-sm active:scale-[0.98] transition-transform duration-150"
            >
              <div className="flex justify-between items-start">
                <h2 className="font-data-heavy text-data-heavy text-on-surface flex-1 mr-sm">{tugas.jalur}</h2>
                <span className={`px-sm py-xs rounded-full font-label-sm text-[10px] uppercase border whitespace-nowrap ${statusColor[tugas.status] ?? 'bg-surface-container text-on-surface-variant'}`}>
                  {statusLabel[tugas.status] ?? tugas.status}
                </span>
              </div>
              <div className="flex items-center gap-xs text-on-surface-variant font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                <span>{tugas.startPointName} → {tugas.endPointName}</span>
              </div>
              <div className="flex items-center gap-xs text-on-surface-variant font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                <span>{new Date(tugas.tanggal).toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              <div className="flex items-center justify-end mt-xs">
                <span className="flex items-center gap-xs text-primary font-label-sm text-label-sm font-semibold">
                  {tugas.status === 'completed' ? 'Lihat Detail' : 'Buka Tracking'}
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full z-50 pb-safe bg-surface/80 backdrop-blur-md shadow-[0px_-4px_20px_rgba(0,0,0,0.05)] flex justify-around items-center h-20 px-2">
        <Link href="/dashboard" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1.5 w-16">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="font-label-sm text-label-sm mt-1">Home</span>
        </Link>
        <div className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-xl px-4 py-1.5 w-20 shadow-sm">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>map</span>
          <span className="font-label-sm text-label-sm mt-1">Track</span>
        </div>
        <Link href="/riwayat" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1.5 w-16">
          <span className="material-symbols-outlined">history</span>
          <span className="font-label-sm text-label-sm mt-1">History</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center justify-center text-on-surface-variant px-4 py-1.5 w-16">
          <span className="material-symbols-outlined">person</span>
          <span className="font-label-sm text-label-sm mt-1">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
