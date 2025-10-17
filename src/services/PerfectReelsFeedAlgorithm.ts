import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Reel } from './firebaseService';

/**
 * 🎯 PERFECT REELS FEED ALGORITHM
 * Instagram-like smart feed that ensures:
 * - Never shows same reel twice
 * - Personalizes based on user behavior
 * - Prioritizes fresh content
 * - Balances followed users and discovery
 */

interface UserInteraction {
  reelId: string;
  timestamp: number;
  action: 'viewed' | 'liked' | 'commented' | 'shared' | 'skipped';
  watchTime?: number;
}

interface FeedPreferences {
  followedUsers: string[];
  likedReelIds: string[];
  viewedReelIds: string[];
  skippedReelIds: string[];
  interestTags: string[];
  lastFetchTime: number;
}

class PerfectReelsFeedAlgorithm {
  private static instance: PerfectReelsFeedAlgorithm;
  private viewedReelsCache: Set<string> = new Set();
  private userPreferences: FeedPreferences | null = null;
  private readonly CACHE_KEY = 'viewed_reels_cache';
  private readonly PREFERENCES_KEY = 'feed_preferences';

  static getInstance(): PerfectReelsFeedAlgorithm {
    if (!PerfectReelsFeedAlgorithm.instance) {
      PerfectReelsFeedAlgorithm.instance = new PerfectReelsFeedAlgorithm();
    }
    return PerfectReelsFeedAlgorithm.instance;
  }

  /**
   * Initialize feed system - load viewed reels from cache
   */
  async initialize(userId: string): Promise<void> {
    try {
      // Load viewed reels from AsyncStorage
      const cachedViewed = await AsyncStorage.getItem(`${this.CACHE_KEY}_${userId}`);
      if (cachedViewed) {
        const viewedArray = JSON.parse(cachedViewed);
        this.viewedReelsCache = new Set(viewedArray);
        console.log(`📚 Loaded ${this.viewedReelsCache.size} viewed reels from cache`);
      }

      // Load user preferences
      const cachedPrefs = await AsyncStorage.getItem(`${this.PREFERENCES_KEY}_${userId}`);
      if (cachedPrefs) {
        this.userPreferences = JSON.parse(cachedPrefs);
        console.log('📊 Loaded user feed preferences');
      } else {
        await this.buildUserPreferences(userId);
      }
    } catch (error) {
      console.error('Error initializing feed algorithm:', error);
    }
  }

  /**
   * Build user preferences from Firebase data
   */
  private async buildUserPreferences(userId: string): Promise<void> {
    try {
      // Get followed users
      const followsSnapshot = await firestore()
        .collection('follows')
        .where('followerId', '==', userId)
        .get();
      
      const followedUsers = followsSnapshot.docs.map(doc => doc.data().followingId);

      // Get liked reels
      const likedSnapshot = await firestore()
        .collectionGroup('likes')
        .where('userId', '==', userId)
        .limit(100)
        .get();
      
      const likedReelIds = likedSnapshot.docs.map(doc => doc.ref.parent.parent?.id || '');

      // Get interest tags from liked reels
      const interestTags = await this.extractInterestTags(likedReelIds);

      this.userPreferences = {
        followedUsers,
        likedReelIds,
        viewedReelIds: Array.from(this.viewedReelsCache),
        skippedReelIds: [],
        interestTags,
        lastFetchTime: Date.now(),
      };

      await this.savePreferences(userId);
    } catch (error) {
      console.error('Error building user preferences:', error);
    }
  }

