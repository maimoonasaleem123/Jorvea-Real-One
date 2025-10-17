/**
 * 🎯 DYNAMIC FIREBASE POSTS SERVICE
 * 
 * Simple, working dynamic posts from Firebase without type conflicts
 */

import firestore from '@react-native-firebase/firestore';

export interface SimpleDynamicPost {
  id: string;
  userId: string;
  mediaUrls: string[];
  mediaType: 'image' | 'video' | 'carousel';
  caption: string;
  location?: {
    name: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  hashtags: string[];
  mentions: string[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  isPrivate: boolean;
  viewsCount?: number;
  commentsDisabled: boolean;
  hideLikeCounts: boolean;
  createdAt: any;
  updatedAt: any;
  // Enhanced properties
  user?: {
    id: string;
    username: string;
    displayName: string;
    profilePicture: string | null;
    verified: boolean;
    isFollowing: boolean;
  };
  isLiked: boolean;
  isSaved: boolean;
  engagement: number;
}

class DynamicFirebasePostsService {
  private static instance: DynamicFirebasePostsService;
  private postsCache = new Map<string, SimpleDynamicPost[]>();
  private userCache = new Map<string, any>();
  private cacheDuration = 30000; // 30 seconds
  private lastCacheTime = 0;

  static getInstance(): DynamicFirebasePostsService {
    if (!DynamicFirebasePostsService.instance) {
      DynamicFirebasePostsService.instance = new DynamicFirebasePostsService();
    }
    return DynamicFirebasePostsService.instance;
  }

  /**
   * 🚀 Get dynamic posts from Firebase
   */
  async getDynamicPosts(userId: string, limit: number = 20): Promise<SimpleDynamicPost[]> {
    const now = Date.now();
    const cacheKey = `posts_${userId}`;

    // Check cache first
    if (this.postsCache.has(cacheKey) && (now - this.lastCacheTime) < this.cacheDuration) {
      console.log('⚡ DynamicPosts: Returning cached posts');
      return this.postsCache.get(cacheKey)!;
    }

    try {
      console.log('🚀 DynamicPosts: Loading from Firebase...');

      // Get user's following list
      const userDoc = await firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();
      const following = userData?.following || [];

      // Get posts from Firebase
      const postsSnapshot = await firestore()
        .collection('posts')
        .where('isPrivate', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(limit * 2) // Get more to filter
        .get();

      const allPosts = postsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((post: any) => post.userId !== userId); // Exclude user's own posts

      console.log('📥 Loaded posts from Firebase:', allPosts.length);
      allPosts.forEach((post: any) => {
        console.log(`  Post ${post.id}: likesCount=${post.likesCount}, commentsCount=${post.commentsCount}`);
      });

      // Sort by social algorithm (following first, then engagement)
      const followingPosts = allPosts.filter((post: any) => following.includes(post.userId));
      const otherPosts = allPosts.filter((post: any) => !following.includes(post.userId));

      // Sort other posts by engagement
      otherPosts.sort((a: any, b: any) => {
        const engagementA = (a.likesCount || 0) + (a.commentsCount || 0) + (a.viewsCount || 0);
        const engagementB = (b.likesCount || 0) + (b.commentsCount || 0) + (b.viewsCount || 0);
        return engagementB - engagementA;
      });

      // Mix posts (70% following, 30% discover)
      const mixedPosts = [];
      const maxFollowing = Math.ceil(limit * 0.7);
      mixedPosts.push(...followingPosts.slice(0, maxFollowing));
      const remainingSlots = limit - mixedPosts.length;
      mixedPosts.push(...otherPosts.slice(0, remainingSlots));

      const finalPosts = mixedPosts.slice(0, limit);

      // Enhance posts with user data
      const enhancedPosts = await Promise.all(
        finalPosts.map(async (post: any): Promise<SimpleDynamicPost> => {
          try {
            // Get user data and interaction status
            // ✅ FIXED: Check likes in the correct collection structure used by RealTimeLikeSystem
            const [userDoc, likeDoc, saveDoc] = await Promise.all([
              this.getCachedUser(post.userId),
              firestore().collection('likes').doc(`${post.id}_${userId}`).get(), // ✅ Correct location
              firestore().collection('users').doc(userId).collection('savedPosts').doc(post.id).get()
            ]);

            const isLiked = likeDoc.exists(); // ✅ Call the method
            const isSaved = !!saveDoc.exists;
            const engagement = (post.likesCount || 0) + (post.commentsCount || 0) + (post.viewsCount || 0);

            console.log(`📊 Post ${post.id}: likesCount=${post.likesCount}, isLiked=${isLiked}, likeDoc.exists=${likeDoc.exists()}`);

            return {
              id: post.id,
              userId: post.userId,
              mediaUrls: post.mediaUrls || [],
              mediaType: post.mediaType || 'image',
              caption: post.caption || '',
              location: post.location,
              hashtags: post.hashtags || [],
              mentions: post.mentions || [],
              likesCount: post.likesCount || 0,
              commentsCount: post.commentsCount || 0,
              sharesCount: post.sharesCount || 0,
              isPrivate: post.isPrivate || false,
              viewsCount: post.viewsCount || 0,
              commentsDisabled: post.commentsDisabled || false,
              hideLikeCounts: post.hideLikeCounts || false,
              createdAt: post.createdAt,
              updatedAt: post.updatedAt,
              isLiked,
              isSaved,
              engagement,
              user: userDoc ? {
                id: post.userId,
                username: userDoc.username || 'user',
                displayName: userDoc.displayName || userDoc.username || 'User',
                profilePicture: userDoc.profilePicture || null,
                verified: userDoc.verified || false,
                isFollowing: following.includes(post.userId)
              } : {
                id: post.userId,
                username: 'user',
                displayName: 'User',
                profilePicture: null,
                verified: false,
                isFollowing: false
              }
            };
          } catch (error) {
            console.error('❌ Error enhancing post:', post.id, error);
            console.log('📊 Fallback data for post:', post.id, '- likesCount:', post.likesCount);
            return {
              id: post.id,
              userId: post.userId,
              mediaUrls: post.mediaUrls || [],
              mediaType: post.mediaType || 'image',
              caption: post.caption || '',
              hashtags: post.hashtags || [],
              mentions: post.mentions || [],
              likesCount: post.likesCount || 0,  // Should come from Firebase post document
              commentsCount: post.commentsCount || 0,
              sharesCount: post.sharesCount || 0,
              isPrivate: false,
              viewsCount: 0,
              commentsDisabled: false,
              hideLikeCounts: false,
              createdAt: post.createdAt,
              updatedAt: post.updatedAt,
              isLiked: false,  // Default to false on error
              isSaved: false,
              engagement: 0,
              user: {
                id: post.userId,
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

      // Cache the results
      this.postsCache.set(cacheKey, enhancedPosts);
      this.lastCacheTime = now;

      console.log(`✅ DynamicPosts: Loaded ${enhancedPosts.length} posts from Firebase`);
      return enhancedPosts;

    } catch (error) {
      console.error('❌ DynamicPosts: Error loading posts:', error);
      
      // Return cached data if available
      if (this.postsCache.has(cacheKey)) {
        console.log('🔄 DynamicPosts: Returning stale cache due to error');
        return this.postsCache.get(cacheKey)!;
      }
      
      return [];
    }
  }

  /**
   * 👤 Get cached user data
   */
  private async getCachedUser(userId: string): Promise<any> {
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId);
    }

    try {
      const userDoc = await firestore().collection('users').doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      
      if (userData) {
        this.userCache.set(userId, userData);
      }
      
      return userData;
    } catch (error) {
      console.error('Error fetching user:', userId, error);
      return null;
    }
  }

  /**
   * 🔄 Refresh posts
   */
  async refreshPosts(userId: string): Promise<SimpleDynamicPost[]> {
    this.clearCache();
    return await this.getDynamicPosts(userId);
  }

  /**
   * 📈 Load more posts
   */
  async loadMorePosts(userId: string, lastPostId: string, limit: number = 10): Promise<SimpleDynamicPost[]> {
    try {
      const userDoc = await firestore().collection('users').doc(userId).get();
      const following = userDoc.data()?.following || [];

      const lastPostDoc = await firestore().collection('posts').doc(lastPostId).get();
      
      const postsSnapshot = await firestore()
        .collection('posts')
        .where('isPrivate', '==', false)
        .orderBy('createdAt', 'desc')
        .startAfter(lastPostDoc)
        .limit(limit)
        .get();

      const posts = postsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((post: any) => post.userId !== userId);

      // Enhance posts with user data (simplified)
      const enhancedPosts = await Promise.all(
        posts.map(async (post: any): Promise<SimpleDynamicPost> => {
          const userDoc = await this.getCachedUser(post.userId);
          // ✅ FIXED: Check likes in the correct collection structure used by RealTimeLikeSystem
          const [likeDoc, saveDoc] = await Promise.all([
            firestore().collection('likes').doc(`${post.id}_${userId}`).get(), // ✅ Correct location
            firestore().collection('users').doc(userId).collection('savedPosts').doc(post.id).get()
          ]);

          return {
            id: post.id,
            userId: post.userId,
            mediaUrls: post.mediaUrls || [],
            mediaType: post.mediaType || 'image',
            caption: post.caption || '',
            hashtags: post.hashtags || [],
            mentions: post.mentions || [],
            likesCount: post.likesCount || 0,
            commentsCount: post.commentsCount || 0,
            sharesCount: post.sharesCount || 0,
            isPrivate: false,
            viewsCount: post.viewsCount || 0,
            commentsDisabled: false,
            hideLikeCounts: false,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            isLiked: likeDoc.exists(), // ✅ Call the method
            isSaved: !!saveDoc.exists,
            engagement: (post.likesCount || 0) + (post.commentsCount || 0) + (post.viewsCount || 0),
            user: userDoc ? {
              id: post.userId,
              username: userDoc.username || 'user',
              displayName: userDoc.displayName || userDoc.username || 'User',
              profilePicture: userDoc.profilePicture || null,
              verified: userDoc.verified || false,
              isFollowing: following.includes(post.userId)
            } : {
              id: post.userId,
              username: 'user',
              displayName: 'User',
              profilePicture: null,
              verified: false,
              isFollowing: false
            }
          };
        })
      );

      return enhancedPosts;
    } catch (error) {
      console.error('❌ Error loading more posts:', error);
      return [];
    }
  }

  /**
   * 🧹 Clear cache
   */
  clearCache(): void {
    this.postsCache.clear();
    this.userCache.clear();
    this.lastCacheTime = 0;
  }
}

export default DynamicFirebasePostsService;
