import AsyncStorage from '@react-native-async-storage/async-storage';
import FirebaseService, { Post, Reel } from './firebaseService';
import { User } from '../types';
import HyperSpeedService from './HyperSpeedService';
import DynamicFirebaseService from './DynamicFirebaseService';

interface UserInteraction {
  userId: string;
  contentId: string;
  contentType: 'post' | 'reel';
  action: 'like' | 'unlike' | 'comment' | 'share' | 'view' | 'skip' | 'save' | 'follow' | 'unfollow';
  timestamp: number;
  duration?: number; // For reels, how long they watched
}

interface UserPreferences {
  interests: string[];
  favoriteCreators: string[];
  preferredContentTypes: ('post' | 'reel')[];
  lastUpdated: number;
}

interface ContentScore {
  contentId: string;
  score: number;
  reasons: string[];
}

export class SmartAlgorithmService {
  private static readonly INTERACTION_KEY = '@jorvea_user_interactions';
  private static readonly PREFERENCES_KEY = '@jorvea_user_preferences';
  private static readonly CACHE_KEY = '@jorvea_algorithm_cache';
  
  // Scoring weights (Instagram/TikTok-like)
  private static readonly WEIGHTS = {
    FOLLOWING: 100,      // Content from followed users gets highest priority
    RECENT: 50,          // Recent content is prioritized
    ENGAGEMENT: 30,      // High engagement content
    INTERACTION_HISTORY: 40, // User's past interactions
    CREATOR_PREFERENCE: 35,  // Favorite creators
    CONTENT_TYPE_MATCH: 25,  // User's preferred content types
    FRESHNESS: 45,       // New content from followed users
    DISCOVERY: 15,       // Random discovery element
    WATCH_TIME: 60,      // For reels - how long user watched
    COMPLETION_RATE: 40, // Did user watch full reel
  };

  // Instagram/TikTok-style content algorithm with HYPER SPEED
  static async getPersonalizedFeed(userId: string, contentType: 'posts' | 'reels' | 'mixed', limit: number = 20): Promise<(Post | Reel)[]> {
    try {
      console.log('🎯 SmartAlgorithm: Generating HYPER-SPEED personalized feed for user:', userId);

      // CHECK HYPERSPEED CACHE FIRST - INSTANT LOADING!
      const cacheKey = `personalized_${contentType}_${userId}_${limit}`;
      let cachedFeed = await HyperSpeedService.getData<(Post | Reel)[]>(cacheKey);
      
      if (cachedFeed && cachedFeed.length > 0) {
        console.log(`⚡ INSTANT LOAD: ${cachedFeed.length} ${contentType} from HyperSpeed cache`);
        
        // Update in background for next time
        this.updateFeedInBackground(userId, contentType, limit, cacheKey);
        
        return cachedFeed;
      }

      // Generate new feed with dynamic Firebase
      console.log('🧠 Generating new personalized feed...');

      // Get user's following list (highest priority)
      const following = await FirebaseService.getFollowing(userId);
      const followingIds = following.map(user => user.uid);
      
      // Get user interactions and preferences
      const [interactions, preferences] = await Promise.all([
        this.getUserInteractions(userId),
        this.getUserPreferences(userId)
      ]);

      let allContent: (Post | Reel)[] = [];

      // Get content based on type - use Dynamic Firebase for speed
      if (contentType === 'posts' || contentType === 'mixed') {
        try {
          const posts = await DynamicFirebaseService.getDynamicPosts(userId, undefined, 50);
          allContent.push(...(posts as unknown as (Post | Reel)[]));
        } catch (error) {
          // Fallback to regular Firebase
          const posts = await FirebaseService.getPosts(undefined, 50);
          allContent.push(...posts);
        }
      }
      
      if (contentType === 'reels' || contentType === 'mixed') {
        try {
          const reels = await DynamicFirebaseService.getDynamicReels(userId, undefined, 50);
          allContent.push(...(reels as unknown as (Post | Reel)[]));
        } catch (error) {
          // Fallback to regular Firebase  
          const reels = await FirebaseService.getRecommendedReels(userId, 50);
          allContent.push(...reels);
        }
      }

      console.log('📊 SmartAlgorithm: Total content loaded:', allContent.length);

      // Score each piece of content
      const scoredContent = await Promise.all(
        allContent.map(async (content) => {
          const score = await this.calculateContentScore(
            content,
            userId,
            followingIds,
            interactions,
            preferences
          );
          return { content, score };
        })
      );

      // Sort by score and apply Instagram-like distribution
      const sortedContent = scoredContent
        .sort((a, b) => b.score - a.score)
        .map(item => item.content);

      // Apply Instagram distribution: 70% following, 30% discovery
      const result = this.applyInstagramDistribution(sortedContent, followingIds, limit);

      console.log('✅ SmartAlgorithm: Final feed generated with', result.length, 'items');
      return result;

    } catch (error) {
      console.error('❌ SmartAlgorithm: Error generating personalized feed:', error);
      // Fallback to basic content
      return contentType === 'posts' 
        ? await FirebaseService.getPosts(undefined, limit)
        : await FirebaseService.getRecommendedReels(userId, limit);
    }
  }

