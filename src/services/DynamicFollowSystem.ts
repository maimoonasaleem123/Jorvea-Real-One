/**
 * DynamicFollowSystem - Universal follow system for all screens
 * Updates followers/following counts and buttons dynamically across the entire app
 */

import firestore from '@react-native-firebase/firestore';
import { EventEmitter } from 'events';

interface FollowData {
  userId: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  followers: string[];
  following: string[];
}

interface FollowEvent {
  type: 'follow' | 'unfollow' | 'count_update';
  userId: string;
  followerId: string;
  data: Partial<FollowData>;
}

class DynamicFollowSystem extends EventEmitter {
  private static instance: DynamicFollowSystem;
  private followCache = new Map<string, FollowData>();
  private firebaseListeners: { [userId: string]: () => void } = {};

  constructor() {
    super(); // Fix EventEmitter initialization
    super();
  }

  static getInstance(): DynamicFollowSystem {
    if (!this.instance) {
      this.instance = new DynamicFollowSystem();
    }
    return this.instance;
  }

  /**
   * Initialize follow data for a user
   */
  async initializeUser(userId: string, currentUserId?: string): Promise<FollowData> {
    try {
      const cached = this.followCache.get(userId);
      if (cached) {
        return cached;
      }

      console.log('🔄 Initializing follow data for user:', userId);

      // Get user document
      const userDoc = await firestore().collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      
      // Get follow counts
      let followersCount = userData?.followersCount || 0;
      let followingCount = userData?.followingCount || 0;
      let followers = userData?.followers || [];
      let following = userData?.following || [];

      // If counts are missing, calculate from arrays or global collections
      if (followersCount === 0 && followingCount === 0) {
        try {
          // Try global collections
          const [followersSnapshot, followingSnapshot] = await Promise.all([
            firestore().collection('followers').where('followedUserId', '==', userId).get(),
            firestore().collection('following').where('followerId', '==', userId).get(),
          ]);

          followersCount = followersSnapshot.size;
          followingCount = followingSnapshot.size;

          // Update arrays from global collections
          followers = followersSnapshot.docs.map(doc => doc.data().followerId);
          following = followingSnapshot.docs.map(doc => doc.data().followedUserId);

          // Update user document with correct counts
          await firestore().collection('users').doc(userId).update({
            followersCount,
            followingCount,
            followers,
            following,
          });

          console.log('✅ Updated follow counts from global collections:', { followersCount, followingCount });
        } catch (error) {
          console.warn('Could not update from global collections:', error);
        }
      }

      // Determine if current user is following this user
      const isFollowing = currentUserId ? followers.includes(currentUserId) : false;

      const followData: FollowData = {
        userId,
        followersCount: Math.max(0, followersCount),
        followingCount: Math.max(0, followingCount),
        isFollowing,
        followers,
        following,
      };

      this.followCache.set(userId, followData);
      console.log('✅ Initialized follow data:', followData);
      
      return followData;
    } catch (error) {
      console.error('❌ Error initializing follow data:', error);
      return {
        userId,
        followersCount: 0,
        followingCount: 0,
        isFollowing: false,
        followers: [],
        following: [],
      };
    }
  }

  /**
   * Toggle follow status with real-time updates
   */
  async toggleFollow(targetUserId: string, currentUserId: string): Promise<boolean> {
    try {
      const followData = await this.initializeUser(targetUserId, currentUserId);
      const isCurrentlyFollowing = followData.isFollowing;
      const newFollowingState = !isCurrentlyFollowing;

      console.log(`🔄 ${newFollowingState ? 'Following' : 'Unfollowing'} user:`, targetUserId);

      // Update cache immediately for instant UI updates
      const updatedFollowData = {
        ...followData,
        isFollowing: newFollowingState,
        followersCount: newFollowingState 
          ? followData.followersCount + 1 
          : Math.max(0, followData.followersCount - 1),
        followers: newFollowingState
          ? [...followData.followers, currentUserId]
          : followData.followers.filter(id => id !== currentUserId),
      };
      
      this.followCache.set(targetUserId, updatedFollowData);

      // Update current user's following data
      const currentUserData = await this.initializeUser(currentUserId);
      const updatedCurrentUserData = {
        ...currentUserData,
        followingCount: newFollowingState 
          ? currentUserData.followingCount + 1 
          : Math.max(0, currentUserData.followingCount - 1),
        following: newFollowingState
          ? [...currentUserData.following, targetUserId]
          : currentUserData.following.filter(id => id !== targetUserId),
      };
      
      this.followCache.set(currentUserId, updatedCurrentUserData);

      // Emit events for real-time UI updates
      this.emit('followUpdate', {
        type: newFollowingState ? 'follow' : 'unfollow',
        userId: targetUserId,
        followerId: currentUserId,
        data: updatedFollowData,
      } as FollowEvent);

      this.emit('followUpdate', {
        type: 'count_update',
        userId: currentUserId,
        followerId: currentUserId,
        data: updatedCurrentUserData,
      } as FollowEvent);

      // Perform database updates in background
      this.performDatabaseUpdate(targetUserId, currentUserId, newFollowingState);

      return newFollowingState;
    } catch (error) {
      console.error('❌ Error toggling follow:', error);
      return false;
    }
  }

