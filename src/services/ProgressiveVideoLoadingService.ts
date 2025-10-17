/**
 * Progressive Video Loading Service
 * Implements Instagram-like video streaming with progressive loading
 * - Loads videos in small chunks (buffer)
 * - Starts playback immediately after minimal buffer
 * - Preloads next videos while current is playing
 * - Manages video cache and quality optimization
 */

import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export interface VideoLoadingConfig {
  minBufferSize: number; // Minimum buffer before starting playback (seconds)
  maxBufferSize: number; // Maximum buffer to maintain
  preloadCount: number; // Number of videos to preload ahead
  enablePreloading: boolean; // Whether to preload next videos
  adaptiveQuality: boolean; // Adjust quality based on network
  maxCacheSize: number; // Maximum cache size in MB
}

export interface VideoBufferInfo {
  videoId: string;
  url: string;
  bufferedDuration: number;
  totalDuration: number;
  isBuffering: boolean;
  isReady: boolean; // Ready to start playback
  quality: 'low' | 'medium' | 'high';
  cacheSize: number; // In bytes
}

export interface NetworkQuality {
  type: string;
  isConnected: boolean;
  speed: 'slow' | 'medium' | 'fast';
  bandwidth: number; // Estimated in Mbps
}

class ProgressiveVideoLoadingService {
  private static instance: ProgressiveVideoLoadingService;
  
  // Configuration
  private config: VideoLoadingConfig = {
    minBufferSize: 3, // 3 seconds minimum buffer (Instagram-like)
    maxBufferSize: 15, // 15 seconds maximum buffer
    preloadCount: 2, // Preload 2 videos ahead
    enablePreloading: true,
    adaptiveQuality: true,
    maxCacheSize: 200, // 200MB cache limit
  };

  // Video buffer management
  private videoBuffers: Map<string, VideoBufferInfo> = new Map();
  private preloadQueue: string[] = [];
  private currentlyLoading: Set<string> = new Set();
  private networkQuality: NetworkQuality = {
    type: 'unknown',
    isConnected: true,
    speed: 'medium',
    bandwidth: 5
  };

  // Cache management
  private cacheUsage = 0; // Total cache usage in bytes
  private loadingProgress: Map<string, number> = new Map(); // Progress 0-100

  private constructor() {
    this.initializeNetworkMonitoring();
    this.optimizeConfigForPlatform();
  }

  public static getInstance(): ProgressiveVideoLoadingService {
    if (!ProgressiveVideoLoadingService.instance) {
      ProgressiveVideoLoadingService.instance = new ProgressiveVideoLoadingService();
    }
    return ProgressiveVideoLoadingService.instance;
  }

  /**
   * Initialize network monitoring for adaptive quality
   */
  private async initializeNetworkMonitoring(): Promise<void> {
    try {
      const state = await NetInfo.fetch();
      this.updateNetworkQuality(state);

      NetInfo.addEventListener(state => {
        this.updateNetworkQuality(state);
      });
    } catch (error) {
      console.warn('Progressive Video: Network monitoring failed', error);
    }
  }

  /**
   * Update network quality assessment
   */
  private updateNetworkQuality(netInfo: any): void {
    this.networkQuality = {
      type: netInfo.type || 'unknown',
      isConnected: netInfo.isConnected || false,
      speed: this.assessNetworkSpeed(netInfo),
      bandwidth: this.estimateBandwidth(netInfo)
    };

    // Adjust configuration based on network
    if (this.config.adaptiveQuality) {
      this.adaptConfigToNetwork();
    }

    console.log('📡 Network Quality Updated:', this.networkQuality);
  }

  /**
   * Assess network speed category
   */
  private assessNetworkSpeed(netInfo: any): 'slow' | 'medium' | 'fast' {
    const type = netInfo.type;
    const effectiveType = netInfo.details?.effectiveType;

    if (type === 'wifi') return 'fast';
    if (type === 'cellular') {
      if (effectiveType === '4g' || effectiveType === '5g') return 'fast';
      if (effectiveType === '3g') return 'medium';
      return 'slow';
    }
    
    return 'medium';
  }

