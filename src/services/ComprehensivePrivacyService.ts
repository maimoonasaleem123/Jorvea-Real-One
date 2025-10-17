/**
 * Comprehensive Privacy Settings Service
 * Professional social media privacy system like Instagram/TikTok
 */

import firestore from '@react-native-firebase/firestore';
import { User } from '../types';
import { Reel, Post } from './firebaseService';

export interface PrivacySettings {
  isPrivateAccount: boolean;           // Account privacy (like Instagram private account)
  allowPublicReels: boolean;           // Allow reels to be public even if account is private
  allowPublicPosts: boolean;           // Allow posts to be public even if account is private
  hideFollowersList: boolean;          // Hide followers list from non-mutual followers
  hideFollowingList: boolean;          // Hide following list from non-mutual followers
  allowStoryViewFromFollowers: boolean; // Only followers can see stories
  allowDirectMessages: boolean;         // Allow DMs from non-followers
  allowMentions: boolean;              // Allow mentions from non-followers
  allowTagging: boolean;               // Allow tagging from non-followers
  allowComments: 'everyone' | 'followers' | 'mutual'; // Comment permissions
  allowLikes: 'everyone' | 'followers' | 'mutual';    // Like visibility
}

export interface FollowStatus {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMutual: boolean;
  isBlocked: boolean;
  isPending: boolean; // For private accounts
}

class ComprehensivePrivacyService {
  private static instance: ComprehensivePrivacyService | null = null;
  private privacyCache = new Map<string, PrivacySettings>();
  private followStatusCache = new Map<string, FollowStatus>();

  public static getInstance(): ComprehensivePrivacyService {
    if (!ComprehensivePrivacyService.instance) {
      ComprehensivePrivacyService.instance = new ComprehensivePrivacyService();
    }
    return ComprehensivePrivacyService.instance;
  }

  /**
   * Get user's privacy settings
   */
  async getUserPrivacySettings(userId: string): Promise<PrivacySettings> {
    // Check cache first
    if (this.privacyCache.has(userId)) {
      return this.privacyCache.get(userId)!;
    }

    try {
      const userDoc = await firestore().collection('users').doc(userId).get();
      
      const defaultSettings: PrivacySettings = {
        isPrivateAccount: false,
        allowPublicReels: true,
        allowPublicPosts: true,
        hideFollowersList: false,
        hideFollowingList: false,
        allowStoryViewFromFollowers: true,
        allowDirectMessages: true,
        allowMentions: true,
        allowTagging: true,
        allowComments: 'everyone',
        allowLikes: 'everyone'
      };

      if (userDoc.exists) {
        const userData = userDoc.data();
        const privacySettings = {
          ...defaultSettings,
          ...userData?.privacySettings
        };
        
        this.privacyCache.set(userId, privacySettings);
        return privacySettings;
      }

      return defaultSettings;
    } catch (error) {
      console.error('Error getting privacy settings:', error);
      return {
        isPrivateAccount: false,
        allowPublicReels: true,
        allowPublicPosts: true,
        hideFollowersList: false,
        hideFollowingList: false,
        allowStoryViewFromFollowers: true,
        allowDirectMessages: true,
        allowMentions: true,
        allowTagging: true,
        allowComments: 'everyone',
        allowLikes: 'everyone'
      };
    }
  }

  /**
   * Update user's privacy settings
   */
  async updatePrivacySettings(userId: string, settings: Partial<PrivacySettings>): Promise<void> {
    try {
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          privacySettings: settings,
          updatedAt: firestore.FieldValue.serverTimestamp()
        });

      // Update cache
      const current = this.privacyCache.get(userId) || {} as PrivacySettings;
      this.privacyCache.set(userId, { ...current, ...settings });
      
