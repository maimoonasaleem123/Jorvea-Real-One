import { createThumbnail } from 'react-native-video-thumbnails';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import DigitalOceanService from './digitalOceanService';

export interface ThumbnailOptions {
  url: string;
  timeStamp?: number; // Time in seconds to capture thumbnail
  quality?: number; // 0.1 to 1.0
  format?: 'jpeg' | 'png';
  cacheName?: string;
}

export interface ThumbnailResult {
  success: boolean;
  thumbnailUrl?: string;
  localPath?: string;
  error?: string;
}

class VideoThumbnailService {
  private static instance: VideoThumbnailService;
  private thumbnailCache = new Map<string, string>();

  static getInstance(): VideoThumbnailService {
    if (!VideoThumbnailService.instance) {
      VideoThumbnailService.instance = new VideoThumbnailService();
    }
    return VideoThumbnailService.instance;
  }

  /**
   * Generate thumbnail from video URL and upload to Digital Ocean
   */
  async generateAndUploadThumbnail(options: ThumbnailOptions): Promise<ThumbnailResult> {
    try {
      const cacheKey = `${options.url}_${options.timeStamp || 1}`;
      
      // Check cache first
      if (this.thumbnailCache.has(cacheKey)) {
        return {
          success: true,
          thumbnailUrl: this.thumbnailCache.get(cacheKey)!,
        };
      }

      console.log('📸 Generating thumbnail for video:', options.url);

      // Generate thumbnail locally
      const thumbnailResponse = await createThumbnail({
        url: options.url,
        timeStamp: options.timeStamp || 1000, // 1 second by default
        quality: options.quality || 0.8,
        format: options.format || 'jpeg',
        cacheName: options.cacheName || `thumbnail_${Date.now()}`,
      });

      if (!thumbnailResponse.path) {
        throw new Error('Failed to generate thumbnail');
      }

      console.log('📸 Thumbnail generated locally:', thumbnailResponse.path);

      // Upload thumbnail to Digital Ocean
      const thumbnailFileName = `thumbnails/thumbnail_${Date.now()}.jpg`;
      const uploadedThumbnailUrl = await DigitalOceanService.uploadMedia(
        thumbnailResponse.path,
        thumbnailFileName,
        'image/jpeg'
      );

      console.log('📸 Thumbnail uploaded to Digital Ocean:', uploadedThumbnailUrl);

      // Cache the result
      this.thumbnailCache.set(cacheKey, uploadedThumbnailUrl);

      // Clean up local file
      try {
        await RNFS.unlink(thumbnailResponse.path);
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup local thumbnail:', cleanupError);
      }

      return {
        success: true,
        thumbnailUrl: uploadedThumbnailUrl,
        localPath: thumbnailResponse.path,
      };
    } catch (error) {
      console.error('❌ Error generating thumbnail:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate thumbnail locally only (for immediate preview)
   */
  async generateLocalThumbnail(options: ThumbnailOptions): Promise<ThumbnailResult> {
    try {
      console.log('📸 Generating local thumbnail for video:', options.url);

      const thumbnailResponse = await createThumbnail({
        url: options.url,
        timeStamp: options.timeStamp || 1000,
        quality: options.quality || 0.8,
        format: options.format || 'jpeg',
        cacheName: options.cacheName || `local_thumbnail_${Date.now()}`,
      });

      if (!thumbnailResponse.path) {
        throw new Error('Failed to generate local thumbnail');
      }

      return {
        success: true,
        localPath: thumbnailResponse.path,
      };
    } catch (error) {
      console.error('❌ Error generating local thumbnail:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate multiple thumbnails at different timestamps
   */
  async generateMultipleThumbnails(
    videoUrl: string,
    timestamps: number[] = [1, 3, 5], // seconds
    uploadToCloud: boolean = true
  ): Promise<ThumbnailResult[]> {
    const results: ThumbnailResult[] = [];
    
    for (const timestamp of timestamps) {
      const result = uploadToCloud 
        ? await this.generateAndUploadThumbnail({
            url: videoUrl,
            timeStamp: timestamp * 1000, // convert to milliseconds
            cacheName: `multi_thumbnail_${timestamp}_${Date.now()}`
          })
        : await this.generateLocalThumbnail({
            url: videoUrl,
            timeStamp: timestamp * 1000,
            cacheName: `multi_thumbnail_${timestamp}_${Date.now()}`
          });
      
      results.push(result);
    }

    return results;
  }

  /**
   * Get best quality thumbnail for video
   */
  async getBestThumbnail(videoUrl: string): Promise<ThumbnailResult> {
    // Try multiple timestamps and pick the best one
    const timestamps = [2, 5, 8]; // Try different points in the video
    
    for (const timestamp of timestamps) {
      const result = await this.generateAndUploadThumbnail({
        url: videoUrl,
        timeStamp: timestamp * 1000,
        quality: 0.9,
        format: 'jpeg',
        cacheName: `best_thumbnail_${timestamp}_${Date.now()}`
      });

      if (result.success) {
        return result;
      }
    }

    // Fallback to basic thumbnail
    return this.generateAndUploadThumbnail({
      url: videoUrl,
      timeStamp: 1000,
      quality: 0.8,
      format: 'jpeg',
    });
  }

  /**
   * Clear thumbnail cache
   */
  clearCache(): void {
    this.thumbnailCache.clear();
    console.log('🧹 Thumbnail cache cleared');
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.thumbnailCache.size;
  }

  /**
   * Generate thumbnail URL for Instagram-like grid
   */
  async generateGridThumbnail(videoUrl: string): Promise<string> {
    const result = await this.generateAndUploadThumbnail({
      url: videoUrl,
      timeStamp: 2000, // 2 seconds for better content
      quality: 0.8,
      format: 'jpeg',
      cacheName: `grid_thumbnail_${Date.now()}`
    });

    return result.thumbnailUrl || videoUrl; // Fallback to video URL
  }

  /**
   * Process video for reel creation with thumbnail
   */
  async processVideoForReel(videoUri: string, uploadToCloud: boolean = true): Promise<{
    thumbnailUrl?: string;
    localThumbnailPath?: string;
    error?: string;
  }> {
    try {
      const result = uploadToCloud 
        ? await this.generateAndUploadThumbnail({
            url: videoUri,
            timeStamp: 1500, // 1.5 seconds
            quality: 0.9,
            format: 'jpeg',
            cacheName: `reel_thumbnail_${Date.now()}`
          })
        : await this.generateLocalThumbnail({
            url: videoUri,
            timeStamp: 1500,
            quality: 0.9,
            format: 'jpeg',
            cacheName: `reel_thumbnail_${Date.now()}`
          });

      if (result.success) {
        return {
          thumbnailUrl: result.thumbnailUrl,
          localThumbnailPath: result.localPath,
        };
      } else {
        return { error: result.error };
      }
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export default VideoThumbnailService.getInstance();
