import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface PPJDB extends DBSchema {
  offlineQueue: {
    key: number;
    value: {
      id?: number;
      url: string;
      method: 'POST' | 'PUT' | 'DELETE';
      body: any;
      headers?: Record<string, string>;
      timestamp: number;
    };
    indexes: { 'by-timestamp': number };
  };
}

let dbPromise: Promise<IDBPDatabase<PPJDB>> | null = null;

if (typeof window !== 'undefined') {
  dbPromise = openDB<PPJDB>('ppj-kai-offline', 1, {
    upgrade(db) {
      const store = db.createObjectStore('offlineQueue', {
        keyPath: 'id',
        autoIncrement: true,
      });
      store.createIndex('by-timestamp', 'timestamp');
    },
  });
}

export async function addToOfflineQueue(url: string, method: 'POST' | 'PUT' | 'DELETE', body: any, headers?: Record<string, string>) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.add('offlineQueue', {
    url,
    method,
    body,
    headers,
    timestamp: Date.now(),
  });
}

export async function getOfflineQueue() {
  if (!dbPromise) return [];
  const db = await dbPromise;
  return db.getAllFromIndex('offlineQueue', 'by-timestamp');
}

export async function removeFromOfflineQueue(id: number) {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.delete('offlineQueue', id);
}

export async function clearOfflineQueue() {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.clear('offlineQueue');
}
