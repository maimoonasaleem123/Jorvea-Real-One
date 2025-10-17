import { InteractionManager, Platform, Dimensions, AppState, DeviceEventEmitter, PixelRatio } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PerformanceConfig {
  maxConcurrentImages: number;
  maxConcurrentVideos: number;
  imageQuality: number;
  enableLazyLoading: boolean;
  preloadDistance: number;
  maxStorageSize: number;
  cleanupInterval: number;
}

class PerformanceManager {
  private static instance: PerformanceManager;
  private config: PerformanceConfig;
  private activeImages = new Set<string>();
  private activeVideos = new Set<string>();
  private taskQueue: (() => Promise<void>)[] = [];
  private isProcessingQueue = false;
  private memoryWarningCount = 0;
  private lastCleanupTime = 0;
  private cleanupTimer: any = null;

  static getInstance(): PerformanceManager {
    if (!PerformanceManager.instance) {
      PerformanceManager.instance = new PerformanceManager();
    }
    return PerformanceManager.instance;
  }

  private constructor() {
    this.config = this.getOptimalConfig();
    this.initialize();
  }

  private getOptimalConfig(): PerformanceConfig {
    const { width, height } = Dimensions.get('window');
    const pixelDensity = PixelRatio.get();
    const totalPixels = width * height * pixelDensity;

    // Adjust config based on device capabilities
    if (totalPixels > 3000000) { // High-end device
      return {
        maxConcurrentImages: 15,
        maxConcurrentVideos: 3,
        imageQuality: 0.8,
        enableLazyLoading: true,
        preloadDistance: 2,
        maxStorageSize: 300 * 1024 * 1024, // 300MB
        cleanupInterval: 15000, // 15 seconds
      };
    } else if (totalPixels > 1500000) { // Mid-range device
      return {
        maxConcurrentImages: 10,
        maxConcurrentVideos: 2,
        imageQuality: 0.7,
        enableLazyLoading: true,
        preloadDistance: 1,
        maxStorageSize: 200 * 1024 * 1024, // 200MB
        cleanupInterval: 20000, // 20 seconds
      };
    } else { // Low-end device
      return {
        maxConcurrentImages: 5,
        maxConcurrentVideos: 1,
        imageQuality: 0.6,
        enableLazyLoading: true,
        preloadDistance: 0,
        maxStorageSize: 100 * 1024 * 1024, // 100MB
        cleanupInterval: 30000, // 30 seconds
      };
    }
  }

