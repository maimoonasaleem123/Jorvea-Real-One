/**
 * Super Fast Search Service
 * Instagram-like search optimization with thumbnail loading and instant navigation
 * - Lightning-fast thumbnail loading
 * - Instant reel/post opening
 * - Memory-efficient content management
 * - Smart preloading and caching
 */

import firestore from '@react-native-firebase/firestore';
import { Post, User, Reel } from '../types';

export interface SearchThumbnail {
  id: string;
  type: 'reel' | 'post';
  thumbnailUrl: string;
  title?: string;
  username: string;
  userId: string;
  likesCount: number;
  viewsCount?: number;
  aspectRatio?: number;
  originalData?: Post | Reel; // Full data loaded on demand
}

export interface FastSearchResult {
  thumbnails: SearchThumbnail[];
  hasMore: boolean;
  nextPageToken?: string;
}

export interface SearchConfig {
  thumbnailSize: 'small' | 'medium' | 'large';
  loadingStrategy: 'lazy' | 'eager';
  cacheSize: number; // Number of items to cache
  preloadCount: number; // Items to preload ahead
}

class SuperFastSearchService {
  private static instance: SuperFastSearchService;
  
  // Search cache for instant results
  private thumbnailCache: Map<string, SearchThumbnail[]> = new Map();
  private userCache: Map<string, User[]> = new Map();
  private fullDataCache: Map<string, Post | Reel> = new Map();
  
  // Configuration
  private config: SearchConfig = {
    thumbnailSize: 'medium',
    loadingStrategy: 'lazy',
    cacheSize: 200, // Cache 200 thumbnails
    preloadCount: 20 // Preload 20 items ahead
  };

  // Performance tracking
  private loadStartTime = 0;
  private lastSearchQuery = '';
  
  private constructor() {
    this.initializeCache();
  }

  public static getInstance(): SuperFastSearchService {
    if (!SuperFastSearchService.instance) {
      SuperFastSearchService.instance = new SuperFastSearchService();
    }
    return SuperFastSearchService.instance;
  }

  /**
   * Initialize cache with popular content for instant display
   */
  private async initializeCache(): Promise<void> {
    try {
      console.log('🚀 Initializing Super Fast Search cache...');
      
      // Load popular content thumbnails for instant display
      const popularThumbnails = await this.loadPopularThumbnails(20);
      this.thumbnailCache.set('popular', popularThumbnails);
      
      console.log('✅ Fast search cache initialized with', popularThumbnails.length, 'thumbnails');
    } catch (error) {
      console.error('❌ Cache initialization failed:', error);
    }
  }

  /**
   * Get explore content thumbnails super fast
   */
  public async getExploreThumbnails(
    limit: number = 30,
    contentType: 'all' | 'reels' | 'posts' = 'all',
    pageToken?: string
  ): Promise<FastSearchResult> {
    const startTime = Date.now();
    console.log('⚡ Loading explore thumbnails super fast...');

    try {
      // Check cache first for instant results
      const cacheKey = `explore_${contentType}_${limit}`;
      const cached = this.thumbnailCache.get(cacheKey);
      
      if (cached && !pageToken) {
        console.log('🔥 INSTANT cache hit! Loaded in', Date.now() - startTime, 'ms');
        return {
          thumbnails: cached,
          hasMore: true,
          nextPageToken: 'cached_content'
        };
      }

      // Load from Firebase with optimization
      const thumbnails: SearchThumbnail[] = [];
      
      if (contentType === 'all' || contentType === 'reels') {
        const reelThumbnails = await this.loadReelThumbnails(Math.ceil(limit * 0.7)); // 70% reels
        thumbnails.push(...reelThumbnails);
      }
      
      if (contentType === 'all' || contentType === 'posts') {
        const postThumbnails = await this.loadPostThumbnails(Math.ceil(limit * 0.3)); // 30% posts
        thumbnails.push(...postThumbnails);
      }

      // Shuffle for Instagram-like mixed content
      const shuffledThumbnails = this.shuffleArray(thumbnails).slice(0, limit);
      
      // Cache results for instant future access
      this.thumbnailCache.set(cacheKey, shuffledThumbnails);
      
      console.log('✅ Super fast loading completed in', Date.now() - startTime, 'ms');
      
      return {
        thumbnails: shuffledThumbnails,
        hasMore: thumbnails.length >= limit,
        nextPageToken: `page_${Date.now()}`
      };

    } catch (error) {
      console.error('❌ Error loading explore thumbnails:', error);
      
      // Fallback to cached popular content
      const fallback = this.thumbnailCache.get('popular') || [];
      return {
        thumbnails: fallback,
        hasMore: false
      };
    }
  }

