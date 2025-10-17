import FirebaseService, { Post, Reel, Story } from './firebaseService';
import { InstantCache } from './InstantCacheService';

interface FastLoadResult<T> {
  instant: T[];
  loading: boolean;
  hasMore: boolean;
}

class LightningFastService {
  private isInitialized = false;
  private backgroundLoading = false;
  
  // Initialize service like Instagram does on app launch
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize cache system
      await InstantCache.initializeCache();
      
      // Start background refresh immediately
      this.startBackgroundRefresh();
      
      this.isInitialized = true;
      console.log('⚡ Lightning Fast Service initialized!');
    } catch (error) {
      console.error('Failed to initialize fast service:', error);
    }
  }

  // Get posts instantly like Instagram
  async getInstantPosts(userId: string): Promise<FastLoadResult<Post>> {
    // First, return cached data immediately (0ms like Instagram)
    const cachedResult = await InstantCache.getInstantPosts();
    
    if (cachedResult.cached.length > 0) {
      // Start background refresh if needed
      if (cachedResult.needsRefresh && !this.backgroundLoading) {
        this.refreshPostsInBackground(userId);
      }
      
      return {
        instant: cachedResult.cached,
        loading: false,
        hasMore: true
      };
    }

    // If no cache, load first batch super fast
    try {
      const freshPosts = await FirebaseService.getPosts(userId, 5); // Just first 5
      await InstantCache.cachePosts(freshPosts);
      
      // Start loading more in background
      this.loadMorePostsInBackground(userId, 5);
      
      return {
        instant: freshPosts,
        loading: false,
        hasMore: true
      };
    } catch (error) {
      console.error('Failed to load instant posts:', error);
      return {
        instant: [],
        loading: false,
        hasMore: false
      };
    }
  }

  // Get reels instantly like TikTok
  async getInstantReels(userId: string): Promise<FastLoadResult<Reel>> {
    const cachedResult = await InstantCache.getInstantReels();
    
    if (cachedResult.cached.length > 0) {
      if (cachedResult.needsRefresh && !this.backgroundLoading) {
        this.refreshReelsInBackground(userId);
      }
      
      // Preload media for instant viewing
      const mediaUrls = cachedResult.cached
        .map(reel => reel.videoUrl)
        .filter(Boolean);
      InstantCache.preloadMedia(mediaUrls);
      
      return {
        instant: cachedResult.cached,
        loading: false,
        hasMore: true
      };
    }

    try {
      const freshReels = await FirebaseService.getReels(userId, 5);
      await InstantCache.cacheReels(freshReels);
      
      // Preload video media immediately
      const mediaUrls = freshReels
        .map(reel => reel.videoUrl)
        .filter(Boolean);
      InstantCache.preloadMedia(mediaUrls);
      
      this.loadMoreReelsInBackground(userId, 5);
      
      return {
        instant: freshReels,
        loading: false,
        hasMore: true
      };
    } catch (error) {
      console.error('Failed to load instant reels:', error);
      return {
        instant: [],
        loading: false,
        hasMore: false
      };
    }
  }

  // Get stories instantly like Instagram
  async getInstantStories(userId: string): Promise<FastLoadResult<Story>> {
    const cachedResult = await InstantCache.getInstantStories();
    
    if (cachedResult.cached.length > 0) {
      if (cachedResult.needsRefresh && !this.backgroundLoading) {
        this.refreshStoriesInBackground(userId);
      }
      
      return {
        instant: cachedResult.cached,
        loading: false,
        hasMore: false // Stories don't paginate
      };
    }

    try {
      const freshStories = await FirebaseService.getFollowingUsersStories(userId);
      await InstantCache.cacheStories(freshStories);
      
      // Preload story media
      const mediaUrls = freshStories
        .map(story => story.mediaUrl)
        .filter(Boolean);
      InstantCache.preloadMedia(mediaUrls);
      
      return {
        instant: freshStories,
        loading: false,
        hasMore: false
      };
    } catch (error) {
      console.error('Failed to load instant stories:', error);
      return {
        instant: [],
        loading: false,
        hasMore: false
      };
    }
  }

  // Load more content seamlessly in background
  async loadMoreContent<T>(
    type: 'posts' | 'reels',
    userId: string,
    lastItem?: T,
    count: number = 10
  ): Promise<T[]> {
    try {
      let newItems: T[] = [];
      
      if (type === 'posts') {
        newItems = await FirebaseService.getMorePosts(userId, lastItem as any, count) as T[];
      } else if (type === 'reels') {
        newItems = await FirebaseService.getMoreReels(userId, lastItem as any, count) as T[];
      }

      return newItems;
    } catch (error) {
      console.error(`Failed to load more ${type}:`, error);
      return [];
    }
  }

  // Background refresh functions
  private async refreshPostsInBackground(userId?: string): Promise<void> {
    if (this.backgroundLoading) return;
    
    this.backgroundLoading = true;
    try {
      // Get latest posts without pagination (fresh feed)
      const freshPosts = await FirebaseService.getPosts(undefined, 20);
      await InstantCache.cachePosts(freshPosts);
      
      // Preload media for immediate viewing - handle both single mediaUrl and mediaUrls array
      const mediaUrls: string[] = [];
      freshPosts.slice(0, 5).forEach(post => {
        if (post.mediaUrl) {
          mediaUrls.push(post.mediaUrl);
        }
        if (post.mediaUrls && Array.isArray(post.mediaUrls)) {
          mediaUrls.push(...post.mediaUrls);
        }
      });
      
      if (mediaUrls.length > 0) {
        InstantCache.preloadMedia(mediaUrls);
      }
      
    } catch (error) {
      console.error('Background post refresh failed:', error);
    } finally {
      this.backgroundLoading = false;
    }
  }

  private async refreshReelsInBackground(userId: string): Promise<void> {
    if (this.backgroundLoading) return;
    
    this.backgroundLoading = true;
    try {
      const freshReels = await FirebaseService.getReels(userId, 20);
      await InstantCache.cacheReels(freshReels);
      
      // Preload video media for smooth playback
      const mediaUrls = freshReels
        .slice(0, 5)
        .map(reel => reel.videoUrl)
        .filter(Boolean);
      InstantCache.preloadMedia(mediaUrls);
      
    } catch (error) {
      console.error('Background reel refresh failed:', error);
    } finally {
      this.backgroundLoading = false;
    }
  }

  private async refreshStoriesInBackground(userId: string): Promise<void> {
    if (this.backgroundLoading) return;
    
    this.backgroundLoading = true;
    try {
      const freshStories = await FirebaseService.getFollowingUsersStories(userId);
      await InstantCache.cacheStories(freshStories);
      
      // Preload all story media since they're quick to view
      const mediaUrls = freshStories
        .map(story => story.mediaUrl)
        .filter(Boolean);
      InstantCache.preloadMedia(mediaUrls);
      
    } catch (error) {
      console.error('Background story refresh failed:', error);
    } finally {
      this.backgroundLoading = false;
    }
  }

  private async loadMorePostsInBackground(userId: string, offset: number): Promise<void> {
    setTimeout(async () => {
      try {
        const morePosts = await FirebaseService.getMorePosts(userId, undefined, 15);
        const allCached = await InstantCache.getInstantPosts();
        const combined = [...(allCached.cached || []), ...morePosts];
        await InstantCache.cachePosts(combined);
      } catch (error) {
        console.error('Background post loading failed:', error);
      }
    }, 500); // Load after 500ms
  }

  private async loadMoreReelsInBackground(userId: string, offset: number): Promise<void> {
    setTimeout(async () => {
      try {
        const moreReels = await FirebaseService.getMoreReels(userId, undefined, 15);
        const allCached = await InstantCache.getInstantReels();
        const combined = [...(allCached.cached || []), ...moreReels];
        await InstantCache.cacheReels(combined);
        
        // Preload next batch of videos
        const mediaUrls = moreReels
          .slice(0, 3)
          .map(reel => reel.videoUrl)
          .filter(Boolean);
        InstantCache.preloadMedia(mediaUrls);
        
      } catch (error) {
        console.error('Background reel loading failed:', error);
      }
    }, 300); // Load after 300ms for videos
  }

  // Start continuous background refresh like Instagram
  private startBackgroundRefresh(): void {
    // Refresh cache every 2 minutes when app is active
    setInterval(async () => {
      try {
        await InstantCache.clearExpiredCache();
      } catch (error) {
        console.error('Background cache cleanup failed:', error);
      }
    }, 2 * 60 * 1000); // 2 minutes
  }

  // Prefetch content for user's interests
  async prefetchUserContent(userId: string): Promise<void> {
    // This runs in background after app launch
    setTimeout(async () => {
      try {
        await Promise.all([
          this.refreshPostsInBackground(userId),
          this.refreshReelsInBackground(userId),
          this.refreshStoriesInBackground(userId)
        ]);
      } catch (error) {
        console.error('Content prefetch failed:', error);
      }
    }, 2000); // Wait 2 seconds after app launch
  }

  // Get service health status
  getServiceHealth(): any {
    return {
      initialized: this.isInitialized,
      backgroundLoading: this.backgroundLoading,
      cacheStats: InstantCache.getCacheStats(),
    };
  }
}

export const LightningFast = new LightningFastService();
