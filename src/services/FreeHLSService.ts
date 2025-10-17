/**
 * 🎉 100% FREE HLS CONVERSION SERVICE
 * 
 * ARCHITECTURE:
 * 1. Upload video to DigitalOcean Spaces (you already have it - FREE!)
 * 2. Call Firebase Function to convert to HLS (FREE for ~6,600/month)
 * 3. Play HLS from DigitalOcean CDN (FREE with your existing plan)
 * 
 * NO FIREBASE STORAGE NEEDED! 💰
 */

import DigitalOceanService from './digitalOceanService';

interface HLSConversionResponse {
  success: boolean;
  hlsUrl: string;           // Master .m3u8 playlist
  thumbnailUrl: string;     // Video thumbnail
  duration: number;         // Video duration in seconds
  resolutions: string[];    // Available resolutions (1080p, 720p, etc.)
}

interface UploadProgress {
  phase: 'uploading' | 'converting' | 'complete';
  progress: number;  // 0-100
  message: string;
}

class FreeHLSService {
  private static instance: FreeHLSService;
  
  // Your Firebase Function URL (deploy first to get this)
  private static FIREBASE_FUNCTION_URL = 'https://us-central1-jorvea-9f876.cloudfunctions.net/convertToHLS';

  static getInstance(): FreeHLSService {
    if (!FreeHLSService.instance) {
      FreeHLSService.instance = new FreeHLSService();
    }
    return FreeHLSService.instance;
  }

  /**
   * Upload video and convert to HLS
   * 100% FREE - Uses your existing DigitalOcean storage!
   */
  async uploadAndConvertVideo(
    videoUri: string,
    userId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<HLSConversionResponse> {
    try {
      console.log('🎬 Starting FREE HLS conversion...');
      const videoId = this.generateVideoId();
      const fileName = `${videoId}.mp4`;

      // Step 1: Upload to DigitalOcean (you already pay for this!)
      onProgress?.({
        phase: 'uploading',
        progress: 0,
        message: 'Uploading to DigitalOcean...'
      });

      console.log('📤 Step 1/2: Uploading to DigitalOcean Spaces...');
      const uploadedMedia = await DigitalOceanService.uploadMedia(
        videoUri,
        `reels/${fileName}`,
        'video/mp4'
      );

      console.log('✅ Upload complete:', uploadedMedia.url);

      onProgress?.({
        phase: 'uploading',
        progress: 50,
        message: 'Upload complete!'
      });

      // Step 2: Call Firebase Function to convert (FREE!)
      onProgress?.({
        phase: 'converting',
        progress: 60,
        message: 'Converting to HLS...'
      });

      console.log('🔄 Step 2/2: Converting to HLS format...');
      const conversionResponse = await this.callConversionFunction(
        uploadedMedia.url,
        videoId,
        userId
      );

      if (!conversionResponse.success) {
        throw new Error(conversionResponse.error || 'Conversion failed');
      }

      console.log('✅ Conversion complete!');
      console.log('🎥 HLS URL:', conversionResponse.hlsUrl);

      onProgress?.({
        phase: 'complete',
        progress: 100,
        message: 'Ready to stream!'
      });

      return conversionResponse;

    } catch (error: any) {
      console.error('❌ HLS conversion failed:', error);
      throw new Error(`HLS conversion failed: ${error.message}`);
    }
  }

  /**
   * Call Firebase Function to convert video
   * This is FREE for ~6,600 videos/month!
   */
  private async callConversionFunction(
    videoUrl: string,
    videoId: string,
    userId: string
  ): Promise<HLSConversionResponse> {
    try {
      console.log('📡 Calling Firebase Function...');
      console.log('🔗 Video URL:', videoUrl);

      const response = await fetch(FreeHLSService.FIREBASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl,
          videoId,
          userId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Function returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Function response:', data);

      return data;

    } catch (error: any) {
      console.error('❌ Function call failed:', error);
      throw error;
    }
  }

  /**
   * Generate unique video ID
   */
  private generateVideoId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get estimated cost (spoiler: it's FREE!)
   */
  static getEstimatedCost(videosPerMonth: number): string {
    const freeConversions = 6600;
    
    if (videosPerMonth <= freeConversions) {
      return '🎉 100% FREE! (Within free tier)';
    }
    
    const paidConversions = videosPerMonth - freeConversions;
    const cost = paidConversions * 0.00015;
    
    return `💰 $${cost.toFixed(2)}/month (${paidConversions} conversions after free tier)`;
  }
}

export default FreeHLSService;
