/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommunityIncident } from '../types';

const DB_NAME = 'RastaMobilityIntelligenceDB';
const DB_VERSION = 1;

export interface SyncStatusInfo {
  isOnline: boolean;
  lastSyncedTimestamp: number | null;
  pendingSyncCount: number;
}

class IncidentSyncService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private listeners: Array<(status: SyncStatusInfo) => void> = [];

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store for all community incidents
        if (!db.objectStoreNames.contains('incidents')) {
          const store = db.createObjectStore('incidents', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('category', 'category', { unique: false });
        }

        // Store for offline pending reports awaiting background sync
        if (!db.objectStoreNames.contains('pending_reports')) {
          db.createObjectStore('pending_reports', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('Failed to open IndexedDB for Rasta app:', request.error);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // Cache incidents locally into IndexedDB
  public async cacheIncidents(incidents: CommunityIncident[]): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('incidents', 'readwrite');
      const store = tx.objectStore('incidents');

      for (const incident of incidents) {
        store.put(incident);
      }

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('IndexedDB cacheIncidents error:', err);
    }
  }

  // Load cached incidents from IndexedDB
  public async getCachedIncidents(): Promise<CommunityIncident[]> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('incidents', 'readonly');
      const store = tx.objectStore('incidents');
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const result = (request.result as CommunityIncident[]) || [];
          // Filter out expired incidents
          const active = result.filter(item => !item.expiresAt || item.expiresAt > Date.now());
          resolve(active.sort((a, b) => b.timestamp - a.timestamp));
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('IndexedDB getCachedIncidents error:', err);
      return [];
    }
  }

  // Queue a report created while offline for automatic background sync
  public async queueOfflineReport(incident: CommunityIncident): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction(['pending_reports', 'incidents'], 'readwrite');
      tx.objectStore('pending_reports').put(incident);
      tx.objectStore('incidents').put(incident); // store locally immediately so user sees it

      return new Promise((resolve, reject) => {
        tx.oncomplete = async () => {
          this.notifyStatus();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('IndexedDB queueOfflineReport error:', err);
    }
  }

  // Count pending offline reports
  public async getPendingCount(): Promise<number> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('pending_reports', 'readonly');
      const request = tx.objectStore('pending_reports').count();

      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || 0);
        request.onerror = () => resolve(0);
      });
    } catch {
      return 0;
    }
  }

  // Synchronize queued pending reports when connection is restored
  public async syncPendingReports(
    onSyncSuccess?: (synced: CommunityIncident[]) => void
  ): Promise<number> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('pending_reports', 'readwrite');
      const store = tx.objectStore('pending_reports');
      const getAllReq = store.getAll();

      return new Promise((resolve) => {
        getAllReq.onsuccess = async () => {
          const pending = (getAllReq.result as CommunityIncident[]) || [];
          if (pending.length === 0) {
            resolve(0);
            return;
          }

          // Simulate broadcast sync to community pool
          store.clear();

          if (onSyncSuccess) {
            onSyncSuccess(pending);
          }

          localStorage.setItem('rasta_last_synced', Date.now().toString());
          this.notifyStatus();
          resolve(pending.length);
        };
        getAllReq.onerror = () => resolve(0);
      });
    } catch (err) {
      console.warn('Sync pending reports error:', err);
      return 0;
    }
  }

  // Register listener for online/offline changes and background sync
  public registerNetworkSyncListener(
    callback: (status: SyncStatusInfo) => void
  ): () => void {
    this.listeners.push(callback);

    const handleOnline = async () => {
      // Reconnected to internet: trigger background sync
      await this.syncPendingReports();
      this.notifyStatus();
    };

    const handleOffline = () => {
      this.notifyStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial notification
    this.notifyStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private async notifyStatus() {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const pendingCount = await this.getPendingCount();
    const lastSynced = localStorage.getItem('rasta_last_synced');

    const info: SyncStatusInfo = {
      isOnline,
      lastSyncedTimestamp: lastSynced ? parseInt(lastSynced, 10) : null,
      pendingSyncCount: pendingCount
    };

    for (const listener of this.listeners) {
      try {
        listener(info);
      } catch (e) {
        console.warn('Error notifying sync listener:', e);
      }
    }
  }
}

export const incidentSyncService = new IncidentSyncService();
