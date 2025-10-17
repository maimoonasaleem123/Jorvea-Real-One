/**
 * Privacy Service - Handles all privacy-related operations
 * Manages mutual following, reel visibility, and user privacy settings
 */

import firestore from '@react-native-firebase/firestore';
import { Reel } from './firebaseService';

interface FollowRelationship {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMutual: boolean;
}

class PrivacyService {
  private static instance: PrivacyService | null = null;
  private followCache = new Map<string, FollowRelationship>();

  public static getInstance(): PrivacyService {
    if (!PrivacyService.instance) {
      PrivacyService.instance = new PrivacyService();
    }
    return PrivacyService.instance;
  }

  /**
   * Check mutual following relationship between two users
   */
  async checkMutualFollowing(userId1: string, userId2: string): Promise<FollowRelationship> {
    const cacheKey = `${userId1}-${userId2}`;
    
    // Check cache first for instant performance
    if (this.followCache.has(cacheKey)) {
      return this.followCache.get(cacheKey)!;
    }

    try {
      // Check if userId1 follows userId2
      const user1FollowsUser2Doc = await firestore()
        .collection('follows')
        .where('followerId', '==', userId1)
        .where('followingId', '==', userId2)
        .limit(1)
        .get();

      const isFollowing = !user1FollowsUser2Doc.empty;

      // Check if userId2 follows userId1
      const user2FollowsUser1Doc = await firestore()
        .collection('follows')
        .where('followerId', '==', userId2)
        .where('followingId', '==', userId1)
        .limit(1)
        .get();

      const isFollowedBy = !user2FollowsUser1Doc.empty;

      const relationship: FollowRelationship = {
        isFollowing,
        isFollowedBy,
        isMutual: isFollowing && isFollowedBy
      };

      // Cache the result for instant future access
      this.followCache.set(cacheKey, relationship);
      
      return relationship;
    } catch (error) {
      console.error('Error checking mutual following:', error);
      return { isFollowing: false, isFollowedBy: false, isMutual: false };
    }
  }

  /**
   * Check if a user can view a specific reel based on privacy settings
   */
  async canUserViewReel(reel: Reel, currentUserId: string): Promise<boolean> {
    // User can always see their own reels
    if (reel.userId === currentUserId) {
      return true;
    }

    // If reel is public, everyone can see it
    if (!reel.isPrivate) {
      return true;
    }

    // If reel is private, only mutual followers can see it
    const relationship = await this.checkMutualFollowing(currentUserId, reel.userId);
    return relationship.isMutual;
  }

  /**
   * Filter reels based on privacy settings - INSTANT MODE
   */
  async filterReelsForUser(reels: Reel[], currentUserId: string): Promise<Reel[]> {
    const visibleReels: Reel[] = [];

    for (const reel of reels) {
      const canView = await this.canUserViewReel(reel, currentUserId);
      if (canView) {
        visibleReels.push(reel);
      }
    }

    return visibleReels;
  }

  /**
   * Get user's following list for instant filtering
   */
  async getUserFollowing(userId: string): Promise<string[]> {
    try {
      const followsSnapshot = await firestore()
        .collection('follows')
        .where('followerId', '==', userId)
        .get();

      return followsSnapshot.docs.map(doc => doc.data().followingId);
    } catch (error) {
      console.error('Error getting user following:', error);
      return [];
    }
  }

  /**
   * Get mutual followers for privacy filtering
   */
  async getMutualFollowers(userId: string): Promise<string[]> {
    try {
      const following = await this.getUserFollowing(userId);
      const mutualFollowers: string[] = [];

      // Check which of the users they follow also follow them back
      for (const followingUserId of following) {
        const relationship = await this.checkMutualFollowing(userId, followingUserId);
        if (relationship.isMutual) {
          mutualFollowers.push(followingUserId);
        }
      }

      return mutualFollowers;
    } catch (error) {
      console.error('Error getting mutual followers:', error);
      return [];
    }
  }

  /**
   * Clear follow cache - call when follow/unfollow happens
   */
  clearFollowCache(): void {
    this.followCache.clear();
  }

  /**
   * Check if user can see stories from another user
   */
  async canUserViewStories(storyUserId: string, currentUserId: string): Promise<boolean> {
    // User can always see their own stories
    if (storyUserId === currentUserId) {
      return true;
    }

    // For stories, only show from users they follow
    const relationship = await this.checkMutualFollowing(currentUserId, storyUserId);
    return relationship.isFollowing;
  }
}

export default PrivacyService;
