/**
 * Instagram-Like Loading Service - Perfect Reels Experience
 * Fresh content loading with randomization like Instagram/TikTok
 */

import firestore from '@react-native-firebase/firestore';
import { Reel, Post } from './firebaseService';
import ComprehensivePrivacyService from './ComprehensivePrivacyService';

export class InstagramLikeLoadingService {
  private static instance: InstagramLikeLoadingService;
  private loadedReels = new Map<string, Reel>();
  private loadedPosts = new Map<string, Post>();
  private isLoadingReel = false;
  private isLoadingPost = false;
  private viewedReelIds = new Set<string>();
  private freshContentMode = false;
  private currentOffset = 0;
  private loadedReelIds = new Set<string>(); // Track all loaded reel IDs to prevent duplicates

  static getInstance(): InstagramLikeLoadingService {
    if (!InstagramLikeLoadingService.instance) {
      InstagramLikeLoadingService.instance = new InstagramLikeLoadingService();
    }
    return InstagramLikeLoadingService.instance;
  }

  async initialize(): Promise<void> {
    console.log('🚀 Instagram-like Perfect Reels Service initialized');
  }

  /**
   * Enable fresh content mode for new session
   */
  enableFreshContent(): void {
    this.freshContentMode = true;
    this.viewedReelIds.clear();
    this.loadedReels.clear();
    this.loadedReelIds.clear(); // Clear loaded IDs for fresh start
    this.currentOffset = 0;
    console.log('🎭 Fresh content mode enabled - new reels will be loaded');
  }

  /**
   * Load fresh random reels like Instagram algorithm
   */
  async loadFreshReels(userId: string, count: number = 2): Promise<Reel[]> {
    try {
      console.log(`🎭 Loading ${count} fresh random reels (Instagram-like)...`);

      // Mix of strategies for Instagram-like experience
      const strategies = [
        () => this.loadTrendingReels(userId, count),
        () => this.loadRecentReels(userId, count),
        () => this.loadRandomReels(userId, count),
      ];

      const strategyIndex = Math.floor(Math.random() * strategies.length);
      const selectedStrategy = strategies[strategyIndex];

      const reels = await selectedStrategy();
      
      // Filter out already viewed reels for freshness
      const freshReels = reels.filter(reel => !this.viewedReelIds.has(reel.id));
      
      // If not enough fresh reels, get more
      if (freshReels.length < count) {
        const additionalReels = await this.loadRandomReels(userId, count - freshReels.length);
        freshReels.push(...additionalReels);
      }

      // Mark as viewed
      freshReels.forEach(reel => this.viewedReelIds.add(reel.id));

      console.log(`✅ Loaded ${freshReels.length} fresh reels`);
      return freshReels.slice(0, count);

    } catch (error) {
      console.error('❌ Error loading fresh reels:', error);
      // Fallback to simple loading
      return this.loadInitialReels(userId);
    }
  }

  /**
   * Load trending reels (high engagement)
   */
  private async loadTrendingReels(userId: string, count: number): Promise<Reel[]> {
    try {
      const querySnapshot = await firestore()
        .collection('reels')
        .where('likesCount', '>=', 1)
        .orderBy('likesCount', 'desc')
        .orderBy('createdAt', 'desc')
        .limit(count * 2)
        .get();

      return this.processReelDocs(querySnapshot.docs, count);
    } catch (error) {
      // Fallback to recent reels if trending fails
      return this.loadRecentReels(userId, count);
    }
  }

  /**
   * Load recent reels (fresh content)
   */
  private async loadRecentReels(userId: string, count: number): Promise<Reel[]> {
    const querySnapshot = await firestore()
      .collection('reels')
      .orderBy('createdAt', 'desc')
      .limit(count * 2)
      .get();

    return this.processReelDocs(querySnapshot.docs, count);
  }

