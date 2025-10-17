import firestore from '@react-native-firebase/firestore';
import { User, Post, Reel } from '../types';

interface LazyLoadOptions {
  batchSize?: number;
  preloadNext?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

interface UserProfileData {
  user: User;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  recentPosts: Post[];
  isFollowing: boolean;
  isOwnProfile: boolean;
}

export class UltraFastLazyLoadService {
  private static instance: UltraFastLazyLoadService;
  private cache = new Map<string, any>();
  private loadingQueue = new Set<string>();

  static getInstance(): UltraFastLazyLoadService {
    if (!UltraFastLazyLoadService.instance) {
      UltraFastLazyLoadService.instance = new UltraFastLazyLoadService();
    }
    return UltraFastLazyLoadService.instance;
  }

  // Ultra fast profile loading like Instagram
  async loadUserProfile(
    userId: string, 
    currentUserId: string,
    options: LazyLoadOptions = {}
  ): Promise<UserProfileData> {
    const cacheKey = `profile_${userId}_${currentUserId}`;
    
    // Return from cache if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Prevent duplicate loading
    if (this.loadingQueue.has(cacheKey)) {
      return new Promise((resolve) => {
        const checkCache = () => {
          if (this.cache.has(cacheKey)) {
            resolve(this.cache.get(cacheKey));
          } else {
            setTimeout(checkCache, 50);
          }
        };
        checkCache();
      });
    }

    this.loadingQueue.add(cacheKey);

    try {
      console.log('🚀 Loading profile for user:', userId);

      // Load all essential data in parallel for instant display
      const [
        userDoc,
        postsSnapshot,
        followersSnapshot,
        followingSnapshot,
        isFollowingDoc
      ] = await Promise.all([
        // User basic info
        firestore().collection('users').doc(userId).get(),
        
        // Posts count (optimized query)
        firestore()
          .collection('posts')
          .where('userId', '==', userId)
          .where('isActive', '==', true)
          .limit(1) // Just to check if posts exist
          .get(),
          
        // Followers count (optimized)
        firestore()
          .collection('users')
          .doc(userId)
          .collection('followers')
          .limit(1)
          .get(),
          
        // Following count (optimized)
        firestore()
          .collection('users')
          .doc(userId)
          .collection('following')
          .limit(1)
          .get(),
          
        // Check if current user is following
        currentUserId !== userId ? 
          firestore()
            .collection('users')
            .doc(currentUserId)
            .collection('following')
            .doc(userId)
            .get() : 
          Promise.resolve({ exists: false })
      ]);

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data() as User;
      
      // Get actual counts from user document (more reliable)
      const followersCount = userData.followersCount || 0;
      const followingCount = userData.followingCount || 0;
      const postsCount = userData.postsCount || 0;

      console.log(`📊 Profile stats - Posts: ${postsCount}, Followers: ${followersCount}, Following: ${followingCount}`);

      // Load recent posts in background (lazy)
      const recentPostsPromise = this.loadRecentPosts(userId, options.batchSize || 6);

      const profileData: UserProfileData = {
        user: {
          ...userData,
          id: userDoc.id,
          followersCount,
          followingCount,
          postsCount
        },
        postsCount,
        followersCount,
        followingCount,
        recentPosts: [], // Will be loaded lazily
        isFollowing: !!isFollowingDoc.exists,
        isOwnProfile: userId === currentUserId
      };

      // Cache the profile data immediately
      this.cache.set(cacheKey, profileData);

      // Load recent posts in background
      recentPostsPromise.then(posts => {
        profileData.recentPosts = posts;
        this.cache.set(cacheKey, profileData);
      });

      console.log('✅ Profile loaded successfully for:', userData.username);
      return profileData;

    } catch (error) {
      console.error('❌ Error loading profile:', error);
      throw error;
    } finally {
      this.loadingQueue.delete(cacheKey);
    }
  }

  // Lazy load recent posts
  private async loadRecentPosts(userId: string, limit: number = 6): Promise<Post[]> {
    try {
      const postsSnapshot = await firestore()
        .collection('posts')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Post));
    } catch (error) {
      console.error('❌ Error loading recent posts:', error);
      return [];
    }
  }

  // Update follower counts in real-time
  async updateFollowerCount(userId: string, increment: boolean) {
    try {
      const userRef = firestore().collection('users').doc(userId);
      await userRef.update({
        followersCount: firestore.FieldValue.increment(increment ? 1 : -1)
      });

      // Update cache
      const cacheKeys = Array.from(this.cache.keys()).filter(key => 
        key.includes(`profile_${userId}`)
      );
      
      cacheKeys.forEach(key => {
        const cached = this.cache.get(key);
        if (cached) {
          cached.followersCount += increment ? 1 : -1;
          cached.user.followersCount = cached.followersCount;
          this.cache.set(key, cached);
        }
      });

    } catch (error) {
      console.error('❌ Error updating follower count:', error);
    }
  }

  // Update following count
  async updateFollowingCount(userId: string, increment: boolean) {
    try {
      const userRef = firestore().collection('users').doc(userId);
      await userRef.update({
        followingCount: firestore.FieldValue.increment(increment ? 1 : -1)
      });

      // Update cache
      const cacheKeys = Array.from(this.cache.keys()).filter(key => 
        key.includes(`profile_${userId}`)
      );
      
      cacheKeys.forEach(key => {
        const cached = this.cache.get(key);
        if (cached) {
          cached.followingCount += increment ? 1 : -1;
          cached.user.followingCount = cached.followingCount;
          this.cache.set(key, cached);
        }
      });

    } catch (error) {
      console.error('❌ Error updating following count:', error);
    }
  }

  // Clear cache when needed
  clearCache(userId?: string) {
    if (userId) {
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.includes(userId)
      );
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      this.cache.clear();
    }
  }

  // Preload user data for smooth navigation
  async preloadUserProfile(userId: string, currentUserId: string) {
    try {
      // Load in background without blocking UI
      setTimeout(() => {
        this.loadUserProfile(userId, currentUserId, { priority: 'low' });
      }, 100);
    } catch (error) {
      // Silent fail for preloading
    }
  }
}

export const lazyLoadService = UltraFastLazyLoadService.getInstance();
