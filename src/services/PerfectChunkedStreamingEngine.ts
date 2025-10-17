/**
 * 🚀 PERFECT INSTAGRAM-STYLE CHUNKED STREAMING ENGINE
 * Zero-error fallback system with instant loading
 */

interface VideoSegment {
  index: number;
  url: string;
  duration: number;
  loaded: boolean;
  loading: boolean;
  data?: ArrayBuffer;
}

interface ChunkedVideo {
  reelId: string;
  originalUrl: string;
  segments: VideoSegment[];
  segmentDuration: number;
  totalDuration: number;
  isHLS: boolean;
  isDASH: boolean;
  loadingState: 'idle' | 'loading' | 'ready' | 'playing' | 'error';
  firstSegmentReady: boolean;
  bufferHealth: number;
  useOriginal: boolean; // Fallback flag
}

interface PrefetchStrategy {
  currentReel: string;
  nextReel?: string;
  nextNextReel?: string;
  prevReel?: string;
}

class PerfectChunkedStreamingEngine {
  private chunkedVideos: Map<string, ChunkedVideo> = new Map();
  private segmentCache: Map<string, ArrayBuffer> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private maxCacheSize = 100 * 1024 * 1024; // 100MB cache limit
  private currentCacheSize = 0;
  private prefetchStrategy: PrefetchStrategy = { currentReel: '' };