  /**
   * Load random reels for variety
   */
  private async loadRandomReels(userId: string, count: number): Promise<Reel[]> {
    const querySnapshot = await firestore()
      .collection('reels')
      .orderBy('createdAt', 'desc')
      .limit(count * 3) // Get more for randomization
      .get();

    // Shuffle the results for randomness
    const docs = querySnapshot.docs.sort(() => Math.random() - 0.5);
    return this.processReelDocs(docs, count);
  }

  /**
   * Process reel documents and add user data
   */
  private async processReelDocs(docs: any[], count: number): Promise<Reel[]> {
    if (docs.length === 0) return [];

    const reels = await Promise.all(
      docs.slice(0, count).map(async (doc) => {
        const reelData = { id: doc.id, ...doc.data() } as Reel;
        
        // Get user data
        try {
          const userDoc = await firestore()
            .collection('users')
            .doc(reelData.userId)
            .get();
          
          if (userDoc.exists) {
            reelData.user = userDoc.data() as any;
          }
        } catch (error) {
          console.warn('Failed to get user data for reel:', reelData.id);
        }

        // Cache this reel
        this.loadedReels.set(reelData.id, reelData);

        return reelData;
      })
    );

    return reels;
  }

  /**
   * Load only 1 reel initially for perfect instant display
   */
  async loadInitialReels(userId: string): Promise<Reel[]> {
    // If fresh content mode is enabled, load fresh reels
    if (this.freshContentMode) {
      return this.loadFreshReels(userId, 1);
    }

    // Default loading - ONLY 1 reel for instant perfect display
    try {
      console.log('🎬 Loading ONLY 1 reel for perfect instant display...');

      const querySnapshot = await firestore()
        .collection('reels')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (querySnapshot.empty) return [];

      return this.processReelDocs(querySnapshot.docs, 1);

    } catch (error) {
      console.error('❌ Error loading initial reel:', error);
      return [];
    }
  }

  /**
   * Load next single reel when user scrolls - PERFECT INFINITE SYSTEM
   */
  async loadNextReel(currentIndex: number, allReelIds: string[]): Promise<Reel | null> {
    if (this.isLoadingReel) return null;

    try {
      this.isLoadingReel = true;
      console.log(`🎬 Loading next reel for index ${currentIndex}...`);

      // Always load fresh reel from Firebase to prevent duplicates
      const freshReel = await this.loadSingleNewReel();
      
      if (freshReel && !this.loadedReelIds.has(freshReel.id)) {
        this.loadedReelIds.add(freshReel.id);
        this.loadedReels.set(freshReel.id, freshReel);
        console.log(`✅ Loaded fresh reel: ${freshReel.id}`);
        return freshReel;
      }

      // If we somehow got a duplicate, try again with different criteria
      return await this.loadAlternativeReel();

    } catch (error) {
      console.error('❌ Error loading next reel:', error);
      return null;
    } finally {
      this.isLoadingReel = false;
    }
  }

