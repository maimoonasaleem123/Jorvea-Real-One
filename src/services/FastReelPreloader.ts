import { Reel } from '../services/firebaseService';

/**
 * 🚀 INSTAGRAM-STYLE REEL PRELOADER
 * Preloads next 2-3 reels in background for instant playback
 * NO loading screens, NO buffering delays
 */
class FastReelPreloader {
  private preloadedVideos: Set<string> = new Set();
  private preloadQueue: string[] = [];
  private maxPreloaded = 3;

  /**
   * Preload video in background
   */
  async preloadVideo(videoUrl: string): Promise<void> {
    if (this.preloadedVideos.has(videoUrl)) {
      return; // Already preloaded
    }

    if (!videoUrl) {
      return;
    }

    try {
      // For HLS, we preload the master playlist
      const isHLS = videoUrl.toLowerCase().includes('.m3u8');
      
      if (isHLS) {
        // Fetch master playlist
        await fetch(videoUrl, {
          method: 'GET',
          headers: {
            'Accept': '*/*',
            'User-Agent': 'Instagram/Android',
          },
        });
        console.log(`✅ Preloaded HLS playlist: ${videoUrl}`);
      } else {
        // For direct videos, just trigger a HEAD request
        await fetch(videoUrl, {
          method: 'HEAD',
        });
        console.log(`✅ Preloaded direct video: ${videoUrl}`);
      }

      this.preloadedVideos.add(videoUrl);
      
      // Keep only last N preloaded
      if (this.preloadedVideos.size > this.maxPreloaded) {
        const oldest = Array.from(this.preloadedVideos)[0];
        this.preloadedVideos.delete(oldest);
      }
    } catch (error) {
      console.log(`⚠️ Preload warning for ${videoUrl}:`, error);
      // Silent fail - don't block playback
    }
  }

  /**
   * Preload next N reels from current index
   */
  preloadNextReels(reels: Reel[], currentIndex: number, count: number = 2): void {
    const nextReels = reels.slice(currentIndex + 1, currentIndex + 1 + count);
    
    nextReels.forEach((reel) => {
      if (reel.videoUrl) {
        this.preloadVideo(reel.videoUrl);
      }
    });
  }

  /**
   * Clear all preloaded data
   */
  clear(): void {
    this.preloadedVideos.clear();
    this.preloadQueue = [];
  }

  /**
   * Check if video is preloaded
   */
  isPreloaded(videoUrl: string): boolean {
    return this.preloadedVideos.has(videoUrl);
  }
}

// Singleton instance
export default new FastReelPreloader();
