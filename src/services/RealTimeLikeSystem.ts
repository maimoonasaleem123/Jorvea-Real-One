import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Alert } from 'react-native';

export interface LikeResult {
  success: boolean;
  isLiked: boolean;
  likesCount: number;
  error?: string;
}

export interface LikeData {
  userId: string;
  contentId: string;
  contentType: 'reel' | 'story' | 'post';
  createdAt: any;
  userInfo?: {
    username?: string;
    profilePicture?: string;
  };
}

export interface LikesDocument {
  likesCount: number;
  lastUpdated: any;
  recentLikes: LikeData[];
}

class RealTimeLikeSystem {
  private static instance: RealTimeLikeSystem;
  private requestQueue: Map<string, Promise<LikeResult>> = new Map();
  private likeCache: Map<string, { isLiked: boolean; likesCount: number; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly BATCH_SIZE = 10;

  public static getInstance(): RealTimeLikeSystem {
    if (!RealTimeLikeSystem.instance) {
      RealTimeLikeSystem.instance = new RealTimeLikeSystem();
    }
    return RealTimeLikeSystem.instance;
  }

  /**
   * Static method for quick like toggle - same interface as PerfectLikeSystem
   */
  public static async toggleLike(
    contentId: string,
    userId: string,
    contentType: 'reel' | 'story' | 'post' = 'reel',
    currentIsLiked?: boolean,
    currentLikesCount?: number
  ): Promise<LikeResult> {
    return RealTimeLikeSystem.getInstance().toggleLike(
      contentId,
      userId,
      contentType,
      currentIsLiked,
      currentLikesCount
    );
  }

  /**
   * Toggle like with optimistic updates and real-time Firebase sync
   * Compatible interface with PerfectLikeSystem
   */
  public async toggleLike(
    contentId: string,
    userId: string,
    contentType: 'reel' | 'story' | 'post',
    currentIsLiked?: boolean,
    currentLikesCount?: number,
    userInfo?: { username?: string; profilePicture?: string }
  ): Promise<LikeResult> {
    const requestKey = `${contentId}_${userId}`;

    // Prevent duplicate requests
    if (this.requestQueue.has(requestKey)) {
      try {
        return await this.requestQueue.get(requestKey)!;
      } catch (error) {
        this.requestQueue.delete(requestKey);
        return { success: false, isLiked: currentIsLiked, likesCount: currentLikesCount, error: 'Request failed' };
      }
    }

    // Create the request promise
    const requestPromise = this.performLikeToggle(
      contentId,
      userId,
      contentType,
      currentIsLiked || false,
      currentLikesCount || 0,
      userInfo
    );

    this.requestQueue.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      
      // Update cache
      this.updateCache(contentId, result.isLiked, result.likesCount);
      
      return result;
    } catch (error) {
      console.error('Like toggle error:', error);
      return { 
        success: false, 
        isLiked: currentIsLiked, 
        likesCount: currentLikesCount, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      this.requestQueue.delete(requestKey);
    }
  }

  /**
   * Perform the actual like toggle operation - Compatible with FirebaseService
   */
  private async performLikeToggle(
    contentId: string,
    userId: string,
    contentType: 'reel' | 'story' | 'post',
    currentIsLiked: boolean,
    currentLikesCount: number,
    userInfo?: { username?: string; profilePicture?: string }
  ): Promise<LikeResult> {
    const batch = firestore().batch();
    const serverTimestamp = firestore.FieldValue.serverTimestamp();

    try {
      // Use FirebaseService compatible collection structure
      const contentRef = firestore().collection(this.getContentCollection(contentType)).doc(contentId);
      const likeRef = firestore().collection('likes').doc(`${contentId}_${userId}`);

      // Check current state in Firebase
      const [contentDoc, likeDoc] = await Promise.all([
        contentRef.get(),
        likeRef.get()
      ]);

      if (!contentDoc.exists) {
        return { success: false, isLiked: currentIsLiked, likesCount: currentLikesCount, error: 'Content not found' };
      }

      const contentData = contentDoc.data();
      const userLikeExists = likeDoc.exists();  // ✅ Call the method with ()

      console.log(`📊 Current state - userLikeExists: ${userLikeExists}, rawLikesCount: ${contentData?.likesCount}`);

      // Determine new state
      const newIsLiked = !userLikeExists;
      
      // Get current likes count - handle undefined, null, and negative values
      let currentFirebaseLikesCount = contentData?.likesCount;
      
      // CRITICAL FIX: Always validate and reset negative/invalid values
      if (currentFirebaseLikesCount === undefined || 
          currentFirebaseLikesCount === null || 
          currentFirebaseLikesCount < 0) {
        console.log(`⚠️ Invalid likesCount detected: ${currentFirebaseLikesCount}, resetting to 0`);
        currentFirebaseLikesCount = 0;
      }
      
      // Calculate new count - ensure it never goes below 0
      const newLikesCount = newIsLiked 
        ? currentFirebaseLikesCount + 1 
        : Math.max(0, currentFirebaseLikesCount - 1);

      console.log(`🔄 Toggle like: ${userLikeExists ? 'unliking' : 'liking'}, count: ${currentFirebaseLikesCount} → ${newLikesCount}`);

      if (newIsLiked) {
        // Adding like - compatible with FirebaseService structure
        const likeData = {
          [`${contentType}Id`]: contentId,
          userId,
          type: contentType,
          createdAt: new Date().toISOString(), // Use ISO string for compatibility
        };

        // Add user like document with FirebaseService compatible structure
        batch.set(likeRef, likeData);
      } else {
        // Removing like
        batch.delete(likeRef);
      }

      // Update content document with new count - ensure it's never negative
      const finalLikesCount = Math.max(0, newLikesCount);
      
      console.log(`💾 Saving to Firebase - finalLikesCount: ${finalLikesCount}, newIsLiked: ${newIsLiked}`);
      
      // Use set with merge to ensure the field gets written properly
      batch.set(contentRef, {
        likesCount: finalLikesCount,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Commit batch
      await batch.commit();

      console.log(`✅ Like ${newIsLiked ? 'added' : 'removed'} successfully. New count: ${finalLikesCount}`);
      console.log(`� Firebase Updated:`);
      console.log(`   - Collection: ${this.getContentCollection(contentType)}/${contentId}`);
      console.log(`   - Field: likesCount = ${finalLikesCount}`);
      console.log(`   - Like doc: likes/${contentId}_${userId} ${newIsLiked ? 'CREATED' : 'DELETED'}`);
      console.log(`�📤 Returning result: { success: true, isLiked: ${newIsLiked}, likesCount: ${finalLikesCount} }`);

      return {
        success: true,
        isLiked: newIsLiked,
        likesCount: finalLikesCount,
      };

    } catch (error) {
      console.error('Firebase like toggle error:', error);
      console.error('Error details:', {
        code: (error as any)?.code,
        message: (error as any)?.message,
        userId,
        contentId,
        contentType,
        currentUser: auth().currentUser?.uid
      });
      
      // Check for specific Firebase errors
      if (error instanceof Error || (error as any)?.code) {
        const errorCode = (error as any)?.code || '';
        const errorMessage = (error as any)?.message || error.toString();
        
        if (errorCode === 'permission-denied' || errorMessage.includes('permission-denied')) {
          console.error('❌ Permission denied - checking auth state and Firebase rules');
          return { success: false, isLiked: currentIsLiked, likesCount: currentLikesCount, error: 'Permission denied' };
        }
        if (errorCode === 'unavailable' || errorMessage.includes('unavailable')) {
          return { success: false, isLiked: currentIsLiked, likesCount: currentLikesCount, error: 'Service unavailable' };
        }
        if (errorCode === 'unauthenticated' || errorMessage.includes('unauthenticated')) {
          console.error('❌ User not authenticated - need to sign in');
          return { success: false, isLiked: currentIsLiked, likesCount: currentLikesCount, error: 'Authentication required' };
        }
      }

      return { 
        success: false, 
        isLiked: currentIsLiked, 
        likesCount: currentLikesCount, 
        error: 'Network error' 
      };
    }
  }

  /**
   * Get current like state for content - Compatible with FirebaseService
   */
  public async getLikeState(
    contentId: string,
    userId: string,
    contentType: 'reel' | 'story' | 'post'
  ): Promise<{ isLiked: boolean; likesCount: number }> {
    const cacheKey = `${contentId}_${userId}`;
    const cached = this.likeCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return { isLiked: cached.isLiked, likesCount: cached.likesCount };
    }

    try {
      // Use FirebaseService compatible structure
      const [userLikeDoc, contentDoc] = await Promise.all([
        firestore().collection('likes').doc(`${contentId}_${userId}`).get(),
        firestore().collection(this.getContentCollection(contentType)).doc(contentId).get()
      ]);

      const isLikedResult: boolean = userLikeDoc.exists();
      const likesCountResult: number = contentDoc.exists ? (contentDoc.data()?.likesCount || 0) : 0;

      // Update cache
      this.updateCache(cacheKey, isLikedResult, likesCountResult);

      return { isLiked: isLikedResult, likesCount: likesCountResult };
    } catch (error) {
      console.error('Error getting like state:', error);
      return { isLiked: false, likesCount: 0 };
    }
  }

  /**
   * Get recent likes for content - Compatible with FirebaseService
   */
  public async getRecentLikes(contentId: string, contentType: 'reel' | 'story' | 'post', limit: number = 10): Promise<LikeData[]> {
    try {
      const snapshot = await firestore()
        .collection('likes')
        .where('type', '==', contentType)
        .where(`${contentType}Id`, '==', contentId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          userId: data.userId,
          contentId: data.reelId || data.postId || data.storyId,
          contentType: data.type as 'reel' | 'story' | 'post',
          createdAt: data.createdAt,
          userInfo: data.userInfo,
        } as LikeData;
      });
    } catch (error) {
      console.error('Error getting recent likes:', error);
      return [];
    }
  }

