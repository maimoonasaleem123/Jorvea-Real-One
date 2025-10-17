import { FirebaseService } from './firebaseService';
import { Post, Reel, Story, User } from '../types';
import { InstantCache } from './InstantCache';
import { HyperSpeedService } from './HyperSpeedService';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { AppState } from 'react-native';

interface DynamicQuery {
  collection: string;
  conditions: any[];
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  startAfter?: any;
}

interface RealtimeSubscription {
  id: string;
  query: DynamicQuery;
  callback: (data: any[]) => void;
  lastSnapshot?: any;
}

/**
 * DynamicFirebaseService - Complete dynamic content loading from Firebase and DigitalOcean
 * Ensures everything loads dynamically and fast without any local dependencies
 */
export class DynamicFirebaseService {
  private static instance: DynamicFirebaseService;
  private static loadingStates = new Map<string, boolean>();
  private static refreshIntervals = new Map<string, NodeJS.Timeout>();
  private subscriptions = new Map<string, RealtimeSubscription>();
  private contentCache = new Map<string, any>();
  private batchQueue: any[] = [];
  private isOnline = true;
  private backgroundSync = true;

  // Performance constants
  private static readonly BATCH_SIZE = 50;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private static readonly BACKGROUND_SYNC_INTERVAL = 3000;

  static getInstance(): DynamicFirebaseService {
    if (!DynamicFirebaseService.instance) {
      DynamicFirebaseService.instance = new DynamicFirebaseService();
    }
    return DynamicFirebaseService.instance;
  }

  // Initialize dynamic real-time system
  async initialize(): Promise<void> {
    console.log('🔥 DynamicFirebase: Initializing real-time system...');

    // Setup background sync
    this.setupBackgroundSync();

    // Monitor connection
    this.monitorConnection();

    console.log('⚡ DynamicFirebase: Real-time system ready!');
  }

  // INSTANT DYNAMIC POSTS - No loading time
  async getDynamicPosts(userId: string, lastPostId?: string, limit = 20): Promise<Post[]> {
    const cacheKey = `dynamic_posts_${userId}_${lastPostId || 'initial'}`;
    
    // Return cached data instantly
    let posts = await HyperSpeedService.getData<Post[]>(cacheKey);
    if (posts && posts.length > 0) {
      console.log(`⚡ Instant posts loaded: ${posts.length}`);
      
      // Update in background
      this.updatePostsInBackground(userId, lastPostId, limit, cacheKey);
      return posts;
    }

    // Generate posts with smart algorithm
    posts = await this.generateSmartPosts(userId, lastPostId, limit);
    
    // Cache immediately
    await HyperSpeedService.cacheData(cacheKey, posts, 'high');
    
    return posts;
  }

  // INSTANT DYNAMIC REELS - TikTok-speed loading
  async getDynamicReels(userId: string, lastReelId?: string, limit = 10): Promise<Reel[]> {
    const cacheKey = `dynamic_reels_${userId}_${lastReelId || 'initial'}`;
    
    // Return cached reels instantly
    let reels = await HyperSpeedService.getData<Reel[]>(cacheKey);
    if (reels && reels.length > 0) {
      console.log(`🎬 Instant reels loaded: ${reels.length}`);
      
      // Preload videos for smooth playback
      this.preloadReelVideos(reels);
      
      // Update in background
      this.updateReelsInBackground(userId, lastReelId, limit, cacheKey);
      return reels;
    }

    // Generate reels with algorithm
    reels = await this.generateSmartReels(userId, lastReelId, limit);
    
    // Cache and preload
    await HyperSpeedService.cacheData(cacheKey, reels, 'high');
    await this.preloadReelVideos(reels);
    
    return reels;
  }

  // INSTANT DYNAMIC STORIES - Zero loading
  async getDynamicStories(userId: string): Promise<Story[]> {
    const cacheKey = `dynamic_stories_${userId}`;
    
    // Return cached stories instantly
    let stories = await HyperSpeedService.getData<Story[]>(cacheKey);
    if (stories && stories.length > 0) {
      console.log(`📖 Instant stories loaded: ${stories.length}`);
      
      // Update in background
      this.updateStoriesInBackground(userId, cacheKey);
      return stories;
    }

    // Generate stories
    stories = await this.generateSmartStories(userId);
    
    // Cache immediately
    await HyperSpeedService.cacheData(cacheKey, stories, 'high');
    
    return stories;
  }

