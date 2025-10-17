import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vibration, Alert } from 'react-native';
import FirebaseService from './firebaseService';
import { User } from '../types';

interface FollowCache {
  following: string[];
  followers: string[];
  lastUpdated: number;
}

interface FollowEvent {
  type: 'follow' | 'unfollow';
  targetUserId: string;
  timestamp: number;
}

export class DynamicFollowService {
  private static readonly CACHE_KEY = '@jorvea_follow_cache';
  private static readonly EVENTS_KEY = '@jorvea_follow_events';
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private static followCache: Map<string, FollowCache> = new Map();
  private static followEventListeners: Map<string, ((event: FollowEvent) => void)[]> = new Map();

  // Initialize follow service for user
  static async initialize(userId: string): Promise<void> {
    try {
      console.log('🔄 DynamicFollowService: Initializing for user:', userId);
      
      // Load cached data
      await this.loadFollowCache(userId);
      
      // Refresh from server if cache is stale
      const cache = this.followCache.get(userId);
      if (!cache || Date.now() - cache.lastUpdated > this.CACHE_DURATION) {
        await this.refreshFollowData(userId);
      }

    } catch (error) {
      console.error('❌ Error initializing DynamicFollowService:', error);
    }
  }

  // Get real-time follow status
  static async isFollowing(userId: string, targetUserId: string): Promise<boolean> {
    try {
      // Don't allow self-following
      if (userId === targetUserId) return false;

      const cache = this.followCache.get(userId);
      if (cache && Date.now() - cache.lastUpdated < this.CACHE_DURATION) {
        return cache.following.includes(targetUserId);
      }

      // Cache miss or stale - check server
      const isFollowing = await FirebaseService.checkIfFollowing(userId, targetUserId);
      await this.updateFollowStatus(userId, targetUserId, isFollowing);
      
      return isFollowing;
    } catch (error) {
      console.error('❌ Error checking follow status:', error);
      return false;
    }
  }

  // Dynamic follow/unfollow with real-time updates
  static async toggleFollow(
    userId: string, 
    targetUserId: string,
    targetUserName?: string
  ): Promise<{ success: boolean; isFollowing: boolean; error?: string }> {
    try {
      // Validation
      if (!userId || !targetUserId) {
        return { success: false, isFollowing: false, error: 'Invalid user IDs' };
      }

      if (userId === targetUserId) {
        return { success: false, isFollowing: false, error: 'Cannot follow yourself' };
      }

      console.log('🎯 DynamicFollowService: Toggling follow for', targetUserName || targetUserId);

      const currentlyFollowing = await this.isFollowing(userId, targetUserId);
      const newFollowingState = !currentlyFollowing;

      // Optimistic update
      await this.updateFollowStatus(userId, targetUserId, newFollowingState);
      
      // Haptic feedback
      Vibration.vibrate(50);

      // Fire event to update UI immediately
      this.fireFollowEvent({
        type: newFollowingState ? 'follow' : 'unfollow',
        targetUserId,
        timestamp: Date.now()
      });

      try {
        // Server update
        const result = await FirebaseService.toggleFollowUser(userId, targetUserId);
        
        // Sync with actual server result
        if (result.isFollowing !== newFollowingState) {
          await this.updateFollowStatus(userId, targetUserId, result.isFollowing);
          this.fireFollowEvent({
            type: result.isFollowing ? 'follow' : 'unfollow',
            targetUserId,
            timestamp: Date.now()
          });
        }

        console.log('✅ Follow action completed:', result.isFollowing ? 'Following' : 'Unfollowed');
        
        return { success: true, isFollowing: result.isFollowing };

      } catch (serverError) {
        console.error('❌ Server error during follow:', serverError);
        
        // Revert optimistic update
        await this.updateFollowStatus(userId, targetUserId, currentlyFollowing);
        this.fireFollowEvent({
          type: currentlyFollowing ? 'follow' : 'unfollow',
          targetUserId,
          timestamp: Date.now()
        });

        return { 
          success: false, 
          isFollowing: currentlyFollowing, 
          error: 'Network error. Please try again.' 
        };
      }

    } catch (error) {
      console.error('❌ Error toggling follow:', error);
      return { 
        success: false, 
        isFollowing: false, 
        error: 'An unexpected error occurred' 
      };
    }
  }

