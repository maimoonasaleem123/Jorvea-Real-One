/**
 * Advanced Segmented Video Fetcher
 * Loads video segments progressively for ultra-fast reels experience
 * Memory-efficient, lightning-fast playback
 */

import RNFS from 'react-native-fs';
import { firebaseStorage } from '../config/firebase';

interface VideoSegment {
  index: number;
  url: string;
  size: number;
  localPath?: string;
  isLoaded: boolean;
  isLoading: boolean;
}

interface SegmentedVideo {
  reelId: string;
  manifestUrl: string;
  totalSegments: number;
  segments: VideoSegment[];
  currentPlaybackSegment: number;
  isReady: boolean;
  combinedVideoPath?: string;
  loadedSegments: Set<number>;
  preloadedSegments: Set<number>;
}

class AdvancedSegmentedVideoFetcher {
  private static instance: AdvancedSegmentedVideoFetcher;
  private videoCache: Map<string, SegmentedVideo> = new Map();
  private maxCacheSize: number = 10; // Cache 10 videos maximum
  private preloadDistance: number = 3; // Preload 3 segments ahead and behind
  private maxConcurrentDownloads: number = 4;
  private activeFetches: Set<string> = new Set();

  static getInstance(): AdvancedSegmentedVideoFetcher {
    if (!AdvancedSegmentedVideoFetcher.instance) {
      AdvancedSegmentedVideoFetcher.instance = new AdvancedSegmentedVideoFetcher();
    }
    return AdvancedSegmentedVideoFetcher.instance;
  }

  /**
   * Prepare video for instant playback
   * Handles both segmented and non-segmented videos
   */
  async prepareVideo(videoUrl: string, reelId: string): Promise<string | null> {
    try {
      console.log(`🎬 Preparing video for segmentation: ${reelId}`);
      
      // Check if already cached
      if (this.videoCache.has(reelId)) {
        const cachedVideo = this.videoCache.get(reelId)!;
        if (cachedVideo.isReady && cachedVideo.combinedVideoPath) {
          console.log(`⚡ Using cached video: ${reelId}`);
          return cachedVideo.combinedVideoPath;
        }
      }
      
      // Try to construct manifest URL from video URL
      const manifestUrl = videoUrl.replace(/\.(mp4|mov|avi)$/, '_manifest.json');
      
      // Load manifest (this might fail for non-segmented videos)
      const manifest = await this.loadManifest(manifestUrl);
      
      if (!manifest) {
        // Video is not segmented yet - use original video URL
        console.log(`📹 Video not segmented, using original: ${reelId}`);
        
        // Cache the original video path for consistency
        this.videoCache.set(reelId, {
          reelId,
          manifestUrl: '',
          totalSegments: 1,
          segments: [{
            index: 0,
            url: videoUrl,
            size: 0,
            isLoaded: true,
            isLoading: false
          }],
          currentPlaybackSegment: 0,
          isReady: true,
          loadedSegments: new Set([0]),
          combinedVideoPath: videoUrl
        });
        
        return videoUrl;
      }
      
      // Create segmented video entry
      const segmentedVideo: SegmentedVideo = {
        reelId,
        manifestUrl,
        totalSegments: manifest.totalSegments,
        segments: manifest.segments.map(seg => ({
          index: seg.index,
          url: seg.url,
          size: seg.size,
          isLoaded: false,
          isLoading: false
        })),
        currentPlaybackSegment: 0,
        isReady: false,
        loadedSegments: new Set(),
        preloadedSegments: new Set()
      };
      
      this.videoCache.set(reelId, segmentedVideo);
      
      // Start intelligent loading strategy
      await this.startIntelligentLoading(segmentedVideo);
      
      return segmentedVideo.combinedVideoPath || null;
      
    } catch (error) {
      console.warn(`⚠️ Error preparing video ${reelId}:`, error);
      // Return original video URL as fallback
      return null;
    }
  }