  /**
   * Load reel thumbnails with optimization
   */
  private async loadReelThumbnails(limit: number): Promise<SearchThumbnail[]> {
    try {
      const reelsQuery = await firestore()
        .collection('reels')
        .where('isActive', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const thumbnails: SearchThumbnail[] = [];

      for (const doc of reelsQuery.docs) {
        const reel = { id: doc.id, ...doc.data() } as Reel;
        
        // Get user info efficiently
        const userInfo = await this.getUserInfoFast(reel.userId);
        
        const thumbnail: SearchThumbnail = {
          id: reel.id,
          type: 'reel',
          thumbnailUrl: reel.thumbnailUrl || reel.videoUrl,
          title: reel.caption,
          username: userInfo?.username || 'Unknown',
          userId: reel.userId,
          likesCount: reel.likesCount || 0,
          viewsCount: reel.viewsCount || 0,
          aspectRatio: 9/16, // Standard reel aspect ratio
          originalData: reel
        };

        thumbnails.push(thumbnail);
      }

      return thumbnails;
    } catch (error) {
      console.error('Error loading reel thumbnails:', error);
      return [];
    }
  }

  /**
   * Load post thumbnails with optimization
   */
  private async loadPostThumbnails(limit: number): Promise<SearchThumbnail[]> {
    try {
      const postsQuery = await firestore()
        .collection('posts')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const thumbnails: SearchThumbnail[] = [];

      for (const doc of postsQuery.docs) {
        const post = { id: doc.id, ...doc.data() } as Post;
        
        // Get user info efficiently
        const userInfo = await this.getUserInfoFast(post.userId);
        
        // Use first image as thumbnail
        const thumbnailUrl = post.images && post.images.length > 0 ? post.images[0] : '';
        
        if (thumbnailUrl) {
          const thumbnail: SearchThumbnail = {
            id: post.id,
            type: 'post',
            thumbnailUrl,
            title: post.caption,
            username: userInfo?.username || 'Unknown',
            userId: post.userId,
            likesCount: post.likesCount || 0,
            aspectRatio: 1, // Square posts
            originalData: post
          };

          thumbnails.push(thumbnail);
        }
      }

      return thumbnails;
    } catch (error) {
      console.error('Error loading post thumbnails:', error);
      return [];
    }
  }

  /**
   * Get user info with caching for speed
   */
  private async getUserInfoFast(userId: string): Promise<User | null> {
    try {
      // Check cache first
      const cached = this.userCache.get(userId);
      if (cached && cached.length > 0) {
        return cached[0];
      }

      // Load from Firebase
      const userDoc = await firestore().collection('users').doc(userId).get();
      if (userDoc.exists) {
        const user = { uid: userDoc.id, ...userDoc.data() } as User;
        
        // Cache for future use
        this.userCache.set(userId, [user]);
        
        return user;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user info:', error);
      return null;
    }
  }

  /**
   * Search users super fast with caching
   */
  public async searchUsers(query: string, limit: number = 20): Promise<User[]> {
    const startTime = Date.now();
    console.log('🔍 Searching users super fast:', query);

    try {
      // Normalize query
      const normalizedQuery = query.toLowerCase().trim();
      
      // Check cache for instant results
      const cacheKey = `users_${normalizedQuery}`;
      const cached = this.userCache.get(cacheKey);
      
      if (cached) {
        console.log('🔥 INSTANT user search cache hit! Loaded in', Date.now() - startTime, 'ms');
        return cached;
      }

      // Search Firebase
      const usersQuery = await firestore()
        .collection('users')
        .where('username', '>=', normalizedQuery)
        .where('username', '<=', normalizedQuery + '\uf8ff')
        .limit(limit)
        .get();

      const users: User[] = usersQuery.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as User));

      // Also search by display name
      const displayNameQuery = await firestore()
        .collection('users')
        .where('displayName', '>=', normalizedQuery)
        .where('displayName', '<=', normalizedQuery + '\uf8ff')
        .limit(limit)
        .get();

      const displayNameUsers: User[] = displayNameQuery.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as User));

