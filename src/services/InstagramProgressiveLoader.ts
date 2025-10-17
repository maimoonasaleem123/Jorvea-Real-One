/**
 * InstagramProgressiveLoader - Progressive content loading like Instagram
 * Posts and reels appear one by one, not all at once
 */

import firestore from '@react-native-firebase/firestore';

interface ProgressiveLoaderOptions {
  userId?: string;
  batchSize: number;
  loadDelay: number; // Delay between each item
  onItemLoaded?: (item: any, index: number) => void;
  onBatchComplete?: (items: any[]) => void;
  onError?: (error: any) => void;
}

class InstagramProgressiveLoader {
  private static loadingInstances = new Map<string, boolean>();

  /**
   * Load posts progressively like Instagram
   */
  static async loadPostsProgressively(
    userId: string,
    options: Partial<ProgressiveLoaderOptions> = {}
  ): Promise<any[]> {
    const loaderId = `posts_${userId}_${Date.now()}`;
    
    const {
      batchSize = 12,
      loadDelay = 100, // 100ms between each post
      onItemLoaded,
      onBatchComplete,
      onError
    } = options;

    if (this.loadingInstances.get(loaderId)) {
      return [];
    }

    this.loadingInstances.set(loaderId, true);

    try {
      console.log('🔄 Starting progressive posts loading for user:', userId);

      // Get all posts first
      const postsSnapshot = await firestore()
        .collection('posts')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(batchSize)
        .get();

      const allPosts = postsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Load progressively with delay
      const progressivePosts: any[] = [];
      
      for (let i = 0; i < allPosts.length; i++) {
        await new Promise(resolve => setTimeout(resolve, loadDelay));
        
        const post = allPosts[i];
        progressivePosts.push(post);
        
        // Notify about each loaded item
        if (onItemLoaded) {
          onItemLoaded(post, i);
        }
        
        console.log(`✅ Loaded post ${i + 1}/${allPosts.length}:`, post.id);
      }

      // Notify completion
      if (onBatchComplete) {
        onBatchComplete(progressivePosts);
      }

      console.log('🎉 Progressive posts loading completed:', progressivePosts.length);
      return progressivePosts;

    } catch (error) {
      console.error('❌ Error in progressive posts loading:', error);
      if (onError) {
        onError(error);
      }
      return [];
    } finally {
      this.loadingInstances.delete(loaderId);
    }
  }

  /**
   * Load reels progressively like Instagram
   */
  static async loadReelsProgressively(
    userId: string,
    options: Partial<ProgressiveLoaderOptions> = {}
  ): Promise<any[]> {
    const loaderId = `reels_${userId}_${Date.now()}`;
    
    const {
      batchSize = 12,
      loadDelay = 150, // 150ms between each reel
      onItemLoaded,
      onBatchComplete,
      onError
    } = options;

    if (this.loadingInstances.get(loaderId)) {
      return [];
    }

    this.loadingInstances.set(loaderId, true);

    try {
      console.log('🔄 Starting progressive reels loading for user:', userId);

      // Get all reels first
      const reelsSnapshot = await firestore()
        .collection('reels')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(batchSize)
        .get();

      const allReels = reelsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Load progressively with delay
      const progressiveReels: any[] = [];
      
      for (let i = 0; i < allReels.length; i++) {
        await new Promise(resolve => setTimeout(resolve, loadDelay));
        
        const reel = allReels[i];
        progressiveReels.push(reel);
        
        // Notify about each loaded item
        if (onItemLoaded) {
          onItemLoaded(reel, i);
        }
        
        console.log(`✅ Loaded reel ${i + 1}/${allReels.length}:`, reel.id);
      }

      // Notify completion
      if (onBatchComplete) {
        onBatchComplete(progressiveReels);
      }

      console.log('🎉 Progressive reels loading completed:', progressiveReels.length);
      return progressiveReels;

    } catch (error) {
      console.error('❌ Error in progressive reels loading:', error);
      if (onError) {
        onError(error);
      }
      return [];
    } finally {
      this.loadingInstances.delete(loaderId);
    }
  }

