/**
 * 🎬 Instagram-Style Randomized Reels Service
 * Provides fast, randomized reel loading with intelligent caching
 */

import firestore from '@react-native-firebase/firestore';
import { FirebaseService } from './firebaseService';
import { Reel } from '../types';

interface RandomizedReelsResult {
  reels: Reel[];
  hasMore: boolean;
  nextBatch: string[];
}

class InstagramRandomizedReelsService {
  private static instance: InstagramRandomizedReelsService;
  private reelsPool: string[] = []; // Pool of all reel IDs
  private usedReels: Set<string> = new Set(); // Track shown reels
  private isInitialized = false;
  private batchSize = 20;
  private preloadedReels: Map<string, Reel> = new Map();

  static getInstance(): InstagramRandomizedReelsService {
    if (!this.instance) {
      this.instance = new InstagramRandomizedReelsService();
    }
    return this.instance;
  }

  /**
   * 🔄 Initialize the reels pool (call once on app start)
   */
  async initializeReelsPool(): Promise<void> {
    try {
      console.log('🎬 Initializing randomized reels pool...');
      
      // Get all reel IDs (lightweight query)
      const reelsSnapshot = await firestore()
        .collection('reels')
        .select() // Only get document IDs, not data
        .get();

      this.reelsPool = reelsSnapshot.docs.map(doc => doc.id);
      
      // Shuffle the initial pool for randomness
      this.shuffleArray(this.reelsPool);
      
      console.log(`✅ Initialized reels pool with ${this.reelsPool.length} reels`);
      this.isInitialized = true;

      // Preload first batch
      await this.preloadNextBatch();

    } catch (error) {
      console.error('❌ Error initializing reels pool:', error);
      throw error;
    }
  }

  /**
   * 🎲 Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * 📦 Preload next batch of reels for instant display
   */
  private async preloadNextBatch(): Promise<void> {
    try {
      const nextReelIds = this.getNextReelIds();
      if (nextReelIds.length === 0) return;

      // Fetch reel data in parallel
      const reelPromises = nextReelIds.map(async (reelId) => {
        try {
          const reelDoc = await firestore().collection('reels').doc(reelId).get();
          if (reelDoc.exists) {
            const reelData = { id: reelDoc.id, ...reelDoc.data() } as Reel;
            
            // Get user data
            if (reelData.userId) {
              const userData = await FirebaseService.getUserProfile(reelData.userId);
              if (userData) {
                reelData.user = userData;
              }
            }
            
            // Add computed fields
            reelData.timeAgo = FirebaseService.formatTimeAgo(reelData.createdAt);
            
            return reelData;
          }
          return null;
        } catch (error) {
          console.warn(`⚠️ Failed to preload reel ${reelId}:`, error);
          return null;
        }
      });

      const loadedReels = await Promise.allSettled(reelPromises);
      
      // Store successfully loaded reels
      loadedReels.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          this.preloadedReels.set(nextReelIds[index], result.value);
        }
      });

      console.log(`📦 Preloaded ${this.preloadedReels.size} reels`);

    } catch (error) {
      console.warn('⚠️ Error preloading reels batch:', error);
    }
  }

  /**
   * 🎯 Get next batch of random reel IDs
   */
  private getNextReelIds(): string[] {
    const availableReels = this.reelsPool.filter(id => !this.usedReels.has(id));
    
    // If we've used all reels, reset and reshuffle
    if (availableReels.length < this.batchSize) {
      console.log('🔄 Reshuffling reels pool for infinite scroll');
      this.usedReels.clear();
      this.shuffleArray(this.reelsPool);
      return this.reelsPool.slice(0, this.batchSize);
    }
    
    return availableReels.slice(0, this.batchSize);
  }

  /**
   * 🎬 Get randomized reels batch (main method)
   */
  async getRandomizedReels(limit: number = 20): Promise<RandomizedReelsResult> {
    try {
      // Initialize if not done yet
      if (!this.isInitialized) {
        await this.initializeReelsPool();
      }

      const reelIds = this.getNextReelIds().slice(0, limit);
      const reels: Reel[] = [];

      // First, try to get from preloaded cache
      for (const reelId of reelIds) {
        const cachedReel = this.preloadedReels.get(reelId);
        if (cachedReel) {
          reels.push(cachedReel);
          this.usedReels.add(reelId);
          this.preloadedReels.delete(reelId); // Remove from cache
        }
      }

      // If we don't have enough from cache, fetch remaining
      const remainingIds = reelIds.filter(id => !this.usedReels.has(id));
      if (remainingIds.length > 0) {
        const additionalReels = await this.fetchReelsByIds(remainingIds);
        reels.push(...additionalReels);
        
        // Mark as used
        remainingIds.forEach(id => this.usedReels.add(id));
      }

      // Shuffle the final batch for extra randomness
      this.shuffleArray(reels);

      // Preload next batch in background
      this.preloadNextBatch().catch(console.warn);

      // Get next batch IDs for preview
      const nextBatch = this.getNextReelIds().slice(0, limit);

      console.log(`🎬 Delivered ${reels.length} randomized reels`);

      return {
        reels,
        hasMore: this.reelsPool.length > this.usedReels.size,
        nextBatch
      };

    } catch (error) {
      console.error('❌ Error getting randomized reels:', error);
      
      // Fallback to regular fetch
      const fallbackResult = await FirebaseService.getReels(limit);
      return {
        reels: fallbackResult.reels,
        hasMore: fallbackResult.hasMore,
        nextBatch: []
      };
    }
  }

  /**
   * 📥 Fetch specific reels by IDs
   */
  private async fetchReelsByIds(reelIds: string[]): Promise<Reel[]> {
    try {
      const reelPromises = reelIds.map(async (reelId) => {
        try {
          const reelDoc = await firestore().collection('reels').doc(reelId).get();
          if (reelDoc.exists) {
            const reelData = { id: reelDoc.id, ...reelDoc.data() } as Reel;
            
            // Get user data
            if (reelData.userId) {
              const userData = await FirebaseService.getUserProfile(reelData.userId);
              if (userData) {
                reelData.user = userData;
              }
            }
            
            // Add computed fields
            reelData.timeAgo = FirebaseService.formatTimeAgo(reelData.createdAt);
            
            return reelData;
          }
          return null;
        } catch (error) {
          console.warn(`⚠️ Failed to fetch reel ${reelId}:`, error);
          return null;
        }
      });

      const results = await Promise.allSettled(reelPromises);
      return results
        .filter((result): result is PromiseFulfilledResult<Reel> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);

    } catch (error) {
      console.error('❌ Error fetching reels by IDs:', error);
      return [];
    }
  }

  /**
   * 🔄 Reset the reels pool (call when new reels are added)
   */
  async refreshReelsPool(): Promise<void> {
    this.reelsPool = [];
    this.usedReels.clear();
    this.isInitialized = false;
    this.preloadedReels.clear();
    await this.initializeReelsPool();
  }

  /**
   * 📊 Get service stats
   */
  getStats() {
    return {
      totalReels: this.reelsPool.length,
      usedReels: this.usedReels.size,
      preloadedReels: this.preloadedReels.size,
      remainingReels: this.reelsPool.length - this.usedReels.size,
      isInitialized: this.isInitialized
    };
  }
}

export default InstagramRandomizedReelsService;
