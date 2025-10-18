/**
 * 🚀 INSTANT REEL PRELOADER
 * Preloads first reel chunks when app opens for instant playback
 */

import firestore from '@react-native-firebase/firestore';
import { Reel } from '../services/firebaseService';

class AppLaunchReelPreloader {
  private static instance: AppLaunchReelPreloader;
  private preloadedReel: Reel | null = null;
  private isPreloading = false;
  private preloadPromise: Promise<Reel | null> | null = null;

  private constructor() {}

  static getInstance(): AppLaunchReelPreloader {
    if (!AppLaunchReelPreloader.instance) {
      AppLaunchReelPreloader.instance = new AppLaunchReelPreloader();
    }
    return AppLaunchReelPreloader.instance;
  }

  /**
   * Preload first reel on app launch (call from App.tsx)
   * This runs in background while user views home screen
   */
  async preloadFirstReel(userId: string): Promise<void> {
    if (this.isPreloading || this.preloadedReel) {
      console.log('⚡ Reel already preloaded or preloading');
      return;
    }

    this.isPreloading = true;
    console.log('🚀 [AppLaunch] Preloading first reel in background...');

    try {
      this.preloadPromise = this.fetchFirstReel(userId);
      this.preloadedReel = await this.preloadPromise;
      
      if (this.preloadedReel) {
        console.log('✅ [AppLaunch] First reel preloaded:', this.preloadedReel.id);
        // Start downloading first chunks
        this.preloadVideoChunks(this.preloadedReel.videoUrl);
      }
    } catch (error) {
      console.error('❌ [AppLaunch] Preload failed:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Get preloaded reel instantly (for ReelsScreen)
   */
  async getPreloadedReel(): Promise<Reel | null> {
    // If already preloaded, return immediately
    if (this.preloadedReel) {
      console.log('⚡ [AppLaunch] Returning preloaded reel instantly');
      return this.preloadedReel;
    }

    // If preloading, wait for it
    if (this.preloadPromise) {
      console.log('⏳ [AppLaunch] Waiting for preload to complete...');
      return await this.preloadPromise;
    }

    return null;
  }

  /**
   * Fetch first reel from Firestore
   */
  private async fetchFirstReel(userId: string): Promise<Reel | null> {
    try {
      // Get user's following list for personalized feed
      const followingSnapshot = await firestore()
        .collection('followers')
        .where('followerId', '==', userId)
        .limit(10)
        .get();

      const followingIds = followingSnapshot.docs.map(doc => doc.data().followedUserId);

      let query;

      // Prioritize followed users if available (only if array is not empty!)
      if (followingIds.length > 0) {
        query = firestore()
          .collection('reels')
          .where('userId', 'in', followingIds.slice(0, 10))
          .orderBy('createdAt', 'desc')
          .limit(1);
      } else {
        // Fallback: Get any public reel
        query = firestore()
          .collection('reels')
          .orderBy('createdAt', 'desc')
          .limit(1);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const reelData = { id: doc.id, ...doc.data() } as Reel;

      // Load user data
      const userDoc = await firestore().collection('users').doc(reelData.userId).get();
      if (userDoc.exists) {
        reelData.user = userDoc.data() as any;
      }

      // Check if liked
      const likeDoc = await firestore()
        .collection('likes')
        .doc(`${reelData.id}_${userId}`)
        .get();
      
      reelData.isLiked = likeDoc.exists();

      return reelData;
    } catch (error) {
      console.error('❌ [AppLaunch] Fetch first reel error:', error);
      return null;
    }
  }

  /**
   * Preload first video chunks (native fetch for instant playback)
   */
  private async preloadVideoChunks(videoUrl: string): Promise<void> {
    if (!videoUrl) return;

    try {
      console.log('📹 [AppLaunch] Preloading video chunks:', videoUrl);

      // For HLS videos, preload master playlist and first segment
      if (videoUrl.includes('.m3u8')) {
        // Fetch master playlist
        const masterResponse = await fetch(videoUrl, {
          headers: {
            'Accept': '*/*',
            'User-Agent': 'Instagram/Android',
          },
        });
        
        if (masterResponse.ok) {
          const masterPlaylist = await masterResponse.text();
          console.log('✅ [AppLaunch] Master playlist preloaded');

          // Parse and preload first quality variant
          const variantMatch = masterPlaylist.match(/^[^#].*\.m3u8$/m);
          if (variantMatch) {
            const variantUrl = new URL(variantMatch[0], videoUrl).href;
            const variantResponse = await fetch(variantUrl);
            
            if (variantResponse.ok) {
              const variantPlaylist = await variantResponse.text();
              console.log('✅ [AppLaunch] Variant playlist preloaded');

              // Preload first 2 segments
              const segmentMatches = [...variantPlaylist.matchAll(/^[^#].*\.ts$/gm)];
              for (let i = 0; i < Math.min(2, segmentMatches.length); i++) {
                const segmentUrl = new URL(segmentMatches[i][0], variantUrl).href;
                fetch(segmentUrl).catch(() => {}); // Fire and forget
              }
              console.log('✅ [AppLaunch] First 2 segments preloading...');
            }
          }
        }
      } else {
        // For direct videos, preload first 1MB
        fetch(videoUrl, {
          headers: {
            'Range': 'bytes=0-1048576', // First 1MB
          },
        }).catch(() => {}); // Fire and forget
        console.log('✅ [AppLaunch] First 1MB preloading...');
      }
    } catch (error) {
      console.warn('⚠️ [AppLaunch] Video chunk preload failed:', error);
      // Non-critical, continue
    }
  }

  /**
   * Clear preloaded data (call when user navigates away from app)
   */
  clear(): void {
    console.log('🧹 [AppLaunch] Clearing preloaded reel');
    this.preloadedReel = null;
    this.preloadPromise = null;
    this.isPreloading = false;
  }
}

export default AppLaunchReelPreloader;
