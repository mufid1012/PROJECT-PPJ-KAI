'use client';

import { useEffect, useState } from 'react';
import { getOfflineQueue, removeFromOfflineQueue } from '../lib/offline-store';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    // Determine initial state safely
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);

      const handleOnline = () => {
        setIsOnline(true);
        syncOfflineData();
      };
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Attempt to sync immediately if we start online
      if (navigator.onLine) {
        syncOfflineData();
      }

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const syncOfflineData = async () => {
    setIsSyncing(true);
    setSyncStatus('Memeriksa data tertunda...');
    
    try {
      const queue = await getOfflineQueue();
      if (queue.length === 0) {
        setSyncStatus(null);
        setIsSyncing(false);
        return;
      }

      setSyncStatus(`Mensinkronkan ${queue.length} antrean data...`);

      for (const item of queue) {
        if (!item.id) continue;
        
        try {
          // Perform the actual fetch request
          const response = await fetch(item.url, {
            method: item.method,
            headers: {
              'Content-Type': 'application/json',
              ...item.headers,
            },
            body: JSON.stringify(item.body),
          });

          if (response.ok) {
            // Remove from queue if successful
            await removeFromOfflineQueue(item.id);
          } else {
            console.error(`Gagal sinkronisasi data dengan ID: ${item.id}`, await response.text());
          }
        } catch (error) {
          console.error(`Network error saat sinkronisasi data ID: ${item.id}`, error);
          // If network error, stop syncing for now to try again later
          break;
        }
      }

      const remaining = await getOfflineQueue();
      if (remaining.length === 0) {
        setSyncStatus('Sinkronisasi selesai');
        setTimeout(() => setSyncStatus(null), 3000);
      } else {
        setSyncStatus(`Gagal mengirim ${remaining.length} data. Akan mencoba lagi nanti.`);
      }
    } catch (error) {
      console.error('Error in offline sync process', error);
      setSyncStatus('Terjadi kesalahan saat sinkronisasi');
    } finally {
      setIsSyncing(false);
    }
  };

  return { isOnline, isSyncing, syncStatus, syncOfflineData };
}
