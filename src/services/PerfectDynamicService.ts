import { FirebaseService } from './firebaseService';
import { Post, Reel, Story } from '../types';
import { HyperSpeedService } from './HyperSpeedService';

/**
 * PerfectDynamicService - Everything loads dynamically from Firebase/DigitalOcean
 * No local storage, everything from cloud, perfectly fast
 */
export class PerfectDynamicService {
  private static instance: PerfectDynamicService;
  private static loadingStates = new Map<string, boolean>();
  private static refreshIntervals = new Map<string, NodeJS.Timeout>();

  static getInstance(): PerfectDynamicService {
    if (!PerfectDynamicService.instance) {
      PerfectDynamicService.instance = new PerfectDynamicService();
    }
    return PerfectDynamicService.instance;
  }

  /**
   * Initialize perfect dynamic system
   */
  static async initialize(): Promise<void> {
    console.log('🚀 Initializing Perfect Dynamic Service - Everything from Firebase/DigitalOcean!');
    
    try {
      // Start dynamic refresh streams
      this.startDynamicStreams();
      console.log('✅ Perfect Dynamic Service initialized');
    } catch (error) {
      console.error('❌ Perfect Dynamic Service failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Get posts perfectly dynamic from Firebase
   */
  static async getPerfectPosts(lastPostId?: string, limit: number = 10): Promise<{
    posts: Post[],
    hasMore: boolean,
    lastPostId?: string
  }> {
    const cacheKey = `perfect_posts_${lastPostId || 'start'}_${limit}`;
    
    if (this.loadingStates.get(cacheKey)) {
      console.log('⏳ Posts loading in progress...');
      await this.waitForOperation(cacheKey);
    }

    this.loadingStates.set(cacheKey, true);
    console.log(`🔄 Loading ${limit} posts dynamically from Firebase...`);

    try {
      // Get posts directly from Firebase with proper pagination fix
      const posts = await FirebaseService.getPosts(lastPostId, limit);
      
      if (posts.length === 0) {
        console.log('📭 No more posts available');
        return { posts: [], hasMore: false };
      }

      // Preload media for instant viewing
      this.preloadPostMedia(posts.slice(0, 5));

      const lastPost = posts[posts.length - 1];
      const hasMore = posts.length === limit;

      console.log(`✅ Loaded ${posts.length} posts perfectly from Firebase`);
      
      return {
        posts,
        hasMore,
        lastPostId: lastPost?.id
      };

    } catch (error) {
      console.error('❌ Perfect posts loading failed:', error);
      throw error;
    } finally {
      this.loadingStates.set(cacheKey, false);
    }
  }

  /**
   * Get reels perfectly dynamic from Firebase
   */
  static async getPerfectReels(limit: number = 10, lastDoc?: any, excludeUserId?: string): Promise<{
    reels: Reel[],
    hasMore: boolean,
    lastDoc?: any
  }> {
    const cacheKey = `perfect_reels_${limit}_${excludeUserId || 'all'}`;
    
    if (this.loadingStates.get(cacheKey)) {
      console.log('⏳ Reels loading in progress...');
      await this.waitForOperation(cacheKey);
    }

    this.loadingStates.set(cacheKey, true);
    console.log(`🔄 Loading ${limit} reels dynamically from Firebase...`);

    try {
      // Get reels directly from Firebase with proper parameters
      const reelsResult = await FirebaseService.getReels(limit, lastDoc, excludeUserId);
      
      if (reelsResult.reels.length === 0) {
        console.log('📭 No more reels available');
        return { reels: [], hasMore: false };
      }

      // Preload video media for smooth playback
      this.preloadReelMedia(reelsResult.reels.slice(0, 3));

      console.log(`✅ Loaded ${reelsResult.reels.length} reels perfectly from Firebase`);
      
      return {
        reels: reelsResult.reels,
        hasMore: reelsResult.hasMore,
        lastDoc: reelsResult.lastDoc
      };

    } catch (error) {
      console.error('❌ Perfect reels loading failed:', error);
      throw error;
    } finally {
      this.loadingStates.set(cacheKey, false);
    }
  }

  /**
   * Get stories perfectly dynamic from Firebase
   */
  static async getPerfectStories(userId?: string): Promise<Story[]> {
    const cacheKey = `perfect_stories_${userId || 'all'}`;
    
    if (this.loadingStates.get(cacheKey)) {
      console.log('⏳ Stories loading in progress...');
      await this.waitForOperation(cacheKey);
    }

    this.loadingStates.set(cacheKey, true);
    console.log('🔄 Loading stories dynamically from Firebase...');

    try {
      // Get stories directly from Firebase
      const stories = await FirebaseService.getStories(userId);
      
      if (stories.length === 0) {
        console.log('📭 No stories available');
        return [];
      }

      // Preload story media for instant viewing
      this.preloadStoryMedia(stories.slice(0, 10));

      console.log(`✅ Loaded ${stories.length} stories perfectly from Firebase`);
      return stories;

    } catch (error) {
      console.error('❌ Perfect stories loading failed:', error);
      throw error;
    } finally {
      this.loadingStates.set(cacheKey, false);
    }
  }

  /**
   * Search content perfectly dynamic
   */
  static async searchPerfectContent(query: string): Promise<{
    posts: Post[],
    users: any[]
  }> {
    console.log(`🔍 Searching dynamically for: "${query}"`);
    
    try {
      const [posts, users] = await Promise.all([
        FirebaseService.searchPosts(query, 20),
        FirebaseService.searchUsers(query, 15)
      ]);

      console.log(`✅ Search results: ${posts.length} posts, ${users.length} users`);
      
      return { posts, users };
    } catch (error) {
      console.error('❌ Perfect search failed:', error);
      throw error;
    }
  }

  /**
   * Get user content perfectly dynamic
   */
  static async getPerfectUserContent(userId: string): Promise<{
    posts: Post[],
    stories: Story[]
  }> {
    console.log(`🔄 Loading user content dynamically for ${userId}...`);
    
    try {
      const [userPosts, userStories] = await Promise.all([
        FirebaseService.getUserPosts(userId, 50),
        this.getPerfectStories(userId)
      ]);

      console.log(`✅ User content loaded: ${userPosts.length} posts, ${userStories.length} stories`);
      
      return {
        posts: userPosts,
        stories: userStories
      };
    } catch (error) {
      console.error('❌ Perfect user content loading failed:', error);
      throw error;
    }
  }

  /**
   * Refresh all content dynamically
   */
  static async refreshAllPerfectContent(): Promise<void> {
    console.log('🔄 Refreshing all content dynamically from Firebase...');
    
    try {
      const promises = [
        this.getPerfectPosts(undefined, 20),
        this.getPerfectReels(15),
        this.getPerfectStories()
      ];

      const [posts, reels, stories] = await Promise.all(promises);
      
      console.log('✅ All content refreshed perfectly:');
      console.log(`   📝 Posts: ${posts.posts.length}`);
      console.log(`   🎬 Reels: ${reels.reels.length}`);
      console.log(`   📖 Stories: ${stories.length}`);
    } catch (error) {
      console.error('❌ Perfect content refresh failed:', error);
      throw error;
    }
  }

  /**
   * Preload post media for instant viewing
   */
  private static preloadPostMedia(posts: Post[]): void {
    const mediaUrls: string[] = [];
    
    posts.forEach(post => {
      if (post.mediaUrls && Array.isArray(post.mediaUrls)) {
        mediaUrls.push(...post.mediaUrls);
      }
    });

    if (mediaUrls.length > 0) {
      HyperSpeedService.preloadMedia(mediaUrls);
      console.log(`⚡ Preloading ${mediaUrls.length} post media files`);
    }
  }

  /**
   * Preload reel media for smooth playback
   */
  private static preloadReelMedia(reels: Reel[]): void {
    const videoUrls = reels
      .map(reel => reel.videoUrl)
      .filter(Boolean);

    if (videoUrls.length > 0) {
      HyperSpeedService.preloadMedia(videoUrls);
      console.log(`⚡ Preloading ${videoUrls.length} reel videos`);
    }
  }

  /**
   * Preload story media for instant viewing
   */
  private static preloadStoryMedia(stories: Story[]): void {
    const mediaUrls = stories
      .map(story => story.mediaUrl)
      .filter(Boolean);

    if (mediaUrls.length > 0) {
      HyperSpeedService.preloadMedia(mediaUrls);
      console.log(`⚡ Preloading ${mediaUrls.length} story media files`);
    }
  }

  /**
   * Start dynamic content streams
   */
  private static startDynamicStreams(): void {
    // Auto-refresh posts every 30 seconds
    const postsInterval = setInterval(async () => {
      try {
        console.log('🔄 Auto-refreshing posts...');
        await this.getPerfectPosts(undefined, 10);
      } catch (error) {
        console.error('❌ Auto posts refresh failed:', error);
      }
    }, 30000);

    // Auto-refresh reels every 45 seconds
    const reelsInterval = setInterval(async () => {
      try {
        console.log('🔄 Auto-refreshing reels...');
        await this.getPerfectReels(10);
      } catch (error) {
        console.error('❌ Auto reels refresh failed:', error);
      }
    }, 45000);

    // Auto-refresh stories every 60 seconds
    const storiesInterval = setInterval(async () => {
      try {
        console.log('🔄 Auto-refreshing stories...');
        await this.getPerfectStories();
      } catch (error) {
        console.error('❌ Auto stories refresh failed:', error);
      }
    }, 60000);

    this.refreshIntervals.set('posts', postsInterval);
    this.refreshIntervals.set('reels', reelsInterval);
    this.refreshIntervals.set('stories', storiesInterval);
  }

  /**
   * Wait for operation to complete
   */
  private static async waitForOperation(cacheKey: string): Promise<void> {
    return new Promise((resolve) => {
      const checkOperation = () => {
        if (!this.loadingStates.get(cacheKey)) {
          resolve();
        } else {
          setTimeout(checkOperation, 100);
        }
      };
      checkOperation();
    });
  }

  /**
   * Cleanup perfect dynamic service
   */
  static cleanup(): void {
    console.log('🧹 Cleaning up Perfect Dynamic Service...');
    
    this.refreshIntervals.forEach(interval => {
      clearInterval(interval);
    });
    
    this.refreshIntervals.clear();
    this.loadingStates.clear();
    
    console.log('✅ Perfect Dynamic Service cleaned up');
  }
}
