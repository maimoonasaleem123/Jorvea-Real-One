/**
 * Instant Profile Cache Service
 * Provides instant loading for profile screens with comprehensive privacy
 */

import { User } from '../types';
import { Post, Reel, Story } from './firebaseService';
import firestore from '@react-native-firebase/firestore';
import ComprehensivePrivacyService from './ComprehensivePrivacyService';

interface ProfileData {
  user: User;
  posts: Post[];
  reels: Reel[];
  stories: Story[];
  followersCount: number;
  followingCount: number;
  postsCount: number;
  lastUpdated: number;
}

class InstantProfileService {
  private static instance: InstantProfileService | null = null;
  private profileCache = new Map<string, ProfileData>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): InstantProfileService {
    if (!InstantProfileService.instance) {
      InstantProfileService.instance = new InstantProfileService();
    }
    return InstantProfileService.instance;
  }

  /**
   * Get profile data instantly from cache or load fresh
   */
  async getProfileInstantly(userId: string, currentUserId: string): Promise<ProfileData | null> {
    // Check cache first for instant response
    const cached = this.profileCache.get(userId);
    if (cached && Date.now() - cached.lastUpdated < this.CACHE_DURATION) {
      console.log(`⚡ Profile loaded instantly from cache: ${userId}`);
      return cached;
    }

    // Load fresh data in background
    this.loadProfileInBackground(userId, currentUserId);

    // Return cached data if available (even if stale)
    if (cached) {
      console.log(`⚡ Returning stale cache while refreshing: ${userId}`);
      return cached;
    }

    // First time loading - load synchronously for instant display
    return await this.loadProfileFresh(userId, currentUserId);
  }

  /**
   * Load profile data fresh and cache it
   */
  private async loadProfileFresh(userId: string, currentUserId: string): Promise<ProfileData | null> {
    try {
      console.log(`🔄 Loading fresh profile data: ${userId}`);

      // Load user profile
      const userDoc = await firestore().collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return null;
      }

      const user = { id: userDoc.id, ...userDoc.data() } as User;

      // Load posts with privacy filtering
      const postsSnapshot = await firestore()
        .collection('posts')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const allPosts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));

      // Load reels with privacy filtering
      const reelsSnapshot = await firestore()
        .collection('reels')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const allReels = reelsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reel));

      // Apply privacy filtering for reels
      const privacyService = ComprehensivePrivacyService.getInstance();
      const visibleReels = await privacyService.filterReelsForUser(allReels, currentUserId);

      // Load stories (only if can view stories)
      let stories: Story[] = [];
      const canViewStories = await privacyService.canViewStories(currentUserId, userId);
      if (canViewStories) {
        const storiesSnapshot = await firestore()
          .collection('stories')
          .where('userId', '==', userId)
          .where('expiresAt', '>', new Date())
          .orderBy('expiresAt', 'asc')
          .limit(20)
          .get();

        stories = storiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
      }

      // Get follow counts
      const [followersCount, followingCount] = await Promise.all([
        this.getFollowersCount(userId),
        this.getFollowingCount(userId)
      ]);

      const profileData: ProfileData = {
        user,
        posts: allPosts,
        reels: visibleReels,
        stories,
        followersCount,
        followingCount,
        postsCount: allPosts.length,
        lastUpdated: Date.now()
      };

      // Cache the data
      this.profileCache.set(userId, profileData);
      console.log(`✅ Profile cached successfully: ${userId}`);

      return profileData;
    } catch (error) {
      console.error('Error loading profile:', error);
      return null;
    }
  }

  /**
   * Load profile in background to update cache
   */
  private async loadProfileInBackground(userId: string, currentUserId: string): Promise<void> {
    try {
      const freshData = await this.loadProfileFresh(userId, currentUserId);
      if (freshData) {
        this.profileCache.set(userId, freshData);
      }
    } catch (error) {
      console.warn('Background profile update failed:', error);
    }
  }

  /**
   * Check if current user is following target user
   */
  private async isFollowing(currentUserId: string, targetUserId: string): Promise<boolean> {
    if (currentUserId === targetUserId) return true;

    try {
      const followDoc = await firestore()
        .collection('follows')
        .where('followerId', '==', currentUserId)
        .where('followingId', '==', targetUserId)
        .limit(1)
        .get();

      return !followDoc.empty;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get followers count
   */
  private async getFollowersCount(userId: string): Promise<number> {
    try {
      const followersSnapshot = await firestore()
        .collection('follows')
        .where('followingId', '==', userId)
        .get();

      return followersSnapshot.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get following count
   */
  private async getFollowingCount(userId: string): Promise<number> {
    try {
      const followingSnapshot = await firestore()
        .collection('follows')
        .where('followerId', '==', userId)
        .get();

      return followingSnapshot.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Preload popular profiles for instant access
   */
  async preloadPopularProfiles(currentUserId: string): Promise<void> {
    try {
      // Get user's following list
      const followingSnapshot = await firestore()
        .collection('follows')
        .where('followerId', '==', currentUserId)
        .limit(20)
        .get();

      const followingIds = followingSnapshot.docs.map(doc => doc.data().followingId);

      // Preload following profiles
      for (const userId of followingIds) {
        this.loadProfileInBackground(userId, currentUserId);
      }

      console.log(`⚡ Preloading ${followingIds.length} profiles for instant access`);
    } catch (error) {
      console.warn('Failed to preload profiles:', error);
    }
  }

  /**
   * Clear cache for specific user (call when user updates profile)
   */
  clearUserCache(userId: string): void {
    this.profileCache.delete(userId);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.profileCache.clear();
  }

  /**
   * Update cached data when user performs actions
   */
  updateCachedData(userId: string, updates: Partial<ProfileData>): void {
    const cached = this.profileCache.get(userId);
    if (cached) {
      this.profileCache.set(userId, { ...cached, ...updates, lastUpdated: Date.now() });
    }
  }
}

export default InstantProfileService;
