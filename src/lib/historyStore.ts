import type { AuditReport } from '../types/audit';

const DB_NAME = 'monograph_audits_db';
const DB_VERSION = 1;
const STORE_NAME = 'audits';

export interface SavedAuditMeta {
  id: string;
  url: string;
  domain: string;
  siteTitle: string;
  createdAt: string;
  pagesCount: number;
  accessibilityScore: number;
  accessibilityGrade: string;
  componentsCount: number;
  primaryColorHex: string | null;
  thumbnailDataUrl: string | null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAuditToHistory(report: AuditReport): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(report);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getAuditFromHistory(id: string): Promise<AuditReport | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as AuditReport | undefined) || null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function listAuditHistory(): Promise<SavedAuditMeta[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      db.close();
      const all = (req.result as AuditReport[]) || [];
      const sorted = all
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map<SavedAuditMeta>((r) => {
          const homeShots = r.pages[0]?.screenshots;
          const thumb =
            homeShots?.desktop?.dataUrl ||
            homeShots?.tablet?.dataUrl ||
            homeShots?.phone?.dataUrl ||
            null;
          const accent =
            r.ui.colors.find((c) => c.role === 'accent')?.hex ||
            r.ui.colors[0]?.hex ||
            null;
          return {
            id: r.id,
            url: r.url,
            domain: r.domain,
            siteTitle: r.siteTitle,
            createdAt: r.createdAt,
            pagesCount: r.pages.length,
            accessibilityScore: r.accessibility.score,
            accessibilityGrade: r.accessibility.grade,
            componentsCount: r.components.length,
            primaryColorHex: accent,
            thumbnailDataUrl: thumb,
          };
        });
      resolve(sorted);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function deleteAuditFromHistory(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function clearAuditHistory(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