  /**
   * Estimate bandwidth in Mbps
   */
  private estimateBandwidth(netInfo: any): number {
    const type = netInfo.type;
    const effectiveType = netInfo.details?.effectiveType;

    if (type === 'wifi') return 50; // Assume good wifi
    if (type === 'cellular') {
      if (effectiveType === '5g') return 100;
      if (effectiveType === '4g') return 25;
      if (effectiveType === '3g') return 5;
      return 1;
    }

    return 10; // Default estimate
  }

  /**
   * Adapt configuration to current network conditions
   */
  private adaptConfigToNetwork(): void {
    const { speed } = this.networkQuality;

    switch (speed) {
      case 'slow':
        this.config.minBufferSize = 5; // Longer buffer for stability
        this.config.preloadCount = 1; // Minimal preloading
        this.config.enablePreloading = false;
        break;
      
      case 'medium':
        this.config.minBufferSize = 3; // Standard buffer
        this.config.preloadCount = 1;
        this.config.enablePreloading = true;
        break;
      
      case 'fast':
        this.config.minBufferSize = 2; // Quick start
        this.config.preloadCount = 3; // Aggressive preloading
        this.config.enablePreloading = true;
        break;
    }

    console.log('⚡ Config adapted for network:', this.config);
  }

  /**
   * Optimize configuration for platform
   */
  private optimizeConfigForPlatform(): void {
    if (Platform.OS === 'android') {
      // Android optimizations
      this.config.minBufferSize = Math.max(this.config.minBufferSize, 2);
      this.config.maxCacheSize = Math.min(this.config.maxCacheSize, 150);
    } else {
      // iOS optimizations
      this.config.preloadCount = Math.max(this.config.preloadCount, 2);
    }
  }

  /**
   * Check if video is ready to start playback
   */
  public isVideoReady(videoId: string): boolean {
    const buffer = this.videoBuffers.get(videoId);
    if (!buffer) return false;

    return buffer.isReady && buffer.bufferedDuration >= this.config.minBufferSize;
  }

  /**
   * Get video loading progress (0-100)
   */
  public getLoadingProgress(videoId: string): number {
    return this.loadingProgress.get(videoId) || 0;
  }

  /**
   * Get optimal video quality for current network
   */
  public getOptimalQuality(): 'low' | 'medium' | 'high' {
    const { speed, bandwidth } = this.networkQuality;

    if (speed === 'slow' || bandwidth < 2) return 'low';
    if (speed === 'medium' || bandwidth < 10) return 'medium';
    return 'high';
  }

  /**
   * Start progressive loading for a video
   */
  public async startProgressiveLoading(
    videoId: string, 
    videoUrl: string,
    onReady?: () => void,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    if (this.currentlyLoading.has(videoId)) {
      console.log('🔄 Video already loading:', videoId);
      return;
    }

    console.log('🎬 Starting progressive loading:', videoId);
    this.currentlyLoading.add(videoId);

    // Initialize buffer info
    const bufferInfo: VideoBufferInfo = {
      videoId,
      url: videoUrl,
      bufferedDuration: 0,
      totalDuration: 0,
      isBuffering: true,
      isReady: false,
      quality: this.getOptimalQuality(),
      cacheSize: 0
    };

    this.videoBuffers.set(videoId, bufferInfo);
    this.loadingProgress.set(videoId, 0);

    try {
      // Simulate progressive loading (in real implementation, this would use
      // custom video streaming or chunked loading)
      await this.simulateProgressiveLoading(videoId, onReady, onProgress);
    } catch (error) {
      console.error('❌ Progressive loading failed:', error);
      this.currentlyLoading.delete(videoId);
    }
  }

