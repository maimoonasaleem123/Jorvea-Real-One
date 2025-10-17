/**
 * CloudFlare Stream Video Service
 * FREE 1000 minutes/month with automatic chunking and adaptive bitrate
 * Instagram-quality video streaming
 */

import axios from 'axios';

// 🔑 TODO: Replace with your CloudFlare credentials
// Get from: https://dash.cloudflare.com
const CLOUDFLARE_ACCOUNT_ID = 'YOUR_ACCOUNT_ID_HERE'; // Found in dashboard URL
const CLOUDFLARE_API_TOKEN = 'YOUR_API_TOKEN_HERE';   // Create in Profile > API Tokens

interface CloudFlareUploadResponse {
  success: boolean;
  result: {
    uid: string;
    preview: string;
    playback: {
      hls: string;
      dash: string;
    };
    thumbnail: string;
    thumbnailTimestampPct: number;
    status: {
      state: string;
      pctComplete: string;
    };
    meta: {
      name?: string;
    };
    created: string;
    modified: string;
    size: number;
    duration: number;
  };
  messages: any[];
  errors: any[];
}

interface VideoMetadata {
  name?: string;
  requireSignedURLs?: boolean;
  thumbnailTimestampPct?: number;
  allowedOrigins?: string[];
}

class CloudFlareStreamService {
  private static instance: CloudFlareStreamService;
  private baseURL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`;

  static getInstance(): CloudFlareStreamService {
    if (!CloudFlareStreamService.instance) {
      CloudFlareStreamService.instance = new CloudFlareStreamService();
    }
    return CloudFlareStreamService.instance;
  }

  /**
   * Upload video to CloudFlare Stream
   * Automatic chunking, adaptive bitrate, CDN delivery
   * 
   * @param videoPath - Local path to video file
   * @param metadata - Optional video metadata
   * @returns Upload response with HLS URL
   */
  async uploadVideo(
    videoPath: string,
    metadata?: VideoMetadata
  ): Promise<CloudFlareUploadResponse> {
    try {
      console.log('📤 Uploading video to CloudFlare Stream...');
      console.log('📁 Video path:', videoPath);

      const formData = new FormData();
      
      // Add video file
      formData.append('file', {
        uri: videoPath,
        type: 'video/mp4',
        name: 'reel.mp4',
      } as any);

      // Add metadata
      if (metadata) {
        const metaData: any = {};
        if (metadata.name) metaData.name = metadata.name;
        if (metadata.requireSignedURLs !== undefined) {
          metaData.requireSignedURLs = metadata.requireSignedURLs;
        }
        if (metadata.thumbnailTimestampPct !== undefined) {
          metaData.thumbnailTimestampPct = metadata.thumbnailTimestampPct;
        }
        if (metadata.allowedOrigins) {
          metaData.allowedOrigins = metadata.allowedOrigins;
        }
        
        formData.append('meta', JSON.stringify(metaData));
      }

      const response = await axios.post(this.baseURL, formData, {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          console.log(`⬆️ Upload progress: ${percentCompleted}%`);
        },
        timeout: 300000, // 5 minutes timeout for large files
      });

      if (!response.data.success) {
        throw new Error('CloudFlare upload failed: ' + JSON.stringify(response.data.errors));
      }

      console.log('✅ Video uploaded successfully!');
      console.log('📺 HLS URL:', response.data.result.playback.hls);
      console.log('🖼️ Thumbnail:', response.data.result.thumbnail);
      console.log('⏱️ Duration:', response.data.result.duration, 'seconds');
      
      return response.data;
    } catch (error: any) {
      console.error('❌ CloudFlare upload failed:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Upload video via direct upload URL
   * Better for large files (>200MB)
   */
  async uploadVideoViaDirectURL(
    videoPath: string,
    metadata?: VideoMetadata
  ): Promise<CloudFlareUploadResponse> {
    try {
      console.log('📤 Getting direct upload URL...');

      // Step 1: Get direct upload URL
      const createResponse = await axios.post(
        `${this.baseURL}/direct_upload`,
        {
          maxDurationSeconds: 600, // 10 minutes max
          meta: metadata,
        },
        {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const uploadURL = createResponse.data.result.uploadURL;
      const videoId = createResponse.data.result.uid;

      console.log('✅ Got upload URL');
      console.log('📤 Uploading video...');

      // Step 2: Upload video to direct URL
      const formData = new FormData();
      formData.append('file', {
        uri: videoPath,
        type: 'video/mp4',
        name: 'reel.mp4',
      } as any);

      await axios.post(uploadURL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          console.log(`⬆️ Upload progress: ${percentCompleted}%`);
        },
        timeout: 600000, // 10 minutes for large files
      });

      console.log('✅ Video uploaded, processing...');

      // Step 3: Wait for processing and get video details
      let videoDetails;
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        videoDetails = await this.getVideoDetails(videoId);
        
        if (videoDetails.status.state === 'ready') {
          console.log('✅ Video ready!');
          break;
        }
        
        console.log(`⏳ Processing: ${videoDetails.status.pctComplete || 0}%`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }

      if (!videoDetails || videoDetails.status.state !== 'ready') {
        throw new Error('Video processing timeout');
      }

      return {
        success: true,
        result: videoDetails,
        messages: [],
        errors: [],
      };
    } catch (error: any) {
      console.error('❌ Direct upload failed:', error.message);
      throw error;
    }
  }

  /**
   * Get video details and playback URLs
   */
  async getVideoDetails(videoId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/${videoId}`, {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      });

      return response.data.result;
    } catch (error: any) {
      console.error('❌ Failed to get video details:', error.message);
      throw error;
    }
  }

  /**
   * Delete video from CloudFlare Stream
   */
  async deleteVideo(videoId: string): Promise<boolean> {
    try {
      await axios.delete(`${this.baseURL}/${videoId}`, {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      });

      console.log('✅ Video deleted successfully');
      return true;
    } catch (error: any) {
      console.error('❌ Failed to delete video:', error.message);
      return false;
    }
  }

  /**
   * List all videos (paginated)
   */
  async listVideos(options?: {
    limit?: number;
    after?: string;
    before?: string;
    search?: string;
  }): Promise<any[]> {
    try {
      const params: any = {};
      if (options?.limit) params.limit = options.limit;
      if (options?.after) params.after = options.after;
      if (options?.before) params.before = options.before;
      if (options?.search) params.search = options.search;

      const response = await axios.get(this.baseURL, {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        params,
      });

      return response.data.result;
    } catch (error: any) {
      console.error('❌ Failed to list videos:', error.message);
      return [];
    }
  }

  /**
   * Update video metadata
   */
  async updateVideo(videoId: string, metadata: VideoMetadata): Promise<boolean> {
    try {
      await axios.post(
        `${this.baseURL}/${videoId}`,
        {
          meta: metadata,
        },
        {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Video metadata updated');
      return true;
    } catch (error: any) {
      console.error('❌ Failed to update video:', error.message);
      return false;
    }
  }

  /**
   * Get video analytics
   */
  async getVideoAnalytics(videoId: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/analytics/views`,
        {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          },
          params: {
            videoUID: videoId,
          },
        }
      );

      return response.data.result;
    } catch (error: any) {
      console.error('❌ Failed to get analytics:', error.message);
      return null;
    }
  }
}

export default CloudFlareStreamService;
