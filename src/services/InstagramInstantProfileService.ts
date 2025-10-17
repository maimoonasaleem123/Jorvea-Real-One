/**
 * InstagramInstantProfileService - Instant profile loading like Instagram
 * No loading states, progressive content loading, instant UI
 */

import firestore from '@react-native-firebase/firestore';
import { User } from '../types';
import UltraFastLazyService from './UltraFastLazyService';

interface InstantProfileData {
  user: User;
  isOwnProfile: boolean;
  canViewProfile: boolean;
  canViewReels: boolean;
  isFollowing: boolean;
  isPrivate: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  reelsCount: number;
  posts: any[];
  reels: any[];
}

class InstagramInstantProfileService {
  private static cache = new Map<string, any>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Load profile instantly like Instagram - NO LOADING STATES
   */
  static async loadProfileInstantly(
    profileUserId: string,
    currentUserId: string
  ): Promise<InstantProfileData> {
    const cacheKey = `instant_profile_${profileUserId}_${currentUserId}`;
    
    try {
      // Return basic structure immediately
      const basicProfile: InstantProfileData = {
        user: {
          uid: profileUserId,
          displayName: 'Loading...',
          username: '',
          email: '',
          profilePicture: '',
          bio: '',
          isPrivate: false,
          isVerified: false,
          followers: [],
          following: [],
          blockedUsers: [],
          postsCount: 0,
          storiesCount: 0,
          reelsCount: 0,
          createdAt: new Date(),
          lastActive: new Date(),
          settings: {
            notifications: {
              likes: true,
              comments: true,
              follows: true,
              messages: true,
              mentions: true,
              stories: true,
            },
            privacy: {
              isPrivate: false,
              privateAccount: false,
              showActivity: true,
              showOnlineStatus: true,
              allowMessages: 'everyone' as const,
            },
            theme: 'light' as const,
          },
        },
        isOwnProfile: profileUserId === currentUserId,
        canViewProfile: true,
        canViewReels: true,
        isFollowing: false,
        isPrivate: false,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        reelsCount: 0,
        posts: [],
        reels: [],
      };

      // Start background loading immediately
      this.loadProfileDataInBackground(profileUserId, currentUserId, cacheKey);

      // Return cached data if available
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }

      return basicProfile;
    } catch (error) {
      console.error('Error in instant profile loading:', error);
      throw error;
    }
  }

  /**
   * Load actual profile data in background
   */
  private static async loadProfileDataInBackground(
    profileUserId: string,
    currentUserId: string,
    cacheKey: string
  ) {
    try {
      // Load user profile data
      const userDoc = await firestore().collection('users').doc(profileUserId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data() as User;
      const isOwnProfile = profileUserId === currentUserId;

      // Load follow counts safely
      let followCounts = { followersCount: 0, followingCount: 0 };
      try {
        const counts = await UltraFastLazyService.getFollowCounts(profileUserId) as { followersCount: number; followingCount: number };
        if (counts && typeof counts === 'object') {
          followCounts = {
            followersCount: Math.max(0, counts.followersCount || 0),
            followingCount: Math.max(0, counts.followingCount || 0)
          };
        }
      } catch (error) {
        console.warn('Could not load follow counts:', error);
      }

      // Check if following (only if not own profile)
      let isFollowing = false;
      if (!isOwnProfile) {
        try {
          const currentUserDoc = await firestore().collection('users').doc(currentUserId).get();
          const currentUserData = currentUserDoc.data();
          isFollowing = currentUserData?.following?.includes(profileUserId) || false;
        } catch (error) {
          console.warn('Could not check following status:', error);
        }
      }

      // Determine privacy settings
      const isPrivate = userData.isPrivate || userData.settings?.privacy?.isPrivate || false;
      const canViewProfile = isOwnProfile || !isPrivate || isFollowing;
      const canViewReels = canViewProfile;

      // Load posts and reels progressively
      let posts: any[] = [];
      let reels: any[] = [];
      
      if (canViewProfile) {
        try {
          // Load posts progressively
          const postsSnapshot = await firestore()
            .collection('posts')
            .where('userId', '==', profileUserId)
            .orderBy('createdAt', 'desc')
            .limit(12) // Load first 12 like Instagram
            .get();
          
          posts = postsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } catch (error) {
          console.warn('Could not load posts:', error);
        }

        try {
          // Load reels progressively
          const reelsSnapshot = await firestore()
            .collection('reels')
            .where('userId', '==', profileUserId)
            .orderBy('createdAt', 'desc')
            .limit(12) // Load first 12 like Instagram
            .get();
          
          reels = reelsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } catch (error) {
          console.warn('Could not load reels:', error);
        }
      }

      const profileData: InstantProfileData = {
        user: userData,
        isOwnProfile,
        canViewProfile,
        canViewReels,
        isFollowing,
        isPrivate,
        followersCount: followCounts.followersCount,
        followingCount: followCounts.followingCount,
        postsCount: posts.length,
        reelsCount: reels.length,
        posts,
        reels,
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: profileData,
        timestamp: Date.now()
      });

      return profileData;
    } catch (error) {
      console.error('Error loading profile data in background:', error);
    }
  }

  /**
   * Get cached profile data for instant updates
   */
  static getCachedProfile(profileUserId: string, currentUserId: string): InstantProfileData | null {
    const cacheKey = `instant_profile_${profileUserId}_${currentUserId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    
    return null;
  }

  /**
   * Update follow status instantly
   */
  static async toggleFollowInstantly(
    profileUserId: string,
    currentUserId: string,
    currentlyFollowing: boolean
  ): Promise<boolean> {
    try {
      const cacheKey = `instant_profile_${profileUserId}_${currentUserId}`;
      
      // Update cache immediately for instant UI
      const cached = this.cache.get(cacheKey);
      if (cached) {
        cached.data.isFollowing = !currentlyFollowing;
        cached.data.followersCount += currentlyFollowing ? -1 : 1;
        this.cache.set(cacheKey, cached);
      }

      // Perform actual follow/unfollow in background
      const batch = firestore().batch();
      
      if (currentlyFollowing) {
        // Unfollow
        const currentUserRef = firestore().collection('users').doc(currentUserId);
        const profileUserRef = firestore().collection('users').doc(profileUserId);
        
        batch.update(currentUserRef, {
          following: firestore.FieldValue.arrayRemove(profileUserId)
        });
        
        batch.update(profileUserRef, {
          followers: firestore.FieldValue.arrayRemove(currentUserId),
          followersCount: firestore.FieldValue.increment(-1)
        });
      } else {
        // Follow
        const currentUserRef = firestore().collection('users').doc(currentUserId);
        const profileUserRef = firestore().collection('users').doc(profileUserId);
        
        batch.update(currentUserRef, {
          following: firestore.FieldValue.arrayUnion(profileUserId)
        });
        
        batch.update(profileUserRef, {
          followers: firestore.FieldValue.arrayUnion(currentUserId),
          followersCount: firestore.FieldValue.increment(1)
        });
      }

      await batch.commit();
      return !currentlyFollowing;
    } catch (error) {
      console.error('Error toggling follow:', error);
      return currentlyFollowing;
    }
  }

  /**
   * Load more posts progressively
   */
  static async loadMorePosts(
    profileUserId: string,
    lastPostId?: string,
    limit = 12
  ): Promise<any[]> {
    try {
      let query = firestore()
        .collection('posts')
        .where('userId', '==', profileUserId)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (lastPostId) {
        const lastDoc = await firestore().collection('posts').doc(lastPostId).get();
        if (lastDoc.exists) {
          query = query.startAfter(lastDoc);
        }
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error loading more posts:', error);
      return [];
    }
  }

  /**
   * Load more reels progressively
   */
  static async loadMoreReels(
    profileUserId: string,
    lastReelId?: string,
    limit = 12
  ): Promise<any[]> {
    try {
      let query = firestore()
        .collection('reels')
        .where('userId', '==', profileUserId)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (lastReelId) {
        const lastDoc = await firestore().collection('reels').doc(lastReelId).get();
        if (lastDoc.exists) {
          query = query.startAfter(lastDoc);
        }
      }

      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error loading more reels:', error);
      return [];
    }
  }

  /**
   * Clear cache
   */
  static clearCache() {
    this.cache.clear();
  }

  /**
   * Clear cache for specific user
   */
  static clearCacheForUser(userId: string) {
    for (const [key] of this.cache) {
      if (key.includes(userId)) {
        this.cache.delete(key);
      }
    }
  }
}

export default InstagramInstantProfileService;