  /**
   * Load feed posts progressively (for main feed)
   */
  static async loadFeedProgressively(
    followingIds: string[],
    options: Partial<ProgressiveLoaderOptions> = {}
  ): Promise<any[]> {
    const loaderId = `feed_${Date.now()}`;
    
    const {
      batchSize = 20,
      loadDelay = 80, // 80ms between each feed item
      onItemLoaded,
      onBatchComplete,
      onError
    } = options;

    if (this.loadingInstances.get(loaderId)) {
      return [];
    }

    this.loadingInstances.set(loaderId, true);

    try {
      console.log('🔄 Starting progressive feed loading for', followingIds.length, 'users');

      if (followingIds.length === 0) {
        return [];
      }

      // Get feed posts from followed users
      const feedSnapshot = await firestore()
        .collection('posts')
        .where('userId', 'in', followingIds.slice(0, 10)) // Firestore limit
        .orderBy('createdAt', 'desc')
        .limit(batchSize)
        .get();

      const allFeedItems = feedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Load progressively with delay
      const progressiveFeed: any[] = [];
      
      for (let i = 0; i < allFeedItems.length; i++) {
        await new Promise(resolve => setTimeout(resolve, loadDelay));
        
        const item = allFeedItems[i];
        progressiveFeed.push(item);
        
        // Notify about each loaded item
        if (onItemLoaded) {
          onItemLoaded(item, i);
        }
        
        console.log(`✅ Loaded feed item ${i + 1}/${allFeedItems.length}:`, item.id);
      }

      // Notify completion
      if (onBatchComplete) {
        onBatchComplete(progressiveFeed);
      }

      console.log('🎉 Progressive feed loading completed:', progressiveFeed.length);
      return progressiveFeed;

    } catch (error) {
      console.error('❌ Error in progressive feed loading:', error);
      if (onError) {
        onError(error);
      }
      return [];
    } finally {
      this.loadingInstances.delete(loaderId);
    }
  }

  /**
   * Load more content progressively (pagination)
   */
  static async loadMoreProgressively(
    collection: 'posts' | 'reels',
    userId: string,
    lastDocId: string,
    options: Partial<ProgressiveLoaderOptions> = {}
  ): Promise<any[]> {
    const loaderId = `more_${collection}_${userId}_${Date.now()}`;
    
    const {
      batchSize = 6,
      loadDelay = 120,
      onItemLoaded,
      onBatchComplete,
      onError
    } = options;

    if (this.loadingInstances.get(loaderId)) {
      return [];
    }

    this.loadingInstances.set(loaderId, true);

    try {
      console.log(`🔄 Loading more ${collection} progressively for user:`, userId);

      // Get the last document for pagination
      const lastDoc = await firestore().collection(collection).doc(lastDocId).get();
      if (!lastDoc.exists) {
        return [];
      }

      // Query for more items
      const moreSnapshot = await firestore()
        .collection(collection)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .startAfter(lastDoc)
        .limit(batchSize)
        .get();

      const moreItems = moreSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Load progressively with delay
      const progressiveItems: any[] = [];
      
      for (let i = 0; i < moreItems.length; i++) {
        await new Promise(resolve => setTimeout(resolve, loadDelay));
        
        const item = moreItems[i];
        progressiveItems.push(item);
        
        // Notify about each loaded item
        if (onItemLoaded) {
          onItemLoaded(item, i);
        }
        
        console.log(`✅ Loaded more ${collection} ${i + 1}/${moreItems.length}:`, item.id);
      }

      // Notify completion
      if (onBatchComplete) {
        onBatchComplete(progressiveItems);
      }

      console.log(`🎉 Progressive more ${collection} loading completed:`, progressiveItems.length);
      return progressiveItems;

    } catch (error) {
      console.error(`❌ Error loading more ${collection} progressively:`, error);
      if (onError) {
        onError(error);
      }
      return [];
    } finally {
      this.loadingInstances.delete(loaderId);
    }
  }

  /**
   * Cancel all loading operations
   */
  static cancelAllLoading() {
    this.loadingInstances.clear();
    console.log('🛑 All progressive loading operations cancelled');
  }

  /**
   * Cancel specific loading operation
   */
  static cancelLoading(loaderId: string) {
    this.loadingInstances.delete(loaderId);
    console.log('🛑 Progressive loading cancelled:', loaderId);
  }

  /**
   * Check if any loading is in progress
   */
  static isLoading(): boolean {
    return this.loadingInstances.size > 0;
  }

  /**
   * Get loading status for all operations
   */
  static getLoadingStatus(): string[] {
    return Array.from(this.loadingInstances.keys());
  }
}

export default InstagramProgressiveLoader;