  // Instagram-style distribution algorithm
  private static applyInstagramDistribution(
    content: (Post | Reel)[], 
    followingIds: string[], 
    limit: number
  ): (Post | Reel)[] {
    const followingContent = content.filter(item => followingIds.includes(item.userId));
    const discoveryContent = content.filter(item => !followingIds.includes(item.userId));

    const followingLimit = Math.ceil(limit * 0.7); // 70% from following
    const discoveryLimit = limit - followingLimit;  // 30% discovery

    const selectedFollowing = followingContent.slice(0, followingLimit);
    const selectedDiscovery = discoveryContent.slice(0, discoveryLimit);

    // Interleave content for natural feed feel
    const result: (Post | Reel)[] = [];
    const maxLength = Math.max(selectedFollowing.length, selectedDiscovery.length);

    for (let i = 0; i < maxLength; i++) {
      // Add 2-3 following posts, then 1 discovery post
      if (i < selectedFollowing.length) {
        result.push(selectedFollowing[i]);
      }
      if (i + 1 < selectedFollowing.length && result.length < limit) {
        result.push(selectedFollowing[i + 1]);
      }
      if (i < selectedDiscovery.length && result.length < limit) {
        result.push(selectedDiscovery[i]);
      }
    }

    return result.slice(0, limit);
  }

