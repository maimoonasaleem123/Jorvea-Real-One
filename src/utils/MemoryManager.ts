import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';

interface StorageItem {
  key: string;
  size: number;
  lastAccessed: number;
}

class MemoryManager {
  private static instance: MemoryManager;
  private maxStorageSize = 500 * 1024 * 1024; // 500MB max
  private cleanupThreshold = 400 * 1024 * 1024; // 400MB cleanup threshold
  private storageMap = new Map<string, StorageItem>();
  private isCleaningUp = false;

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  private constructor() {
    this.initializeStorageMap();
    this.schedulePeriodicCleanup();
  }

  private async initializeStorageMap() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      for (const key of keys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            this.storageMap.set(key, {
              key,
              size: value.length,
              lastAccessed: Date.now(),
            });
          }
        } catch (e) {
          console.warn(`Failed to read storage item ${key}:`, e);
        }
      }
    } catch (error) {
      console.error('Failed to initialize storage map:', error);
    }
  }

  private schedulePeriodicCleanup() {
    // Clean up every 5 minutes
    setInterval(() => {
      this.performCleanupIfNeeded();
    }, 5 * 60 * 1000);

    // Also clean up when app becomes active
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        this.performCleanupIfNeeded();
      }
    };
  }

  async setItem(key: string, value: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    try {
      // Check if we need cleanup before storing
      await this.performCleanupIfNeeded();

      await AsyncStorage.setItem(key, value);
      
      this.storageMap.set(key, {
        key,
        size: value.length,
        lastAccessed: Date.now(),
      });

      // Mark high priority items
      if (priority === 'high') {
        this.storageMap.get(key)!.lastAccessed = Date.now() + (365 * 24 * 60 * 60 * 1000); // Future date
      }
    } catch (error) {
      console.error('Failed to set storage item:', error);
      throw error;
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value && this.storageMap.has(key)) {
        // Update last accessed time
        const item = this.storageMap.get(key)!;
        item.lastAccessed = Date.now();
      }
      return value;
    } catch (error) {
      console.error('Failed to get storage item:', error);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
      this.storageMap.delete(key);
    } catch (error) {
      console.error('Failed to remove storage item:', error);
    }
  }

  private async performCleanupIfNeeded(): Promise<void> {
    if (this.isCleaningUp) return;

    try {
      this.isCleaningUp = true;
      const currentSize = this.getCurrentStorageSize();

      if (currentSize > this.cleanupThreshold) {
        console.log('🧹 Starting storage cleanup, current size:', currentSize / 1024 / 1024, 'MB');
        await this.cleanupOldData();
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    } finally {
      this.isCleaningUp = false;
    }
  }

  private getCurrentStorageSize(): number {
    let totalSize = 0;
    for (const item of this.storageMap.values()) {
      totalSize += item.size;
    }
    return totalSize;
  }

  private async cleanupOldData(): Promise<void> {
    const sortedItems = Array.from(this.storageMap.values())
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    const targetSize = this.maxStorageSize * 0.7; // Clean to 70% capacity
    let currentSize = this.getCurrentStorageSize();
    const itemsToRemove: string[] = [];

    for (const item of sortedItems) {
      if (currentSize <= targetSize) break;
      
      // Don't remove critical items (user data, auth tokens, etc.)
      if (this.isCriticalData(item.key)) continue;
      
      itemsToRemove.push(item.key);
      currentSize -= item.size;
    }

    // Remove items in batches to avoid blocking the main thread
    const batchSize = 10;
    for (let i = 0; i < itemsToRemove.length; i += batchSize) {
      const batch = itemsToRemove.slice(i, i + batchSize);
      
      await new Promise(resolve => {
        InteractionManager.runAfterInteractions(async () => {
          for (const key of batch) {
            await this.removeItem(key);
          }
          resolve(void 0);
        });
      });
    }

    console.log('🧹 Cleanup complete, removed', itemsToRemove.length, 'items');
  }

  private isCriticalData(key: string): boolean {
    const criticalPrefixes = [
      'user_',
      'auth_',
      'settings_',
      'profile_',
      'session_',
      'token_',
    ];

    return criticalPrefixes.some(prefix => key.startsWith(prefix));
  }

  // Memory optimization methods
  public clearImageCache(): Promise<void> {
    return this.clearCacheByPrefix('image_cache_');
  }

  public clearVideoCache(): Promise<void> {
    return this.clearCacheByPrefix('video_cache_');
  }

  public clearOldMessages(): Promise<void> {
    return this.clearCacheByPrefix('message_cache_');
  }

  private async clearCacheByPrefix(prefix: string): Promise<void> {
    const keysToRemove = Array.from(this.storageMap.keys())
      .filter(key => key.startsWith(prefix));

    for (const key of keysToRemove) {
      await this.removeItem(key);
    }
  }

  public async getStorageStats(): Promise<{ totalSize: number; itemCount: number }> {
    return {
      totalSize: this.getCurrentStorageSize(),
      itemCount: this.storageMap.size,
    };
  }
}

export default MemoryManager.getInstance();
