/**
 * 🎯 PERFECT LIKE SYSTEM - Bulletproof Instagram-Style Likes
 * 
 * Features:
 * - Instant UI feedback with optimistic updates
 * - Prevents duplicate likes from rapid clicking
 * - Automatic sync with Firebase
 * - Error handling with rollback
 * - Real-time like count updates
 * - Works for both posts and reels
 */

import firestore from '@react-native-firebase/firestore';
import { Vibration } from 'react-native';

interface LikeResult {
  isLiked: boolean;
  likesCount: number;
  success: boolean;
  error?: string;
}

interface LikeOperation {
  id: string;
  userId: string;
  timestamp: number;
  isProcessing: boolean;
}

class PerfectLikeSystem {
  private static instance: PerfectLikeSystem;
  private activeOperations = new Map<string, LikeOperation>();
  private likeCache = new Map<string, { isLiked: boolean; likesCount: number; lastUpdate: number }>();
  private debounceTime = 500; // 500ms debounce for rapid clicks
  private cacheExpiry = 30000; // 30 seconds cache

  static getInstance(): PerfectLikeSystem {
    if (!PerfectLikeSystem.instance) {
      PerfectLikeSystem.instance = new PerfectLikeSystem();
    }
    return PerfectLikeSystem.instance;
  }