      console.log('✅ Privacy settings updated successfully');
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive follow status between two users
   */
  async getFollowStatus(currentUserId: string, targetUserId: string): Promise<FollowStatus> {
    if (currentUserId === targetUserId) {
      return {
        isFollowing: false,
        isFollowedBy: false,
        isMutual: false,
        isBlocked: false,
        isPending: false
      };
    }

    const cacheKey = `${currentUserId}-${targetUserId}`;
    
    if (this.followStatusCache.has(cacheKey)) {
      return this.followStatusCache.get(cacheKey)!;
    }

    try {
      const [followingDoc, followerDoc, blockDoc] = await Promise.all([
        // Check if current user follows target
        firestore()
          .collection('follows')
          .where('followerId', '==', currentUserId)
          .where('followingId', '==', targetUserId)
          .limit(1)
          .get(),
        
        // Check if target follows current user
        firestore()
          .collection('follows')
          .where('followerId', '==', targetUserId)
          .where('followingId', '==', currentUserId)
          .limit(1)
          .get(),

        // Check if either user has blocked the other
        firestore()
          .collection('blocks')
          .where('blockerId', 'in', [currentUserId, targetUserId])
          .where('blockedId', 'in', [currentUserId, targetUserId])
          .limit(1)
          .get()
      ]);

      const isFollowing = !followingDoc.empty;
      const isFollowedBy = !followerDoc.empty;
      const isBlocked = !blockDoc.empty;

      // Check for pending follow request if target has private account
      const targetPrivacy = await this.getUserPrivacySettings(targetUserId);
      let isPending = false;
      
      if (targetPrivacy.isPrivateAccount && !isFollowing) {
        const pendingDoc = await firestore()
          .collection('followRequests')
          .where('senderId', '==', currentUserId)
          .where('receiverId', '==', targetUserId)
          .where('status', '==', 'pending')
          .limit(1)
          .get();
        
        isPending = !pendingDoc.empty;
      }

      const followStatus: FollowStatus = {
        isFollowing,
        isFollowedBy,
        isMutual: isFollowing && isFollowedBy,
        isBlocked,
        isPending
      };

      this.followStatusCache.set(cacheKey, followStatus);
      return followStatus;
    } catch (error) {
      console.error('Error getting follow status:', error);
      return {
        isFollowing: false,
        isFollowedBy: false,
        isMutual: false,
        isBlocked: false,
        isPending: false
      };
    }
  }

  /**
   * Check if user can view another user's profile
   */
  async canViewProfile(currentUserId: string, targetUserId: string): Promise<boolean> {
    if (currentUserId === targetUserId) return true;

    const [privacySettings, followStatus] = await Promise.all([
      this.getUserPrivacySettings(targetUserId),
      this.getFollowStatus(currentUserId, targetUserId)
    ]);

    // If blocked, cannot view
    if (followStatus.isBlocked) return false;

    // If public account, can view
    if (!privacySettings.isPrivateAccount) return true;

    // If private account, only followers can view
    return followStatus.isFollowing;
  }

  /**
   * Check if user can view reels from another user
   */
  async canViewReels(currentUserId: string, targetUserId: string): Promise<boolean> {
    if (currentUserId === targetUserId) return true;

    const [privacySettings, followStatus] = await Promise.all([
      this.getUserPrivacySettings(targetUserId),
      this.getFollowStatus(currentUserId, targetUserId)
    ]);

    // If blocked, cannot view
    if (followStatus.isBlocked) return false;

    // If user allows public reels, everyone can see them
    if (privacySettings.allowPublicReels) return true;

    // If account is private and reels are not public, only followers can view
    if (privacySettings.isPrivateAccount) {
      return followStatus.isFollowing;
    }

    // If account is public but reels are restricted, check follow status
    return followStatus.isFollowing;
  }

  /**
   * Check if user can view specific reel based on reel privacy and account privacy
   */
  async canViewSpecificReel(reel: Reel, currentUserId: string): Promise<boolean> {
    if (reel.userId === currentUserId) return true;

    const [privacySettings, followStatus] = await Promise.all([
      this.getUserPrivacySettings(reel.userId),
      this.getFollowStatus(currentUserId, reel.userId)
    ]);

    // If blocked, cannot view
    if (followStatus.isBlocked) return false;

    // If reel is explicitly public, can view
    if (!reel.isPrivate) {
      // But still respect account privacy
      if (privacySettings.isPrivateAccount && !privacySettings.allowPublicReels) {
        return followStatus.isFollowing;
      }
      return true;
    }

    // If reel is private, only mutual followers can view
    if (reel.isPrivate) {
      return followStatus.isMutual;
    }

    // Default case based on account privacy
    if (privacySettings.isPrivateAccount) {
      return followStatus.isFollowing;
    }

    return true;
  }