      // Combine and deduplicate
      const allUsers = [...users, ...displayNameUsers];
      const uniqueUsers = allUsers.filter((user, index, self) => 
        index === self.findIndex(u => u.uid === user.uid)
      );

      // Cache results
      this.userCache.set(cacheKey, uniqueUsers);
      
      console.log('✅ User search completed in', Date.now() - startTime, 'ms');
      return uniqueUsers.slice(0, limit);

    } catch (error) {
      console.error('❌ Error searching users:', error);
      return [];
    }
  }

  /**
   * Get full content data on demand (for instant opening)
   */
  public async getFullContentData(id: string, type: 'reel' | 'post'): Promise<Post | Reel | null> {
    try {
      // Check cache first
      const cached = this.fullDataCache.get(id);
      if (cached) {
        return cached;
      }

      // Load from Firebase
      const collection = type === 'reel' ? 'reels' : 'posts';
      const doc = await firestore().collection(collection).doc(id).get();
      
      if (doc.exists) {
        const data = { id: doc.id, ...doc.data() } as Post | Reel;
        
        // Cache for future use
        this.fullDataCache.set(id, data);
        
        return data;
      }

      return null;
    } catch (error) {
      console.error('Error loading full content data:', error);
      return null;
    }
  }

  /**
   * Preload content for smooth navigation
   */
  public async preloadContentForNavigation(
    thumbnails: SearchThumbnail[], 
    startIndex: number = 0
  ): Promise<void> {
    try {
      const preloadCount = Math.min(this.config.preloadCount, thumbnails.length - startIndex);
      const preloadPromises: Promise<void>[] = [];

      for (let i = startIndex; i < startIndex + preloadCount; i++) {
        const thumbnail = thumbnails[i];
        if (thumbnail && !this.fullDataCache.has(thumbnail.id)) {
          preloadPromises.push(
            this.getFullContentData(thumbnail.id, thumbnail.type).then(() => {})
          );
        }
      }

      await Promise.allSettled(preloadPromises);
      console.log('✅ Preloaded', preloadCount, 'items for smooth navigation');
    } catch (error) {
      console.warn('⚠️ Preloading failed:', error);
    }
  }

  /**
   * Load popular content for initial cache
   */
  private async loadPopularThumbnails(limit: number): Promise<SearchThumbnail[]> {
    try {
      // Load most liked reels and posts
      const [popularReels, popularPosts] = await Promise.all([
        this.loadReelThumbnails(Math.ceil(limit * 0.7)),
        this.loadPostThumbnails(Math.ceil(limit * 0.3))
      ]);

      return this.shuffleArray([...popularReels, ...popularPosts]).slice(0, limit);
    } catch (error) {
      console.error('Error loading popular thumbnails:', error);
      return [];
    }
  }

  /**
   * Shuffle array for mixed content display
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
   * Clear cache to free memory
   */
  public clearCache(): void {
    this.thumbnailCache.clear();
    this.userCache.clear();
    this.fullDataCache.clear();
    console.log('🗑️ Search cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    thumbnails: number;
    users: number;
    fullData: number;
    totalMemoryEstimate: string;
  } {
    return {
      thumbnails: this.thumbnailCache.size,
      users: this.userCache.size,
      fullData: this.fullDataCache.size,
      totalMemoryEstimate: `~${(this.thumbnailCache.size * 0.1 + this.fullDataCache.size * 0.5).toFixed(1)}MB`
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<SearchConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Search config updated:', this.config);
  }
}

export default SuperFastSearchService;
