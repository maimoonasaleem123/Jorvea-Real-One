/**
 * 🖼️ PERFECT INSTANT THUMBNAIL SYSTEM
 * Zero-error fallback with instant display
 */

import { Image } from 'react-native';

interface ThumbnailData {
  reelId: string;
  thumbnailUrl: string;
  videoUrl: string;
  loaded: boolean;
  loading: boolean;
  cached: boolean;
  blurDataURL?: string;
  error?: any;
}

class PerfectInstantThumbnailSystem {
  private thumbnailCache: Map<string, ThumbnailData> = new Map();
  private imageCache: Map<string, boolean> = new Map();
  private prefetchQueue: string[] = [];
  private maxCacheSize = 50; // Keep 50 thumbnails

  /**
   * ⚡ PREPARE THUMBNAIL (Never fails)
   */
  public async prepareThumbnail(
    reelId: string,
    thumbnailUrl: string,
    videoUrl: string
  ): Promise<ThumbnailData> {
    console.log(`⚡ Preparing perfect thumbnail: ${reelId}`);

    // Check cache first
    const cached = this.thumbnailCache.get(reelId);
    if (cached) {
      return cached;
    }

    // Create thumbnail data with safe defaults
    const thumbnailData: ThumbnailData = {
      reelId,
      thumbnailUrl: thumbnailUrl || '', // Safe fallback
      videoUrl: videoUrl || '',
      loaded: false,
      loading: false,
      cached: false,
      blurDataURL: this.generateDefaultBlur()
    };

    this.thumbnailCache.set(reelId, thumbnailData);

    // Only try to load if we have a valid URL
    if (thumbnailUrl && thumbnailUrl.trim() !== '') {
      this.loadThumbnailSafely(thumbnailData);
    } else {
      // Mark as loaded with default blur
      thumbnailData.loaded = true;
    }

    return thumbnailData;
  }