  /**
   * Get all likes for content with pagination - Compatible with FirebaseService
   */
  public async getAllLikes(
    contentId: string, 
    limit: number = 20, 
    lastDoc?: any
  ): Promise<{ likes: LikeData[]; hasMore: boolean; lastDocument?: any }> {
    try {
      let query = firestore()
        .collection('likes')
        .where('type', '==', 'reel') // Assuming reel type, can be parameterized
        .where(`reelId`, '==', contentId) // Use FirebaseService compatible field name
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      const likes = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          userId: data.userId,
          contentId: data.reelId || data.postId || data.storyId,
          contentType: data.type as 'reel' | 'story' | 'post',
          createdAt: data.createdAt,
          userInfo: data.userInfo,
        } as LikeData;
      });
      const hasMore = snapshot.docs.length === limit;
      const lastDocument = snapshot.docs[snapshot.docs.length - 1];

      return { likes, hasMore, lastDocument };
    } catch (error) {
      console.error('Error getting all likes:', error);
      return { likes: [], hasMore: false };
    }
  }

  /**
   * Bulk update likes count for content (for migration or fixing) - Compatible with FirebaseService
   */
  public async updateLikesCount(contentId: string, contentType: 'reel' | 'story' | 'post'): Promise<boolean> {
    try {
      // Count actual likes using FirebaseService compatible structure
      const likesSnapshot = await firestore()
        .collection('likes')
        .where('type', '==', contentType)
        .where(`${contentType}Id`, '==', contentId)
        .get();

      const actualCount = likesSnapshot.size;

      // Update content document
      const contentRef = firestore().collection(this.getContentCollection(contentType)).doc(contentId);

      await contentRef.update({ 
        likesCount: actualCount,
        updatedAt: new Date().toISOString(),
      });

      console.log(`✅ Updated likes count for ${contentId}: ${actualCount}`);
      return true;
    } catch (error) {
      console.error('Error updating likes count:', error);
      return false;
    }
  }

  /**
   * Subscribe to real-time like updates - Compatible with FirebaseService
   */
  public subscribeLikeUpdates(
    contentId: string,
    contentType: 'reel' | 'story' | 'post',
    onUpdate: (likesCount: number, recentLikes: LikeData[]) => void
  ): () => void {
    // Subscribe to content document for like count changes
    const unsubscribe = firestore()
      .collection(this.getContentCollection(contentType))
      .doc(contentId)
      .onSnapshot(
        async (doc) => {
          if (doc.exists()) {
            const likesCount = doc.data()?.likesCount || 0;
            
            // Get recent likes
            const recentLikes = await this.getRecentLikes(contentId, contentType, 5);
            onUpdate(likesCount, recentLikes);
          } else {
            onUpdate(0, []);
          }
        },
        (error) => {
          console.error('Like subscription error:', error);
          onUpdate(0, []);
        }
      );

    return unsubscribe;
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.likeCache.clear();
  }

  /**
   * Update cache
   */
  private updateCache(key: string, isLiked: boolean, likesCount: number): void {
    this.likeCache.set(key, {
      isLiked,
      likesCount,
      timestamp: Date.now(),
    });
  }

  /**
   * Get content collection name
   */
  private getContentCollection(contentType: 'reel' | 'story' | 'post'): string {
    switch (contentType) {
      case 'reel':
        return 'reels';
      case 'story':
        return 'stories';
      case 'post':
        return 'posts';
      default:
        return 'reels';
    }
  }

  /**
   * Health check - verify system is working
   */
  public async healthCheck(): Promise<{ status: 'healthy' | 'error'; message: string }> {
    try {
      // Test basic connectivity
      await firestore().collection('likes').limit(1).get();
      return { status: 'healthy', message: 'Real-time like system is operational' };
    } catch (error) {
      return { 
        status: 'error', 
        message: `Like system error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}

export default RealTimeLikeSystem;
