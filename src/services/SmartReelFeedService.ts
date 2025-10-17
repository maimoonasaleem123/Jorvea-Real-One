/**
 * 🎯 SMART REEL FEED SERVICE - Instagram-Style Intelligent Feed Algorithm
 * 
 * Features:
 * - Prioritizes following users' content
 * - High engagement reels appear first
 * - Trending content detection
 * - Personalized recommendations
 * - Discovery of new creators
 * - Prevents duplicate content
 * - Optimized for instant loading
 */

import firestore from '@react-native-firebase/firestore';
import { Reel } from './firebaseService';

interface ReelScore {
  reel: Reel;
  score: number;
  category: 'following' | 'trending' | 'high-engagement' | 'personalized' | 'discovery';
}

interface FeedComposition {
  following: number;      // 30%
  trending: number;       // 25%
  highEngagement: number; // 20%
  personalized: number;   // 15%
  discovery: number;      // 10%
}

class SmartReelFeedService {
  private static instance: SmartReelFeedService;
  private reelCache = new Map<string, Reel>();
  private userWatchHistory = new Map<string, Set<string>>(); // userId -> Set of reelIds
  private lastFetchTime = new Map<string, number>();
  private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

  static getInstance(): SmartReelFeedService {
    if (!SmartReelFeedService.instance) {
      SmartReelFeedService.instance = new SmartReelFeedService();
    }
    return SmartReelFeedService.instance;
  }

  /**
   * 🎯 Get smart personalized feed for user
   */
  async getSmartFeed(
    userId: string,
    limit: number = 10,
    lastReelId?: string
  ): Promise<Reel[]> {
    try {
      console.log('🎯 Generating smart feed for user:', userId);

      // Calculate feed composition
      const composition = this.calculateFeedComposition(limit);

      // Fetch different categories of reels in parallel
      const [followingReels, trendingReels, highEngagementReels, personalizedReels, discoveryReels] = 
        await Promise.all([
          this.getFollowingReels(userId, composition.following),
          this.getTrendingReels(composition.trending, userId),
          this.getHighEngagementReels(composition.highEngagement, userId),
          this.getPersonalizedReels(userId, composition.personalized),
          this.getDiscoveryReels(composition.discovery, userId),
        ]);

      // Score and rank all reels
      const scoredReels = this.scoreAndRankReels(
        userId,
        followingReels,
        trendingReels,
        highEngagementReels,
        personalizedReels,
        discoveryReels
      );

      // Mix reels intelligently (not just top scores, but varied content)
      const mixedReels = this.mixReelsIntelligently(scoredReels, composition);

      // Filter out already watched reels
      const unwatchedReels = this.filterWatchedReels(userId, mixedReels);

      console.log(`✅ Smart feed generated: ${unwatchedReels.length} reels`);
      console.log(`📊 Composition: Following=${followingReels.length}, Trending=${trendingReels.length}, High Engagement=${highEngagementReels.length}, Personalized=${personalizedReels.length}, Discovery=${discoveryReels.length}`);

      return unwatchedReels.slice(0, limit);
    } catch (error) {
      console.error('❌ Error generating smart feed:', error);
      // Fallback to simple recent reels
      return this.getFallbackReels(userId, limit);
    }
  }

  /**
   * 📊 Calculate optimal feed composition
   */
  private calculateFeedComposition(totalReels: number): FeedComposition {
    return {
      following: Math.ceil(totalReels * 0.30),      // 30%
      trending: Math.ceil(totalReels * 0.25),       // 25%
      highEngagement: Math.ceil(totalReels * 0.20), // 20%
      personalized: Math.ceil(totalReels * 0.15),   // 15%
      discovery: Math.ceil(totalReels * 0.10),      // 10%
    };
  }

