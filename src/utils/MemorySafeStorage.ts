import AsyncStorage from '@react-native-async-storage/async-storage';

interface StorageItem {
  data: any;
  timestamp: number;
  size: number;
  expiry?: number;
}

class MemorySafeStorage {
  private static instance: MemorySafeStorage;
  private readonly MAX_STORAGE_SIZE = 150 * 1024 * 1024; // 150MB max like TikTok
  private readonly CLEANUP_THRESHOLD = 0.8; // Clean when 80% full
  private readonly DEFAULT_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  static getInstance(): MemorySafeStorage {
    if (!MemorySafeStorage.instance) {
      MemorySafeStorage.instance = new MemorySafeStorage();
    }
    return MemorySafeStorage.instance;
  }

  // Store data with automatic size management
  async setItem(key: string, value: any, expiry?: number): Promise<void> {
    try {
      const item: StorageItem = {
        data: value,
        timestamp: Date.now(),
        size: this.calculateSize(value),
        expiry: expiry || (Date.now() + this.DEFAULT_EXPIRY)
      };

      const serialized = JSON.stringify(item);
      
      // Check if we need to cleanup before storing
      await this.manageStorageSize(this.calculateSize(serialized));
      
      await AsyncStorage.setItem(key, serialized);
      
    } catch (error) {
      console.error('Storage setItem error:', error);
      // If storage fails, try emergency cleanup and retry once
      await this.emergencyCleanup();
      try {
        const item: StorageItem = {
          data: value,
          timestamp: Date.now(),
          size: this.calculateSize(value),
          expiry: expiry || (Date.now() + this.DEFAULT_EXPIRY)
        };
        await AsyncStorage.setItem(key, JSON.stringify(item));
      } catch (retryError) {
        console.error('Storage setItem retry failed:', retryError);
      }
    }
  }

  // Get data with expiry check
  async getItem(key: string): Promise<any> {
    try {
      const serialized = await AsyncStorage.getItem(key);
      if (!serialized) return null;

      const item: StorageItem = JSON.parse(serialized);
      
      // Check if expired
      if (item.expiry && Date.now() > item.expiry) {
        await AsyncStorage.removeItem(key);
        return null;
      }

      return item.data;
    } catch (error) {
      console.error('Storage getItem error:', error);
      // If parsing fails, remove corrupted item
      await AsyncStorage.removeItem(key);
      return null;
    }
  }

  // Remove item
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Storage removeItem error:', error);
    }
  }

  // Store with memory-safe image caching
  async setImageCache(url: string, data: string): Promise<void> {
    const key = `image_cache_${this.hashString(url)}`;
    await this.setItem(key, data, Date.now() + (6 * 60 * 60 * 1000)); // 6 hours
  }

  // Get cached image
  async getImageCache(url: string): Promise<string | null> {
    const key = `image_cache_${this.hashString(url)}`;
    return await this.getItem(key);
  }

  // Store user data with longer expiry
  async setUserData(key: string, data: any): Promise<void> {
    const userKey = `user_${key}`;
    await this.setItem(userKey, data, Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days
  }

  // Get user data
  async getUserData(key: string): Promise<any> {
    const userKey = `user_${key}`;
    return await this.getItem(userKey);
  }

  // Calculate storage size
  private calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return JSON.stringify(data).length * 2; // Rough estimate
    }
  }

  // Hash string for consistent keys
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Manage storage size like TikTok
  private async manageStorageSize(additionalSize: number = 0): Promise<void> {
    try {
      const currentSize = await this.getCurrentStorageSize();
      const totalSize = currentSize + additionalSize;

      if (totalSize > this.MAX_STORAGE_SIZE * this.CLEANUP_THRESHOLD) {
        console.log(`🧹 Storage cleanup needed: ${Math.round(totalSize / 1024 / 1024)}MB`);
        await this.performCleanup(totalSize - (this.MAX_STORAGE_SIZE * 0.6));
      }
    } catch (error) {
      console.error('Storage size management error:', error);
    }
  }

  // Get current storage size
  private async getCurrentStorageSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      for (const key of keys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            totalSize += this.calculateSize(value);
          }
        } catch (error) {
          console.warn('Error calculating size for key:', key);
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Error getting storage size:', error);
      return 0;
    }
  }

  // Perform smart cleanup
  private async performCleanup(targetReduction: number): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const items: Array<{key: string, item: StorageItem}> = [];

      // Collect all items with metadata
      for (const key of keys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            const item: StorageItem = JSON.parse(value);
            items.push({ key, item });
          }
        } catch (error) {
          // Remove corrupted items
          await AsyncStorage.removeItem(key);
        }
      }

      // Sort by priority (expired first, then oldest)
      items.sort((a, b) => {
        // Expired items first
        const aExpired = a.item.expiry ? Date.now() > a.item.expiry : false;
        const bExpired = b.item.expiry ? Date.now() > b.item.expiry : false;
        
        if (aExpired && !bExpired) return -1;
        if (!aExpired && bExpired) return 1;
        
        // Then by timestamp (oldest first)
        return a.item.timestamp - b.item.timestamp;
      });

      // Remove items until we reach target
      let removedSize = 0;
      for (const { key, item } of items) {
        if (removedSize >= targetReduction) break;

        await AsyncStorage.removeItem(key);
        removedSize += item.size;
      }

      console.log(`🗑️ Cleaned up ${Math.round(removedSize / 1024 / 1024)}MB of storage`);
    } catch (error) {
      console.error('Storage cleanup error:', error);
    }
  }

  // Emergency cleanup for critical situations
  private async emergencyCleanup(): Promise<void> {
    try {
      console.log('🚨 Emergency storage cleanup triggered');
      
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        key.includes('cache_') || 
        key.includes('temp_') || 
        key.includes('image_')
      );

      // Remove all cache items
      await AsyncStorage.multiRemove(cacheKeys);
      
      console.log(`🗑️ Emergency cleanup removed ${cacheKeys.length} cache items`);
    } catch (error) {
      console.error('Emergency cleanup error:', error);
    }
  }

  // Clear all expired items
  async clearExpired(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const expiredKeys: string[] = [];

      for (const key of keys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            const item: StorageItem = JSON.parse(value);
            if (item.expiry && Date.now() > item.expiry) {
              expiredKeys.push(key);
            }
          }
        } catch (error) {
          // Add corrupted items to removal list
          expiredKeys.push(key);
        }
      }

      if (expiredKeys.length > 0) {
        await AsyncStorage.multiRemove(expiredKeys);
        console.log(`🗑️ Removed ${expiredKeys.length} expired items`);
      }
    } catch (error) {
      console.error('Clear expired error:', error);
    }
  }

  // Get storage statistics
  async getStorageStats(): Promise<{
    totalSize: number;
    itemCount: number;
    maxSize: number;
    usagePercentage: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const totalSize = await this.getCurrentStorageSize();

      return {
        totalSize,
        itemCount: keys.length,
        maxSize: this.MAX_STORAGE_SIZE,
        usagePercentage: (totalSize / this.MAX_STORAGE_SIZE) * 100
      };
    } catch (error) {
      console.error('Storage stats error:', error);
      return {
        totalSize: 0,
        itemCount: 0,
        maxSize: this.MAX_STORAGE_SIZE,
        usagePercentage: 0
      };
    }
  }
}

export default MemorySafeStorage.getInstance();