  /**
   * 🔄 LOAD THUMBNAIL SAFELY
   */
  private async loadThumbnailSafely(thumbnailData: ThumbnailData): Promise<void> {
    if (thumbnailData.loading || thumbnailData.loaded) return;

    thumbnailData.loading = true;

    try {
      // Use React Native's Image.prefetch with timeout
      const prefetchPromise = Image.prefetch(thumbnailData.thumbnailUrl);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );

      await Promise.race([prefetchPromise, timeoutPromise]);
      
      // Successfully loaded
      thumbnailData.loaded = true;
      thumbnailData.cached = true;
      thumbnailData.error = null;
      
      console.log(`✅ Thumbnail loaded: ${thumbnailData.reelId}`);
    } catch (error) {
      // Silent fail - keep using blur placeholder
      thumbnailData.loaded = true; // Mark as loaded to stop retry
      thumbnailData.error = error;
      console.log(`📷 Using blur placeholder: ${thumbnailData.reelId}`);
    } finally {
      thumbnailData.loading = false;
    }
  }

  /**
   * 🎨 GENERATE DEFAULT BLUR
   */
  private generateDefaultBlur(): string {
    // Generate a simple gradient blur placeholder
    const colors = ['#4f46e5', '#7c3aed', '#db2777', '#dc2626'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Return a simple color as base64 (1x1 pixel)
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
  }

  /**
   * 📷 GET INSTANT DISPLAY STRATEGY
   */
  public getInstantDisplayStrategy(reelId: string): {
    shouldShowBlur: boolean;
    shouldShowThumbnail: boolean;
    shouldShowFirstFrame: boolean;
    thumbnailUrl: string;
    blurDataURL: string;
  } {
    const thumbnailData = this.thumbnailCache.get(reelId);
    
    if (!thumbnailData) {
      return {
        shouldShowBlur: true,
        shouldShowThumbnail: false,
        shouldShowFirstFrame: false,
        thumbnailUrl: '',
        blurDataURL: this.generateDefaultBlur()
      };
    }

    return {
      shouldShowBlur: !thumbnailData.loaded || !thumbnailData.thumbnailUrl,
      shouldShowThumbnail: thumbnailData.loaded && !!thumbnailData.thumbnailUrl && !thumbnailData.error,
      shouldShowFirstFrame: false, // Will be handled by video component
      thumbnailUrl: thumbnailData.thumbnailUrl || '',
      blurDataURL: thumbnailData.blurDataURL || this.generateDefaultBlur()
    };
  }

  /**
   * 🚀 PREFETCH THUMBNAILS (Safe bulk loading)
   */
  public async prefetchThumbnails(reelIds: string[], thumbnailUrls: string[], videoUrls: string[]): Promise<void> {
    console.log(`🚀 Prefetching ${reelIds.length} thumbnails safely`);
    
    const prefetchPromises = reelIds.map(async (reelId, index) => {
      try {
        const thumbnailUrl = thumbnailUrls[index] || '';
        const videoUrl = videoUrls[index] || '';
        
        if (!this.thumbnailCache.has(reelId)) {
          await this.prepareThumbnail(reelId, thumbnailUrl, videoUrl);
        }
      } catch (error) {
        // Silent fail for individual thumbnails
        console.log(`🔇 Silent prefetch fail: ${reelId}`);
      }
    });

    // Wait for all with timeout
    try {
      await Promise.allSettled(prefetchPromises);
      console.log(`✅ Thumbnail prefetching complete`);
    } catch (error) {
      console.log(`📷 Prefetch completed with some failures`);
    }
  }

  /**
   * 📊 GET LOADING STATE
   */
  public getLoadingState(reelId: string): {
    isLoading: boolean;
    isLoaded: boolean;
    hasError: boolean;
    error?: any;
  } {
    const thumbnailData = this.thumbnailCache.get(reelId);
    
    if (!thumbnailData) {
      return {
        isLoading: false,
        isLoaded: false,
        hasError: false
      };
    }

    return {
      isLoading: thumbnailData.loading,
      isLoaded: thumbnailData.loaded,
      hasError: !!thumbnailData.error,
      error: thumbnailData.error
    };
  }

  /**
   * 🧹 CLEANUP
   */
  public cleanup(): void {
    // Clear cache but keep some recent items
    if (this.thumbnailCache.size > this.maxCacheSize) {
      const entries = Array.from(this.thumbnailCache.entries());
      const toKeep = entries.slice(-this.maxCacheSize);
      
      this.thumbnailCache.clear();
      this.imageCache.clear();
      
      toKeep.forEach(([key, value]) => {
        this.thumbnailCache.set(key, value);
      });
    }
    
    this.prefetchQueue = [];
    console.log('🧹 Perfect thumbnail system cleaned up');
  }

  /**
   * 💾 GET CACHED THUMBNAIL URL
   */
  public getCachedThumbnailUrl(reelId: string): string {
    const thumbnailData = this.thumbnailCache.get(reelId);
    if (thumbnailData?.loaded && !thumbnailData.error) {
      return thumbnailData.thumbnailUrl;
    }
    return '';
  }

  /**
   * 🎯 IS THUMBNAIL READY
   */
  public isThumbnailReady(reelId: string): boolean {
    const thumbnailData = this.thumbnailCache.get(reelId);
    return thumbnailData?.loaded || false;
  }

  /**
   * 📈 GET CACHE STATS
   */
  public getCacheStats(): {
    totalCached: number;
    loadedSuccessfully: number;
    withErrors: number;
  } {
    const totalCached = this.thumbnailCache.size;
    const loadedSuccessfully = Array.from(this.thumbnailCache.values())
      .filter(t => t.loaded && !t.error).length;
    const withErrors = Array.from(this.thumbnailCache.values())
      .filter(t => t.error).length;

    return {
      totalCached,
      loadedSuccessfully,
      withErrors
    };
  }
}

export default PerfectInstantThumbnailSystem;
