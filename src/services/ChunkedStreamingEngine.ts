/**
 * 🚀 CHUNKED STREAMING ENGINE
 * Instagram-like instant video loading with HLS/DASH segments
 * - Loads 1-3 second video segments progressively
 * - Instant first frame display
 * - Background segment fetching
 * - Memory-efficient chunk management
 */

interface VideoSegment {
  index: number;
  url: string;
  duration: number;
  size: number;
  loaded: boolean;
  loading: boolean;
  data?: ArrayBuffer;
}

interface ChunkedVideo {
  id: string;
  originalUrl: string;
  manifestUrl?: string; // HLS .m3u8 or DASH .mpd
  thumbnailUrl: string;
  firstFrameUrl?: string;
  segments: VideoSegment[];
  totalDuration: number;
  segmentDuration: number; // 1-3 seconds per segment
  isHLS: boolean;
  isDASH: boolean;
  loadingState: 'idle' | 'loading' | 'ready' | 'playing' | 'error';
  firstSegmentReady: boolean;
  bufferHealth: number; // Percentage buffered ahead
}

interface PrefetchStrategy {
  currentReel: string; // N - Play instantly
  nextReel?: string;   // N+1 - Preload fully (high priority)
  nextNextReel?: string; // N+2 - Preload 2-3 segments (medium priority)
  prevReel?: string;   // N-1 - Keep cached (instant back scroll)
}

class ChunkedStreamingEngine {
  private static instance: ChunkedStreamingEngine;
  private chunkedVideos: Map<string, ChunkedVideo> = new Map();
  private segmentCache: Map<string, ArrayBuffer> = new Map();
  private downloadQueue: string[] = [];
  private maxCacheSize = 500 * 1024 * 1024; // 500MB cache limit
  private currentCacheSize = 0;
  private prefetchStrategy: PrefetchStrategy = { currentReel: '' };
  private abortControllers: Map<string, AbortController> = new Map();

  public static getInstance(): ChunkedStreamingEngine {
    if (!ChunkedStreamingEngine.instance) {
      ChunkedStreamingEngine.instance = new ChunkedStreamingEngine();
    }
    return ChunkedStreamingEngine.instance;
  }

  /**
   * 🎯 INSTANT INITIALIZATION - Convert video to chunked format
   */
  public async initializeChunkedVideo(
    reelId: string, 
    videoUrl: string, 
    thumbnailUrl: string
  ): Promise<ChunkedVideo> {
    console.log(`🎯 Initializing chunked video: ${reelId}`);

    // Check if already initialized
    const existing = this.chunkedVideos.get(reelId);
    if (existing) {
      return existing;
    }

    // Create chunked video structure
    const chunkedVideo: ChunkedVideo = {
      id: reelId,
      originalUrl: videoUrl,
      thumbnailUrl,
      firstFrameUrl: `${videoUrl}?t=0.1`, // Extract first frame
      segments: [],
      totalDuration: 30, // Assume 30s videos (can be detected)
      segmentDuration: 2, // 2-second segments
      isHLS: videoUrl.includes('.m3u8'),
      isDASH: videoUrl.includes('.mpd'),
      loadingState: 'idle',
      firstSegmentReady: false,
      bufferHealth: 0,
    };

    // Generate segments (simulate HLS/DASH manifest)
    await this.generateVideoSegments(chunkedVideo);
    
    this.chunkedVideos.set(reelId, chunkedVideo);
    console.log(`✅ Chunked video initialized: ${reelId} with ${chunkedVideo.segments.length} segments`);
    
    return chunkedVideo;
  }

  /**
   * 🔥 INSTANT FIRST SEGMENT - Load immediately for instant playback
   */
  public async loadFirstSegmentInstantly(reelId: string): Promise<boolean> {
    const video = this.chunkedVideos.get(reelId);
    if (!video || video.segments.length === 0) {
      return false;
    }

    const firstSegment = video.segments[0];
    if (firstSegment.loaded) {
      video.firstSegmentReady = true;
      return true;
    }

    console.log(`🔥 Loading first segment instantly: ${reelId}`);
    
    try {
      // High priority download
      const segmentData = await this.downloadSegment(firstSegment, true);
      firstSegment.data = segmentData;
      firstSegment.loaded = true;
      video.firstSegmentReady = true;
      video.loadingState = 'ready';
      
      // Add to cache
      this.addToCache(`${reelId}_segment_0`, segmentData);
      
      console.log(`⚡ First segment ready: ${reelId}`);
      return true;
    } catch (error) {
      console.error(`❌ First segment failed: ${reelId}`, error);
      video.loadingState = 'error';
      return false;
    }
  }