  // Advanced content scoring algorithm (Instagram/TikTok-like)
  private static async calculateContentScore(
    content: Post | Reel,
    userId: string,
    followingIds: string[],
    interactions: UserInteraction[],
    preferences: UserPreferences
  ): Promise<number> {
    let score = 0;
    const reasons: string[] = [];

    // 1. FOLLOWING BOOST (Instagram's primary factor)
    if (followingIds.includes(content.userId)) {
      score += this.WEIGHTS.FOLLOWING;
      reasons.push('following');
    }

    // 2. RECENCY BOOST (TikTok's freshness factor)
    const hoursOld = (Date.now() - new Date(content.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursOld < 1) {
      score += this.WEIGHTS.RECENT * 1.5; // Super fresh
      reasons.push('very_recent');
    } else if (hoursOld < 24) {
      score += this.WEIGHTS.RECENT;
      reasons.push('recent');
    } else if (hoursOld < 168) { // 1 week
      score += this.WEIGHTS.RECENT * 0.5;
      reasons.push('this_week');
    }

    // 3. ENGAGEMENT SCORE
    const likesCount = content.likesCount || 0;
    const commentsCount = content.commentsCount || 0;
    const sharesCount = content.sharesCount || 0;
    const viewsCount = (content as Reel).viewsCount || 0;

    const engagementScore = Math.log(
      (likesCount * 1) + 
      (commentsCount * 3) + 
      (sharesCount * 5) + 
      (viewsCount * 0.1) + 1
    ) * this.WEIGHTS.ENGAGEMENT;
    
    score += engagementScore;
    reasons.push(`engagement_${Math.round(engagementScore)}`);

    // 4. USER INTERACTION HISTORY
    const userInteractionsWithCreator = interactions.filter(
      i => i.userId === content.userId
    );
    
    if (userInteractionsWithCreator.length > 0) {
      const positiveInteractions = userInteractionsWithCreator.filter(
        i => ['like', 'comment', 'share'].includes(i.action)
      ).length;
      
      score += (positiveInteractions / userInteractionsWithCreator.length) * this.WEIGHTS.INTERACTION_HISTORY;
      reasons.push('positive_history');
    }

    // 5. FAVORITE CREATORS BOOST
    if (preferences.favoriteCreators.includes(content.userId)) {
      score += this.WEIGHTS.CREATOR_PREFERENCE;
      reasons.push('favorite_creator');
    }

    // 6. CONTENT TYPE PREFERENCE
    const contentType = 'videoUrl' in content ? 'reel' : 'post';
    if (preferences.preferredContentTypes.includes(contentType)) {
      score += this.WEIGHTS.CONTENT_TYPE_MATCH;
      reasons.push('preferred_type');
    }

    // 7. NEW CONTENT FROM FOLLOWED USERS (Instagram priority)
    if (followingIds.includes(content.userId) && hoursOld < 24) {
      score += this.WEIGHTS.FRESHNESS;
      reasons.push('fresh_following');
    }

    // 8. DISCOVERY RANDOMNESS (TikTok's surprise element)
    if (!followingIds.includes(content.userId)) {
      score += Math.random() * this.WEIGHTS.DISCOVERY;
      reasons.push('discovery');
    }

    // 9. REEL-SPECIFIC SCORING (TikTok-like)
    if ('videoUrl' in content) {
      const reel = content as Reel;
      
      // Watch time boost
      const avgWatchTime = this.getAverageWatchTime(userId, reel.id, interactions);
      if (avgWatchTime > 0.7) { // Watched more than 70%
        score += this.WEIGHTS.WATCH_TIME;
        reasons.push('high_completion');
      }

      // Duration preference
      const duration = reel.duration || 30;
      if (duration >= 15 && duration <= 60) { // Sweet spot for engagement
        score += 10;
        reasons.push('optimal_duration');
      }
    }

    // 10. HASHTAG MATCHING (Interest-based)
    const contentHashtags = (content as any).hashtags || [];
    const matchingInterests = preferences.interests.filter(interest =>
      contentHashtags.some((tag: string) => tag.toLowerCase().includes(interest.toLowerCase()))
    );
    
    score += matchingInterests.length * 8;
    if (matchingInterests.length > 0) {
      reasons.push('interest_match');
    }

    console.log(`📊 Content ${content.id} scored ${Math.round(score)} points:`, reasons.join(', '));
    return score;
  }

  // Track user interactions (Instagram/TikTok analytics)
  static async trackUserInteraction(
    userId: string,
    contentId: string,
    contentType: 'post' | 'reel',
    action: 'like' | 'unlike' | 'comment' | 'share' | 'view' | 'skip' | 'save' | 'follow' | 'unfollow',
    duration?: number
  ): Promise<void> {
    try {
      const interaction: UserInteraction = {
        userId,
        contentId,
        contentType,
        action,
        timestamp: Date.now(),
        duration
      };

      const interactions = await this.getUserInteractions(userId);
      const updatedInteractions = [...interactions, interaction];
      
      // Keep only last 1000 interactions
      const trimmedInteractions = updatedInteractions.slice(-1000);
      
      await AsyncStorage.setItem(
        `${this.INTERACTION_KEY}_${userId}`, 
        JSON.stringify(trimmedInteractions)
      );

      // Update user preferences based on interactions
      await this.updateUserPreferences(userId, interaction);

    } catch (error) {
      console.error('❌ Error tracking user interaction:', error);
    }
  }

  // Get user interactions
  private static async getUserInteractions(userId: string): Promise<UserInteraction[]> {
    try {
      const data = await AsyncStorage.getItem(`${this.INTERACTION_KEY}_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ Error getting user interactions:', error);
      return [];
    }
  }

  // Update user preferences based on behavior
  private static async updateUserPreferences(userId: string, interaction: UserInteraction): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);
      
      // Update based on positive interactions
      if (['like', 'comment', 'share'].includes(interaction.action)) {
        // Add content creator to favorites if frequently liked
        const creatorInteractions = await this.getUserInteractions(userId);
        const creatorCount = creatorInteractions.filter(
          i => i.userId === interaction.userId && ['like', 'comment', 'share'].includes(i.action)
        ).length;
        
        if (creatorCount >= 3 && !preferences.favoriteCreators.includes(interaction.userId)) {
          preferences.favoriteCreators.push(interaction.userId);
        }

        // Update preferred content types
        if (!preferences.preferredContentTypes.includes(interaction.contentType)) {
          preferences.preferredContentTypes.push(interaction.contentType);
        }
      }

      preferences.lastUpdated = Date.now();
      
      await AsyncStorage.setItem(
        `${this.PREFERENCES_KEY}_${userId}`,
        JSON.stringify(preferences)
      );

    } catch (error) {
      console.error('❌ Error updating user preferences:', error);
    }
  }

  // Get user preferences
  private static async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      const data = await AsyncStorage.getItem(`${this.PREFERENCES_KEY}_${userId}`);
      const defaultPreferences: UserPreferences = {
        interests: [],
        favoriteCreators: [],
        preferredContentTypes: ['post', 'reel'],
        lastUpdated: Date.now()
      };
      
      return data ? { ...defaultPreferences, ...JSON.parse(data) } : defaultPreferences;
    } catch (error) {
      console.error('❌ Error getting user preferences:', error);
      return {
        interests: [],
        favoriteCreators: [],
        preferredContentTypes: ['post', 'reel'],
        lastUpdated: Date.now()
      };
    }
  }

  // Calculate average watch time for reels
  private static getAverageWatchTime(userId: string, reelId: string, interactions: UserInteraction[]): number {
    const reelViews = interactions.filter(
      i => i.contentId === reelId && i.action === 'view' && i.duration
    );
    
    if (reelViews.length === 0) return 0;
    
    const totalWatchTime = reelViews.reduce((sum, view) => sum + (view.duration || 0), 0);
    return totalWatchTime / reelViews.length;
  }

  // Clear user data (for privacy)
  static async clearUserData(userId: string): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(`${this.INTERACTION_KEY}_${userId}`),
        AsyncStorage.removeItem(`${this.PREFERENCES_KEY}_${userId}`),
        AsyncStorage.removeItem(`${this.CACHE_KEY}_${userId}`)
      ]);
    } catch (error) {
      console.error('❌ Error clearing user data:', error);
    }
  }

  // Get content insights for creators
  static async getContentInsights(contentId: string, contentType: 'post' | 'reel'): Promise<{
    totalViews: number;
    averageWatchTime: number;
    engagementRate: number;
    topAgeGroups: string[];
    peakViewingTimes: string[];
  }> {
    // This would integrate with analytics in a full implementation
    return {
      totalViews: 0,
      averageWatchTime: 0,
      engagementRate: 0,
      topAgeGroups: [],
      peakViewingTimes: []
    };
  }

  // Background feed update for HyperSpeed system
  private static async updateFeedInBackground(userId: string, contentType: 'posts' | 'reels' | 'mixed', limit: number, cacheKey: string): Promise<void> {
    try {
      console.log('🔄 Background updating feed for instant loading...');
      
      // Generate fresh feed
      const freshFeed = await this.generateFreshFeed(userId, contentType, limit);
      
      // Update cache for next instant access
      await HyperSpeedService.cacheData(cacheKey, freshFeed, 'high');
      
      console.log(`✅ Background update completed: ${freshFeed.length} items cached`);
    } catch (error) {
      console.warn('Background feed update failed:', error);
    }
  }

  // Generate fresh feed without cache
  private static async generateFreshFeed(userId: string, contentType: 'posts' | 'reels' | 'mixed', limit: number): Promise<(Post | Reel)[]> {
    // Get user's following list
    const following = await FirebaseService.getFollowing(userId);
    const followingIds = following.map(user => user.uid);
    
    // Get user interactions and preferences
    const [interactions, preferences] = await Promise.all([
      this.getUserInteractions(userId),
      this.getUserPreferences(userId)
    ]);

    let allContent: (Post | Reel)[] = [];

    // Get fresh content
    if (contentType === 'posts' || contentType === 'mixed') {
      const posts = await FirebaseService.getPosts(undefined, 50);
      allContent.push(...posts);
    }
    
    if (contentType === 'reels' || contentType === 'mixed') {
      const reels = await FirebaseService.getRecommendedReels(userId, 50);
      allContent.push(...reels);
    }

    // Score and sort content
    const scoredContent = await Promise.all(
      allContent.map(async (content) => {
        const score = await this.calculateContentScore(content, userId, followingIds, interactions, preferences);
        return { content, score };
      })
    );

    // Sort by score and return
    scoredContent.sort((a, b) => b.score - a.score);
    return scoredContent.slice(0, limit).map(item => item.content);
  }
}