  /**
   * Check if user can view followers list
   */
  async canViewFollowersList(currentUserId: string, targetUserId: string): Promise<boolean> {
    if (currentUserId === targetUserId) return true;

    const [privacySettings, followStatus] = await Promise.all([
      this.getUserPrivacySettings(targetUserId),
      this.getFollowStatus(currentUserId, targetUserId)
    ]);

    // If blocked, cannot view
    if (followStatus.isBlocked) return false;

    // If followers list is hidden, only mutual followers can view
    if (privacySettings.hideFollowersList) {
      return followStatus.isMutual;
    }

    // If account is private, only followers can view followers list
    if (privacySettings.isPrivateAccount) {
      return followStatus.isFollowing;
    }

    return true;
  }

  /**
   * Check if user can view following list
   */
  async canViewFollowingList(currentUserId: string, targetUserId: string): Promise<boolean> {
    if (currentUserId === targetUserId) return true;

    const [privacySettings, followStatus] = await Promise.all([
      this.getUserPrivacySettings(targetUserId),
      this.getFollowStatus(currentUserId, targetUserId)
    ]);

    // If blocked, cannot view
    if (followStatus.isBlocked) return false;

    // If following list is hidden, only mutual followers can view
    if (privacySettings.hideFollowingList) {
      return followStatus.isMutual;
    }

    // If account is private, only followers can view following list
    if (privacySettings.isPrivateAccount) {
      return followStatus.isFollowing;
    }

    return true;
  }

  /**
   * Check if user can view stories
   */
  async canViewStories(currentUserId: string, targetUserId: string): Promise<boolean> {
    if (currentUserId === targetUserId) return true;

    const [privacySettings, followStatus] = await Promise.all([
      this.getUserPrivacySettings(targetUserId),
      this.getFollowStatus(currentUserId, targetUserId)
    ]);

    // If blocked, cannot view
    if (followStatus.isBlocked) return false;

    // Stories are typically only for followers
    if (privacySettings.allowStoryViewFromFollowers) {
      return followStatus.isFollowing;
    }

    // If account is private, only followers can view stories
    if (privacySettings.isPrivateAccount) {
      return followStatus.isFollowing;
    }

    return followStatus.isFollowing; // Stories are generally follower-only
  }

  /**
   * Filter reels based on comprehensive privacy settings
   */
  async filterReelsForUser(reels: Reel[], currentUserId: string): Promise<Reel[]> {
    const visibleReels: Reel[] = [];

    for (const reel of reels) {
      const canView = await this.canViewSpecificReel(reel, currentUserId);
      if (canView) {
        visibleReels.push(reel);
      }
    }

    return visibleReels;
  }

  /**
   * Get privacy summary for a user (for UI display)
   */
  async getPrivacySummary(currentUserId: string, targetUserId: string): Promise<{
    canViewProfile: boolean;
    canViewReels: boolean;
    canViewFollowers: boolean;
    canViewFollowing: boolean;
    canViewStories: boolean;
    followStatus: FollowStatus;
    isPrivateAccount: boolean;
  }> {
    const [
      canViewProfile,
      canViewReels,
      canViewFollowers,
      canViewFollowing,
      canViewStories,
      followStatus,
      privacySettings
    ] = await Promise.all([
      this.canViewProfile(currentUserId, targetUserId),
      this.canViewReels(currentUserId, targetUserId),
      this.canViewFollowersList(currentUserId, targetUserId),
      this.canViewFollowingList(currentUserId, targetUserId),
      this.canViewStories(currentUserId, targetUserId),
      this.getFollowStatus(currentUserId, targetUserId),
      this.getUserPrivacySettings(targetUserId)
    ]);

    return {
      canViewProfile,
      canViewReels,
      canViewFollowers,
      canViewFollowing,
      canViewStories,
      followStatus,
      isPrivateAccount: privacySettings.isPrivateAccount
    };
  }

  /**
   * Clear all caches (call when follow/unfollow happens)
   */
  clearCaches(): void {
    this.privacyCache.clear();
    this.followStatusCache.clear();
  }

  /**
   * Clear specific user cache
   */
  clearUserCache(userId: string): void {
    this.privacyCache.delete(userId);
    // Clear follow status cache for this user
    for (const [key] of this.followStatusCache) {
      if (key.includes(userId)) {
        this.followStatusCache.delete(key);
      }
    }
  }
}

export default ComprehensivePrivacyService;