  /**
   * 🎯 Perfect Like Toggle - Handles both posts and reels
   * Prevents rapid clicking and ensures consistent state
   */
  async toggleLike(
    contentId: string,
    userId: string,
    contentType: 'post' | 'reel' = 'reel',
    currentIsLiked: boolean,
    currentLikesCount: number
  ): Promise<LikeResult> {
    const operationKey = `${contentId}_${userId}`;
    const now = Date.now();

    // Prevent rapid clicking
    const existingOperation = this.activeOperations.get(operationKey);
    if (existingOperation && (now - existingOperation.timestamp) < this.debounceTime) {
      console.log('🚫 PerfectLike: Ignoring rapid click');
      return {
        isLiked: currentIsLiked,
        likesCount: currentLikesCount,
        success: false,
        error: 'Too fast'
      };
    }

    // Mark operation as active
    this.activeOperations.set(operationKey, {
      id: contentId,
      userId,
      timestamp: now,
      isProcessing: true
    });

    try {
      // Calculate optimistic state
      const newIsLiked = !currentIsLiked;
      const newLikesCount = newIsLiked ? currentLikesCount + 1 : currentLikesCount - 1;

      // Vibration feedback
      Vibration.vibrate(newIsLiked ? [30, 50, 30] : 25);

      // Update cache immediately for instant UI
      this.likeCache.set(contentId, {
        isLiked: newIsLiked,
        likesCount: Math.max(0, newLikesCount), // Ensure non-negative
        lastUpdate: now
      });

      // Perform Firebase update
      const firestoreResult = await this.performFirestoreUpdate(
        contentId,
        userId,
        contentType,
        currentIsLiked
      );

      if (firestoreResult.success) {
        // Update cache with final Firebase data
        this.likeCache.set(contentId, {
          isLiked: firestoreResult.isLiked,
          likesCount: firestoreResult.likesCount,
          lastUpdate: now
        });

        console.log(`✅ PerfectLike: ${contentType} ${contentId} ${firestoreResult.isLiked ? 'liked' : 'unliked'} successfully`);

        return {
          isLiked: firestoreResult.isLiked,
          likesCount: firestoreResult.likesCount,
          success: true
        };
      } else {
        // Rollback optimistic update on error
        this.likeCache.set(contentId, {
          isLiked: currentIsLiked,
          likesCount: currentLikesCount,
          lastUpdate: now
        });

        return {
          isLiked: currentIsLiked,
          likesCount: currentLikesCount,
          success: false,
          error: firestoreResult.error
        };
      }

    } catch (error) {
      console.error('❌ PerfectLike: Error in toggleLike:', error);

      // Rollback optimistic update
      this.likeCache.set(contentId, {
        isLiked: currentIsLiked,
        likesCount: currentLikesCount,
        lastUpdate: now
      });

      return {
        isLiked: currentIsLiked,
        likesCount: currentLikesCount,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      // Clear operation
      this.activeOperations.delete(operationKey);
    }
  }

  /**
   * 🔥 Perform actual Firebase update with proper error handling
   */
  private async performFirestoreUpdate(
    contentId: string,
    userId: string,
    contentType: 'post' | 'reel',
    currentIsLiked: boolean
  ): Promise<LikeResult> {
    try {
      const collection = contentType === 'post' ? 'posts' : 'reels';
      const contentRef = firestore().collection(collection).doc(contentId);
      const likeRef = contentRef.collection('likes').doc(userId);

      // Use transaction for atomic operation
      const result = await firestore().runTransaction(async (transaction) => {
        // Get current documents
        const [contentDoc, likeDoc] = await Promise.all([
          transaction.get(contentRef),
          transaction.get(likeRef)
        ]);

        if (!contentDoc.exists) {
          throw new Error(`${contentType} not found`);
        }

        const contentData = contentDoc.data();
        const currentLikesCount = contentData?.likesCount || 0;
        const likeExists = !!likeDoc.exists;

        let newLikesCount: number;
        let newIsLiked: boolean;

        if (currentIsLiked && likeExists) {
          // Unlike: Remove like and decrement count
          transaction.delete(likeRef);
          newLikesCount = Math.max(0, currentLikesCount - 1);
          newIsLiked = false;
        } else if (!currentIsLiked && !likeExists) {
          // Like: Add like and increment count
          transaction.set(likeRef, {
            userId,
            timestamp: firestore.FieldValue.serverTimestamp(),
            deviceInfo: {
              platform: 'mobile',
              version: '1.0'
            }
          });
          newLikesCount = currentLikesCount + 1;
          newIsLiked = true;
        } else {
          // State mismatch - sync with current Firebase state
          newIsLiked = likeExists;
          newLikesCount = currentLikesCount;
        }

        // Update content document with new like count
        transaction.update(contentRef, {
          likesCount: newLikesCount,
          lastActivity: firestore.FieldValue.serverTimestamp()
        });

        return { isLiked: newIsLiked, likesCount: newLikesCount };
      });

      // Create notification for like (non-blocking)
      if (result.isLiked) {
        this.createLikeNotification(contentId, userId, contentType).catch(console.warn);
      }

      return {
        isLiked: result.isLiked,
        likesCount: result.likesCount,
        success: true
      };

    } catch (error) {
      console.error('❌ PerfectLike: Firestore update failed:', error);
      return {
        isLiked: currentIsLiked,
        likesCount: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Firebase error'
      };
    }
  }

  /**
   * 📱 Create like notification (Instagram-style)
   */
  private async createLikeNotification(
    contentId: string,
    fromUserId: string,
    contentType: 'post' | 'reel'
  ): Promise<void> {
    try {
      const collection = contentType === 'post' ? 'posts' : 'reels';
      const contentDoc = await firestore().collection(collection).doc(contentId).get();
      const contentData = contentDoc.data();

      if (!contentData || contentData.userId === fromUserId) {
        return; // Don't notify self-likes
      }

      // Get liker's info
      const likerDoc = await firestore().collection('users').doc(fromUserId).get();
      const likerData = likerDoc.data();

      // Create notification with correct field names to match FirebaseService
      await firestore().collection('notifications').add({
        type: 'like',
        senderId: fromUserId, // Changed from fromUserId
        recipientId: contentData.userId, // Changed from toUserId
        contentId,
        contentType,
        message: `liked your ${contentType}`,
        createdAt: firestore.FieldValue.serverTimestamp(),
        read: false, // Changed from isRead
        // Additional data for UI
        senderUsername: likerData?.username || 'Someone',
        senderProfilePicture: likerData?.profilePicture || null,
        contentThumbnail: contentData.thumbnailUrl || contentData.imageUrl || contentData.videoUrl
      });

      console.log(`✅ Created like notification for ${contentType} ${contentId}`);

    } catch (error) {
      console.warn('Failed to create like notification:', error);
    }
  }

  /**
   * 🎯 Get cached like state for instant UI updates
   */
  getCachedLikeState(contentId: string): { isLiked: boolean; likesCount: number } | null {
    const cached = this.likeCache.get(contentId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.lastUpdate > this.cacheExpiry) {
      this.likeCache.delete(contentId);
      return null;
    }

    return {
      isLiked: cached.isLiked,
      likesCount: cached.likesCount
    };
  }

  /**
   * 🧹 Clear cache for content
   */
  clearCache(contentId?: string): void {
    if (contentId) {
      this.likeCache.delete(contentId);
    } else {
      this.likeCache.clear();
    }
  }

  /**
   * 📊 Get like statistics for analytics
   */
  getLikeStats(): {
    activeOperations: number;
    cachedItems: number;
    operationsToday: number;
  } {
    return {
      activeOperations: this.activeOperations.size,
      cachedItems: this.likeCache.size,
      operationsToday: 0 // Could be tracked if needed
    };
  }
}

export default PerfectLikeSystem;
