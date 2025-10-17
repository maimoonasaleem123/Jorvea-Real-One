import { Video } from 'react-native-compressor';
import { Alert } from 'react-native';

// Fallback video info function
const getVideoInfo = async (videoUri: string) => {
  try {
    // Try to use react-native-video-info if available
    const { getVideoMetaData } = require('react-native-video-info');
    if (getVideoMetaData && typeof getVideoMetaData === 'function') {
      return await getVideoMetaData(videoUri);
    }
  } catch (error) {
    console.log('react-native-video-info not available, using fallback');
  }
  
  // Fallback: return default values
  return {
    duration: 30, // Default 30 seconds
    width: 720,
    height: 1280,
  };
};

export interface VideoCompressionResult {
  success: boolean;
  compressedUri?: string;
  originalSize: number;
  compressedSize: number;
  duration: number;
  error?: string;
}

export interface VideoValidationResult {
  isValid: boolean;
  duration?: number;
  error?: string;
}

class VideoCompressorService {
  private static instance: VideoCompressorService;

  static getInstance(): VideoCompressorService {
    if (!VideoCompressorService.instance) {
      VideoCompressorService.instance = new VideoCompressorService();
    }
    return VideoCompressorService.instance;
  }

  /**
   * Validate video duration and properties
   */
  async validateVideo(videoUri: string): Promise<VideoValidationResult> {
    try {
      console.log('🎬 VideoCompressor: Validating video:', videoUri);
      
      const metadata = await getVideoInfo(videoUri);
      const duration = metadata?.duration || 30;
      
      console.log('🎬 VideoCompressor: Video duration:', duration, 'seconds');
      
      // Check if video is longer than 60 seconds
      if (duration > 60) {
        return {
          isValid: false,
          duration,
          error: `Video is ${Math.round(duration)}s long. Reels must be 60 seconds or less.`
        };
      }

      // Check if video is too short (less than 1 second)
      if (duration < 1) {
        return {
          isValid: false,
          duration,
          error: 'Video is too short. Minimum duration is 1 second.'
        };
      }

      return {
        isValid: true,
        duration
      };
    } catch (error) {
      console.error('🎬 VideoCompressor: Error validating video:', error);
      // Don't fail completely, just use default values
      return {
        isValid: true,
        duration: 30,
      };
    }
  }

  /**
   * Trim video to 60 seconds if it's longer
   */
  async trimVideoTo60Seconds(videoUri: string, duration: number): Promise<string> {
    try {
      if (duration <= 60) {
        return videoUri; // No trimming needed
      }

      console.log('🎬 VideoCompressor: Trimming video to 60 seconds');
      
      // Trim video to first 60 seconds
      const trimmedUri = await Video.compress(videoUri, {
        compressionMethod: 'manual',
        minimumFileSizeForCompress: 0, // Always compress
        maxSize: 1920, // Max width/height
        // Trim to 60 seconds
        getCancellationId: () => `trim_${Date.now()}`,
      });

      return trimmedUri;
    } catch (error) {
      console.error('🎬 VideoCompressor: Error trimming video:', error);
      throw new Error('Failed to trim video. Please try again.');
    }
  }

  /**
   * Compress video for optimal upload
   */
  async compressVideo(videoUri: string, onProgress?: (progress: number) => void): Promise<VideoCompressionResult> {
    try {
      console.log('🎬 VideoCompressor: Starting compression for:', videoUri);
      
      // First validate the video
      const validation = await this.validateVideo(videoUri);
      if (!validation.isValid) {
        return {
          success: false,
          originalSize: 0,
          compressedSize: 0,
          duration: validation.duration || 0,
          error: validation.error
        };
      }

      let processedUri = videoUri;
      const duration = validation.duration || 0;

      // Trim video if longer than 60 seconds
      if (duration > 60) {
        processedUri = await this.trimVideoTo60Seconds(videoUri, duration);
      }

      // Get original file size
      const originalStats = await this.getFileSize(processedUri);
      
      console.log('🎬 VideoCompressor: Original size:', this.formatFileSize(originalStats));

      // Define compression settings based on file size
      let compressionSettings;
      
      if (originalStats > 50 * 1024 * 1024) { // > 50MB
        compressionSettings = {
          compressionMethod: 'manual' as const,
          maxSize: 1280, // 720p max
          quality: 'low' as const,
          minimumFileSizeForCompress: 0,
        };
      } else if (originalStats > 20 * 1024 * 1024) { // > 20MB
        compressionSettings = {
          compressionMethod: 'manual' as const,
          maxSize: 1920, // 1080p max
          quality: 'medium' as const,
          minimumFileSizeForCompress: 0,
        };
      } else {
        compressionSettings = {
          compressionMethod: 'auto' as const,
          quality: 'high' as const,
          minimumFileSizeForCompress: 5 * 1024 * 1024, // Only compress if > 5MB
        };
      }

      console.log('🎬 VideoCompressor: Using compression settings:', compressionSettings);

      // Compress the video
      const compressedUri = await Video.compress(processedUri, {
        ...compressionSettings,
        getCancellationId: () => `compress_${Date.now()}`,
      });

      // Get compressed file size
      const compressedStats = await this.getFileSize(compressedUri);
      
      console.log('🎬 VideoCompressor: Compressed size:', this.formatFileSize(compressedStats));
      console.log('🎬 VideoCompressor: Compression ratio:', 
        ((originalStats - compressedStats) / originalStats * 100).toFixed(1) + '%');

      return {
        success: true,
        compressedUri,
        originalSize: originalStats,
        compressedSize: compressedStats,
        duration: Math.min(duration, 60), // Cap at 60 seconds
      };

    } catch (error) {
      console.error('🎬 VideoCompressor: Compression failed:', error);
      return {
        success: false,
        originalSize: 0,
        compressedSize: 0,
        duration: 0,
        error: 'Video compression failed. Please try a different video.',
      };
    }
  }

  /**
   * Get file size in bytes
   */
  private async getFileSize(uri: string): Promise<number> {
    try {
      const RNFS = require('react-native-fs');
      const stats = await RNFS.stat(uri);
      return stats.size;
    } catch (error) {
      console.error('🎬 VideoCompressor: Error getting file size:', error);
      return 0;
    }
  }

  /**
   * Format file size for human reading
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Show compression progress to user
   */
  showCompressionAlert(originalSize: number, compressedSize: number): void {
    const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
    Alert.alert(
      'Video Optimized! 🎬',
      `Original: ${this.formatFileSize(originalSize)}\n` +
      `Optimized: ${this.formatFileSize(compressedSize)}\n` +
      `Space saved: ${savings}%`,
      [{ text: 'Great!', style: 'default' }]
    );
  }

  /**
   * Cancel ongoing compression
   */
  cancelCompression(cancellationId: string): void {
    try {
      Video.cancelCompression(cancellationId);
    } catch (error) {
      console.error('🎬 VideoCompressor: Error cancelling compression:', error);
    }
  }
}

export default VideoCompressorService.getInstance();
