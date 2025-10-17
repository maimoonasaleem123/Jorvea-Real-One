/**
 * Fixed UltraFastDynamicLikeService - Instagram-style dynamic like system
 * Handles instant likes/unlikes with real-time feedback
 */

import firestore from '@react-native-firebase/firestore';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

interface LikeResult {
  success: boolean;
  isLiked: boolean;
  newLikeCount: number;
  error?: string;
}

class UltraFastDynamicLikeService {
  private static pendingLikes = new Map<string, boolean>();
  private static likeCache = new Map<string, { isLiked: boolean; count: number; timestamp: number }>();
  private static readonly CACHE_DURATION = 30 * 1000; // 30 seconds

  /**
   * Toggle like for post or reel with instant UI feedback
   */
  static async toggleLike(
    contentId: string,
    contentType: 'post' | 'reel',
    userId: string,
    currentIsLiked: boolean,
    currentLikeCount: number
  ): Promise<LikeResult> {
    const cacheKey = `${contentType}_${contentId}_${userId}`;
    
    // Prevent duplicate requests
    if (this.pendingLikes.has(cacheKey)) {
      return {
        success: false,
        isLiked: currentIsLiked,
        newLikeCount: currentLikeCount,
        error: 'Like request already pending'
      };
    }

    // Set pending state
    this.pendingLikes.set(cacheKey, true);

    try {
      const collectionName = contentType === 'post' ? 'posts' : 'reels';
      const likeRef = firestore()
        .collection(collectionName)
        .doc(contentId)
        .collection('likes')
        .doc(userId);

      const contentRef = firestore()
        .collection(collectionName)
        .doc(contentId);

      // Calculate new state
      const newIsLiked = !currentIsLiked;
      const newLikeCount = newIsLiked ? currentLikeCount + 1 : currentLikeCount - 1;

      // Provide haptic feedback immediately
      try {
        ReactNativeHapticFeedback.trigger(
          newIsLiked ? 'impactMedium' : 'impactLight',
          { enableVibrateFallback: false, ignoreAndroidSystemSettings: false }
        );
      } catch (error) {
        // Haptic feedback might not be available
        console.log('Haptic feedback not available');
      }

      // Update cache immediately for instant UI feedback
      this.likeCache.set(cacheKey, {
        isLiked: newIsLiked,
        count: Math.max(0, newLikeCount), // Ensure count doesn't go negative
        timestamp: Date.now()
      });

      // Perform Firebase operations
      if (newIsLiked) {
        // Add like
        await Promise.all([
          likeRef.set({
            userId,
            createdAt: new Date(),
          }),
          contentRef.update({
            likesCount: firestore.FieldValue.increment(1),
            updatedAt: new Date(),
          })
        ]);

        // Add notification (in background)
        this.addLikeNotification(contentId, contentType, userId).catch(console.error);
      } else {
        // Remove like
        await Promise.all([
          likeRef.delete(),
          contentRef.update({
            likesCount: firestore.FieldValue.increment(-1),
            updatedAt: new Date(),
          })
        ]);
      }

      return {
        success: true,
        isLiked: newIsLiked,
        newLikeCount: Math.max(0, newLikeCount),
      };

    } catch (error) {
      console.error('Error toggling like:', error);
      
      // Revert cache on error
      this.likeCache.set(cacheKey, {
        isLiked: currentIsLiked,
        count: currentLikeCount,
        timestamp: Date.now()
      });

      return {
        success: false,
        isLiked: currentIsLiked,
        newLikeCount: currentLikeCount,
        error: 'Failed to update like'
      };
    } finally {
      // Clear pending state
      this.pendingLikes.delete(cacheKey);
    }
  }

  /**
   * Get cached like state for instant UI updates
   */
  static getCachedLikeState(
    contentId: string,
    contentType: 'post' | 'reel',
    userId: string,
    fallbackIsLiked: boolean,
    fallbackCount: number
  ): { isLiked: boolean; count: number } {
    const cacheKey = `${contentType}_${contentId}_${userId}`;
    const cached = this.likeCache.get(cacheKey);

    if (!cached) {
      return { isLiked: fallbackIsLiked, count: fallbackCount };
    }

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.likeCache.delete(cacheKey);
      return { isLiked: fallbackIsLiked, count: fallbackCount };
    }