  /**
   * Load alternative reel to avoid duplicates
   */
  private async loadAlternativeReel(): Promise<Reel | null> {
    try {
      // Load with different sorting for variety
      const querySnapshot = await firestore()
        .collection('reels')
        .orderBy('likesCount', 'desc') // Different sorting
        .limit(20)
        .get();

      if (querySnapshot.empty) return null;

      // Find a reel we haven't loaded yet
      for (const doc of querySnapshot.docs) {
        if (!this.loadedReelIds.has(doc.id)) {
          const reels = await this.processReelDocs([doc], 1);
          if (reels.length > 0) {
            const reel = reels[0];
            this.loadedReelIds.add(reel.id);
            this.loadedReels.set(reel.id, reel);
            return reel;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error loading alternative reel:', error);
      return null;
    }
  }

  /**
   * Load a single new reel from Firebase with perfect variety
   */
  private async loadSingleNewReel(): Promise<Reel | null> {
    try {
      console.log('📥 Loading single new reel with variety...');

      // Use different strategies to ensure variety
      const strategies = [
        // Strategy 1: Recent reels
        () => firestore().collection('reels').orderBy('createdAt', 'desc').limit(30).get(),
        // Strategy 2: Popular reels
        () => firestore().collection('reels').orderBy('likesCount', 'desc').limit(30).get(),
        // Strategy 3: Random mix
        () => firestore().collection('reels').orderBy('viewsCount', 'desc').limit(30).get(),
      ];

      const strategyIndex = Math.floor(Math.random() * strategies.length);
      const querySnapshot = await strategies[strategyIndex]();

      if (querySnapshot.empty) {
        console.log('⚠️ No reels found, loading any available reel');
        return await this.loadAnyAvailableReel();
      }

      // Filter out already loaded reels and pick randomly
      const availableDocs = querySnapshot.docs.filter(doc => !this.loadedReelIds.has(doc.id));
      
      if (availableDocs.length === 0) {
        console.log('� All reels in batch already loaded, trying different batch');
        this.currentOffset += 30; // Move to next batch
        return await this.loadAnyAvailableReel();
      }

      const randomDoc = availableDocs[Math.floor(Math.random() * availableDocs.length)];
      const reels = await this.processReelDocs([randomDoc], 1);

      return reels.length > 0 ? reels[0] : null;

    } catch (error) {
      console.error('❌ Error loading new reel:', error);
      return await this.loadAnyAvailableReel();
    }
  }

  /**
   * Load any available reel as fallback
   */
  private async loadAnyAvailableReel(): Promise<Reel | null> {
    try {
      // Use different batch sizes to get variety
      const batchSize = Math.floor(Math.random() * 20) + 10; // 10-30 reels per batch
      
      const querySnapshot = await firestore()
        .collection('reels')
        .orderBy('createdAt', 'desc')
        .limit(batchSize)
        .get();

      if (querySnapshot.empty) {
        // Try with different ordering
        const retrySnapshot = await firestore()
          .collection('reels')
          .orderBy('likesCount', 'desc')
          .limit(50)
          .get();
        
        if (retrySnapshot.empty) return null;
        
        const randomDoc = retrySnapshot.docs[Math.floor(Math.random() * retrySnapshot.docs.length)];
        const reels = await this.processReelDocs([randomDoc], 1);
        return reels.length > 0 ? reels[0] : null;
      }

      // Find first reel that hasn't been loaded
      for (const doc of querySnapshot.docs) {
        if (!this.loadedReelIds.has(doc.id)) {
          const reels = await this.processReelDocs([doc], 1);
          if (reels.length > 0) {
            return reels[0];
          }
        }
      }

      // If all reels are loaded, clear the loaded set and start fresh
      if (this.loadedReelIds.size > 50) { // Reset after 50 reels to allow variety
        console.log('🔄 Resetting loaded reels for infinite variety');
        this.loadedReelIds.clear();
        this.loadedReels.clear();
      }

      // Try one more time with different sorting
      const finalSnapshot = await firestore()
        .collection('reels')
        .orderBy('viewsCount', 'desc')
        .limit(30)
        .get();

      if (!finalSnapshot.empty) {
        const randomDoc = finalSnapshot.docs[Math.floor(Math.random() * finalSnapshot.docs.length)];
        const reels = await this.processReelDocs([randomDoc], 1);
        return reels.length > 0 ? reels[0] : null;
      }

      return null;

    } catch (error) {
      console.error('❌ Error in fallback reel loading:', error);
      return null;
    }
  }

  /**
   * Load a specific reel by ID
   */
  private async loadSingleReelById(reelId: string): Promise<Reel | null> {
    if (this.isLoadingReel) return null;
    
    try {
      this.isLoadingReel = true;
      console.log(`📥 Loading reel: ${reelId}`);

      const doc = await firestore()
        .collection('reels')
        .doc(reelId)
        .get();

      if (!doc.exists) return null;

      const reels = await this.processReelDocs([doc], 1);
      return reels.length > 0 ? reels[0] : null;

    } catch (error) {
      console.error('❌ Error loading reel by ID:', error);
      return null;
    } finally {
      this.isLoadingReel = false;
    }
  }

  /**
   * Refresh service for new session
   */
  async refreshInBackground(): Promise<void> {
    console.log('🔄 Refreshing Instagram-like service...');
    this.enableFreshContent();
    
    // Clear caches
    this.loadedReels.clear();
    this.loadedPosts.clear();
  }

  // Post loading methods (simplified)
  async loadInitialPosts(userId: string): Promise<Post[]> {
    try {
      console.log('📰 Loading ONLY first 2 posts for instant display...');

      const querySnapshot = await firestore()
        .collection('posts')
        .orderBy('createdAt', 'desc')
        .limit(2)
        .get();

      if (querySnapshot.empty) return [];

      const posts = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const postData = { id: doc.id, ...doc.data() } as Post;
          
          // Get user data
          try {
            const userDoc = await firestore()
              .collection('users')
              .doc(postData.userId)
              .get();
            
            if (userDoc.exists) {
              postData.user = userDoc.data() as any;
            }
          } catch (error) {
            console.warn('Failed to get user data for post:', postData.id);
          }

          this.loadedPosts.set(postData.id, postData);
          return postData;
        })
      );

      console.log(`✅ Loaded ONLY ${posts.length} posts instantly!`);
      return posts;

    } catch (error) {
      console.error('❌ Error loading initial posts:', error);
      return [];
    }
  }