  /**
   * 🌊 PROGRESSIVE LOADING - Continue loading segments while playing
   */
  public async startProgressiveLoading(reelId: string, priority: 'high' | 'medium' | 'low' = 'high'): Promise<void> {
    const video = this.chunkedVideos.get(reelId);
    if (!video) return;

    console.log(`🌊 Starting progressive loading: ${reelId} (${priority} priority)`);
    
    const segmentsToLoad = priority === 'high' ? video.segments.length : 
                          priority === 'medium' ? Math.min(3, video.segments.length) : 2;

    // Load segments progressively
    for (let i = 1; i < segmentsToLoad; i++) {
      const segment = video.segments[i];
      if (!segment.loaded && !segment.loading) {
        this.queueSegmentDownload(video, segment, priority === 'high');
      }
    }
  }

  /**
   * 🎯 PREFETCH STRATEGY - Implement N, N+1, N+2, N-1 loading
   */
  public async setPrefetchStrategy(strategy: PrefetchStrategy): Promise<void> {
    this.prefetchStrategy = strategy;
    console.log('🎯 Setting prefetch strategy:', strategy);

    // Cancel previous downloads for efficiency
    this.cancelNonPriorityDownloads();

    // Current reel (N) - Ensure it's fully loaded
    if (strategy.currentReel) {
      await this.loadFirstSegmentInstantly(strategy.currentReel);
      await this.startProgressiveLoading(strategy.currentReel, 'high');
    }

    // Next reel (N+1) - High priority full preload
    if (strategy.nextReel) {
      await this.initializeChunkedVideo(strategy.nextReel, '', '');
      await this.loadFirstSegmentInstantly(strategy.nextReel);
      await this.startProgressiveLoading(strategy.nextReel, 'high');
    }

    // Next-next reel (N+2) - Medium priority partial preload
    if (strategy.nextNextReel) {
      await this.initializeChunkedVideo(strategy.nextNextReel, '', '');
      await this.loadFirstSegmentInstantly(strategy.nextNextReel);
      await this.startProgressiveLoading(strategy.nextNextReel, 'medium');
    }

    // Previous reel (N-1) is kept in cache automatically
  }

  /**
   * 📺 GET PLAYABLE URL - Get URL for current playback position
   */
  public getPlayableUrl(reelId: string, currentTime: number = 0): string | null {
    const video = this.chunkedVideos.get(reelId);
    if (!video || !video.firstSegmentReady) {
      return video?.thumbnailUrl || null;
    }

    // Calculate which segment should be playing
    const segmentIndex = Math.floor(currentTime / video.segmentDuration);
    const segment = video.segments[segmentIndex];

    if (segment?.loaded && segment.data) {
      // Return blob URL for loaded segment (simplified for React Native)
      return `data:video/mp4;base64,${btoa(String.fromCharCode(...new Uint8Array(segment.data)))}`;
    }

    // Fallback to original URL if segment not ready
    return video.originalUrl;
  }

  /**
   * ⚡ INSTANT READY CHECK
   */
  public isInstantReady(reelId: string): boolean {
    const video = this.chunkedVideos.get(reelId);
    return video?.firstSegmentReady || false;
  }

  /**
   * 📊 BUFFER HEALTH
   */
  public getBufferHealth(reelId: string): number {
    const video = this.chunkedVideos.get(reelId);
    if (!video) return 0;

    const loadedSegments = video.segments.filter(s => s.loaded).length;
    return (loadedSegments / video.segments.length) * 100;
  }

  // ================== PRIVATE METHODS ==================