    return { isLiked: cached.isLiked, count: cached.count };
  }

  /**
   * Check if content is liked by user
   */
  static async isContentLiked(
    contentId: string,
    contentType: 'post' | 'reel',
    userId: string
  ): Promise<boolean> {
    try {
      const collectionName = contentType === 'post' ? 'posts' : 'reels';
      const likeDoc = await firestore()
        .collection(collectionName)
        .doc(contentId)
        .collection('likes')
        .doc(userId)
        .get();

      return likeDoc.exists();
    } catch (error) {
      console.error('Error checking like status:', error);
      return false;
    }
  }

  /**
   * Get like count for content
   */
  static async getLikeCount(
    contentId: string,
    contentType: 'post' | 'reel'
  ): Promise<number> {
    try {
      const collectionName = contentType === 'post' ? 'posts' : 'reels';
      const contentDoc = await firestore()
        .collection(collectionName)
        .doc(contentId)
        .get();

      const data = contentDoc.data();
      return data?.likesCount || 0;
    } catch (error) {
      console.error('Error getting like count:', error);
      return 0;
    }
  }

  /**
   * Real-time like listener for a single content item
   */
  static subscribeLikeUpdates(
    contentId: string,
    contentType: 'post' | 'reel',
    userId: string,
    callback: (isLiked: boolean, count: number) => void
  ) {
    const collectionName = contentType === 'post' ? 'posts' : 'reels';

    // Listen to content document for like count
    const contentUnsubscribe = firestore()
      .collection(collectionName)
      .doc(contentId)
      .onSnapshot(async (doc) => {
        if (doc.exists) {
          const data = doc.data();
          const count = data?.likesCount || 0;

          try {
            // Check if user liked it
            const likeDoc = await firestore()
              .collection(collectionName)
              .doc(contentId)
              .collection('likes')
              .doc(userId)
              .get();

            const isLiked = likeDoc.exists();
            
            // Update cache
            const cacheKey = `${contentType}_${contentId}_${userId}`;
            this.likeCache.set(cacheKey, {
              isLiked,
              count,
              timestamp: Date.now()
            });

            callback(isLiked, count);
          } catch (error) {
            console.error('Error in like listener:', error);
            callback(false, count);
          }
        }
      });

    return contentUnsubscribe;
  }

  /**
   * Add notification for like (runs in background)
   */
  private static async addLikeNotification(
    contentId: string,
    contentType: 'post' | 'reel',
    likerId: string
  ) {
    try {
      // Get content owner
      const collectionName = contentType === 'post' ? 'posts' : 'reels';
      const contentDoc = await firestore().collection(collectionName).doc(contentId).get();
      
      if (!contentDoc.exists) return;
      
      const contentData = contentDoc.data();
      if (!contentData) return;

      const ownerId = contentData.userId;
      
      // Don't notify if user is liking their own content
      if (ownerId === likerId) return;

      // Create notification
      await firestore().collection('notifications').add({
        type: 'like',
        recipientId: ownerId,
        senderId: likerId,
        contentId,
        contentType,
        message: `liked your ${contentType}`,
        isRead: false,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Error adding like notification:', error);
    }
  }

  /**
   * Clear cache (useful for logout or memory management)
   */
  static clearCache() {
    this.likeCache.clear();
    this.pendingLikes.clear();
  }

  /**
   * Clear cache for specific user (useful for logout)
   */
  static clearCacheForUser(userId: string) {
    for (const [key] of this.likeCache) {
      if (key.includes(userId)) {
        this.likeCache.delete(key);
      }
    }
    
    for (const [key] of this.pendingLikes) {
      if (key.includes(userId)) {
        this.pendingLikes.delete(key);
      }
    }
  }
}

export default UltraFastDynamicLikeService;
export type { LikeResult };