  // Get following list with caching
  static async getFollowing(userId: string): Promise<User[]> {
    try {
      const cache = this.followCache.get(userId);
      if (cache && Date.now() - cache.lastUpdated < this.CACHE_DURATION) {
        // Get user details for cached following IDs
        const following = await Promise.all(
          cache.following.map(id => FirebaseService.getUserProfile(id))
        );
        return following.filter(user => user !== null) as User[];
      }

      // Cache miss - get from server
      const following = await FirebaseService.getFollowing(userId);
      await this.updateFollowCache(userId, following.map(u => u.uid), null);
      
      return following;
    } catch (error) {
      console.error('❌ Error getting following list:', error);
      return [];
    }
  }

  // Get followers list with caching
  static async getFollowers(userId: string): Promise<User[]> {
    try {
      const cache = this.followCache.get(userId);
      if (cache && Date.now() - cache.lastUpdated < this.CACHE_DURATION) {
        // Get user details for cached follower IDs
        const followers = await Promise.all(
          cache.followers.map(id => FirebaseService.getUserProfile(id))
        );
        return followers.filter(user => user !== null) as User[];
      }

      // Cache miss - get from server
      const followers = await FirebaseService.getFollowers(userId);
      await this.updateFollowCache(userId, null, followers.map(u => u.uid));
      
      return followers;
    } catch (error) {
      console.error('❌ Error getting followers list:', error);
      return [];
    }
  }

  // Get follow counts with caching
  static async getFollowCounts(userId: string): Promise<{ followersCount: number; followingCount: number }> {
    try {
      const cache = this.followCache.get(userId);
      if (cache && Date.now() - cache.lastUpdated < this.CACHE_DURATION) {
        return {
          followersCount: cache.followers.length,
          followingCount: cache.following.length
        };
      }

      // Get from server
      const counts = await FirebaseService.getUserFollowCounts(userId);
      return counts;
    } catch (error) {
      console.error('❌ Error getting follow counts:', error);
      return { followersCount: 0, followingCount: 0 };
    }
  }

  // Refresh follow data from server
  static async refreshFollowData(userId: string): Promise<void> {
    try {
      console.log('🔄 Refreshing follow data for user:', userId);

      const [following, followers] = await Promise.all([
        FirebaseService.getFollowing(userId),
        FirebaseService.getFollowers(userId)
      ]);

      await this.updateFollowCache(
        userId, 
        following.map(u => u.uid),
        followers.map(u => u.uid)
      );

    } catch (error) {
      console.error('❌ Error refreshing follow data:', error);
    }
  }

  // Subscribe to follow events for real-time UI updates
  static subscribeToFollowEvents(userId: string, listener: (event: FollowEvent) => void): () => void {
    const listeners = this.followEventListeners.get(userId) || [];
    listeners.push(listener);
    this.followEventListeners.set(userId, listeners);

    // Return unsubscribe function
    return () => {
      const currentListeners = this.followEventListeners.get(userId) || [];
      const filteredListeners = currentListeners.filter(l => l !== listener);
      this.followEventListeners.set(userId, filteredListeners);
    };
  }

  // Get mutual followers (Instagram-like feature)
  static async getMutualFollowers(userId: string, targetUserId: string): Promise<User[]> {
    try {
      const [userFollowing, targetFollowers] = await Promise.all([
        this.getFollowing(userId),
        this.getFollowers(targetUserId)
      ]);

      const userFollowingIds = new Set(userFollowing.map(u => u.uid));
      const mutualFollowers = targetFollowers.filter(user => 
        userFollowingIds.has(user.uid)
      );

      return mutualFollowers;
    } catch (error) {
      console.error('❌ Error getting mutual followers:', error);
      return [];
    }
  }

