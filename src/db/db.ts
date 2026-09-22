// Thin, dependency-free IndexedDB wrapper.
//
// We intentionally do NOT reach for a library like idb or Dexie here — the
// schema is four small object stores with simple key/index lookups, and a
// ~120-line wrapper keeps things transparent for a personal project rather
// than pulling in another abstraction layer.

import type { Commitment, DayRecord, Settings, TimerState } from '../types';

// NOTE: kept as the original value on purpose — changing this string would
// make the app open a brand-new (empty) IndexedDB and orphan every existing
// user's saved commitments/history on their device. Renaming the product
// does not require renaming its storage.
const DB_NAME = 'the-architect';
const DB_VERSION = 1;

export const STORES = {
  commitments: 'commitments',
  dayRecords: 'dayRecords',
  timerState: 'timerState',
  settings: 'settings',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

/** Opens (and lazily migrates) the database. Cached across calls.
 *  Not exported — every read/write in this module goes through withStore(),
 *  which is the only caller; nothing outside this file needs a raw handle. */
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.commitments)) {
        db.createObjectStore(STORES.commitments, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.dayRecords)) {
        const store = db.createObjectStore(STORES.dayRecords, { keyPath: 'id' });
        store.createIndex('commitmentId', 'commitmentId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.timerState)) {
        db.createObjectStore(STORES.timerState, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open database.'));
    request.onblocked = () => reject(new Error('Database open was blocked by another tab.'));
  });

  return dbPromise;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function promisifyTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => T | Promise<T>,
): Promise<T> {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const result = await fn(store);
  await promisifyTx(tx);
  return result;
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  return withStore(storeName, 'readonly', (store) => promisifyRequest(store.getAll() as IDBRequest<T[]>));
}

export async function getById<T>(storeName: string, id: string): Promise<T | undefined> {
  return withStore(storeName, 'readonly', (store) => promisifyRequest(store.get(id) as IDBRequest<T | undefined>));
}

export async function put<T>(storeName: string, value: T): Promise<void> {
  await withStore(storeName, 'readwrite', (store) => promisifyRequest(store.put(value)));
}

export async function remove(storeName: string, id: string): Promise<void> {
  await withStore(storeName, 'readwrite', (store) => promisifyRequest(store.delete(id)));
}

export async function clearStore(storeName: string): Promise<void> {
  await withStore(storeName, 'readwrite', (store) => promisifyRequest(store.clear()));
}

export async function getByIndex<T>(storeName: string, indexName: string, value: string): Promise<T[]> {
  return withStore(storeName, 'readonly', (store) =>
    promisifyRequest(store.index(indexName).getAll(value) as IDBRequest<T[]>),
  );
}

export type { Commitment, DayRecord, Settings, TimerState };