  /**
   * Perform actual database update in background
   */
  private async performDatabaseUpdate(targetUserId: string, currentUserId: string, isFollowing: boolean) {
    try {
      const batch = firestore().batch();

      if (isFollowing) {
        // Follow operations
        const targetUserRef = firestore().collection('users').doc(targetUserId);
        const currentUserRef = firestore().collection('users').doc(currentUserId);

        batch.update(targetUserRef, {
          followers: firestore.FieldValue.arrayUnion(currentUserId),
          followersCount: firestore.FieldValue.increment(1),
        });

        batch.update(currentUserRef, {
          following: firestore.FieldValue.arrayUnion(targetUserId),
          followingCount: firestore.FieldValue.increment(1),
        });

        // Add to global collections
        const followDoc = firestore().collection('followers').doc();
        batch.set(followDoc, {
          followerId: currentUserId,
          followedUserId: targetUserId,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

        const followingDoc = firestore().collection('following').doc();
        batch.set(followingDoc, {
          followerId: currentUserId,
          followedUserId: targetUserId,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      } else {
        // Unfollow operations
        const targetUserRef = firestore().collection('users').doc(targetUserId);
        const currentUserRef = firestore().collection('users').doc(currentUserId);

        batch.update(targetUserRef, {
          followers: firestore.FieldValue.arrayRemove(currentUserId),
          followersCount: firestore.FieldValue.increment(-1),
        });

        batch.update(currentUserRef, {
          following: firestore.FieldValue.arrayRemove(targetUserId),
          followingCount: firestore.FieldValue.increment(-1),
        });

        // Remove from global collections
        const followersQuery = await firestore()
          .collection('followers')
          .where('followerId', '==', currentUserId)
          .where('followedUserId', '==', targetUserId)
          .get();

        const followingQuery = await firestore()
          .collection('following')
          .where('followerId', '==', currentUserId)
          .where('followedUserId', '==', targetUserId)
          .get();

        followersQuery.docs.forEach(doc => batch.delete(doc.ref));
        followingQuery.docs.forEach(doc => batch.delete(doc.ref));
      }

      await batch.commit();
      console.log('✅ Database follow update completed');

    } catch (error) {
      console.error('❌ Error updating database:', error);
      // Revert cache on error
      this.invalidateCache(targetUserId);
      this.invalidateCache(currentUserId);
    }
  }

  /**
   * Get follow data for a user
   */
  getFollowData(userId: string): FollowData | null {
    return this.followCache.get(userId) || null;
  }

  /**
   * Subscribe to follow updates for a user
   */
  subscribeToUser(userId: string, callback: (data: FollowData) => void): () => void {
    const listener = (event: FollowEvent) => {
      if (event.userId === userId) {
        const updatedData = this.followCache.get(userId);
        if (updatedData) {
          callback(updatedData);
        }
      }
    };

    this.on('followUpdate', listener);

    // Return unsubscribe function
    return () => {
      this.off('followUpdate', listener);
    };
  }

  /**
   * Bulk update follow data for multiple users (for feeds, search, etc.)
   */
  async bulkInitialize(userIds: string[], currentUserId?: string): Promise<Map<string, FollowData>> {
    const results = new Map<string, FollowData>();
    
    console.log('🔄 Bulk initializing follow data for', userIds.length, 'users');

    const promises = userIds.map(async (userId) => {
      const data = await this.initializeUser(userId, currentUserId);
      results.set(userId, data);
      return data;
    });

    await Promise.all(promises);
    console.log('✅ Bulk initialization completed');
    
    return results;
  }

  /**
   * Invalidate cache for a user
   */
  invalidateCache(userId: string) {
    this.followCache.delete(userId);
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.followCache.clear();
  }

  /**
   * Get follow statistics
   */
  getStats() {
    return {
      cachedUsers: this.followCache.size,
      listeners: Object.keys(this.firebaseListeners).length,
    };
  }

  /**
   * Force refresh follow data for a user
   */
  async refreshUser(userId: string, currentUserId?: string): Promise<FollowData> {
    this.invalidateCache(userId);
    return await this.initializeUser(userId, currentUserId);
  }

  /**
   * Check if user is following another user
   */
  isFollowing(userId: string, targetUserId: string): boolean {
    const followData = this.getFollowData(userId);
    return followData ? followData.following.includes(targetUserId) : false;
  }

  /**
   * Get followers count
   */
  getFollowersCount(userId: string): number {
    const followData = this.getFollowData(userId);
    return followData ? followData.followersCount : 0;
  }

  /**
   * Get following count
   */
  getFollowingCount(userId: string): number {
    const followData = this.getFollowData(userId);
    return followData ? followData.followingCount : 0;
  }
}

export default DynamicFollowSystem;