  private async generateVideoSegments(video: ChunkedVideo): Promise<void> {
    const segmentCount = Math.ceil(video.totalDuration / video.segmentDuration);
    
    for (let i = 0; i < segmentCount; i++) {
      const segment: VideoSegment = {
        index: i,
        url: video.isHLS ? 
          `${video.originalUrl.replace('.mp4', '')}_segment_${i}.ts` :
          `${video.originalUrl}?t=${i * video.segmentDuration}&duration=${video.segmentDuration}`,
        duration: video.segmentDuration,
        size: 1024 * 512, // Estimate 512KB per segment
        loaded: false,
        loading: false,
      };
      video.segments.push(segment);
    }
  }

  private async downloadSegment(segment: VideoSegment, highPriority: boolean = false): Promise<ArrayBuffer> {
    segment.loading = true;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), highPriority ? 5000 : 10000);

    try {
      const response = await fetch(segment.url, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'max-age=3600',
          'Range': `bytes=0-${segment.size - 1}`,
        },
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const data = await response.arrayBuffer();
      segment.loading = false;
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      segment.loading = false;
      throw error;
    }
  }

  private queueSegmentDownload(video: ChunkedVideo, segment: VideoSegment, highPriority: boolean): void {
    if (segment.loading || segment.loaded) return;

    // Add to download queue
    const downloadKey = `${video.id}_segment_${segment.index}`;
    
    if (highPriority) {
      this.downloadQueue.unshift(downloadKey);
    } else {
      this.downloadQueue.push(downloadKey);
    }

    // Process queue
    this.processDownloadQueue();
  }

  private async processDownloadQueue(): Promise<void> {
    if (this.downloadQueue.length === 0) return;

    const downloadKey = this.downloadQueue.shift()!;
    const [reelId, , segmentIndexStr] = downloadKey.split('_');
    const segmentIndex = parseInt(segmentIndexStr);

    const video = this.chunkedVideos.get(reelId);
    const segment = video?.segments[segmentIndex];

    if (video && segment && !segment.loaded && !segment.loading) {
      try {
        const data = await this.downloadSegment(segment);
        segment.data = data;
        segment.loaded = true;
        this.addToCache(downloadKey, data);
        
        // Update buffer health
        video.bufferHealth = this.getBufferHealth(reelId);
        
        console.log(`✅ Segment downloaded: ${downloadKey} (${video.bufferHealth}% buffered)`);
      } catch (error) {
        console.error(`❌ Segment download failed: ${downloadKey}`, error);
      }
    }

    // Continue processing queue
    if (this.downloadQueue.length > 0) {
      setTimeout(() => this.processDownloadQueue(), 100);
    }
  }

  private addToCache(key: string, data: ArrayBuffer): void {
    // Check cache size limit
    if (this.currentCacheSize + data.byteLength > this.maxCacheSize) {
      this.cleanupOldCache();
    }

    this.segmentCache.set(key, data);
    this.currentCacheSize += data.byteLength;
  }

  private cleanupOldCache(): void {
    // Remove non-priority cached segments
    const priorityReels = [
      this.prefetchStrategy.currentReel,
      this.prefetchStrategy.nextReel,
      this.prefetchStrategy.prevReel,
    ].filter(Boolean);

    for (const [key] of this.segmentCache.entries()) {
      const reelId = key.split('_')[0];
      if (!priorityReels.includes(reelId)) {
        const data = this.segmentCache.get(key);
        if (data) {
          this.currentCacheSize -= data.byteLength;
          this.segmentCache.delete(key);
        }
      }
    }
  }

  private cancelNonPriorityDownloads(): void {
    // Cancel downloads for reels not in current strategy
    for (const [key, controller] of this.abortControllers.entries()) {
      const reelId = key.split('_')[0];
      const isPriority = [
        this.prefetchStrategy.currentReel,
        this.prefetchStrategy.nextReel,
        this.prefetchStrategy.nextNextReel,
      ].includes(reelId);

      if (!isPriority) {
        controller.abort();
        this.abortControllers.delete(key);
      }
    }
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
    this.downloadQueue = [];
    
    console.log('🧹 Chunked streaming engine cleaned up');
  }
}

export default ChunkedStreamingEngine;