  /**
   * Extract interest tags from liked reels
   */
  private async extractInterestTags(reelIds: string[]): Promise<string[]> {
    try {
      const tags: string[] = [];
      
      for (const reelId of reelIds.slice(0, 20)) {
        const reelDoc = await firestore().collection('reels').doc(reelId).get();
        if (reelDoc.exists && reelDoc.data()?.tags) {
          tags.push(...reelDoc.data()!.tags);
        }
      }

      // Count tag frequency and get top tags
      const tagCounts = tags.reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag);
    } catch (error) {
      console.error('Error extracting interest tags:', error);
      return [];
    }
  }

  /**
   * Get personalized feed - Instagram algorithm
   */
  async getPersonalizedFeed(
    userId: string,
    limit: number = 10,
    lastReelId?: string
  ): Promise<Reel[]> {
    try {
      console.log('🎯 Generating personalized feed...');

      if (!this.userPreferences) {
        await this.buildUserPreferences(userId);
      }

      const feed: Reel[] = [];
      
      // 1. Fresh reels from followed users (40% of feed)
      const followedReels = await this.getFollowedUsersReels(userId, Math.ceil(limit * 0.4));
      feed.push(...followedReels);

      // 2. Trending reels (30% of feed)
      const trendingReels = await this.getTrendingReels(userId, Math.ceil(limit * 0.3));
      feed.push(...trendingReels);

      // 3. Interest-based discovery (20% of feed)
      const interestReels = await this.getInterestBasedReels(userId, Math.ceil(limit * 0.2));
      feed.push(...interestReels);

      // 4. Random discovery (10% of feed)
      const discoveryReels = await this.getDiscoveryReels(userId, Math.ceil(limit * 0.1));
      feed.push(...discoveryReels);

      // Shuffle and remove duplicates
      const uniqueFeed = this.removeDuplicates(feed);
      const shuffled = this.shuffleArray(uniqueFeed);

      // Filter out viewed reels
      const unseenFeed = shuffled.filter(reel => !this.viewedReelsCache.has(reel.id));

      console.log(`✅ Generated feed: ${unseenFeed.length} unseen reels`);
      return unseenFeed.slice(0, limit);
    } catch (error) {
      console.error('Error getting personalized feed:', error);
      return [];
    }
  }

  /**
   * Get reels from followed users
   */
  private async getFollowedUsersReels(userId: string, limit: number): Promise<Reel[]> {
    try {
      if (!this.userPreferences?.followedUsers.length) {
        return [];
      }

      const snapshot = await firestore()
        .collection('reels')
        .where('userId', 'in', this.userPreferences.followedUsers.slice(0, 10))
        .where('createdAt', '>', firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))) // Last 7 days
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reel));
    } catch (error) {
      console.error('Error getting followed users reels:', error);
      return [];
    }
  }

  /**
   * Get trending reels (high engagement)
   */
  private async getTrendingReels(userId: string, limit: number): Promise<Reel[]> {
    try {
      const snapshot = await firestore()
        .collection('reels')
        .where('createdAt', '>', firestore.Timestamp.fromDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))) // Last 3 days
        .orderBy('createdAt', 'desc')
        .orderBy('likesCount', 'desc')
        .limit(limit * 3)
        .get();

      // Calculate engagement score
      const reelsWithScore = snapshot.docs.map(doc => {
        const data = doc.data();
        const engagementScore = 
          (data.likesCount || 0) * 3 +
          (data.commentsCount || 0) * 5 +
          (data.shares || 0) * 7 +
          (data.views || 0) * 0.1;
        
        return {
          id: doc.id,
          ...data,
          engagementScore,
        } as Reel & { engagementScore: number };
      });

      // Sort by engagement and return top
      return reelsWithScore
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting trending reels:', error);
      return [];
    }
  }

  /**
   * Get reels based on user interests
   */
  private async getInterestBasedReels(userId: string, limit: number): Promise<Reel[]> {
    try {
      if (!this.userPreferences?.interestTags.length) {
        return [];
      }

      const snapshot = await firestore()
        .collection('reels')
        .where('tags', 'array-contains-any', this.userPreferences.interestTags.slice(0, 10))
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reel));
    } catch (error) {
      console.error('Error getting interest-based reels:', error);
      return [];
    }
  }

  /**
   * Get random discovery reels
   */
  private async getDiscoveryReels(userId: string, limit: number): Promise<Reel[]> {
    try {
      // Get random recent reels
      const snapshot = await firestore()
        .collection('reels')
        .where('createdAt', '>', firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000))) // Last 24 hours
        .orderBy('createdAt', 'desc')
        .limit(limit * 5)
        .get();

      const reels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reel));
      return this.shuffleArray(reels).slice(0, limit);
    } catch (error) {
      console.error('Error getting discovery reels:', error);
      return [];
    }
  }

  /**
   * Mark reel as viewed
   */
  async markAsViewed(userId: string, reelId: string): Promise<void> {
    try {
      this.viewedReelsCache.add(reelId);
      
      // Save to AsyncStorage (throttled)
      await this.saveViewedCache(userId);

      // Update preferences
      if (this.userPreferences) {
        this.userPreferences.viewedReelIds.push(reelId);
        await this.savePreferences(userId);
      }
    } catch (error) {
      console.error('Error marking reel as viewed:', error);
    }
  }

  /**
   * Track user interaction for better recommendations
   */
  async trackInteraction(
    userId: string,
    reelId: string,
    action: 'viewed' | 'liked' | 'commented' | 'shared' | 'skipped',
    watchTime?: number
  ): Promise<void> {
    try {
      const interaction: UserInteraction = {
        reelId,
        timestamp: Date.now(),
        action,
        watchTime,
      };

      // Store interaction in Firebase for analysis
      await firestore()
        .collection('userInteractions')
        .doc(`${userId}_${reelId}`)
        .set(interaction, { merge: true });

      // Update local preferences
      if (action === 'liked' && this.userPreferences) {
        this.userPreferences.likedReelIds.push(reelId);
      } else if (action === 'skipped' && this.userPreferences) {
        this.userPreferences.skippedReelIds.push(reelId);
      }
    } catch (error) {
      console.error('Error tracking interaction:', error);
    }
  }

  /**
   * Clear viewed cache (for debugging or user request)
   */
  async clearViewedCache(userId: string): Promise<void> {
    try {
      this.viewedReelsCache.clear();
      await AsyncStorage.removeItem(`${this.CACHE_KEY}_${userId}`);
      console.log('🗑️ Viewed reels cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Helper: Save viewed cache to AsyncStorage
   */
  private async saveViewedCache(userId: string): Promise<void> {
    try {
      const viewedArray = Array.from(this.viewedReelsCache);
      await AsyncStorage.setItem(`${this.CACHE_KEY}_${userId}`, JSON.stringify(viewedArray));
    } catch (error) {
      console.error('Error saving viewed cache:', error);
    }
  }

  /**
   * Helper: Save preferences to AsyncStorage
   */
  private async savePreferences(userId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${this.PREFERENCES_KEY}_${userId}`,
        JSON.stringify(this.userPreferences)
      );
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  }

  /**
   * Helper: Remove duplicates
   */
  private removeDuplicates(reels: Reel[]): Reel[] {
    const seen = new Set<string>();
    return reels.filter(reel => {
      if (seen.has(reel.id)) {
        return false;
      }
      seen.add(reel.id);
      return true;
    });
  }

  /**
   * Helper: Shuffle array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

export default PerfectReelsFeedAlgorithm;