  /**
   * Simulate progressive loading behavior
   */
  private async simulateProgressiveLoading(
    videoId: string,
    onReady?: () => void,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const buffer = this.videoBuffers.get(videoId);
    if (!buffer) return;

    const totalSteps = 20; // Simulate loading in 20 steps
    const minReadyStep = Math.ceil(totalSteps * 0.2); // Ready at 20% (minimum buffer)

    for (let step = 1; step <= totalSteps; step++) {
      // Simulate network delay based on quality
      const delay = this.getLoadingDelay();
      await new Promise(resolve => setTimeout(resolve, delay));

      // Update progress
      const progress = (step / totalSteps) * 100;
      this.loadingProgress.set(videoId, progress);
      onProgress?.(progress);

      // Update buffer info
      buffer.bufferedDuration = (step / totalSteps) * 30; // Assume 30s total video
      buffer.cacheSize = (step / totalSteps) * 10 * 1024 * 1024; // 10MB estimated

      // Mark as ready when minimum buffer is reached
      if (step >= minReadyStep && !buffer.isReady) {
        buffer.isReady = true;
        buffer.isBuffering = false;
        console.log('✅ Video ready for playback:', videoId);
        onReady?.();
      }

      this.videoBuffers.set(videoId, buffer);
    }

    this.currentlyLoading.delete(videoId);
    console.log('🎉 Progressive loading complete:', videoId);
  }

  /**
   * Get loading delay based on network and quality
   */
  private getLoadingDelay(): number {
    const { speed } = this.networkQuality;
    
    switch (speed) {
      case 'slow': return 200; // Slower loading
      case 'medium': return 100; // Medium loading
      case 'fast': return 50; // Fast loading
      default: return 100;
    }
  }

  /**
   * Preload next videos in sequence
   */
  public preloadNextVideos(currentIndex: number, videoUrls: string[]): void {
    if (!this.config.enablePreloading) return;

    const { preloadCount } = this.config;
    const startIndex = currentIndex + 1;
    const endIndex = Math.min(startIndex + preloadCount, videoUrls.length);

    for (let i = startIndex; i < endIndex; i++) {
      const videoId = `video_${i}`;
      const videoUrl = videoUrls[i];

      if (!this.isVideoReady(videoId) && !this.currentlyLoading.has(videoId)) {
        console.log('🔮 Preloading video:', videoId);
        this.startProgressiveLoading(videoId, videoUrl);
      }
    }
  }

  /**
   * Clear old buffers to manage memory
   */
  public clearOldBuffers(currentIndex: number, keepRange: number = 3): void {
    const keysToDelete: string[] = [];

    this.videoBuffers.forEach((buffer, videoId) => {
      const videoIndex = parseInt(videoId.replace('video_', ''));
      
      if (Math.abs(videoIndex - currentIndex) > keepRange) {
        keysToDelete.push(videoId);
        this.cacheUsage -= buffer.cacheSize;
      }
    });

    keysToDelete.forEach(key => {
      this.videoBuffers.delete(key);
      this.loadingProgress.delete(key);
      console.log('🗑️ Cleared buffer:', key);
    });
  }

  /**
   * Get video buffer status for monitoring
   */
  public getBufferStatus(videoId: string): VideoBufferInfo | null {
    return this.videoBuffers.get(videoId) || null;
  }

  /**
   * Get service configuration
   */
  public getConfig(): VideoLoadingConfig {
    return { ...this.config };
  }

  /**
   * Update service configuration
   */
  public updateConfig(newConfig: Partial<VideoLoadingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Progressive loading config updated:', this.config);
  }

  /**
   * Get network status
   */
  public getNetworkStatus(): NetworkQuality {
    return { ...this.networkQuality };
  }

  /**
   * Force refresh network assessment
   */
  public async refreshNetworkStatus(): Promise<void> {
    try {
      const state = await NetInfo.fetch();
      this.updateNetworkQuality(state);
    } catch (error) {
      console.warn('Failed to refresh network status:', error);
    }
  }

  /**
   * Get total cache usage
   */
  public getCacheUsage(): { used: number; max: number; percentage: number } {
    const maxBytes = this.config.maxCacheSize * 1024 * 1024;
    return {
      used: this.cacheUsage,
      max: maxBytes,
      percentage: (this.cacheUsage / maxBytes) * 100
    };
  }
}

export default ProgressiveVideoLoadingService;
