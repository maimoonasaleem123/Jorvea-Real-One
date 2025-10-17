/**
 * 🎯 FIREBASE DYNAMIC LIKE SYSTEM
 * 
 * Features:
 * - Real-time Firebase integration
 * - Optimistic UI updates
 * - Automatic state synchronization
 * - Error handling with rollback
 * - Prevents duplicate operations
 * - Works for posts, reels, comments
 * - Instagram-quality animations
 */

import firestore from '@react-native-firebase/firestore';
import { Vibration } from 'react-native';

interface LikeOperation {
  contentId: string;
  userId: string;
  contentType: 'post' | 'reel' | 'comment';
  operation: 'like' | 'unlike';
  timestamp: number;
  isProcessing: boolean;
}

interface LikeResult {
  success: boolean;
  isLiked: boolean;
  likesCount: number;
  error?: string;
  wasOptimistic?: boolean;
}

interface LikeState {
  isLiked: boolean;
  likesCount: number;
  lastUpdated: number;
  isOptimistic: boolean;
}

class FirebaseDynamicLikeSystem {
  private static instance: FirebaseDynamicLikeSystem;
  private activeOperations = new Map<string, LikeOperation>();
  private likeStates = new Map<string, LikeState>();
  private realtimeListeners = new Map<string, () => void>();
  private debounceTime = 300; // 300ms debounce
  private cacheExpiry = 60000; // 1 minute cache

  static getInstance(): FirebaseDynamicLikeSystem {
    if (!FirebaseDynamicLikeSystem.instance) {
      FirebaseDynamicLikeSystem.instance = new FirebaseDynamicLikeSystem();
    }
    return FirebaseDynamicLikeSystem.instance;
  }

