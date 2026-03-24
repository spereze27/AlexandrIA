/** Offline storage using IndexedDB via idb library.
 *
 * Stores pending submissions when offline, syncs when connection returns.
 */

import { openDB, type IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';
import { submissionsApi } from './api';

const DB_NAME = 'formbuilder-offline';
const DB_VERSION = 1;
const STORE_SUBMISSIONS = 'pending_submissions';
const STORE_FORMS = 'cached_forms';

interface PendingSubmission {
  client_id: string;
  form_id: string;
  data: Record<string, unknown>;
  gps_lat?: number;
  gps_lng?: number;
  offline_created_at: string;
  media_blobs: Array<{ field_key: string; blob: Blob; filename: string }>;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_SUBMISSIONS)) {
          db.createObjectStore(STORE_SUBMISSIONS, { keyPath: 'client_id' });
        }
        if (!db.objectStoreNames.contains(STORE_FORMS)) {
          db.createObjectStore(STORE_FORMS, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// ── Pending submissions ─────────────────────────────────────────────────────

export async function savePendingSubmission(
  formId: string,
  data: Record<string, unknown>,
  gpsLat?: number,
  gpsLng?: number,
): Promise<string> {
  const db = await getDB();
  const clientId = uuidv4();

  const submission: PendingSubmission = {
    client_id: clientId,
    form_id: formId,
    data,
    gps_lat: gpsLat,
    gps_lng: gpsLng,
    offline_created_at: new Date().toISOString(),
    media_blobs: [],
  };

  await db.put(STORE_SUBMISSIONS, submission);
  return clientId;
}

export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  const db = await getDB();
  return db.getAll(STORE_SUBMISSIONS);
}

export async function removePendingSubmission(clientId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_SUBMISSIONS, clientId);
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.count(STORE_SUBMISSIONS);
}

// ── Sync engine ─────────────────────────────────────────────────────────────

export async function syncPendingSubmissions(): Promise<{
  synced: number;
  failed: number;
}> {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const pending = await getPendingSubmissions();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  try {
    const response = await submissionsApi.batchSync(
      pending.map((sub) => ({
        form_id: sub.form_id,
        data: sub.data,
        gps_lat: sub.gps_lat,
        gps_lng: sub.gps_lng,
        client_id: sub.client_id,
        offline_created_at: sub.offline_created_at,
      })),
    );

    const result = response.data;

    // Remove successfully synced submissions
    for (const sub of pending) {
      await removePendingSubmission(sub.client_id);
    }

    return { synced: result.synced + result.duplicates_skipped, failed: result.errors.length };
  } catch {
    return { synced: 0, failed: pending.length };
  }
}

// ── Form caching (for offline rendering) ────────────────────────────────────

export async function cacheForm(form: { id: string; name: string; schema: unknown }): Promise<void> {
  const db = await getDB();
  await db.put(STORE_FORMS, form);
}

export async function getCachedForm(formId: string): Promise<{ id: string; name: string; schema: unknown } | undefined> {
  const db = await getDB();
  return db.get(STORE_FORMS, formId);
}

// ── Auto-sync on reconnect ──────────────────────────────────────────────────

export function registerSyncListeners() {
  window.addEventListener('online', () => {
    console.log('[offline] Back online — syncing pending submissions...');
    syncPendingSubmissions().then(({ synced, failed }) => {
      if (synced > 0) console.log(`[offline] Synced ${synced} submissions`);
      if (failed > 0) console.warn(`[offline] Failed to sync ${failed} submissions`);
    });
  });
}
