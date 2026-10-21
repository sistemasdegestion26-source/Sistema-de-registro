// Browser-native IndexedDB client storage engine for high capacity & persistence
// Bypasses 5MB localStorage limits and securely retains hundreds of MBs of records across tab closes, refreshes & sessions

const DB_NAME = 'tinaquillo_dg_db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

// Required object stores for complete municipal records & attachments
const ALL_STORES = [
  'solicitudes',
  'informes',
  'asistencias',
  'funcionarios',
  'profiles',
  'metasPoa',
  'authCredentials',
  'large_attachments',
  'storage_backups',
];

/**
 * Requests high-capacity persistent storage from browser / Android WebView
 * Prevents OS from evicting municipal data on low device storage
 */
export async function requestPersistentStorage(): Promise<{
  persisted: boolean;
  quotaMb?: number;
  usageMb?: number;
}> {
  if (typeof navigator !== 'undefined' && navigator.storage) {
    let persisted = false;
    try {
      if (navigator.storage.persist) {
        persisted = await navigator.storage.persist();
      }
    } catch (e) {
      // Ignored: persistent storage not supported in private mode
    }

    let quotaMb: number | undefined;
    let usageMb: number | undefined;
    try {
      if (navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (est.quota) quotaMb = Math.round(est.quota / (1024 * 1024));
        if (est.usage) usageMb = Math.round(est.usage / (1024 * 1024));
      }
    } catch (e) {}

    return { persisted, quotaMb, usageMb };
  }
  return { persisted: false };
}

export function getIndexedDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      dbPromise = null;
      return reject(new Error('IndexedDB no está soportado en este entorno'));
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const storeName of ALL_STORES) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => {
          dbPromise = null;
        };
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        // Auto-request persistent storage in background
        requestPersistentStorage().catch(() => {});
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        console.warn('[IndexedDB] Error al abrir base de datos local:', request.error);
        reject(request.error);
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

export async function idbSaveAll<T extends { id?: string }>(storeName: string, items: T[]): Promise<void> {
  try {
    const db = await getIndexedDB();
    if (!db.objectStoreNames.contains(storeName)) {
      console.warn(`[IndexedDB] Object store no registrado: ${storeName}`);
      return;
    }
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    for (const item of items) {
      if (item && item.id) {
        store.put(item);
      }
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn(`[IndexedDB] Fallback al guardar ${storeName}:`, e);
  }
}

export async function idbSaveItem<T extends { id: string }>(storeName: string, item: T): Promise<void> {
  try {
    const db = await getIndexedDB();
    if (!db.objectStoreNames.contains(storeName)) return;
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(item);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn(`[IndexedDB] Error guardando item en ${storeName}:`, e);
  }
}

export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  try {
    const db = await getIndexedDB();
    if (!db.objectStoreNames.contains(storeName)) {
      return [];
    }
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn(`[IndexedDB] Fallback al leer ${storeName}:`, e);
    return [];
  }
}

export async function idbClear(storeName: string): Promise<void> {
  try {
    const db = await getIndexedDB();
    if (!db.objectStoreNames.contains(storeName)) return;
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
  } catch (e) {
    console.warn(`[IndexedDB] Fallback al limpiar ${storeName}:`, e);
  }
}