  private initialize(): void {
    this.startQueueProcessor();
    this.setupMemoryWarnings();
    this.startPeriodicCleanup();
    this.setupAppStateHandling();
  }

  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 100); // Process queue every 100ms
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.taskQueue.length === 0) return;

    this.isProcessingQueue = true;
    
    try {
      while (this.taskQueue.length > 0) {
        const task = this.taskQueue.shift();
        if (task) {
          await new Promise<void>(resolve => {
            InteractionManager.runAfterInteractions(async () => {
              try {
                await task();
              } catch (error) {
                console.error('Task execution failed:', error);
              }
              resolve();
            });
          });
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private setupMemoryWarnings(): void {
    if (Platform.OS === 'ios') {
      DeviceEventEmitter.addListener('memoryWarning', () => {
        this.handleMemoryWarning();
      });
    }
  }

  private setupAppStateHandling(): void {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        this.performCleanup();
      }
    });
  }

  private handleMemoryWarning(): void {
    this.memoryWarningCount++;
    console.warn(`Memory warning received (${this.memoryWarningCount})`);
    
    // Clear caches immediately
    this.clearImageCache();
    this.performCleanup();
    
    // Force garbage collection if available
    if ((global as any).gc) {
      (global as any).gc();
    }
  }

  private startPeriodicCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  private async performCleanup(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanupTime < this.config.cleanupInterval / 2) {
      return; // Too soon since last cleanup
    }

    this.lastCleanupTime = now;
    
    try {
      await this.limitStorageSize();
      await this.clearOldCache();
      this.clearUnusedImages();
      this.clearUnusedVideos();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  private clearImageCache(): void {
    try {
      // Clear React Native Image cache
      const { Image } = require('react-native');
      if (Image.clearMemoryCache) {
        Image.clearMemoryCache();
      }
      if (Image.clearDiskCache) {
        Image.clearDiskCache();
      }
    } catch (error) {
      console.warn('Error clearing image cache:', error);
    }
  }

  private async limitStorageSize(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      const items: Array<{key: string, size: number, timestamp: number}> = [];

      for (const key of keys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            const size = new Blob([value]).size;
            totalSize += size;
            
            const timestamp = this.extractTimestamp(key) || Date.now();
            items.push({ key, size, timestamp });
          }
        } catch (error) {
          console.warn('Error checking storage item:', key, error);
        }
      }

      if (totalSize > this.config.maxStorageSize) {
        await this.cleanupOldStorage(items, totalSize);
      }
    } catch (error) {
      console.error('Error managing storage size:', error);
    }
  }

  private extractTimestamp(key: string): number | null {
    const match = key.match(/timestamp_(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  private async cleanupOldStorage(items: Array<{key: string, size: number, timestamp: number}>, totalSize: number): Promise<void> {
    items.sort((a, b) => a.timestamp - b.timestamp);

    let removedSize = 0;
    const targetReduction = totalSize - (this.config.maxStorageSize * 0.7);

    for (const item of items) {
      if (removedSize >= targetReduction) {
        break;
      }

      try {
        await AsyncStorage.removeItem(item.key);
        removedSize += item.size;
      } catch (error) {
        console.error('Error removing storage item:', item.key, error);
      }
    }
  }

  private async clearOldCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        key.includes('cache_') || 
        key.includes('temp_') ||
        key.includes('image_')
      );

      const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);
      
      for (const key of cacheKeys) {
        const timestamp = this.extractTimestamp(key);
        if (timestamp && timestamp < sixHoursAgo) {
          await AsyncStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Error clearing old cache:', error);
    }
  }

  private clearUnusedImages(): void {
    // Keep only recent images
    if (this.activeImages.size > this.config.maxConcurrentImages) {
      const imagesToRemove = Array.from(this.activeImages).slice(0, this.activeImages.size - this.config.maxConcurrentImages);
      imagesToRemove.forEach(img => this.activeImages.delete(img));
    }
  }

  private clearUnusedVideos(): void {
    // Keep only recent videos
    if (this.activeVideos.size > this.config.maxConcurrentVideos) {
      const videosToRemove = Array.from(this.activeVideos).slice(0, this.activeVideos.size - this.config.maxConcurrentVideos);
      videosToRemove.forEach(vid => this.activeVideos.delete(vid));
    }
  }

  public async forceCleanup(): Promise<void> {
    console.log('Force cleanup triggered');
    this.handleMemoryWarning();
    await this.performCleanup();
  }

  public getMemoryInfo() {
    return {
      memoryWarnings: this.memoryWarningCount,
      lastCleanup: this.lastCleanupTime,
      activeImages: this.activeImages.size,
      activeVideos: this.activeVideos.size,
      queueLength: this.taskQueue.length,
      config: this.config
    };
  }

  public canLoadImage(imageId: string): boolean {
    if (this.activeImages.has(imageId)) return true;
    return this.activeImages.size < this.config.maxConcurrentImages;
  }

  public canLoadVideo(videoId: string): boolean {
    if (this.activeVideos.has(videoId)) return true;
    return this.activeVideos.size < this.config.maxConcurrentVideos;
  }

  public registerImageLoad(imageId: string): void {
    this.activeImages.add(imageId);
  }

  public unregisterImageLoad(imageId: string): void {
    this.activeImages.delete(imageId);
  }

  public registerVideoLoad(videoId: string): void {
    this.activeVideos.add(videoId);
  }

  public unregisterVideoLoad(videoId: string): void {
    this.activeVideos.delete(videoId);
  }

  public addTask(task: () => Promise<void>): void {
    this.taskQueue.push(task);
  }

  public getImageQuality(): number {
    return this.config.imageQuality;
  }

  public shouldUseLazyLoading(): boolean {
    return this.config.enableLazyLoading;
  }

  public getPreloadDistance(): number {
    return this.config.preloadDistance;
  }

  // Memory pressure handling
  public handleMemoryPressure(): void {
    console.log('🔥 Memory pressure detected, reducing performance');
    
    // Reduce concurrent loads
    this.config.maxConcurrentImages = Math.max(3, Math.floor(this.config.maxConcurrentImages * 0.7));
    this.config.maxConcurrentVideos = Math.max(1, Math.floor(this.config.maxConcurrentVideos * 0.7));
    this.config.imageQuality *= 0.9;
    
    // Clear some active items
    const imagesToClear = Array.from(this.activeImages).slice(this.config.maxConcurrentImages);
    const videosToClear = Array.from(this.activeVideos).slice(this.config.maxConcurrentVideos);
    
    imagesToClear.forEach(id => this.activeImages.delete(id));
    videosToClear.forEach(id => this.activeVideos.delete(id));
    
    // Clear task queue to reduce pressure
    this.taskQueue.splice(Math.floor(this.taskQueue.length / 2));
  }

  public resetPerformanceConfig(): void {
    this.config = this.getOptimalConfig();
  }

  public getPerformanceStats(): {
    activeImages: number;
    activeVideos: number;
    queueLength: number;
    config: PerformanceConfig;
  } {
    return {
      activeImages: this.activeImages.size,
      activeVideos: this.activeVideos.size,
      queueLength: this.taskQueue.length,
      config: { ...this.config },
    };
  }

  // Debounced function helper
  public debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: any;
    return function executedFunction(...args: Parameters<T>) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttled function helper
  public throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return function executedFunction(this: any, ...args: Parameters<T>) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }
}

export default PerformanceManager.getInstance();