  async loadNextPost(currentIndex: number, allPostIds: string[]): Promise<Post | null> {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= allPostIds.length) {
      return await this.loadSingleNewPost();
    }

    const postId = allPostIds[nextIndex];
    if (this.loadedPosts.has(postId)) {
      return this.loadedPosts.get(postId) || null;
    }

    return await this.loadSinglePostById(postId);
  }

  private async loadSingleNewPost(): Promise<Post | null> {
    if (this.isLoadingPost) return null;
    
    try {
      this.isLoadingPost = true;
      console.log('📥 Loading single new post...');

      const querySnapshot = await firestore()
        .collection('posts')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      if (querySnapshot.empty) return null;

      const docs = querySnapshot.docs;
      const randomDoc = docs[Math.floor(Math.random() * docs.length)];
      const postData = { id: randomDoc.id, ...randomDoc.data() } as Post;
      
      // Get user data
      try {
        const userDoc = await firestore()
          .collection('users')
          .doc(postData.userId)
          .get();
        
        if (userDoc.exists) {
          postData.user = userDoc.data() as any;
        }
      } catch (error) {
        console.warn('Failed to get user data for post:', postData.id);
      }

      this.loadedPosts.set(postData.id, postData);
      return postData;

    } catch (error) {
      console.error('❌ Error loading new post:', error);
      return null;
    } finally {
      this.isLoadingPost = false;
    }
  }

  private async loadSinglePostById(postId: string): Promise<Post | null> {
    if (this.isLoadingPost) return null;
    
    try {
      this.isLoadingPost = true;
      console.log(`📥 Loading post: ${postId}`);

      const doc = await firestore()
        .collection('posts')
        .doc(postId)
        .get();

      if (!doc.exists) return null;

      const postData = { id: doc.id, ...doc.data() } as Post;
      
      // Get user data
      try {
        const userDoc = await firestore()
          .collection('users')
          .doc(postData.userId)
          .get();
        
        if (userDoc.exists) {
          postData.user = userDoc.data() as any;
        }
      } catch (error) {
        console.warn('Failed to get user data for post:', postData.id);
      }

      this.loadedPosts.set(postData.id, postData);
      return postData;

    } catch (error) {
      console.error('❌ Error loading post by ID:', error);
      return null;
    } finally {
      this.isLoadingPost = false;
    }
  }

  /**
   * Perfect Instagram/TikTok algorithm for loading initial reels
   */
  async loadReelsWithFollowingPriority(
    userId: string, 
    followingUserIds: string[], 
    count: number = 3,
    followingRatio: number = 0.7 // 70% from following, 30% discover
  ): Promise<Reel[]> {
    try {
      console.log(`🎯 Perfect Algorithm: Loading ${count} reels (${Math.round(followingRatio * 100)}% following)`);
      
      const reels: Reel[] = [];
      const targetFollowingCount = Math.floor(count * followingRatio);
      const targetDiscoverCount = count - targetFollowingCount;
      
      // INSTANT MODE: Load all recent reels without complex filters
      const allReelsSnapshot = await firestore()
        .collection('reels')
        .orderBy('createdAt', 'desc')
        .limit(200) // Large enough pool for instant algorithm
        .get();

      const allReels = allReelsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Reel))
        .filter(reel => !this.loadedReelIds.has(reel.id));

      // Apply privacy filtering using ComprehensivePrivacyService
      const privacyService = ComprehensivePrivacyService.getInstance();
      const visibleReels = await privacyService.filterReelsForUser(allReels, userId);

      // Separate following and discover content
      const followingReels = visibleReels.filter(reel => followingUserIds.includes(reel.userId));
      const discoverReels = visibleReels.filter(reel => !followingUserIds.includes(reel.userId));

      // Score and sort discover content by engagement
      const scoredDiscoverReels = discoverReels
        .map(reel => ({
          reel,
          score: this.calculateInterestScore(reel)
        }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.reel);

      // Mix following and high-scoring discover content
      let followingIndex = 0;
      let discoverIndex = 0;
      
      for (let i = 0; i < count && reels.length < count; i++) {
        let selectedReel: Reel | null = null;
        
        // Decide content type based on algorithm
        const shouldUseFollowing = Math.random() < followingRatio && 
                                  followingIndex < followingReels.length &&
                                  reels.filter(r => followingUserIds.includes(r.userId)).length < targetFollowingCount;
        
        if (shouldUseFollowing) {
          selectedReel = followingReels[followingIndex++];
          console.log('👥 Selected from following');
        } else if (discoverIndex < scoredDiscoverReels.length) {
          selectedReel = scoredDiscoverReels[discoverIndex++];
          console.log('🔥 Selected from discover (interest-based)');
        }
        
        if (selectedReel) {
          // Enrich with user data
          try {
            if (!selectedReel.user) {
              const userDoc = await firestore()
                .collection('users')
                .doc(selectedReel.userId)
                .get();
              
              if (userDoc.exists) {
                selectedReel.user = userDoc.data() as any;
              }
            }
            
            this.loadedReelIds.add(selectedReel.id);
            this.loadedReels.set(selectedReel.id, selectedReel);
            reels.push(selectedReel);
          } catch (error) {
            console.warn('Failed to enrich reel:', selectedReel.id);
          }
        }
      }
      
      console.log(`✅ Loaded ${reels.length} reels with perfect algorithm`);
      return reels;

    } catch (error) {
      console.error('❌ Error in perfect algorithm:', error);
      
      // Fallback: simple recent content - INSTANT MODE
      try {
        const fallbackReels = await firestore()
          .collection('reels')
          .orderBy('createdAt', 'desc')
          .limit(count)
          .get();

        const reels = fallbackReels.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Reel))
          .filter(reel => !this.loadedReelIds.has(reel.id))
          .slice(0, count);

        // Enrich with user data
        for (const reel of reels) {
          try {
            if (!reel.user) {
              const userDoc = await firestore()
                .collection('users')
                .doc(reel.userId)
                .get();
              
              if (userDoc.exists) {
                reel.user = userDoc.data() as any;
              }
            }
            this.loadedReelIds.add(reel.id);
            this.loadedReels.set(reel.id, reel);
          } catch (error) {
            console.warn('Failed to enrich fallback reel:', reel.id);
          }
        }
        
        console.log(`✅ Fallback: Loaded ${reels.length} reels`);
        return reels;
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Perfect Instagram/TikTok-like algorithm for loading next reel
   */
  async loadNextReelWithFollowingPriority(
    index: number,
    excludeIds: string[],
    userId: string,
    followingUserIds: string[],
    followingRatio: number = 0.6
  ): Promise<Reel | null> {
    try {
      console.log(`🎯 Instagram Algorithm: Loading reel ${index} (${Math.round(followingRatio * 100)}% following)`);
      
      // Perfect Instagram/TikTok algorithm: Following > Interest > Trending > Random
      const algorithmChoice = Math.random();
      
      if (algorithmChoice < followingRatio && followingUserIds.length > 0) {
        console.log('👥 Loading from following users...');
        const followingReel = await this.loadFromFollowingWithFallback(followingUserIds, excludeIds);
        if (followingReel) return followingReel;
      } else if (algorithmChoice < followingRatio + 0.25) {
        console.log('🔥 Loading interest-based content...');
        const interestReel = await this.loadInterestBasedContent(excludeIds, userId);
        if (interestReel) return interestReel;
      } else if (algorithmChoice < followingRatio + 0.4) {
        console.log('📈 Loading trending content...');
        const trendingReel = await this.loadTrendingContent(excludeIds);
        if (trendingReel) return trendingReel;
      }
      
      // Final fallback - general discover content
      console.log('🌍 Loading general discover content...');
      return await this.loadGeneralContent(excludeIds);

    } catch (error) {
      console.error('❌ Error in Instagram algorithm:', error);
      return await this.loadGeneralContent(excludeIds);
    }
  }

  private async loadFromFollowingWithFallback(followingUserIds: string[], excludeIds: string[]): Promise<Reel | null> {
    try {
      // Get all recent reels and filter for following
      const reelsSnapshot = await firestore()
        .collection('reels')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      // Filter for following users and not already loaded
      const followingReels = reelsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Reel))
        .filter(reel => 
          followingUserIds.includes(reel.userId) && 
          !excludeIds.includes(reel.id) && 
          !this.loadedReelIds.has(reel.id)
        );

      if (followingReels.length > 0) {
        // Prioritize most recent from following
        const selectedReel = followingReels[0];
        return await this.enrichReelWithUserData(selectedReel);
      }
      return null;
    } catch (error) {
      console.warn('Following loading failed:', error);
      return null;
    }
  }

  private async loadInterestBasedContent(excludeIds: string[], userId: string): Promise<Reel | null> {
    try {
      // Get recent content for interest analysis
      const reelsSnapshot = await firestore()
        .collection('reels')
        .orderBy('createdAt', 'desc')
        .limit(150)
        .get();

      const reels = reelsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Reel))
        .filter(reel => !excludeIds.includes(reel.id) && !this.loadedReelIds.has(reel.id));

      if (reels.length === 0) return null;

      // Score reels based on engagement and recency (Instagram/TikTok algorithm)
      const scoredReels = reels.map(reel => ({
        reel,
        score: this.calculateInterestScore(reel)
      }));

      // Sort by score with randomness for discovery
      scoredReels.sort((a, b) => {
        const scoreDiff = b.score - a.score;
        const randomFactor = (Math.random() - 0.5) * 3; // Add discovery randomness
        return scoreDiff + randomFactor;
      });

      // Pick from top scoring reels with some randomness
      const topReels = scoredReels.slice(0, Math.min(10, scoredReels.length));
      const randomIndex = Math.floor(Math.random() * topReels.length);
      return await this.enrichReelWithUserData(topReels[randomIndex].reel);

    } catch (error) {
      console.warn('Interest-based loading failed:', error);
      return null;
    }
  }

  private async loadTrendingContent(excludeIds: string[]): Promise<Reel | null> {
    try {
      // Get recent popular content (last 3 days for trending)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const reelsSnapshot = await firestore()
        .collection('reels')
        .orderBy('createdAt', 'desc')
        .limit(80)
        .get();

      const trendingReels = reelsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Reel))
        .filter(reel => {
          const reelDate = reel.createdAt instanceof Date ? reel.createdAt : new Date(reel.createdAt);
          return reelDate >= threeDaysAgo && 
                 !excludeIds.includes(reel.id) && 
                 !this.loadedReelIds.has(reel.id);
        })
        .sort((a, b) => {
          // Sort by engagement rate (likes + comments + views)
          const aEngagement = (a.likes?.length || 0) + (a.comments?.length || 0) * 2 + (a.views || 0) * 0.1;
          const bEngagement = (b.likes?.length || 0) + (b.comments?.length || 0) * 2 + (b.views || 0) * 0.1;
          return bEngagement - aEngagement;
        });

      if (trendingReels.length > 0) {
        // Select from top trending with randomness
        const topTrending = Math.min(8, trendingReels.length);
        const randomIndex = Math.floor(Math.random() * topTrending);
        return await this.enrichReelWithUserData(trendingReels[randomIndex]);
      }

      return null;
    } catch (error) {
      console.warn('Trending loading failed:', error);
      return null;
    }
  }

  private async loadGeneralContent(excludeIds: string[]): Promise<Reel | null> {
    try {
      const reelsSnapshot = await firestore()
        .collection('reels')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const availableReels = reelsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Reel))
        .filter(reel => !excludeIds.includes(reel.id) && !this.loadedReelIds.has(reel.id));

      if (availableReels.length > 0) {
        // Random selection with slight preference for recent content
        const recentCount = Math.min(15, availableReels.length);
        const randomIndex = Math.floor(Math.random() * recentCount);
        return await this.enrichReelWithUserData(availableReels[randomIndex]);
      }

      return null;
    } catch (error) {
      console.warn('General content loading failed:', error);
      return null;
    }
  }

  private calculateInterestScore(reel: Reel): number {
    let score = 0;

    // Recency boost (Instagram prioritizes recent content)
    const reelDate = reel.createdAt instanceof Date ? reel.createdAt : new Date(reel.createdAt);
    const hoursOld = (Date.now() - reelDate.getTime()) / (1000 * 60 * 60);
    score += Math.max(0, 20 - hoursOld / 12); // Higher score for content < 10 days old

    // Engagement score (TikTok/Instagram algorithm)
    const likes = reel.likes?.length || 0;
    const comments = reel.comments?.length || 0;
    const views = reel.views || 0;
    const shares = reel.shares || 0;

    // Weighted engagement (comments and shares are most valuable)
    score += Math.log(likes + 1) * 2;
    score += Math.log(comments + 1) * 5; // Comments indicate high engagement
    score += Math.log(shares + 1) * 8; // Shares are super valuable
    score += Math.log(views + 1) * 0.3;

    // Completion rate estimate (longer videos that are engaging)
    if (reel.duration && reel.duration > 0) {
      const estimatedCompletionRate = Math.min(1, (views * 0.7) / (likes + comments + 1));
      score += estimatedCompletionRate * 5;
    }

    // Content quality indicators
    if (reel.caption && reel.caption.length > 20) score += 2;
    if (reel.music) score += 1; // Music indicates higher production value
    if (reel.duration && reel.duration > 15 && reel.duration < 60) score += 1; // Sweet spot

    // Boost for creators with consistent engagement
    const avgEngagement = (likes + comments * 2) / Math.max(1, views * 0.01);
    if (avgEngagement > 5) score += 3;

    // Add controlled randomness for discovery (Instagram's secret sauce)
    score += Math.random() * 8;

    return Math.max(0, score);
  }

  /**
   * Check if user can view a reel based on privacy settings
   */
  private async canUserViewReel(reel: Reel, currentUserId: string, followingUserIds: string[]): Promise<boolean> {
    const privacyService = ComprehensivePrivacyService.getInstance();
    return await privacyService.canViewSpecificReel(reel, currentUserId);
  }

  private async enrichReelWithUserData(reel: Reel): Promise<Reel> {
    try {
      if (!reel.user) {
        const userDoc = await firestore()
          .collection('users')
          .doc(reel.userId)
          .get();
        
        if (userDoc.exists) {
          reel.user = userDoc.data() as any;
        }
      }

      this.loadedReelIds.add(reel.id);
      this.loadedReels.set(reel.id, reel);
      console.log(`✅ Perfect Algorithm: Loaded reel ${reel.id} (score-based)`);
      return reel;
    } catch (error) {
      console.warn('Failed to enrich reel with user data:', reel.id);
      this.loadedReelIds.add(reel.id);
      this.loadedReels.set(reel.id, reel);
      return reel;
    }
  }
}

export default InstagramLikeLoadingService;