  /**
   * 🎯 Toggle like with real-time Firebase sync
   */
  async toggleLike(
    contentId: string,
    userId: string,
    contentType: 'post' | 'reel' | 'comment' = 'post'
  ): Promise<LikeResult> {
    const operationKey = `${contentId}_${userId}`;
    const now = Date.now();

    // Prevent rapid clicking
    const existingOperation = this.activeOperations.get(operationKey);
    if (existingOperation && (now - existingOperation.timestamp) < this.debounceTime) {
      console.log('🚫 FirebaseLike: Preventing rapid click');
      const currentState = this.likeStates.get(contentId);
      return {
        success: false,
        isLiked: currentState?.isLiked || false,
        likesCount: currentState?.likesCount || 0,
        error: 'Too fast'
      };
    }

    // Mark operation as active
    this.activeOperations.set(operationKey, {
      contentId,
      userId,
      contentType,
      operation: 'like', // Will be determined below
      timestamp: now,
      isProcessing: true
    });

    try {
      // Get current state from cache or Firebase
      const currentState = await this.getCurrentLikeState(contentId, userId, contentType);
      const newIsLiked = !currentState.isLiked;
      const newLikesCount = newIsLiked 
        ? currentState.likesCount + 1 
        : Math.max(0, currentState.likesCount - 1);

      // Update operation type
      const operation = this.activeOperations.get(operationKey);
      if (operation) {
        operation.operation = newIsLiked ? 'like' : 'unlike';
        this.activeOperations.set(operationKey, operation);
      }

      // Optimistic UI update
      this.likeStates.set(contentId, {
        isLiked: newIsLiked,
        likesCount: newLikesCount,
        lastUpdated: now,
        isOptimistic: true
      });

      // Vibration feedback
      Vibration.vibrate(newIsLiked ? [30, 50, 30] : 25);

      // Perform Firebase update
      const firebaseResult = await this.performFirebaseUpdate(
        contentId,
        userId,
        contentType,
        newIsLiked,
        currentState.isLiked
      );

      if (firebaseResult.success) {
        // Update with final Firebase state
        this.likeStates.set(contentId, {
          isLiked: firebaseResult.isLiked,
          likesCount: firebaseResult.likesCount,
          lastUpdated: now,
          isOptimistic: false
        });

        // Set up real-time listener for this content
        this.setupRealtimeListener(contentId, userId, contentType);

        console.log(`✅ FirebaseLike: ${contentType} ${contentId} ${firebaseResult.isLiked ? 'liked' : 'unliked'} successfully`);

        return {
          success: true,
          isLiked: firebaseResult.isLiked,
          likesCount: firebaseResult.likesCount,
          wasOptimistic: true
        };
      } else {
        // Rollback optimistic update
        this.likeStates.set(contentId, {
          isLiked: currentState.isLiked,
          likesCount: currentState.likesCount,
          lastUpdated: now,
          isOptimistic: false
        });

        return {
          success: false,
          isLiked: currentState.isLiked,
          likesCount: currentState.likesCount,
          error: firebaseResult.error
        };
      }

    } catch (error) {
      console.error('❌ FirebaseLike: Error in toggleLike:', error);

      // Rollback to previous state
      const previousState = await this.getCurrentLikeState(contentId, userId, contentType, true);
      this.likeStates.set(contentId, {
        isLiked: previousState.isLiked,
        likesCount: previousState.likesCount,
        lastUpdated: now,
        isOptimistic: false
      });

      return {
        success: false,
        isLiked: previousState.isLiked,
        likesCount: previousState.likesCount,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      // Clear operation
      this.activeOperations.delete(operationKey);
    }
  }

  /**
   * 🔥 Get current like state from cache or Firebase
   */
  private async getCurrentLikeState(
    contentId: string,
    userId: string,
    contentType: 'post' | 'reel' | 'comment',
    forceFresh: boolean = false
  ): Promise<LikeState> {
    const now = Date.now();
    const cached = this.likeStates.get(contentId);

    // Return cached state if valid and not forced fresh
    if (!forceFresh && cached && (now - cached.lastUpdated) < this.cacheExpiry) {
      return cached;
    }

    try {
      // Get from Firebase
      const collection = this.getCollectionName(contentType);
      const [contentDoc, likeDoc] = await Promise.all([
        firestore().collection(collection).doc(contentId).get(),
        firestore().collection(collection).doc(contentId).collection('likes').doc(userId).get()
      ]);

      const contentData = contentDoc.data();
      const isLiked = !!likeDoc.exists;
      const likesCount = contentData?.likesCount || 0;

      const state: LikeState = {
        isLiked,
        likesCount,
        lastUpdated: now,
        isOptimistic: false
      };

      // Cache the state
      this.likeStates.set(contentId, state);
      return state;

    } catch (error) {
      console.error('❌ Error getting like state from Firebase:', error);
      
      // Return cached state if available, otherwise default
      return cached || {
        isLiked: false,
        likesCount: 0,
        lastUpdated: now,
        isOptimistic: false
      };
    }
  }

  /**
   * 🔥 Perform Firebase update with transaction
   */
  private async performFirebaseUpdate(
    contentId: string,
    userId: string,
    contentType: 'post' | 'reel' | 'comment',
    newIsLiked: boolean,
    previousIsLiked: boolean
  ): Promise<LikeResult> {
    try {
      const collection = this.getCollectionName(contentType);
      const contentRef = firestore().collection(collection).doc(contentId);
      const likeRef = contentRef.collection('likes').doc(userId);

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

        let finalLikesCount: number;
        let finalIsLiked: boolean;

        if (newIsLiked && !likeExists) {
          // Like: Add like document and increment count
          transaction.set(likeRef, {
            userId,
            timestamp: firestore.FieldValue.serverTimestamp(),
            contentType,
            deviceInfo: {
              platform: 'mobile',
              userAgent: 'react-native'
            }
          });
          finalLikesCount = currentLikesCount + 1;
          finalIsLiked = true;
        } else if (!newIsLiked && likeExists) {
          // Unlike: Remove like document and decrement count
          transaction.delete(likeRef);
          finalLikesCount = Math.max(0, currentLikesCount - 1);
          finalIsLiked = false;
        } else {
          // State is already correct or conflicting - sync with Firebase
          finalIsLiked = likeExists;
          finalLikesCount = currentLikesCount;
        }

        // Update content document
        transaction.update(contentRef, {
          likesCount: finalLikesCount,
          lastActivity: firestore.FieldValue.serverTimestamp()
        });

        return { isLiked: finalIsLiked, likesCount: finalLikesCount };
      });

      // Create notification for like (non-blocking)
      if (result.isLiked && !previousIsLiked) {
        this.createLikeNotification(contentId, userId, contentType).catch(console.warn);
      }

      return {
        success: true,
        isLiked: result.isLiked,
        likesCount: result.likesCount
      };

    } catch (error) {
      console.error('❌ Firebase update failed:', error);
      return {
        success: false,
        isLiked: false,
        likesCount: 0,
        error: error instanceof Error ? error.message : 'Firebase error'
      };
    }
  }

  /**
   * 📡 Setup real-time listener for like updates
   */
  private setupRealtimeListener(
    contentId: string,
    userId: string,
    contentType: 'post' | 'reel' | 'comment'
  ): void {
    const listenerKey = `${contentId}_${userId}`;
    
    // Clear existing listener
    const existingListener = this.realtimeListeners.get(listenerKey);
    if (existingListener) {
      existingListener();
    }

    try {
      const collection = this.getCollectionName(contentType);
      
      // Listen to content document for like count changes
      const unsubscribeContent = firestore()
        .collection(collection)
        .doc(contentId)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              const data = doc.data();
              const currentState = this.likeStates.get(contentId);
              
              if (currentState && !currentState.isOptimistic) {
                // Update like count from Firebase
                this.likeStates.set(contentId, {
                  ...currentState,
                  likesCount: data?.likesCount || 0,
                  lastUpdated: Date.now()
                });
              }
            }
          },
          (error) => {
            console.warn('Real-time listener error:', error);
          }
        );

      // Listen to user's like document
      const unsubscribeLike = firestore()
        .collection(collection)
        .doc(contentId)
        .collection('likes')
        .doc(userId)
        .onSnapshot(
          (doc) => {
            const currentState = this.likeStates.get(contentId);
            
            if (currentState && !currentState.isOptimistic) {
              // Update like status from Firebase
              this.likeStates.set(contentId, {
                ...currentState,
                isLiked: !!doc.exists,
                lastUpdated: Date.now()
              });
            }
          },
          (error) => {
            console.warn('Real-time like listener error:', error);
          }
        );

      // Combined unsubscribe function
      const combinedUnsubscribe = () => {
        unsubscribeContent();
        unsubscribeLike();
      };

      this.realtimeListeners.set(listenerKey, combinedUnsubscribe);

      // Auto-cleanup after 5 minutes
      setTimeout(() => {
        this.cleanupRealtimeListener(listenerKey);
      }, 300000);

    } catch (error) {
      console.error('Failed to setup real-time listener:', error);
    }
  }

  /**
   * 📱 Create like notification
   */
  private async createLikeNotification(
    contentId: string,
    fromUserId: string,
    contentType: 'post' | 'reel' | 'comment'
  ): Promise<void> {
    try {
      const collection = this.getCollectionName(contentType);
      const [contentDoc, userDoc] = await Promise.all([
        firestore().collection(collection).doc(contentId).get(),
        firestore().collection('users').doc(fromUserId).get()
      ]);

      const contentData = contentDoc.data();
      const userData = userDoc.data();

      if (!contentData || !userData || contentData.userId === fromUserId) {
        return; // Don't notify self-likes or if data missing
      }

      // Create notification
      await firestore().collection('notifications').add({
        type: 'like',
        contentType,
        contentId,
        fromUserId,
        fromUsername: userData.username || 'Someone',
        fromProfilePicture: userData.profilePicture || null,
        toUserId: contentData.userId,
        message: `liked your ${contentType}`,
        createdAt: firestore.FieldValue.serverTimestamp(),
        isRead: false,
        data: {
          thumbnail: contentData.thumbnailUrl || contentData.imageUrl || contentData.videoUrl || contentData.mediaUrls?.[0]
        }
      });

    } catch (error) {
      console.warn('Failed to create like notification:', error);
    }
  }

  /**
   * 🎯 Get current like state (public method)
   */
  async getLikeState(
    contentId: string,
    userId: string,
    contentType: 'post' | 'reel' | 'comment' = 'post'
  ): Promise<{ isLiked: boolean; likesCount: number }> {
    const state = await this.getCurrentLikeState(contentId, userId, contentType);
    return {
      isLiked: state.isLiked,
      likesCount: state.likesCount
    };
  }

  /**
   * 🎯 Get cached like state for instant UI
   */
  getCachedLikeState(contentId: string): { isLiked: boolean; likesCount: number } | null {
    const cached = this.likeStates.get(contentId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.lastUpdated > this.cacheExpiry) {
      this.likeStates.delete(contentId);
      return null;
    }

    return {
      isLiked: cached.isLiked,
      likesCount: cached.likesCount
    };
  }

  /**
   * 📊 Get likes for content with user details
   */
  async getLikesWithUsers(
    contentId: string,
    contentType: 'post' | 'reel' | 'comment' = 'post',
    limit: number = 20
  ): Promise<Array<{ userId: string; username: string; profilePicture: string | null; timestamp: any }>> {
    try {
      const collection = this.getCollectionName(contentType);
      const likesSnapshot = await firestore()
        .collection(collection)
        .doc(contentId)
        .collection('likes')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const likes = await Promise.all(
        likesSnapshot.docs.map(async (likeDoc) => {
          const likeData = likeDoc.data();
          const userDoc = await firestore().collection('users').doc(likeDoc.id).get();
          const userData = userDoc.data();

          return {
            userId: likeDoc.id,
            username: userData?.username || 'Unknown',
            profilePicture: userData?.profilePicture || null,
            timestamp: likeData.timestamp
          };
        })
      );

      return likes;
    } catch (error) {
      console.error('Error getting likes with users:', error);
      return [];
    }
  }

  /**
   * 🧹 Cleanup methods
   */
  private cleanupRealtimeListener(listenerKey: string): void {
    const listener = this.realtimeListeners.get(listenerKey);
    if (listener) {
      listener();
      this.realtimeListeners.delete(listenerKey);
    }
  }

  clearCache(contentId?: string): void {
    if (contentId) {
      this.likeStates.delete(contentId);
    } else {
      this.likeStates.clear();
    }
  }

  clearAllListeners(): void {
    this.realtimeListeners.forEach(unsubscribe => unsubscribe());
    this.realtimeListeners.clear();
  }

  /**
   * 🔧 Helper methods
   */
  private getCollectionName(contentType: 'post' | 'reel' | 'comment'): string {
    switch (contentType) {
      case 'post': return 'posts';
      case 'reel': return 'reels';
      case 'comment': return 'comments';
      default: return 'posts';
    }
  }

  /**
   * 📈 Get system statistics
   */
  getSystemStats(): {
    activeOperations: number;
    cachedStates: number;
    activeListeners: number;
    memoryUsage: string;
  } {
    return {
      activeOperations: this.activeOperations.size,
      cachedStates: this.likeStates.size,
      activeListeners: this.realtimeListeners.size,
      memoryUsage: `${Math.round(process.memoryUsage?.().heapUsed / 1024 / 1024 || 0)}MB`
    };
  }
}

export default FirebaseDynamicLikeSystem;
export type { LikeResult, LikeState };