  /**
   * 🚀 INITIALIZE WITH PERFECT FALLBACK
   */
  public async initializeChunkedVideo(
    reelId: string,
    videoUrl: string,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<void> {
    console.log(`🚀 Perfect chunked init: ${reelId}`);

    if (this.chunkedVideos.has(reelId)) {
      return;
    }

    // Create video entry with fallback
    const chunkedVideo: ChunkedVideo = {
      reelId,
      originalUrl: videoUrl,
      segments: [],
      segmentDuration: 3,
      totalDuration: 30, // Assume 30s videos
      isHLS: videoUrl.includes('.m3u8'),
      isDASH: videoUrl.includes('.mpd'),
      loadingState: 'loading',
      firstSegmentReady: false,
      bufferHealth: 0,
      useOriginal: false
    };

    this.chunkedVideos.set(reelId, chunkedVideo);

    try {
      // Quick chunked support detection
      const hasSegments = await this.quickSegmentCheck(videoUrl);
      
      if (hasSegments) {
        // Initialize real segments
        await this.initializeRealSegments(chunkedVideo);
        await this.loadFirstSegmentSafely(reelId);
      } else {
        // Use original video - instant ready
        this.enableOriginalFallback(chunkedVideo);
      }
    } catch (error) {
      console.log(`📺 Using original video fallback: ${reelId}`);
      this.enableOriginalFallback(chunkedVideo);
    }
  }

  /**
   * 🔍 QUICK SEGMENT CHECK (1 second timeout)
   */
  private async quickSegmentCheck(videoUrl: string): Promise<boolean> {
    if (videoUrl.includes('.m3u8') || videoUrl.includes('.mpd')) {
      return true;
    }

    try {
      const segmentUrl = videoUrl.replace(/\.[^.]+$/, '_segment_0.mp4');
      const controller = new AbortController();
      
      // 1 second timeout
      setTimeout(() => controller.abort(), 1000);

      const response = await fetch(segmentUrl, {
        method: 'HEAD',
        signal: controller.signal
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 📺 ENABLE ORIGINAL FALLBACK
   */
  private enableOriginalFallback(chunkedVideo: ChunkedVideo): void {
    chunkedVideo.useOriginal = true;
    chunkedVideo.loadingState = 'ready';
    chunkedVideo.firstSegmentReady = true;
    chunkedVideo.bufferHealth = 100;
    console.log(`✅ Original fallback ready: ${chunkedVideo.reelId}`);
  }

  /**
   * 🎯 INITIALIZE REAL SEGMENTS
   */
  private async initializeRealSegments(chunkedVideo: ChunkedVideo): Promise<void> {
    const segmentCount = Math.ceil(chunkedVideo.totalDuration / chunkedVideo.segmentDuration);
    
    for (let i = 0; i < segmentCount; i++) {
      const segmentUrl = chunkedVideo.originalUrl.replace(/\.[^.]+$/, `_segment_${i}.mp4`);
      
      chunkedVideo.segments.push({
        index: i,
        url: segmentUrl,
        duration: chunkedVideo.segmentDuration,
        loaded: false,
        loading: false
      });
    }
  }

  /**
   * ⚡ LOAD FIRST SEGMENT SAFELY
   */
  private async loadFirstSegmentSafely(reelId: string): Promise<void> {
    const video = this.chunkedVideos.get(reelId);
    if (!video || video.segments.length === 0) return;

    const firstSegment = video.segments[0];
    
    try {
      const controller = new AbortController();
      this.abortControllers.set(`${reelId}_0`, controller);
      
      // 3 second timeout for first segment
      setTimeout(() => controller.abort(), 3000);

      const response = await fetch(firstSegment.url, {
        signal: controller.signal
      });

      if (response.ok) {
        const data = await response.arrayBuffer();
        firstSegment.data = data;
        firstSegment.loaded = true;
        video.firstSegmentReady = true;
        video.loadingState = 'ready';
        video.bufferHealth = 25;
        
        this.addToCache(`${reelId}_0`, data);
        console.log(`⚡ First segment loaded: ${reelId}`);
      } else {
        throw new Error('Segment not found');
      }
    } catch (error) {
      console.log(`📺 Fallback to original: ${reelId}`);
      this.enableOriginalFallback(video);
    }
  }

  /**
   * 🎬 GET PLAYABLE URL
   */
  public getPlayableUrl(reelId: string, currentTime: number = 0): string {
    const video = this.chunkedVideos.get(reelId);
    if (!video) return '';

    // Use original video if fallback enabled
    if (video.useOriginal) {
      return video.originalUrl;
    }

    // Calculate which segment should be playing
    const segmentIndex = Math.floor(currentTime / video.segmentDuration);
    const segment = video.segments[segmentIndex];

    if (segment?.loaded && segment.data) {
      // Return data URL for loaded segment
      const base64 = btoa(String.fromCharCode(...new Uint8Array(segment.data)));
      return `data:video/mp4;base64,${base64}`;
    }

    // Fallback to original URL
    return video.originalUrl;
  }

  /**
   * 📊 SET PREFETCH STRATEGY
   */
  public async setPrefetchStrategy(strategy: PrefetchStrategy): Promise<void> {
    this.prefetchStrategy = strategy;
    
    // Background prefetch for next reels
    if (strategy.nextReel) {
      setTimeout(() => this.backgroundPrefetch(strategy.nextReel!), 100);
    }
    
    if (strategy.nextNextReel) {
      setTimeout(() => this.backgroundPrefetch(strategy.nextNextReel!, 'partial'), 500);
    }
  }

  /**
   * 🌊 BACKGROUND PREFETCH
   */
  private async backgroundPrefetch(reelId: string, mode: 'full' | 'partial' = 'full'): Promise<void> {
    const video = this.chunkedVideos.get(reelId);
    if (!video || video.useOriginal) return;

    const segmentsToLoad = mode === 'partial' ? 2 : video.segments.length;
    
    for (let i = 1; i < Math.min(segmentsToLoad, video.segments.length); i++) {
      const segment = video.segments[i];
      if (!segment.loaded && !segment.loading) {
        this.loadSegmentBackground(reelId, segment);
      }
    }
  }

  /**
   * 🔄 LOAD SEGMENT BACKGROUND
   */
  private async loadSegmentBackground(reelId: string, segment: VideoSegment): Promise<void> {
    if (segment.loading) return;
    
    segment.loading = true;
    
    try {
      const controller = new AbortController();
      this.abortControllers.set(`${reelId}_${segment.index}`, controller);
      
      const response = await fetch(segment.url, {
        signal: controller.signal
      });

      if (response.ok) {
        const data = await response.arrayBuffer();
        segment.data = data;
        segment.loaded = true;
        
        this.addToCache(`${reelId}_${segment.index}`, data);
        this.updateBufferHealth(reelId);
        console.log(`🌊 Background loaded: ${reelId}_${segment.index}`);
      }
    } catch (error) {
      // Silent fail for background loading
    } finally {
      segment.loading = false;
    }
  }

  /**
   * 📊 UPDATE BUFFER HEALTH
   */
  private updateBufferHealth(reelId: string): void {
    const video = this.chunkedVideos.get(reelId);
    if (!video) return;

    const loadedSegments = video.segments.filter(s => s.loaded).length;
    video.bufferHealth = Math.round((loadedSegments / video.segments.length) * 100);
  }

  /**
   * 💾 ADD TO CACHE
   */
  private addToCache(key: string, data: ArrayBuffer): void {
    if (this.currentCacheSize + data.byteLength > this.maxCacheSize) {
      this.cleanOldCache();
    }
    
    this.segmentCache.set(key, data);
    this.currentCacheSize += data.byteLength;
  }

  /**
   * 🧹 CLEAN OLD CACHE
   */
  private cleanOldCache(): void {
    const entries = Array.from(this.segmentCache.entries());
    const toDelete = entries.slice(0, Math.floor(entries.length / 2));
    
    toDelete.forEach(([key, data]) => {
      this.segmentCache.delete(key);
      this.currentCacheSize -= data.byteLength;
    });
  }

  /**
   * ⚡ CHECK FIRST SECOND CHUNK
   */
  public async checkFirstSecondChunk(reelId: string): Promise<boolean> {
    const video = this.chunkedVideos.get(reelId);
    if (!video) return false;
    
    try {
      // Check if first segment (1 second) is available
      if (video.useOriginal) {
        return true; // Original video is always ready
      }
      
      if (video.segments.length > 0 && video.segments[0]) {
        const firstSegment = video.segments[0];
        
        // If already loaded, return true
        if (firstSegment.loaded) {
          return true;
        }
        
        // Try to load first segment with 1 second timeout
        return new Promise<boolean>((resolve) => {
          const timeoutId = setTimeout(() => {
            resolve(false);
          }, 1000);
          
          this.loadSegmentBackground(reelId, firstSegment).then(() => {
            clearTimeout(timeoutId);
            resolve(firstSegment.loaded);
          }).catch(() => {
            clearTimeout(timeoutId);
            resolve(false);
          });
        });
      }
      
      return false;
    } catch (error) {
      console.log(`Error checking first chunk for ${reelId}:`, error);
      return false;
    }
  }

  /**
   * ⚡ IS INSTANT READY
   */
  public isInstantReady(reelId: string): boolean {
    const video = this.chunkedVideos.get(reelId);
    return video?.firstSegmentReady || video?.useOriginal || false;
  }

  /**
   * 📊 GET BUFFER HEALTH
   */
  public getBufferHealth(reelId: string): number {
    const video = this.chunkedVideos.get(reelId);
    return video?.bufferHealth || 0;
  }

  /**
   * 🧹 CLEANUP
   */
  public cleanup(): void {
    // Cancel all downloads
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();

    // Clear caches
    this.segmentCache.clear();
    this.currentCacheSize = 0;
    
    console.log('🧹 Perfect chunked engine cleaned up');
  }

  /**
   * 📊 GET LOADING STATE
   */
  public getLoadingState(reelId: string): string {
    const video = this.chunkedVideos.get(reelId);
    return video?.loadingState || 'idle';
  }
}

export default PerfectChunkedStreamingEngine;
