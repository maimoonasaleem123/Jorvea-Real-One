/**
 * Instant Reels Preloader Service
 * Preloads reels data in background for instant access
 * Instagram-style instant loading experience
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import UltraFastInstantService from './UltraFastInstantService';

interface PreloadedReelsCache {
  reels: any[];
  timestamp: number;
  userId: string;
}

class InstantReelsPreloader {
  private static instance: InstantReelsPreloader;
  private cache: Map<string, PreloadedReelsCache> = new Map();
  private preloadTimer: NodeJS.Timeout | null = null;
  private isPreloading = false;

  static getInstance(): InstantReelsPreloader {
    if (!InstantReelsPreloader.instance) {
      InstantReelsPreloader.instance = new InstantReelsPreloader();
    }
    return InstantReelsPreloader.instance;
  }

  /**
   * Initialize preloader and start background preloading
   */
  async initialize(userId: string): Promise<void> {
    if (!userId) return;

    console.log('⚡ Initializing Instant Reels Preloader for user:', userId);

    try {
      // Load cached reels from AsyncStorage
      await this.loadCachedReels(userId);

      // Start background preloading
      this.startBackgroundPreloading(userId);

      console.log('✅ Instant Reels Preloader initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize reels preloader:', error);
    }
  }

  /**
   * Get instant reels (from cache if available, otherwise load)
   */
  async getInstantReels(userId: string, count: number = 10): Promise<any[]> {
    if (!userId) return [];

    // Check cache first
    const cached = this.cache.get(userId);
    if (cached && this.isCacheValid(cached)) {
      console.log('⚡ Returning cached reels instantly!', cached.reels.length);
      
      // Trigger background refresh
      setTimeout(() => {
        this.preloadReels(userId, count);
      }, 500);
      
      return cached.reels.slice(0, count);
    }

    // No cache available, load immediately
    console.log('📱 No cache available, loading reels...');
    return await this.loadAndCacheReels(userId, count);
  }

  /**
   * Preload reels in background
   */
  private async preloadReels(userId: string, count: number = 15): Promise<void> {
    if (this.isPreloading) return;

    try {
      this.isPreloading = true;
      console.log('🔄 Background preloading reels...');

      const ultraFastService = UltraFastInstantService.getInstance();
      const reels = await ultraFastService.getInstantReels(userId, count);

      if (reels.length > 0) {
        const cacheData: PreloadedReelsCache = {
          reels,
          timestamp: Date.now(),
          userId,
        };

        // Update memory cache
        this.cache.set(userId, cacheData);

        // Update AsyncStorage cache
        await this.saveCacheToStorage(userId, cacheData);

        console.log(`✅ Preloaded ${reels.length} reels in background`);
      }
    } catch (error) {
      console.error('❌ Background preloading failed:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Load and cache reels immediately
   */
  private async loadAndCacheReels(userId: string, count: number): Promise<any[]> {
    try {
      const ultraFastService = UltraFastInstantService.getInstance();
      const reels = await ultraFastService.getInstantReels(userId, count);

      if (reels.length > 0) {
        const cacheData: PreloadedReelsCache = {
          reels,
          timestamp: Date.now(),
          userId,
        };

        // Update cache
        this.cache.set(userId, cacheData);
        await this.saveCacheToStorage(userId, cacheData);
      }

      return reels;
    } catch (error) {
      console.error('❌ Failed to load and cache reels:', error);
      return [];
    }
  }

  /**
   * Start continuous background preloading
   */
  private startBackgroundPreloading(userId: string): void {
    // Clear existing timer
    if (this.preloadTimer) {
      clearInterval(this.preloadTimer);
    }

    // Preload immediately
    setTimeout(() => {
      this.preloadReels(userId);
    }, 2000);

    // Set up periodic preloading (every 2 minutes)
    this.preloadTimer = setInterval(() => {
      this.preloadReels(userId);
    }, 120000); // 2 minutes
  }

  /**
   * Load cached reels from AsyncStorage
   */
  private async loadCachedReels(userId: string): Promise<void> {
    try {
      const cacheKey = `reels_cache_${userId}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);

      if (cachedData) {
        const parsed: PreloadedReelsCache = JSON.parse(cachedData);
        if (this.isCacheValid(parsed)) {
          this.cache.set(userId, parsed);
          console.log(`✅ Loaded ${parsed.reels.length} cached reels from storage`);
        } else {
          console.log('⚠️ Cached reels expired, will refresh');
          await AsyncStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load cached reels:', error);
    }
  }

  /**
   * Save cache to AsyncStorage
   */
  private async saveCacheToStorage(userId: string, cacheData: PreloadedReelsCache): Promise<void> {
    try {
      const cacheKey = `reels_cache_${userId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('❌ Failed to save cache to storage:', error);
    }
  }

  /**
   * Check if cache is still valid (5 minutes)
   */
  private isCacheValid(cache: PreloadedReelsCache): boolean {
    const fiveMinutes = 5 * 60 * 1000;
    return (Date.now() - cache.timestamp) < fiveMinutes;
  }

  /**
   * Force refresh cache
   */
  async refreshCache(userId: string): Promise<void> {
    if (!userId) return;

    console.log('🔄 Force refreshing reels cache...');
    
    // Clear existing cache
    this.cache.delete(userId);
    
    const cacheKey = `reels_cache_${userId}`;
    await AsyncStorage.removeItem(cacheKey);

    // Preload fresh data
    await this.preloadReels(userId);
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    console.log('🧹 Clearing all reels cache...');
    
    this.cache.clear();
    
    if (this.preloadTimer) {
      clearInterval(this.preloadTimer);
      this.preloadTimer = null;
    }

    // Clear AsyncStorage cache
    try {
      const keys = await AsyncStorage.getAllKeys();
      const reelsCacheKeys = keys.filter(key => key.startsWith('reels_cache_'));
      await AsyncStorage.multiRemove(reelsCacheKeys);
    } catch (error) {
      console.error('❌ Failed to clear cache from storage:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { cacheSize: number; entries: string[] } {
    return {
      cacheSize: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Preload trending reels for discovery
   */
  async preloadTrendingReels(): Promise<void> {
    try {
      console.log('🔥 Preloading trending reels...');
      const ultraFastService = UltraFastInstantService.getInstance();
      
      // This would preload trending/popular reels for discovery
      // Implementation depends on your trending algorithm
      
      console.log('✅ Trending reels preloaded');
    } catch (error) {
      console.error('❌ Failed to preload trending reels:', error);
    }
  }
}

export default InstantReelsPreloader;