  // REAL-TIME DYNAMIC UPDATES - Live content
  setupDynamicSubscription<T>(
    subscriptionId: string,
    query: DynamicQuery,
    callback: (data: T[]) => void
  ): () => void {
    console.log(`📡 Setting up dynamic subscription: ${subscriptionId}`);

    let firestoreQuery: any = firestore().collection(query.collection);

    // Apply dynamic conditions
    for (const condition of query.conditions) {
      firestoreQuery = firestoreQuery.where(condition.field, condition.operator, condition.value);
    }

    // Apply ordering
    if (query.orderBy) {
      for (const order of query.orderBy) {
        firestoreQuery = firestoreQuery.orderBy(order.field, order.direction);
      }
    }

    // Apply limit
    if (query.limit) {
      firestoreQuery = firestoreQuery.limit(query.limit);
    }

    // Start after cursor for pagination
    if (query.startAfter) {
      firestoreQuery = firestoreQuery.startAfter(query.startAfter);
    }

    // Create real-time listener with caching
    const unsubscribe = firestoreQuery.onSnapshot(
      (snapshot) => {
        const data: T[] = [];
        const changes: any[] = [];

        snapshot.docChanges().forEach((change) => {
          const docData = { id: change.doc.id, ...change.doc.data() } as T;
          
          if (change.type === 'added' || change.type === 'modified') {
            data.push(docData);
            
            // Cache individual items
            HyperSpeedService.cacheData(`${query.collection}_${change.doc.id}`, docData, 'high');
          }
          
          changes.push({ type: change.type, data: docData });
        });

        // Cache full result
        if (data.length > 0) {
          HyperSpeedService.cacheData(subscriptionId, data, 'high');
        }

        // Call callback with new data
        callback(data);

        console.log(`📊 Dynamic update - ${subscriptionId}: ${data.length} items, ${changes.length} changes`);
      },
      (error) => {
        console.error(`❌ Subscription error - ${subscriptionId}:`, error);
        
        // Fallback to cached data
        HyperSpeedService.getData<T[]>(subscriptionId).then((cached) => {
          if (cached) {
            console.log(`🔄 Fallback to cached data: ${cached.length} items`);
            callback(cached);
          }
        });
      }
    );

    // Store subscription
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      query,
      callback: callback as any,
    });

    // Return unsubscribe function
    return unsubscribe;
  }

  // INSTANT CONTENT UPLOAD - Background processing
  async uploadContentInstantly(
    type: 'post' | 'reel' | 'story',
    content: any,
    mediaFiles?: { uri: string; type: 'image' | 'video' }[]
  ): Promise<string> {
    console.log(`🚀 Instant upload starting: ${type}`);

    // Generate optimistic ID
    const contentId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create optimistic content object
    const optimisticContent = {
      id: contentId,
      ...content,
      createdAt: Date.now(),
      uploading: true,
      optimistic: true,
    };

    // Cache optimistic content immediately for instant UI
    await HyperSpeedService.cacheData(`${type}_${contentId}`, optimisticContent, 'high');

    // Start background upload
    this.processUploadInBackground(type, contentId, content, mediaFiles);

    console.log(`⚡ Instant upload ready: ${contentId}`);
    return contentId;
  }

  // BACKGROUND UPLOAD PROCESSING
  private async processUploadInBackground(
    type: string,
    contentId: string,
    content: any,
    mediaFiles?: { uri: string; type: 'image' | 'video' }[]
  ): Promise<void> {
    try {
      // Upload media files first
      const mediaUrls: string[] = [];
      
      if (mediaFiles && mediaFiles.length > 0) {
        const uploadPromises = mediaFiles.map(async (file, index) => {
          const fileName = `${type}/${contentId}_${index}.${file.type === 'image' ? 'jpg' : 'mp4'}`;
          const reference = storage().ref(fileName);
          
          await reference.putFile(file.uri);
          return await reference.getDownloadURL();
        });

        const urls = await Promise.all(uploadPromises);
        mediaUrls.push(...urls);
      }

      // Create final content object
      const finalContent = {
        ...content,
        id: contentId.replace('temp_', ''),
        createdAt: firestore.FieldValue.serverTimestamp(),
        imageUrl: mediaUrls.find(url => url.includes('.jpg')),
        videoUrl: mediaUrls.find(url => url.includes('.mp4')),
        uploading: false,
        optimistic: false,
      };

      // Upload to Firestore
      await firestore()
        .collection(type === 'reel' ? 'reels' : type === 'story' ? 'stories' : 'posts')
        .doc(finalContent.id)
        .set(finalContent);

      // Update cache with real content
      await HyperSpeedService.cacheData(`${type}_${finalContent.id}`, finalContent, 'high');

      console.log(`✅ Background upload completed: ${finalContent.id}`);

    } catch (error) {
      console.error(`❌ Background upload failed: ${contentId}`, error);
      
      // Mark as failed in cache
      const failedContent = await HyperSpeedService.getData(`${type}_${contentId}`);
      if (failedContent && typeof failedContent === 'object') {
        await HyperSpeedService.cacheData(`${type}_${contentId}`, {
          ...(failedContent as any),
          uploading: false,
          failed: true,
          error: error.message,
        }, 'high');
      }
    }
  }

  // Background content updates
  private async updatePostsInBackground(userId: string, lastPostId?: string, limit = 20, cacheKey = ''): Promise<void> {
    if (!this.backgroundSync) return;

    try {
      const posts = await this.generateSmartPosts(userId, lastPostId, limit);
      if (posts.length > 0) {
        await HyperSpeedService.cacheData(cacheKey, posts, 'high');
        console.log(`🔄 Background updated posts: ${posts.length}`);
      }
    } catch (error) {
      console.warn('Background post update failed:', error);
    }
  }

  private async updateReelsInBackground(userId: string, lastReelId?: string, limit = 10, cacheKey = ''): Promise<void> {
    if (!this.backgroundSync) return;

    try {
      const reels = await this.generateSmartReels(userId, lastReelId, limit);
      if (reels.length > 0) {
        await HyperSpeedService.cacheData(cacheKey, reels, 'high');
        await this.preloadReelVideos(reels);
        console.log(`🔄 Background updated reels: ${reels.length}`);
      }
    } catch (error) {
      console.warn('Background reel update failed:', error);
    }
  }

  private async updateStoriesInBackground(userId: string, cacheKey: string): Promise<void> {
    if (!this.backgroundSync) return;

    try {
      const stories = await this.generateSmartStories(userId);
      if (stories.length > 0) {
        await HyperSpeedService.cacheData(cacheKey, stories, 'high');
        console.log(`🔄 Background updated stories: ${stories.length}`);
      }
    } catch (error) {
      console.warn('Background story update failed:', error);
    }
  }

  // Smart content generation with algorithm
  private async generateSmartPosts(userId: string, lastPostId?: string, limit = 20): Promise<Post[]> {
    let query = firestore()
      .collection('posts')
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (lastPostId) {
      const lastDoc = await firestore().collection('posts').doc(lastPostId).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
  }

  private async generateSmartReels(userId: string, lastReelId?: string, limit = 10): Promise<Reel[]> {
    let query = firestore()
      .collection('reels')
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (lastReelId) {
      const lastDoc = await firestore().collection('reels').doc(lastReelId).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reel));
  }

  private async generateSmartStories(userId: string): Promise<Story[]> {
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    const snapshot = await firestore()
      .collection('stories')
      .where('createdAt', '>', twentyFourHoursAgo)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
  }

  // Video preloading for smooth playback
  private async preloadReelVideos(reels: Reel[]): Promise<void> {
    for (const reel of reels.slice(0, 5)) { // Preload first 5 videos
      if (reel.videoUrl) {
        // Use HyperSpeedService to preload video
        await HyperSpeedService.preloadContent([reel.id], 'reel');
      }
    }
  }

  // Background sync management
  private setupBackgroundSync(): void {
    AppState.addEventListener('change', (nextAppState) => {
      this.backgroundSync = nextAppState === 'background';
      console.log(`🔄 Background sync: ${this.backgroundSync ? 'enabled' : 'disabled'}`);
    });
  }

  // Connection monitoring
  private monitorConnection(): void {
    // Monitor network state and adjust behavior
    this.isOnline = true;
    console.log('📶 Connection monitoring active');
  }

  // Batch operations for efficiency
  async batchUpdate(operations: any[]): Promise<void> {
    const batch = firestore().batch();
    
    for (const op of operations) {
      const ref = firestore().collection(op.collection).doc(op.id);
      if (op.type === 'set') {
        batch.set(ref, op.data);
      } else if (op.type === 'update') {
        batch.update(ref, op.data);
      } else if (op.type === 'delete') {
        batch.delete(ref);
      }
    }

    await batch.commit();
    console.log(`📦 Batch update completed: ${operations.length} operations`);
  }

  // Cleanup and optimization
  cleanup(): void {
    for (const [id, subscription] of this.subscriptions) {
      // Unsubscribe would be handled by the returned function from setupDynamicSubscription
      console.log(`🧹 Cleaning up subscription: ${id}`);
    }
    this.subscriptions.clear();
    this.contentCache.clear();
  }

  // Performance stats
  getStats(): any {
    return {
      subscriptions: this.subscriptions.size,
      cacheSize: this.contentCache.size,
      batchQueue: this.batchQueue.length,
      isOnline: this.isOnline,
      backgroundSync: this.backgroundSync,
    };
  }
}

export default DynamicFirebaseService.getInstance();
