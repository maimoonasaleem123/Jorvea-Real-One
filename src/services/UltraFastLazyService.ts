/**
 * UltraFastLazyService - Instagram-style lazy loading system
 * Prevents everything from loading at once, improves performance
 */

import firestore from '@react-native-firebase/firestore';
import { User } from '../types';

interface LazyLoadConfig {
  initialLoad: number;
  batchSize: number;
  preloadNext: boolean;
  cacheEnabled: boolean;
}

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class UltraFastLazyService {
  private static cache = new Map<string, CacheItem<any>>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Default configurations for different content types
  private static configs = {
    posts: { initialLoad: 5, batchSize: 10, preloadNext: true, cacheEnabled: true },
    reels: { initialLoad: 3, batchSize: 8, preloadNext: true, cacheEnabled: true },
    comments: { initialLoad: 10, batchSize: 20, preloadNext: false, cacheEnabled: true },
    followers: { initialLoad: 20, batchSize: 30, preloadNext: false, cacheEnabled: true },
    following: { initialLoad: 20, batchSize: 30, preloadNext: false, cacheEnabled: true },
    stories: { initialLoad: 10, batchSize: 15, preloadNext: true, cacheEnabled: true },
    likes: { initialLoad: 15, batchSize: 25, preloadNext: false, cacheEnabled: true },
  };

  /**
   * Get cached data if available and not expired
   */
  private static getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.timestamp + cached.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Set data in cache with expiry
   */
  private static setCache<T>(key: string, data: T, customExpiry?: number): void {
    const expiry = customExpiry || this.CACHE_DURATION;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry,
    });
  }

  /**
   * Lazy load posts with Instagram-style progressive loading
   */
  static async lazyLoadPosts(
    userId: string,
    lastPostId?: string,
    customConfig?: Partial<LazyLoadConfig>
  ) {
    const config = { ...this.configs.posts, ...customConfig };
    const cacheKey = `posts_${userId}_${lastPostId || 'initial'}`;

    // Try cache first
    if (config.cacheEnabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;
    }

    try {
      let query = firestore()
        .collection('posts')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(lastPostId ? config.batchSize : config.initialLoad);

      if (lastPostId) {
        const lastDoc = await firestore().collection('posts').doc(lastPostId).get();
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Cache the result
      if (config.cacheEnabled) {
        this.setCache(cacheKey, posts);
      }

      // Preload next batch if enabled
      if (config.preloadNext && posts.length === config.batchSize) {
        setTimeout(() => {
          const lastPost = posts[posts.length - 1];
          this.lazyLoadPosts(userId, lastPost.id, { ...config, preloadNext: false });
        }, 1000);
      }

      return posts;
    } catch (error) {
      console.error('Error lazy loading posts:', error);
      return [];
    }
  }

  /**
   * Lazy load reels with algorithm-based loading
   */
  static async lazyLoadReels(
    currentUserId: string,
    following: string[] = [],
    lastReelId?: string,
    customConfig?: Partial<LazyLoadConfig>
  ) {
    const config = { ...this.configs.reels, ...customConfig };
    const cacheKey = `reels_${currentUserId}_${lastReelId || 'initial'}`;

    if (config.cacheEnabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;
    }

    try {
      // Get mixed content: 70% following, 30% discover
      const followingReels = await this.loadFollowingReels(following, lastReelId, Math.ceil(config.initialLoad * 0.7));
      const discoverReels = await this.loadDiscoverReels(currentUserId, following, lastReelId, Math.floor(config.initialLoad * 0.3));

      // Mix the content intelligently
      const mixedReels = this.mixContent(followingReels, discoverReels);

      if (config.cacheEnabled) {
        this.setCache(cacheKey, mixedReels);
      }

      return mixedReels;
    } catch (error) {
      console.error('Error lazy loading reels:', error);
      return [];
    }
  }

  /**
   * Load following users' reels
   */
  private static async loadFollowingReels(following: string[], lastReelId?: string, limit = 5) {
    if (following.length === 0) return [];

    let query = firestore()
      .collection('reels')
      .where('userId', 'in', following.slice(0, 10)) // Firestore limit
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (lastReelId) {
      const lastDoc = await firestore().collection('reels').doc(lastReelId).get();
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      source: 'following'
    }));
  }

  /**
   * Load discover reels (trending, high engagement)
   */
  private static async loadDiscoverReels(currentUserId: string, following: string[], lastReelId?: string, limit = 3) {
    let query = firestore()
      .collection('reels')
      .where('userId', 'not-in', [currentUserId, ...following.slice(0, 9)]) // Exclude user and following
      .orderBy('likesCount', 'desc')
      .limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      source: 'discover'
    }));
  }

  /**
   * Mix following and discover content intelligently
   */
  private static mixContent(followingContent: any[], discoverContent: any[]) {
    const mixed = [];
    let followingIndex = 0;
    let discoverIndex = 0;

    // Instagram-like mixing: 2-3 following, then 1 discover
    while (followingIndex < followingContent.length || discoverIndex < discoverContent.length) {
      // Add 2-3 following reels
      for (let i = 0; i < 3 && followingIndex < followingContent.length; i++) {
        mixed.push(followingContent[followingIndex++]);
      }

      // Add 1 discover reel
      if (discoverIndex < discoverContent.length) {
        mixed.push(discoverContent[discoverIndex++]);
      }
    }

    return mixed;
  }

  /**
   * Lazy load comments with progressive loading
   */
  static async lazyLoadComments(
    postId: string,
    lastCommentId?: string,
    customConfig?: Partial<LazyLoadConfig>
  ) {
    const config = { ...this.configs.comments, ...customConfig };
    const cacheKey = `comments_${postId}_${lastCommentId || 'initial'}`;

    if (config.cacheEnabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;
    }

    try {
      let query = firestore()
        .collection('posts')
        .doc(postId)
        .collection('comments')
        .orderBy('createdAt', 'desc')
        .limit(lastCommentId ? config.batchSize : config.initialLoad);

      if (lastCommentId) {
        const lastDoc = await firestore()
          .collection('posts')
          .doc(postId)
          .collection('comments')
          .doc(lastCommentId)
          .get();
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      const comments = [];

      for (const doc of snapshot.docs) {
        const commentData = doc.data();
        
        // Load user data for each comment
        const userDoc = await firestore().collection('users').doc(commentData.userId).get();
        const userData = userDoc.data();

        comments.push({
          id: doc.id,
          ...commentData,
          user: {
            uid: commentData.userId,
            displayName: userData?.displayName || 'Unknown User',
            profilePicture: userData?.profilePicture,
          },
        });
      }

      if (config.cacheEnabled) {
        this.setCache(cacheKey, comments);
      }

      return comments;
    } catch (error) {
      console.error('Error lazy loading comments:', error);
      return [];
    }
  }

  /**
   * Lazy load followers/following with progressive loading
   */
  static async lazyLoadFollowers(
    userId: string,
    type: 'followers' | 'following',
    lastUserId?: string,
    customConfig?: Partial<LazyLoadConfig>
  ) {
    const config = { ...this.configs[type], ...customConfig };
    const cacheKey = `${type}_${userId}_${lastUserId || 'initial'}`;

    if (config.cacheEnabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;
    }

    try {
      let query = firestore()
        .collection('users')
        .doc(userId)
        .collection(type)
        .orderBy('createdAt', 'desc')
        .limit(lastUserId ? config.batchSize : config.initialLoad);

      if (lastUserId) {
        const lastDoc = await firestore()
          .collection('users')
          .doc(userId)
          .collection(type)
          .doc(lastUserId)
          .get();
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      const userIds = snapshot.docs.map(doc => doc.id);

      // Load user data in batches
      const users = [];
      for (const uid of userIds) {
        try {
          const userDoc = await firestore().collection('users').doc(uid).get();
          if (userDoc.exists) {
            users.push({
              uid,
              ...userDoc.data(),
            });
          }
        } catch (error) {
          console.error(`Error loading user ${uid}:`, error);
        }
      }

      if (config.cacheEnabled) {
        this.setCache(cacheKey, users);
      }

      return users;
    } catch (error) {
      console.error(`Error lazy loading ${type}:`, error);
      return [];
    }
  }

  /**
   * Get followers/following count efficiently with safe permissions
   */
  static async getFollowCounts(userId: string) {
    const cacheKey = `follow_counts_${userId}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      console.log('🔍 Getting follow counts for user:', userId);

      // First try to get from user document (safer approach)
      const userDoc = await firestore().collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.followersCount !== undefined && userData?.followingCount !== undefined) {
          const counts = {
            followersCount: Math.max(0, userData.followersCount || 0),
            followingCount: Math.max(0, userData.followingCount || 0),
          };
          console.log('✅ Got counts from user document:', counts);
          this.setCache(cacheKey, counts, 2 * 60 * 1000);
          return counts;
        }
        
        // If no counts in user doc, try to get from arrays
        if (userData?.followers && userData?.following) {
          const counts = {
            followersCount: userData.followers.length || 0,
            followingCount: userData.following.length || 0,
          };
          console.log('✅ Got counts from user arrays:', counts);
          this.setCache(cacheKey, counts, 2 * 60 * 1000);
          return counts;
        }
      }

      // Fallback 1: try global collections (new approach)
      try {
        console.log('🔄 Trying global collections...');
        const [followersSnapshot, followingSnapshot] = await Promise.all([
          firestore().collection('followers').where('followedUserId', '==', userId).get(),
          firestore().collection('following').where('followerId', '==', userId).get(),
        ]);

        const counts = {
          followersCount: followersSnapshot.size,
          followingCount: followingSnapshot.size,
        };

        console.log('✅ Got counts from global collections:', counts);
        this.setCache(cacheKey, counts, 2 * 60 * 1000);
        return counts;
      } catch (globalError) {
        console.warn('Could not access global collections:', globalError.message);
      }

      // Fallback 2: try to count subcollections (might have permission issues)
      try {
        console.log('🔄 Trying subcollections...');
        const [followersSnapshot, followingSnapshot] = await Promise.all([
          firestore().collection('users').doc(userId).collection('followers').get(),
          firestore().collection('users').doc(userId).collection('following').get(),
        ]);

        const counts = {
          followersCount: followersSnapshot.size,
          followingCount: followingSnapshot.size,
        };

        console.log('✅ Got counts from subcollections:', counts);
        this.setCache(cacheKey, counts, 2 * 60 * 1000);
        return counts;
      } catch (subError) {
        console.warn('Permission denied for subcollections:', subError.message);
      }

      // Final fallback: return defaults
      console.warn('Using default counts for user:', userId);
      const defaultCounts = { followersCount: 0, followingCount: 0 };
      this.setCache(cacheKey, defaultCounts, 30 * 1000); // Cache for 30 seconds
      return defaultCounts;

    } catch (error) {
      console.error('Error getting follow counts:', error);
      return { followersCount: 0, followingCount: 0 };
    }
  }

  /**
   * Lazy load user profile with progressive data loading
   */
  static async lazyLoadUserProfile(userId: string) {
    const cacheKey = `user_profile_${userId}`;
    
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Load basic user data first
      const userDoc = await firestore().collection('users').doc(userId).get();
      if (!userDoc.exists) return null;

      const userData = userDoc.data();

      // Load additional data in parallel
      const [followCounts, postsCount, reelsCount] = await Promise.all([
        this.getFollowCounts(userId),
        this.getPostsCount(userId),
        this.getReelsCount(userId),
      ]);

      const profile = {
        uid: userId,
        ...userData,
        followersCount: (followCounts as any).followersCount || 0,
        followingCount: (followCounts as any).followingCount || 0,
        postsCount,
        reelsCount,
      };

      this.setCache(cacheKey, profile);

      return profile;
    } catch (error) {
      console.error('Error lazy loading user profile:', error);
      return null;
    }
  }

  /**
   * Get posts count efficiently
   */
  private static async getPostsCount(userId: string) {
    try {
      const snapshot = await firestore()
        .collection('posts')
        .where('userId', '==', userId)
        .get();
      return snapshot.size;
    } catch (error) {
      console.error('Error getting posts count:', error);
      return 0;
    }
  }

  /**
   * Get reels count efficiently
   */
  private static async getReelsCount(userId: string) {
    try {
      const snapshot = await firestore()
        .collection('reels')
        .where('userId', '==', userId)
        .get();
      return snapshot.size;
    } catch (error) {
      console.error('Error getting reels count:', error);
      return 0;
    }
  }

  /**
   * Clear cache (useful for logout or refresh)
   */
  static clearCache() {
    this.cache.clear();
  }

  /**
   * Clear specific cache entries
   */
  static clearCacheForUser(userId: string) {
    for (const [key] of this.cache) {
      if (key.includes(userId)) {
        this.cache.delete(key);
      }
    }
  }
}

export default UltraFastLazyService;