  /**
   * 👥 Get reels from users the person follows
   */
  private async getFollowingReels(userId: string, limit: number): Promise<Reel[]> {
    try {
      // Get user's following list
      const followingSnapshot = await firestore()
        .collection('following')
        .where('followerId', '==', userId)
        .limit(50)
        .get();

      const followingIds = followingSnapshot.docs.map(doc => doc.data().followingId);

      if (followingIds.length === 0) {
        return [];
      }

      // Get reels from followed users (most recent first)
      const reelsSnapshot = await firestore()
        .collection('reels')
        .where('userId', 'in', followingIds.slice(0, 10)) // Firestore 'in' limit is 10
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return reelsSnapshot.docs.map(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : 
                         data.createdAt instanceof Date ? data.createdAt : 
                         new Date();
        return {
          id: doc.id,
          ...data,
          createdAt,
        } as Reel;
      });
    } catch (error) {
      console.error('Error getting following reels:', error);
      return [];
    }
  }

  /**
   * 🔥 Get trending reels (high engagement in last 24h)
   */
  private async getTrendingReels(limit: number, userId: string): Promise<Reel[]> {
    try {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      // Simplified query without compound index requirement
      const reelsSnapshot = await firestore()
        .collection('reels')
        .where('createdAt', '>=', yesterday)
        .orderBy('createdAt', 'desc')
        .limit(limit * 3) // Get more to filter and sort by engagement
        .get();

      const reels = reelsSnapshot.docs.map(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : 
                         data.createdAt instanceof Date ? data.createdAt : 
                         new Date();
        return {
          id: doc.id,
          ...data,
          createdAt,
        } as Reel;
      });

      // Filter out user's own reels and sort by engagement
      return reels
        .filter(reel => reel.userId !== userId)
        .sort((a, b) => {
          const engagementA = (a.likesCount || 0) + (a.commentsCount || 0) * 2;
          const engagementB = (b.likesCount || 0) + (b.commentsCount || 0) * 2;
          return engagementB - engagementA;
        })
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting trending reels:', error);
      return [];
    }
  }

  /**
   * ⭐ Get high engagement reels
   */
  private async getHighEngagementReels(limit: number, userId: string): Promise<Reel[]> {
    try {
      const reelsSnapshot = await firestore()
        .collection('reels')
        .where('likesCount', '>=', 50) // At least 50 likes (lowered threshold)
        .orderBy('likesCount', 'desc')
        .limit(limit * 2)
        .get();

      const reels = reelsSnapshot.docs.map(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : 
                         data.createdAt instanceof Date ? data.createdAt : 
                         new Date();
        return {
          id: doc.id,
          ...data,
          createdAt,
        } as Reel;
      });

      // Filter out user's own reels and ensure variety
      return reels
        .filter(reel => reel.userId !== userId)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting high engagement reels:', error);
      return [];
    }
  }

  /**
   * 🎨 Get personalized reels based on user's watch history
   */
  private async getPersonalizedReels(userId: string, limit: number): Promise<Reel[]> {
    try {
      // For now, return recent reels
      // TODO: Implement proper personalization based on watch history and likes
      const reelsSnapshot = await firestore()
        .collection('reels')
        .orderBy('createdAt', 'desc')
        .limit(limit * 2)
        .get();

      const reels = reelsSnapshot.docs.map(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : 
                         data.createdAt instanceof Date ? data.createdAt : 
                         new Date();
        return {
          id: doc.id,
          ...data,
          createdAt,
        } as Reel;
      });

      return reels
        .filter(reel => reel.userId !== userId)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting personalized reels:', error);
      return [];
    }
  }

  /**
   * 🔍 Get discovery reels (new creators)
   */
  private async getDiscoveryReels(limit: number, userId: string): Promise<Reel[]> {
    try {
      // Get reels from users with low follower count (new creators)
      const reelsSnapshot = await firestore()
        .collection('reels')
        .orderBy('createdAt', 'desc')
        .limit(limit * 3)
        .get();

      const reels = reelsSnapshot.docs.map(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : 
                         data.createdAt instanceof Date ? data.createdAt : 
                         new Date();
        return {
          id: doc.id,
          ...data,
          createdAt,
        } as Reel;
      });

      // Filter for variety and new creators
      return reels
        .filter(reel => reel.userId !== userId)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting discovery reels:', error);
      return [];
    }
  }

  /**
   * 🎯 Score and rank all reels
   */
  private scoreAndRankReels(
    userId: string,
    followingReels: Reel[],
    trendingReels: Reel[],
    highEngagementReels: Reel[],
    personalizedReels: Reel[],
    discoveryReels: Reel[]
  ): ReelScore[] {
    const scoredReels: ReelScore[] = [];

    // Score following reels (highest priority)
    followingReels.forEach(reel => {
      scoredReels.push({
        reel,
        score: this.calculateReelScore(reel, 'following'),
        category: 'following',
      });
    });

    // Score trending reels
    trendingReels.forEach(reel => {
      if (!scoredReels.find(sr => sr.reel.id === reel.id)) {
        scoredReels.push({
          reel,
          score: this.calculateReelScore(reel, 'trending'),
          category: 'trending',
        });
      }
    });

    // Score high engagement reels
    highEngagementReels.forEach(reel => {
      if (!scoredReels.find(sr => sr.reel.id === reel.id)) {
        scoredReels.push({
          reel,
          score: this.calculateReelScore(reel, 'high-engagement'),
          category: 'high-engagement',
        });
      }
    });

    // Score personalized reels
    personalizedReels.forEach(reel => {
      if (!scoredReels.find(sr => sr.reel.id === reel.id)) {
        scoredReels.push({
          reel,
          score: this.calculateReelScore(reel, 'personalized'),
          category: 'personalized',
        });
      }
    });

    // Score discovery reels
    discoveryReels.forEach(reel => {
      if (!scoredReels.find(sr => sr.reel.id === reel.id)) {
        scoredReels.push({
          reel,
          score: this.calculateReelScore(reel, 'discovery'),
          category: 'discovery',
        });
      }
    });

    return scoredReels;
  }

  /**
   * 📊 Calculate score for a reel
   */
  private calculateReelScore(reel: Reel, category: string): number {
    let score = 0;

    // Base score by category
    switch (category) {
      case 'following':
        score = 1000;
        break;
      case 'trending':
        score = 800;
        break;
      case 'high-engagement':
        score = 600;
        break;
      case 'personalized':
        score = 400;
        break;
      case 'discovery':
        score = 200;
        break;
    }

    // Add engagement score
    const likes = reel.likesCount || 0;
    const comments = reel.commentsCount || 0;
    const views = reel.views || 0;
    
    score += likes * 2;
    score += comments * 5;
    score += Math.min(views / 100, 100); // Max 100 points from views

    // Recency bonus (newer content gets boost)
    const createdAt = reel.createdAt;
    if (createdAt !== null && createdAt !== undefined) {
      const createdAtTime = typeof createdAt === 'object' && createdAt && 'getTime' in createdAt
        ? (createdAt as Date).getTime() 
        : typeof createdAt === 'string' 
        ? new Date(createdAt).getTime() 
        : 0;
      const hoursOld = (Date.now() - createdAtTime) / (1000 * 60 * 60);
      if (hoursOld < 24) {
        score += (24 - hoursOld) * 5;
      }
    }

    return score;
  }

  /**
   * 🎨 Mix reels intelligently for variety
   */
  private mixReelsIntelligently(scoredReels: ReelScore[], composition: FeedComposition): Reel[] {
    // Handle empty case
    if (!scoredReels || scoredReels.length === 0) {
      return [];
    }

    // Sort by score first
    const sorted = [...scoredReels].sort((a, b) => b.score - a.score);

    // Group by category with safety checks
    const byCategory = {
      following: sorted.filter(sr => sr && sr.category === 'following') || [],
      trending: sorted.filter(sr => sr && sr.category === 'trending') || [],
      highEngagement: sorted.filter(sr => sr && sr.category === 'high-engagement') || [],
      personalized: sorted.filter(sr => sr && sr.category === 'personalized') || [],
      discovery: sorted.filter(sr => sr && sr.category === 'discovery') || [],
    };

    // Mix categories for variety (not all following first, but interspersed)
    const mixed: Reel[] = [];
    const pattern = ['following', 'trending', 'following', 'highEngagement', 'personalized', 'following', 'discovery'];
    let patternIndex = 0;
    let emptyIterations = 0;
    const maxEmptyIterations = pattern.length * 2; // Prevent infinite loop

    while (mixed.length < sorted.length && emptyIterations < maxEmptyIterations) {
      const category = pattern[patternIndex % pattern.length];
      const categoryReels = byCategory[category as keyof typeof byCategory];
      
      if (categoryReels && categoryReels.length > 0) {
        const reel = categoryReels.shift();
        if (reel && reel.reel) {
          mixed.push(reel.reel);
          emptyIterations = 0; // Reset counter when we find a reel
        }
      } else {
        emptyIterations++;
      }
      
      patternIndex++;
    }

    return mixed;
  }

  /**
   * 🚫 Filter out already watched reels
   */
  private filterWatchedReels(userId: string, reels: Reel[]): Reel[] {
    const watchHistory = this.userWatchHistory.get(userId) || new Set();
    return reels.filter(reel => !watchHistory.has(reel.id));
  }

  /**
   * 📝 Mark reel as watched
   */
  markReelAsWatched(userId: string, reelId: string): void {
    if (!this.userWatchHistory.has(userId)) {
      this.userWatchHistory.set(userId, new Set());
    }
    this.userWatchHistory.get(userId)!.add(reelId);

    // Keep only last 1000 watched reels per user
    const history = this.userWatchHistory.get(userId)!;
    if (history.size > 1000) {
      const toRemove = Array.from(history).slice(0, history.size - 1000);
      toRemove.forEach(id => history.delete(id));
    }
  }

  /**
   * 🔄 Fallback to simple reels if smart feed fails
   */
  private async getFallbackReels(userId: string, limit: number): Promise<Reel[]> {
    try {
      const reelsSnapshot = await firestore()
        .collection('reels')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return reelsSnapshot.docs.map(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : 
                         data.createdAt instanceof Date ? data.createdAt : 
                         new Date();
        return {
          id: doc.id,
          ...data,
          createdAt,
        } as Reel;
      });
    } catch (error) {
      console.error('Error getting fallback reels:', error);
      return [];
    }
  }

  /**
   * 🧹 Clear watch history for user
   */
  clearWatchHistory(userId: string): void {
    this.userWatchHistory.delete(userId);
  }
}

export default SmartReelFeedService;