  // Get suggested users to follow
  static async getSuggestedUsers(userId: string, limit: number = 10): Promise<User[]> {
    try {
      const following = await this.getFollowing(userId);
      const followingIds = new Set(following.map(u => u.uid));

      // Get users followed by people you follow
      const suggestions = new Map<string, number>();
      
      for (const followedUser of following.slice(0, 20)) { // Limit processing
        const theirFollowing = await this.getFollowing(followedUser.uid);
        
        for (const user of theirFollowing) {
          if (!followingIds.has(user.uid) && user.uid !== userId) {
            suggestions.set(user.uid, (suggestions.get(user.uid) || 0) + 1);
          }
        }
      }

      // Get top suggestions
      const sortedSuggestions = Array.from(suggestions.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      const suggestedUsers = await Promise.all(
        sortedSuggestions.map(([uid]) => FirebaseService.getUserProfile(uid))
      );

      return suggestedUsers.filter(user => user !== null) as User[];
    } catch (error) {
      console.error('❌ Error getting suggested users:', error);
      return [];
    }
  }

  // Private helper methods

  private static async loadFollowCache(userId: string): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(`${this.CACHE_KEY}_${userId}`);
      if (cacheData) {
        const cache: FollowCache = JSON.parse(cacheData);
        this.followCache.set(userId, cache);
      }
    } catch (error) {
      console.error('❌ Error loading follow cache:', error);
    }
  }

  private static async updateFollowCache(
    userId: string, 
    following: string[] | null, 
    followers: string[] | null
  ): Promise<void> {
    try {
      const existingCache = this.followCache.get(userId) || {
        following: [],
        followers: [],
        lastUpdated: 0
      };

      const updatedCache: FollowCache = {
        following: following !== null ? following : existingCache.following,
        followers: followers !== null ? followers : existingCache.followers,
        lastUpdated: Date.now()
      };

      this.followCache.set(userId, updatedCache);
      
      await AsyncStorage.setItem(
        `${this.CACHE_KEY}_${userId}`,
        JSON.stringify(updatedCache)
      );
    } catch (error) {
      console.error('❌ Error updating follow cache:', error);
    }
  }

  private static async updateFollowStatus(
    userId: string, 
    targetUserId: string, 
    isFollowing: boolean
  ): Promise<void> {
    const cache = this.followCache.get(userId);
    if (!cache) return;

    const updatedFollowing = isFollowing
      ? [...new Set([...cache.following, targetUserId])]
      : cache.following.filter(id => id !== targetUserId);

    await this.updateFollowCache(userId, updatedFollowing, null);
  }

  private static fireFollowEvent(event: FollowEvent): void {
    // Notify all listeners across the app
    this.followEventListeners.forEach((listeners) => {
      listeners.forEach(listener => listener(event));
    });
  }

  // Clear cache for user (useful for logout)
  static async clearCache(userId: string): Promise<void> {
    try {
      this.followCache.delete(userId);
      this.followEventListeners.delete(userId);
      await AsyncStorage.removeItem(`${this.CACHE_KEY}_${userId}`);
      await AsyncStorage.removeItem(`${this.EVENTS_KEY}_${userId}`);
    } catch (error) {
      console.error('❌ Error clearing follow cache:', error);
    }
  }

  // Get follow statistics
  static getFollowStatistics(userId: string): {
    following: number;
    followers: number;
    mutualConnections: number;
    recentFollows: number;
  } {
    const cache = this.followCache.get(userId);
    if (!cache) {
      return { following: 0, followers: 0, mutualConnections: 0, recentFollows: 0 };
    }

    return {
      following: cache.following.length,
      followers: cache.followers.length,
      mutualConnections: 0, // Would need additional calculation
      recentFollows: 0 // Would need to track recent follows
    };
  }
}