  /**
   * Load manifest from Firebase Storage
   * Returns null for non-segmented videos (expected behavior)
   */
  private async loadManifest(manifestUrl: string): Promise<any> {
    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        // Manifest doesn't exist - video is not segmented
        return null;
      }
      const manifest = await response.json();
      return manifest;
    } catch (error) {
      // Expected for non-segmented videos - don't log as error
      console.log(`📹 No manifest found (video not segmented): ${manifestUrl.split('/').pop()}`);
      return null;
    }
  }

  /**
   * Intelligent loading strategy for instant playback
   */
  private async startIntelligentLoading(video: SegmentedVideo): Promise<void> {
    try {
      console.log(`🧠 Starting intelligent loading for ${video.reelId}`);
      
      // Strategy 1: Load first segment immediately for instant playback
      await this.loadSegment(video, 0, true);
      
      // Strategy 2: Load middle segment for seek support
      const middleSegment = Math.floor(video.totalSegments / 2);
      if (middleSegment > 0) {
        this.loadSegment(video, middleSegment, false);
      }
      
      // Strategy 3: Progressive loading of remaining segments
      this.progressivelyLoadSegments(video);
      
    } catch (error) {
      console.error(`❌ Error in intelligent loading:`, error);
    }
  }

  /**
   * Load specific video segment
   */
  private async loadSegment(
    video: SegmentedVideo, 
    segmentIndex: number, 
    isUrgent: boolean = false
  ): Promise<void> {
    try {
      const segment = video.segments[segmentIndex];
      if (!segment || segment.isLoaded || segment.isLoading) return;
      
      segment.isLoading = true;
      const segmentKey = `${video.reelId}_segment_${segmentIndex}`;
      
      if (this.activeFetches.has(segmentKey)) return;
      this.activeFetches.add(segmentKey);
      
      console.log(`📥 Loading segment ${segmentIndex} for ${video.reelId} ${isUrgent ? '(URGENT)' : ''}`);
      
      // Download segment
      const localPath = `${RNFS.CachesDirectoryPath}/reel_${video.reelId}_segment_${segmentIndex}.mp4`;
      
      // Use fetch with progress for better control
      const response = await fetch(segment.url);
      const segmentData = await response.arrayBuffer();
      const base64Data = this.arrayBufferToBase64(segmentData);
      
      await RNFS.writeFile(localPath, base64Data, 'base64');
      
      segment.localPath = localPath;
      segment.isLoaded = true;
      segment.isLoading = false;
      video.loadedSegments.add(segmentIndex);
      
      this.activeFetches.delete(segmentKey);
      
      console.log(`✅ Segment ${segmentIndex} loaded for ${video.reelId}`);
      
      // If this is the first segment, immediately create playable video
      if (segmentIndex === 0) {
        await this.createPlayableVideo(video);
      }
      
      // Update combined video as more segments load
      await this.updateCombinedVideo(video);
      
    } catch (error) {
      console.error(`❌ Error loading segment ${segmentIndex}:`, error);
      const segment = video.segments[segmentIndex];
      if (segment) {
        segment.isLoading = false;
      }
      this.activeFetches.delete(`${video.reelId}_segment_${segmentIndex}`);
    }
  }

  /**
   * Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const binary = new Uint8Array(buffer);
    let result = '';
    for (let i = 0; i < binary.length; i++) {
      result += String.fromCharCode(binary[i]);
    }
    return btoa(result);
  }

  /**
   * Create initial playable video from first segment
   */
  private async createPlayableVideo(video: SegmentedVideo): Promise<void> {
    try {
      const firstSegment = video.segments[0];
      if (!firstSegment.localPath) return;
      
      const initialVideoPath = `${RNFS.CachesDirectoryPath}/reel_${video.reelId}_playable.mp4`;
      
      // Copy first segment as initial playable video
      await RNFS.copyFile(firstSegment.localPath, initialVideoPath);
      
      video.combinedVideoPath = initialVideoPath;
      video.isReady = true;
      
      console.log(`⚡ Initial playable video ready: ${video.reelId}`);
      
    } catch (error) {
      console.error(`❌ Error creating playable video:`, error);
    }
  }

  /**
   * Update combined video as more segments load
   */
  private async updateCombinedVideo(video: SegmentedVideo): Promise<void> {
    try {
      if (!video.combinedVideoPath) return;
      
      // Check if we have consecutive segments loaded
      const consecutiveSegments = this.getConsecutiveLoadedSegments(video);
      if (consecutiveSegments.length <= 1) return;
      
      // Combine consecutive segments
      await this.combineSegments(video, consecutiveSegments);
      
    } catch (error) {
      console.error(`❌ Error updating combined video:`, error);
    }
  }

  /**
   * Get consecutive loaded segments starting from 0
   */
  private getConsecutiveLoadedSegments(video: SegmentedVideo): number[] {
    const consecutive: number[] = [];
    
    for (let i = 0; i < video.totalSegments; i++) {
      if (video.loadedSegments.has(i)) {
        consecutive.push(i);
      } else {
        break;
      }
    }
    
    return consecutive;
  }

  /**
   * Combine loaded segments into single playable file
   */
  private async combineSegments(video: SegmentedVideo, segmentIndices: number[]): Promise<void> {
    try {
      if (segmentIndices.length <= 1) return;
      
      console.log(`🔗 Combining segments 0-${segmentIndices.length - 1} for ${video.reelId}`);
      
      const tempPath = `${RNFS.CachesDirectoryPath}/reel_${video.reelId}_temp.mp4`;
      const finalPath = video.combinedVideoPath!;
      
      // Clear temp file
      if (await RNFS.exists(tempPath)) {
        await RNFS.unlink(tempPath);
      }
      
      // Combine segments by appending
      for (const segmentIndex of segmentIndices) {
        const segment = video.segments[segmentIndex];
        if (segment.localPath && await RNFS.exists(segment.localPath)) {
          const segmentData = await RNFS.readFile(segment.localPath, 'base64');
          await RNFS.appendFile(tempPath, segmentData, 'base64');
        }
      }
      
      // Replace current combined video
      if (await RNFS.exists(finalPath)) {
        await RNFS.unlink(finalPath);
      }
      await RNFS.moveFile(tempPath, finalPath);
      
      console.log(`✅ Combined ${segmentIndices.length} segments for ${video.reelId}`);
      
    } catch (error) {
      console.error(`❌ Error combining segments:`, error);
    }
  }

  /**
   * Progressively load remaining segments
   */
  private async progressivelyLoadSegments(video: SegmentedVideo): Promise<void> {
    try {
      // Load segments in intelligent order
      const loadOrder = this.calculateOptimalLoadOrder(video);
      
      for (const segmentIndex of loadOrder) {
        // Throttle downloads to avoid overwhelming the device
        while (this.activeFetches.size >= this.maxConcurrentDownloads) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.loadSegment(video, segmentIndex, false);
        
        // Small delay between initiating downloads
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
    } catch (error) {
      console.error(`❌ Error in progressive loading:`, error);
    }
  }

  /**
   * Calculate optimal segment loading order
   */
  private calculateOptimalLoadOrder(video: SegmentedVideo): number[] {
    const order: number[] = [];
    const total = video.totalSegments;
    
    // Skip segment 0 (already loaded) and middle segment (already queued)
    const middleSegment = Math.floor(total / 2);
    const loaded = new Set([0, middleSegment]);
    
    // Load in a pattern that provides good seek support
    // Load every 4th segment first, then fill in gaps
    
    // Load key positions first (quarter points)
    const keyPositions = [
      Math.floor(total * 0.25),
      Math.floor(total * 0.75),
      Math.floor(total * 0.125),
      Math.floor(total * 0.375),
      Math.floor(total * 0.625),
      Math.floor(total * 0.875)
    ];
    
    for (const pos of keyPositions) {
      if (pos > 0 && pos < total && !loaded.has(pos)) {
        order.push(pos);
        loaded.add(pos);
      }
    }
    
    // Fill in remaining segments sequentially
    for (let i = 1; i < total; i++) {
      if (!loaded.has(i)) {
        order.push(i);
      }
    }
    
    return order;
  }

  /**
   * Preload video for upcoming reel
   */
  async preloadVideo(reelId: string, manifestUrl: string): Promise<void> {
    try {
      console.log(`🚀 Preloading video: ${reelId}`);
      
      if (this.videoCache.has(reelId)) return;
      
      // Load manifest only
      const manifest = await this.loadManifest(manifestUrl);
      if (!manifest) return;
      
      const segmentedVideo: SegmentedVideo = {
        reelId,
        manifestUrl,
        totalSegments: manifest.totalSegments,
        segments: manifest.segments.map(seg => ({
          index: seg.index,
          url: seg.url,
          size: seg.size,
          isLoaded: false,
          isLoading: false
        })),
        currentPlaybackSegment: 0,
        isReady: false,
        loadedSegments: new Set(),
        preloadedSegments: new Set()
      };
      
      this.videoCache.set(reelId, segmentedVideo);
      
      // Preload first segment only
      await this.loadSegment(segmentedVideo, 0, false);
      
    } catch (error) {
      console.error(`❌ Error preloading video ${reelId}:`, error);
    }
  }

  /**
   * Get video playback path
   */
  getVideoPath(reelId: string): string | null {
    const video = this.videoCache.get(reelId);
    return video?.combinedVideoPath || null;
  }

  /**
   * Check if video is ready for playback
   */
  isVideoReady(reelId: string): boolean {
    const video = this.videoCache.get(reelId);
    return video?.isReady || false;
  }

  /**
   * Get video loading progress
   */
  getLoadingProgress(reelId: string): number {
    const video = this.videoCache.get(reelId);
    if (!video) return 0;
    
    return (video.loadedSegments.size / video.totalSegments) * 100;
  }

  /**
   * Clean up old cached videos
   */
  async cleanupCache(): Promise<void> {
    try {
      if (this.videoCache.size <= this.maxCacheSize) return;
      
      console.log('🧹 Cleaning up video cache...');
      
      // Remove oldest cached videos
      const entries = Array.from(this.videoCache.entries());
      const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
      
      for (const [reelId, video] of toRemove) {
        await this.removeVideoFromCache(reelId);
      }
      
    } catch (error) {
      console.error('❌ Error cleaning up cache:', error);
    }
  }

  /**
   * Remove specific video from cache
   */
  async removeVideoFromCache(reelId: string): Promise<void> {
    try {
      const video = this.videoCache.get(reelId);
      if (!video) return;
      
      // Clean up local files
      if (video.combinedVideoPath && await RNFS.exists(video.combinedVideoPath)) {
        await RNFS.unlink(video.combinedVideoPath);
      }
      
      for (const segment of video.segments) {
        if (segment.localPath && await RNFS.exists(segment.localPath)) {
          await RNFS.unlink(segment.localPath);
        }
      }
      
      this.videoCache.delete(reelId);
      console.log(`🗑️ Removed video from cache: ${reelId}`);
      
    } catch (error) {
      console.error(`❌ Error removing video from cache:`, error);
    }
  }

  /**
   * Initialize the fetcher
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Advanced Segmented Video Fetcher...');
    
    // Clean up any leftover files from previous sessions
    try {
      const cacheFiles = await RNFS.readDir(RNFS.CachesDirectoryPath);
      const reelFiles = cacheFiles.filter(file => file.name.includes('reel_'));
      
      for (const file of reelFiles) {
        await RNFS.unlink(file.path);
      }
      
      console.log(`🧹 Cleaned up ${reelFiles.length} cache files`);
    } catch (error) {
      console.error('❌ Error cleaning up cache files:', error);
    }
    
    console.log('✅ Advanced Segmented Video Fetcher initialized');
  }
}

export default AdvancedSegmentedVideoFetcher;
