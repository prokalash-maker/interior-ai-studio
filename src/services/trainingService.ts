/**
 * trainingService.ts
 * AI Model Training, LoRA Management & Dataset Pair Studio
 * Interior AI Studio v2.1.0 Pro
 */

import { comfyuiProvider } from './ai/ComfyUIProvider';

export interface DatasetPair {
  id: string;
  sourceBase64: string;
  outputBase64: string;
  prompt: string;
  styleName: string;
  roomType: string;
  timestamp: number;
  tags: string[];
}

class TrainingService {
  private dataset: DatasetPair[] = [];
  private installedLoras: string[] = [];
  private dbPromise: Promise<IDBDatabase | null>;
  private readyPromise: Promise<DatasetPair[]>;

  constructor() {
    this.dbPromise = this.openDatabase();
    this.readyPromise = this.initializeDataset();
  }

  private openDatabase(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise((resolve) => {
      const request = indexedDB.open('InteriorAITraining', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('pairs')) db.createObjectStore('pairs', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }

  loadDataset(): Promise<DatasetPair[]> {
    return this.readyPromise;
  }

  private async initializeDataset(): Promise<DatasetPair[]> {
    try {
      const db = await this.dbPromise;
      if (db) {
        const saved = await new Promise<DatasetPair[]>((resolve) => {
          const request = db.transaction('pairs', 'readonly').objectStore('pairs').getAll();
          request.onsuccess = () => resolve((request.result || []) as DatasetPair[]);
          request.onerror = () => resolve([]);
        });
        this.dataset = saved.sort((a, b) => b.timestamp - a.timestamp);
        if (this.dataset.length === 0) {
          const legacy = localStorage.getItem('interior_ai_training_dataset');
          if (legacy) {
            const oldPairs = JSON.parse(legacy) as DatasetPair[];
            for (const pair of oldPairs) await this.putPair(pair);
            this.dataset = oldPairs;
            localStorage.removeItem('interior_ai_training_dataset');
          }
        }
      } else {
        const saved = localStorage.getItem('interior_ai_training_dataset');
        if (saved) this.dataset = JSON.parse(saved);
      }
    } catch (_) {}
    return this.dataset;
  }

  private saveDataset() {
    try {
      localStorage.setItem('interior_ai_training_dataset', JSON.stringify(this.dataset));
    } catch (_) {}
  }

  private async putPair(pair: DatasetPair): Promise<void> {
    const db = await this.dbPromise;
    if (!db) return;
    await new Promise<void>((resolve) => {
      const request = db.transaction('pairs', 'readwrite').objectStore('pairs').put(pair);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  getDataset(): DatasetPair[] {
    return this.dataset;
  }

  async addPairToDataset(pair: Omit<DatasetPair, 'id' | 'timestamp'>): Promise<DatasetPair> {
    await this.readyPromise;
    const item: DatasetPair = {
      ...pair,
      id: 'pair_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
    };
    this.dataset.unshift(item);
    const db = await this.dbPromise;
    if (db) await this.putPair(item);
    else this.saveDataset();
    return item;
  }

  async removePair(id: string): Promise<void> {
    this.dataset = this.dataset.filter((p) => p.id !== id);
    const db = await this.dbPromise;
    if (db) {
      await new Promise<void>((resolve) => {
        const request = db.transaction('pairs', 'readwrite').objectStore('pairs').delete(id);
        request.onsuccess = () => resolve(); request.onerror = () => resolve();
      });
    } else this.saveDataset();
  }

  async clearDataset(): Promise<void> {
    this.dataset = [];
    const db = await this.dbPromise;
    if (db) {
      await new Promise<void>((resolve) => {
        const request = db.transaction('pairs', 'readwrite').objectStore('pairs').clear();
        request.onsuccess = () => resolve(); request.onerror = () => resolve();
      });
    } else this.saveDataset();
  }

  async scanLocalLoras(): Promise<string[]> {
    try {
      if (window.electronAPI?.scanModelsFolder) {
        const res = await window.electronAPI.scanModelsFolder();
        this.installedLoras = (res.loras || []).map((l: any) => l.name);
      }
    } catch (_) {}

    try {
      const obj = await (comfyuiProvider as any).request('/object_info/LoraLoader');
      const list = obj?.LoraLoader?.input?.required?.lora_name?.[0];
      if (Array.isArray(list) && list.length > 0) {
        this.installedLoras = list;
      }
    } catch (_) {}

    return this.installedLoras;
  }

  getInstalledLoras(): string[] {
    return this.installedLoras;
  }

}

export const trainingService = new TrainingService();
