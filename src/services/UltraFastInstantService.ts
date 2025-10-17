/**
 * Ultra Fast Instant Loading Service
 * Bypasses complex checks for instant reel loading
 */

import firestore from '@react-native-firebase/firestore';
import { Reel } from './firebaseService';

class UltraFastInstantService {
  private static instance: UltraFastInstantService;
  private reelCache = new Map<string, Reel[]>();
  private lastFetchTime = 0;
  private cacheDuration = 30000; // 30 seconds

  static getInstance(): UltraFastInstantService {
    if (!UltraFastInstantService.instance) {
      UltraFastInstantService.instance = new UltraFastInstantService();
    }
    return UltraFastInstantService.instance;
  }

  /**
   * Fisher-Yates shuffle algorithm for Instagram-like randomization
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get reels instantly with social media algorithm - EXCLUDE USER'S OWN REELS
   * Shows reels from following users first, then trending content with randomization
   */
  async getInstantReels(userId: string, limit: number = 20): Promise<Reel[]> {
    const now = Date.now();
    const cacheKey = `instant_reels_${userId}`;

    // Always fetch fresh reels for Instagram-like randomization (no cache)
    console.log('🚀 UltraFast: Loading fresh randomized reels...');
    
    try {
      console.log('🚀 UltraFast: Loading social media reels with algorithm...');
      
      // Get user's following list for personalized content
      const userDoc = await firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();
      const following = userData?.following || [];
      
      console.log(`🎯 Instagram Algorithm: User follows ${following.length} users`);
      
      // Simple query to avoid index issues - get recent reels and randomize in code
      const reelsSnapshot = await firestore()
        .collection('reels')
        .where('isPrivate', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(limit * 3) // Get more for better mixing
        .get();
      
      const allReels: Reel[] = reelsSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Reel))
        .filter(reel => reel.userId !== userId); // Exclude user's own reels

      console.log(`📊 Total available reels: ${allReels.length}`);
      
      if (allReels.length === 0) {
        console.log('⚠️ No reels found');
        return [];
      }

      // Instagram/TikTok Algorithm Implementation
      const followingReels = allReels.filter(reel => following.includes(reel.userId));
      const discoverReels = allReels.filter(reel => !following.includes(reel.userId));

      console.log(`👥 Following reels: ${followingReels.length}, 🌍 Discover reels: ${discoverReels.length}`);

      // Shuffle both arrays for maximum randomization
      const shuffledFollowing = this.shuffleArray(followingReels);
      const shuffledDiscover = this.shuffleArray(discoverReels);

      // Instagram-like content mixing strategy with randomization
      const mixedReels: Reel[] = [];
      let followingIndex = 0;
      let discoverIndex = 0;
      
      // Instagram pattern: Mix following and discover content randomly
      for (let i = 0; i < limit && (followingIndex < shuffledFollowing.length || discoverIndex < shuffledDiscover.length); i++) {
        // Random choice between following and discover (60% following, 40% discover)
        const useFollowing = (Math.random() < 0.6 && followingIndex < shuffledFollowing.length) || discoverIndex >= shuffledDiscover.length;
        
        if (useFollowing && followingIndex < shuffledFollowing.length) {
          mixedReels.push(shuffledFollowing[followingIndex++]);
          console.log(`👥 Added following reel at position ${i}`);
        } else if (discoverIndex < shuffledDiscover.length) {
          mixedReels.push(shuffledDiscover[discoverIndex++]);
          console.log(`🌍 Added discover reel at position ${i}`);
        }
      }

      console.log(`🎭 Final mix: ${mixedReels.length} reels (${mixedReels.filter(r => following.includes(r.userId)).length} following)`);

      // Apply final shuffle for complete randomization like Instagram
      const finalRandomizedReels = this.shuffleArray(mixedReels);
      
      // Load user data and interaction status for each reel
      const reelsWithUserData: any[] = await Promise.all(
        finalRandomizedReels.map(async (reel) => {
          try {
            // Load user data and interaction status in parallel
            // CRITICAL: Use top-level 'likes' collection with document ID format: {reelId}_{userId}
            const [likeDoc, saveDoc, userDoc] = await Promise.all([
              firestore().collection('likes').doc(`${reel.id}_${userId}`).get(), // ✅ Fixed: Use top-level likes collection
              firestore().collection('users').doc(userId).collection('savedReels').doc(reel.id).get(),
              firestore().collection('users').doc(reel.userId).get()
            ]);

            const userData = userDoc.exists() ? userDoc.data() : null;
            const isLiked = likeDoc.exists();
            const isSaved = saveDoc.exists();

            console.log(`📊 Reel ${reel.id}: likesCount=${reel.likesCount}, isLiked=${isLiked}, likeDoc.exists=${likeDoc.exists()}`);

            return {
              ...reel,
              isLiked,
              isSaved,
              user: userData ? {
                id: reel.userId,
                uid: reel.userId,
                username: userData.username || 'user',
                displayName: userData.displayName || userData.username || 'User',
                profilePicture: userData.profilePicture || null,
                verified: userData.verified || false,
                isFollowing: following.includes(reel.userId)
              } : {
                id: reel.userId,
                uid: reel.userId,
                username: 'user',
                displayName: 'User',
                profilePicture: null,
                verified: false,
                isFollowing: false
              }
            };
          } catch (error) {
            console.error('Error loading reel data:', reel.id, error);
            // Fallback data
            return {
              ...reel,
              isLiked: false,
              isSaved: false,
              user: {
                id: reel.userId,
                uid: reel.userId,
                username: 'user',
                displayName: 'User',
                profilePicture: null,
                verified: false,
                isFollowing: false
              }
            };
          }
        })
      );

      console.log(`✅ UltraFast: Loaded ${reelsWithUserData.length} randomized reels INSTANTLY!`);
      return reelsWithUserData;

    } catch (error) {
      console.error('❌ UltraFast getInstantReels error:', error);
      return [];
    }
  }

  /**
   * Load more reels with pagination
      if (this.reelCache.has(cacheKey)) {
        console.log('🔄 UltraFast: Returning stale cache due to error');
        return this.reelCache.get(cacheKey)!;
      }
      
      return [];
    }
  }

  /**
   * Load more reels with social media algorithm - EXCLUDE USER'S OWN REELS
   */
  async loadMoreReels(userId: string, lastReelId?: string, limit: number = 10): Promise<Reel[]> {
    try {
      console.log('📦 UltraFast: Loading more reels with algorithm...');
      
      // Get user's following list for personalized content
      const userDoc = await firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();
      const following = userData?.following || [];
      
      // Simple query without where clause to avoid index requirements
      let query = firestore()
        .collection('reels')
        .orderBy('createdAt', 'desc')
        .limit(limit * 4); // Get more to allow better Instagram-like mixing

      // If we have a last reel, start after it
      if (lastReelId) {
        const lastReelDoc = await firestore().collection('reels').doc(lastReelId).get();
        if (lastReelDoc.exists) {
          query = query.startAfter(lastReelDoc);
        }
      }

      const reelsSnapshot = await query.get();
      
      // Get all reels and filter locally
      const allReels: Reel[] = reelsSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Reel))
        .filter(reel => {
          const reelData = reel as any;
          return reelData.isPublic !== false && // Include undefined/null as public
                 !reelData.isArchived && 
                 !reelData.isDeleted &&
                 reel.userId !== userId; // EXCLUDE USER'S OWN REELS
        });

      console.log(`📊 LoadMore: Found ${allReels.length} candidate reels`);

      // Instagram/TikTok Algorithm for continuous loading
      const followingReels = allReels.filter(reel => following.includes(reel.userId));
      const discoverReels = allReels.filter(reel => !following.includes(reel.userId));

      // Sort following by recency (recent content first)
      followingReels.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      // Sort discover by engagement score (Instagram weighted algorithm)
      discoverReels.sort((a, b) => {
        const engagementA = (a.likesCount || 0) + (a.commentsCount || 0) * 2 + (a.viewsCount || 0) * 0.1;
        const engagementB = (b.likesCount || 0) + (b.commentsCount || 0) * 2 + (b.viewsCount || 0) * 0.1;
        return engagementB - engagementA;
      });

      // Instagram-style content mixing for continuous scroll
      const mixedReels: Reel[] = [];
      let followingIndex = 0;
      let discoverIndex = 0;
      
      // Slightly reduce following ratio for continuous loading (more discovery)
      for (let i = 0; i < limit && (followingIndex < followingReels.length || discoverIndex < discoverReels.length); i++) {
        const useFollowing = (Math.random() < 0.65 && followingIndex < followingReels.length) || discoverIndex >= discoverReels.length;
        
        if (useFollowing && followingIndex < followingReels.length) {
          mixedReels.push(followingReels[followingIndex++]);
        } else if (discoverIndex < discoverReels.length) {
          mixedReels.push(discoverReels[discoverIndex++]);
        }
      }

      const finalReels = mixedReels.slice(0, limit);
      console.log(`🎭 LoadMore mix: ${finalReels.length} reels (${finalReels.filter(r => following.includes(r.userId)).length} following)`);

      // Load user data and interaction status for each reel
      const reelsWithUserData: any[] = await Promise.all(
        finalReels.map(async (reel) => {
          try {
            // Load user data and interaction status in parallel
            // CRITICAL: Use top-level 'likes' collection with document ID format: {reelId}_{userId}
            const [userDoc, likeDoc, saveDoc] = await Promise.all([
              firestore().collection('users').doc(reel.userId).get(),
              firestore().collection('likes').doc(`${reel.id}_${userId}`).get(), // ✅ Fixed: Use top-level likes collection
              firestore().collection('users').doc(userId).collection('savedReels').doc(reel.id).get()
            ]);

            const userData = userDoc.exists() ? userDoc.data() : null;
            const isLiked = likeDoc.exists();
            const isSaved = saveDoc.exists();

            console.log(`📊 LoadMore Reel ${reel.id}: likesCount=${reel.likesCount}, isLiked=${isLiked}`);

            return {
              ...reel,
              isLiked,
              isSaved,
              user: userData ? {
                id: reel.userId,
                uid: reel.userId,
                username: userData.username || 'user',
                displayName: userData.displayName || userData.username || 'User',
                profilePicture: userData.profilePicture || null,
                verified: userData.verified || false,
                isFollowing: following.includes(reel.userId)
              } : {
                id: reel.userId,
                uid: reel.userId,
                username: 'user',
                displayName: 'User',
                profilePicture: null,
                verified: false,
                isFollowing: false
              }
            };
          } catch (error) {
            console.error('Error loading reel data:', reel.id, error);
            return {
              ...reel,
              isLiked: false,
              isSaved: false,
              user: {
                id: reel.userId,
                uid: reel.userId,
                username: 'user',
                displayName: 'User',
                profilePicture: null,
                verified: false,
                isFollowing: false
              }
            };
          }
        })
      );

      console.log(`✅ UltraFast: Loaded ${reelsWithUserData.length} more reels with user data!`);
      return reelsWithUserData as Reel[];

    } catch (error) {
      console.error('❌ UltraFast loadMore error:', error);
      return [];
    }
  }

  /**
   * Preload next batch in background
   */
  async preloadNextBatch(currentIndex: number, reels: Reel[], userId: string): Promise<void> {
    // If user is near the end, preload more
    if (currentIndex >= reels.length - 3) {
      const lastReelId = reels[reels.length - 1]?.id;
      const newReels = await this.loadMoreReels(userId, lastReelId, 5);
      
      if (newReels.length > 0) {
        console.log(`🔄 UltraFast: Preloaded ${newReels.length} reels in background`);
      }
    }
  }

  /**
   * Clear cache to force fresh load
   */
  clearCache(): void {
    this.reelCache.clear();
    this.lastFetchTime = 0;
    console.log('🧹 UltraFast: Cache cleared');
  }

  /**
   * Get instant user reels (for profile screens)
   */
  async getUserReelsInstant(userId: string, limit: number = 12): Promise<Reel[]> {
    try {
      console.log(`🚀 UltraFast: Loading user ${userId} reels instantly...`);
      
      const reelsSnapshot = await firestore()
        .collection('reels')
        .where('userId', '==', userId)
        .where('isPublic', '==', true) // Only public for instant loading
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const reels: Reel[] = reelsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Reel));

      console.log(`✅ UltraFast: Loaded ${reels.length} user reels instantly!`);
      return reels;

    } catch (error) {
      console.error('❌ UltraFast getUserReels error:', error);
      return [];
    }
  }

  /**
   * Simple like action without complex checks
   */
  async instantLike(reelId: string, userId: string): Promise<boolean> {
    try {
      await firestore()
        .collection('reels')
        .doc(reelId)
        .update({
          [`likes.${userId}`]: firestore.FieldValue.serverTimestamp(),
          likesCount: firestore.FieldValue.increment(1),
          updatedAt: firestore.FieldValue.serverTimestamp()
        });

      console.log('❤️ UltraFast: Instant like successful');
      return true;
    } catch (error) {
      console.error('❌ UltraFast like error:', error);
      return false;
    }
  }

  /**
   * Simple unlike action
   */
  async instantUnlike(reelId: string, userId: string): Promise<boolean> {
    try {
      await firestore()
        .collection('reels')
        .doc(reelId)
        .update({
          [`likes.${userId}`]: firestore.FieldValue.delete(),
          likesCount: firestore.FieldValue.increment(-1),
          updatedAt: firestore.FieldValue.serverTimestamp()
        });

      console.log('💔 UltraFast: Instant unlike successful');
      return true;
    } catch (error) {
      console.error('❌ UltraFast unlike error:', error);
      return false;
    }
  }
  /**
   * Enhanced Instagram-like toggle like with optimistic updates and animations
   * REDIRECTED to RealTimeLikeSystem for consistency
   */
  async toggleLike(reelId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number; isOptimistic?: boolean }> {
    try {
      console.log(`⚠️ UltraFastInstantService.toggleLike: Redirecting to RealTimeLikeSystem for reel ${reelId}`);
      
      // Import RealTimeLikeSystem
      const RealTimeLikeSystem = require('./RealTimeLikeSystem').default;
      
      // Get current state for optimistic response
      const likeDoc = await firestore().collection('likes').doc(`${reelId}_${userId}`).get();
      const reelDoc = await firestore().collection('reels').doc(reelId).get();
      
      const isCurrentlyLiked = likeDoc.exists();
      const currentLikesCount = reelDoc.data()?.likesCount || 0;
      
      // Use RealTimeLikeSystem for actual toggle
      const result = await RealTimeLikeSystem.getInstance().toggleLike(
        reelId,
        userId,
        'reel',
        isCurrentlyLiked,
        currentLikesCount
      );
      
      if (result.success) {
        return {
          isLiked: result.isLiked,
          likesCount: result.likesCount,
          isOptimistic: false
        };
      }
      
      // Fallback to old behavior if RealTimeLikeSystem fails
      console.error('❌ RealTimeLikeSystem failed, using fallback');
      const reelRef = firestore().collection('reels').doc(reelId);
      const likeRef = firestore().collection('likes').doc(`${reelId}_${userId}`);
      
      // Return optimistic update immediately
      const optimisticResult = {
        isLiked: !isCurrentlyLiked,
        likesCount: isCurrentlyLiked ? currentLikesCount - 1 : currentLikesCount + 1,
        isOptimistic: true
      };
      
      // Perform actual Firebase update in background
      this.performLikeUpdate(reelId, userId, isCurrentlyLiked, reelRef, likeRef)
        .catch(error => {
          console.error('Background like update failed:', error);
          // You could emit an event here to revert optimistic update if needed
        });
      
      return optimisticResult;
    } catch (error) {
      console.error('Error in optimistic like toggle:', error);
      throw error;
    }
  }

  /**
   * Perform the actual like update in Firebase (background operation)
   * UPDATED to use top-level likes collection instead of subcollection
   */
  private async performLikeUpdate(
    reelId: string, 
    userId: string, 
    isCurrentlyLiked: boolean, 
    reelRef: any, 
    likeRef: any
  ): Promise<void> {
    try {
      const batch = firestore().batch();
      
      if (isCurrentlyLiked) {
        // Unlike: remove like document and decrement counter
        batch.delete(likeRef);
        batch.set(reelRef, {
          likesCount: firestore.FieldValue.increment(-1)
        }, { merge: true });
      } else {
        // Like: add like document (top-level collection) and increment counter
        batch.set(likeRef, {
          reelId,
          userId,
          type: 'reel',
          createdAt: new Date().toISOString()
        });
        batch.set(reelRef, {
          likesCount: firestore.FieldValue.increment(1)
        }, { merge: true });
        
        // Optional: Create notification for reel owner (non-blocking)
        this.createLikeNotification(reelId, userId).catch(console.warn);
      }
      
      await batch.commit();
      console.log(`✅ Background like update completed for reel ${reelId}`);
    } catch (error) {
      console.error('Firebase like update failed:', error);
      throw error;
    }
  }

  /**
   * Create like notification (Instagram-style)
   */
  private async createLikeNotification(reelId: string, fromUserId: string): Promise<void> {
    try {
      const reelDoc = await firestore().collection('reels').doc(reelId).get();
      const reelData = reelDoc.data();
      
      if (!reelData || reelData.userId === fromUserId) {
        return; // Don't notify if it's user's own reel
      }
      
      // Create notification
      await firestore().collection('notifications').add({
        type: 'like',
        fromUserId,
        toUserId: reelData.userId,
        reelId,
        message: 'liked your reel',
        createdAt: firestore.FieldValue.serverTimestamp(),
        isRead: false,
        data: {
          reelThumbnail: reelData.thumbnailUrl || reelData.videoUrl
        }
      });
    } catch (error) {
      console.warn('Failed to create like notification:', error);
    }
  }

  /**
   * Get real-time like status for a reel
   */
  subscribeToLikeUpdates(reelId: string, userId: string, callback: (data: { isLiked: boolean; likesCount: number }) => void): () => void {
    const reelRef = firestore().collection('reels').doc(reelId);
    const likeRef = reelRef.collection('likes').doc(userId);
    
    // Subscribe to both reel data and user's like status
    const unsubscribeReel = reelRef.onSnapshot(doc => {
      const reelData = doc.data();
      const likesCount = reelData?.likesCount || 0;
      
      // Check user's like status
      likeRef.get().then(likeDoc => {
        callback({
          isLiked: likeDoc.exists(),
          likesCount
        });
      });
    });
    
    return unsubscribeReel;
  }

  /**
   * Toggle save on a reel instantly
   */
  async toggleSave(reelId: string, userId: string): Promise<{ isSaved: boolean }> {
    try {
      const saveRef = firestore().collection('users').doc(userId).collection('savedReels').doc(reelId);
      
      // Check current save status
      const saveDoc = await saveRef.get();
      const isCurrentlySaved = saveDoc.exists();
      
      if (isCurrentlySaved) {
        // Unsave: remove save document
        await saveRef.delete();
        return { isSaved: false };
      } else {
        // Save: add save document
        await saveRef.set({
          reelId,
          savedAt: firestore.FieldValue.serverTimestamp()
        });
        return { isSaved: true };
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      throw error;
    }
  }
}

export default UltraFastInstantService;
