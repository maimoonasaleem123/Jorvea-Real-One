import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestore } from '@react-native-firebase/firestore';
import { Post, Reel, Story } from './firebaseService';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
}

interface CachedUser {
  uid: string;
  displayName: string;
  photoURL: string;
  username: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isVerified?: boolean;
  isOnline?: boolean;
  lastSeen?: number;
}

interface CachedMessage {
  id: string;
  text: string;
  senderId: string;
  timestamp: number;
  type: 'text' | 'image' | 'video';
  mediaUrl?: string;
  isRead: boolean;
}

interface CachedChat {
  chatId: string;
  participants: string[];
  participantDetails: CachedUser[];
  lastMessage: CachedMessage;
  unreadCount: number;
  lastActivity: number;
}

interface InstantCache {
  posts: CacheItem<Post[]>;
  reels: CacheItem<Reel[]>;
  stories: CacheItem<Story[]>;
  userProfiles: { [userId: string]: CacheItem<CachedUser> };
  chats: { [chatId: string]: CacheItem<CachedChat> };
  messages: { [chatId: string]: CacheItem<CachedMessage[]> };
  mediaPreloaded: { [url: string]: boolean };
}

class InstantCacheManager {
  private cache: Partial<InstantCache> = {};
  private readonly CACHE_KEYS = {
    POSTS: 'instant_posts_cache',
    REELS: 'instant_reels_cache', 
    STORIES: 'instant_stories_cache',
    PROFILES: 'instant_profiles_cache',
    CHATS: 'instant_chats_cache',
    MESSAGES: 'instant_messages_cache',
    MEDIA: 'instant_media_cache'
  };

  private readonly CACHE_DURATION = {
    HIGH_PRIORITY: 5 * 60 * 1000, // 5 minutes
    MEDIUM_PRIORITY: 15 * 60 * 1000, // 15 minutes
    LOW_PRIORITY: 60 * 60 * 1000, // 1 hour
  };

  private readonly INSTANT_LOAD_COUNT = 5; // Load first 5 items instantly

  // Initialize cache on app start
  async initializeCache(): Promise<void> {
    try {
      await Promise.all([
        this.loadCacheFromStorage('posts'),
        this.loadCacheFromStorage('reels'),
        this.loadCacheFromStorage('stories'),
        this.loadCacheFromStorage('profiles'),
        this.loadCacheFromStorage('chats'),
        this.loadCacheFromStorage('messages'),
        this.loadCacheFromStorage('media'),
      ]);
      console.log('⚡ InstantCache initialized - Instagram-level instant loading ready!');
    } catch (error) {
      console.log('Cache initialization failed, starting fresh:', error);
    }
  }

  // Cache posts with instant priority for first few
  async cachePosts(posts: Post[]): Promise<void> {
    const prioritizedPosts = posts.map((post, index) => ({
      ...post,
      _priority: index < this.INSTANT_LOAD_COUNT ? 'high' : 'medium'
    }));

    const cacheItem: CacheItem<Post[]> = {
      data: prioritizedPosts,
      timestamp: Date.now(),
      priority: 'high'
    };

    this.cache.posts = cacheItem;
    await this.saveCacheToStorage('posts', cacheItem);
  }

  // Cache reels with instant priority
  async cacheReels(reels: Reel[]): Promise<void> {
    const prioritizedReels = reels.map((reel, index) => ({
      ...reel,
      _priority: index < this.INSTANT_LOAD_COUNT ? 'high' : 'medium'
    }));

    const cacheItem: CacheItem<Reel[]> = {
      data: prioritizedReels,
      timestamp: Date.now(),
      priority: 'high'
    };

    this.cache.reels = cacheItem;
    await this.saveCacheToStorage('reels', cacheItem);
  }

  // Cache stories with instant priority
  async cacheStories(stories: Story[]): Promise<void> {
    const cacheItem: CacheItem<Story[]> = {
      data: stories,
      timestamp: Date.now(),
      priority: 'high'
    };

    this.cache.stories = cacheItem;
    await this.saveCacheToStorage('stories', cacheItem);
  }

  // Get instant posts (cached + fresh)
  async getInstantPosts(): Promise<{ cached: Post[], needsRefresh: boolean }> {
    const cachedPosts = this.cache.posts;
    
    if (cachedPosts && this.isCacheValid(cachedPosts)) {
      return {
        cached: cachedPosts.data.slice(0, this.INSTANT_LOAD_COUNT),
        needsRefresh: false
      };
    }

    // Return empty array but signal refresh needed
    return {
      cached: [],
      needsRefresh: true
    };
  }

  // Get instant reels (cached + fresh)
  async getInstantReels(): Promise<{ cached: Reel[], needsRefresh: boolean }> {
    const cachedReels = this.cache.reels;
    
    if (cachedReels && this.isCacheValid(cachedReels)) {
      return {
        cached: cachedReels.data.slice(0, this.INSTANT_LOAD_COUNT),
        needsRefresh: false
      };
    }

    return {
      cached: [],
      needsRefresh: true
    };
  }

  // Get instant stories
  async getInstantStories(): Promise<{ cached: Story[], needsRefresh: boolean }> {
    const cachedStories = this.cache.stories;
    
    if (cachedStories && this.isCacheValid(cachedStories)) {
      return {
        cached: cachedStories.data,
        needsRefresh: false
      };
    }

    return {
      cached: [],
      needsRefresh: true
    };
  }

  // Preload media in background
  async preloadMedia(urls: string[]): Promise<void> {
    const priorityUrls = urls.slice(0, this.INSTANT_LOAD_COUNT);
    
    // Preload high priority media immediately
    Promise.all(
      priorityUrls.map(url => this.preloadSingleMedia(url))
    ).catch(console.warn);

    // Preload remaining media in background
    setTimeout(() => {
      const remainingUrls = urls.slice(this.INSTANT_LOAD_COUNT);
      Promise.all(
        remainingUrls.map(url => this.preloadSingleMedia(url))
      ).catch(console.warn);
    }, 1000);
  }

  private async preloadSingleMedia(url: string): Promise<void> {
    if (!url || this.cache.mediaPreloaded?.[url]) return;

    try {
      // Skip temp files that might not exist
      if (url.includes('temp_') || url.includes('cache/rn_image_picker')) {
        console.log('Skipping temp file preload:', url);
        return;
      }

      // For images, we can use Image.prefetch
      if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        const { prefetch } = require('react-native').Image;
        await prefetch(url);
        console.log('✅ Preloaded image successfully');
      }

      // Mark as preloaded
      if (!this.cache.mediaPreloaded) {
        this.cache.mediaPreloaded = {};
      }
      this.cache.mediaPreloaded[url] = true;
    } catch (error) {
      // Don't log as error for missing temp files, just info
      if (error.message?.includes('ENOENT') || error.message?.includes('No such file')) {
        console.log('Temp file not found, skipping preload');
      } else {
        console.warn('Failed to preload media:', error.message);
      }
    }
  }

  // Check if cache is still valid
  private isCacheValid<T>(cacheItem: CacheItem<T>): boolean {
    const now = Date.now();
    const age = now - cacheItem.timestamp;

    switch (cacheItem.priority) {
      case 'high':
        return age < this.CACHE_DURATION.HIGH_PRIORITY;
      case 'medium':
        return age < this.CACHE_DURATION.MEDIUM_PRIORITY;
      case 'low':
        return age < this.CACHE_DURATION.LOW_PRIORITY;
      default:
        return false;
    }
  }

  // Load cache from AsyncStorage
  private async loadCacheFromStorage(type: string): Promise<void> {
    try {
      const key = this.CACHE_KEYS[type.toUpperCase() as keyof typeof this.CACHE_KEYS];
      if (!key) return;

      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        (this.cache as any)[type] = parsed;
      }
    } catch (error) {
      console.warn(`Failed to load ${type} cache:`, error);
    }
  }

  // Save cache to AsyncStorage
  private async saveCacheToStorage<T>(type: string, data: CacheItem<T>): Promise<void> {
    try {
      const key = this.CACHE_KEYS[type.toUpperCase() as keyof typeof this.CACHE_KEYS];
      if (!key) return;

      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn(`Failed to save ${type} cache:`, error);
    }
  }

  // Clear expired cache
  async clearExpiredCache(): Promise<void> {
    const now = Date.now();
    
    Object.keys(this.cache).forEach(key => {
      const cacheItem = (this.cache as any)[key];
      if (cacheItem && !this.isCacheValid(cacheItem)) {
        delete (this.cache as any)[key];
      }
    });
  }

  // Clear all cache
  async clearAllCache(): Promise<void> {
    this.cache = {};
    await Promise.all(
      Object.values(this.CACHE_KEYS).map(key => 
        AsyncStorage.removeItem(key).catch(console.warn)
      )
    );
  }

  // Get cache statistics
  getCacheStats(): any {
    return {
      postsCount: this.cache.posts?.data?.length || 0,
      reelsCount: this.cache.reels?.data?.length || 0,
      storiesCount: this.cache.stories?.data?.length || 0,
      profilesCount: Object.keys(this.cache.userProfiles || {}).length,
      chatsCount: Object.keys(this.cache.chats || {}).length,
      messagesCount: Object.values(this.cache.messages || {}).reduce((total, cache) => total + cache.data.length, 0),
      mediaCount: Object.keys(this.cache.mediaPreloaded || {}).length,
    };
  }

  // ===== USER PROFILE INSTANT LOADING =====
  
  /**
   * Cache user profile for instant loading
   */
  async cacheUserProfile(userId: string, userData: any): Promise<void> {
    try {
      const cachedUser: CachedUser = {
        uid: userId,
        displayName: userData.displayName || '',
        photoURL: userData.photoURL || '',
        username: userData.username || '',
        bio: userData.bio || '',
        followersCount: userData.followersCount || 0,
        followingCount: userData.followingCount || 0,
        postsCount: userData.postsCount || 0,
        isVerified: userData.isVerified || false,
        isOnline: userData.isOnline || false,
        lastSeen: userData.lastSeen || Date.now()
      };

      const cacheItem: CacheItem<CachedUser> = {
        data: cachedUser,
        timestamp: Date.now(),
        priority: 'high'
      };

      if (!this.cache.userProfiles) {
        this.cache.userProfiles = {};
      }

      this.cache.userProfiles[userId] = cacheItem;
      await this.saveCacheToStorage(`profiles_${userId}`, cacheItem);
      
      console.log(`💾 User profile cached: ${userData.displayName || userId}`);
    } catch (error) {
      console.error('❌ Error caching user profile:', error);
    }
  }

  /**
   * Get cached user profile for instant loading
   */
  async getInstantUserProfile(userId: string): Promise<{ user: CachedUser | null; fromCache: boolean }> {
    try {
      // Check memory cache first
      const cached = this.cache.userProfiles?.[userId];
      if (cached && this.isCacheValid(cached)) {
        console.log(`⚡ Instant user profile load: ${cached.data.displayName}`);
        return { user: cached.data, fromCache: true };
      }

      // Check AsyncStorage cache
      const storageKey = `instant_profiles_cache_${userId}`;
      const storedData = await AsyncStorage.getItem(storageKey);
      if (storedData) {
        const parsed: CacheItem<CachedUser> = JSON.parse(storedData);
        if (this.isCacheValid(parsed)) {
          this.cache.userProfiles = this.cache.userProfiles || {};
          this.cache.userProfiles[userId] = parsed;
          console.log(`⚡ Instant user profile load from storage: ${parsed.data.displayName}`);
          return { user: parsed.data, fromCache: true };
        }
      }

      return { user: null, fromCache: false };
    } catch (error) {
      console.error('❌ Error getting cached user profile:', error);
      return { user: null, fromCache: false };
    }
  }

  /**
   * Load user profile with cache-first approach
   */
  async loadUserProfile(userId: string): Promise<CachedUser | null> {
    // Try cache first
    const { user, fromCache } = await this.getInstantUserProfile(userId);
    if (user && fromCache) {
      // Start background refresh
      this.backgroundRefreshUserProfile(userId);
      return user;
    }

    // Load from Firebase if not cached
    try {
      const userDoc = await firestore().collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        await this.cacheUserProfile(userId, userData);
        return userData as CachedUser;
      }
    } catch (error) {
      console.error('❌ Error loading user profile from Firebase:', error);
    }

    return null;
  }

  // ===== CHAT INSTANT LOADING =====

  /**
   * Cache chat data for instant loading
   */
  async cacheChat(chatId: string, chatData: any): Promise<void> {
    try {
      const cachedChat: CachedChat = {
        chatId,
        participants: chatData.participants || [],
        participantDetails: chatData.participantDetails || [],
        lastMessage: chatData.lastMessage ? {
          id: chatData.lastMessage.id,
          text: chatData.lastMessage.text || '',
          senderId: chatData.lastMessage.senderId,
          timestamp: chatData.lastMessage.timestamp,
          type: chatData.lastMessage.type || 'text',
          mediaUrl: chatData.lastMessage.mediaUrl,
          isRead: chatData.lastMessage.isRead || false
        } : {} as CachedMessage,
        unreadCount: chatData.unreadCount || 0,
        lastActivity: chatData.lastActivity || Date.now()
      };

      const cacheItem: CacheItem<CachedChat> = {
        data: cachedChat,
        timestamp: Date.now(),
        priority: 'high'
      };

      if (!this.cache.chats) {
        this.cache.chats = {};
      }

      this.cache.chats[chatId] = cacheItem;
      await this.saveCacheToStorage(`chats_${chatId}`, cacheItem);
      
      console.log(`💾 Chat cached: ${chatId}`);
    } catch (error) {
      console.error('❌ Error caching chat:', error);
    }
  }

  /**
   * Cache messages for a specific chat
   */
  async cacheMessages(chatId: string, messages: any[]): Promise<void> {
    try {
      const cachedMessages: CachedMessage[] = messages
        .slice(0, 100) // Limit to last 100 messages
        .map(msg => ({
          id: msg.id,
          text: msg.text || '',
          senderId: msg.senderId,
          timestamp: msg.timestamp,
          type: msg.type || 'text',
          mediaUrl: msg.mediaUrl,
          isRead: msg.isRead || false
        }));

      const cacheItem: CacheItem<CachedMessage[]> = {
        data: cachedMessages,
        timestamp: Date.now(),
        priority: 'high'
      };

      if (!this.cache.messages) {
        this.cache.messages = {};
      }

      this.cache.messages[chatId] = cacheItem;
      await this.saveCacheToStorage(`messages_${chatId}`, cacheItem);
      
      console.log(`💾 Messages cached for chat: ${chatId} (${cachedMessages.length} messages)`);
    } catch (error) {
      console.error('❌ Error caching messages:', error);
    }
  }

  /**
   * Get cached chat for instant loading
   */
  async getInstantChat(chatId: string): Promise<{ chat: CachedChat | null; fromCache: boolean }> {
    try {
      // Check memory cache first
      const cached = this.cache.chats?.[chatId];
      if (cached && this.isCacheValid(cached)) {
        console.log(`⚡ Instant chat load: ${chatId}`);
        return { chat: cached.data, fromCache: true };
      }

      // Check AsyncStorage cache
      const storageKey = `instant_chats_cache_${chatId}`;
      const storedData = await AsyncStorage.getItem(storageKey);
      if (storedData) {
        const parsed: CacheItem<CachedChat> = JSON.parse(storedData);
        if (this.isCacheValid(parsed)) {
          this.cache.chats = this.cache.chats || {};
          this.cache.chats[chatId] = parsed;
          console.log(`⚡ Instant chat load from storage: ${chatId}`);
          return { chat: parsed.data, fromCache: true };
        }
      }

      return { chat: null, fromCache: false };
    } catch (error) {
      console.error('❌ Error getting cached chat:', error);
      return { chat: null, fromCache: false };
    }
  }

  /**
   * Get cached messages for instant loading
   */
  async getInstantMessages(chatId: string): Promise<{ messages: CachedMessage[]; fromCache: boolean }> {
    try {
      // Check memory cache first
      const cached = this.cache.messages?.[chatId];
      if (cached && this.isCacheValid(cached)) {
        console.log(`⚡ Instant messages load: ${chatId} (${cached.data.length} messages)`);
        return { messages: cached.data, fromCache: true };
      }

      // Check AsyncStorage cache
      const storageKey = `instant_messages_cache_${chatId}`;
      const storedData = await AsyncStorage.getItem(storageKey);
      if (storedData) {
        const parsed: CacheItem<CachedMessage[]> = JSON.parse(storedData);
        if (this.isCacheValid(parsed)) {
          this.cache.messages = this.cache.messages || {};
          this.cache.messages[chatId] = parsed;
          console.log(`⚡ Instant messages load from storage: ${chatId} (${parsed.data.length} messages)`);
          return { messages: parsed.data, fromCache: true };
        }
      }

      return { messages: [], fromCache: false };
    } catch (error) {
      console.error('❌ Error getting cached messages:', error);
      return { messages: [], fromCache: false };
    }
  }

  /**
   * Load chat with cache-first approach
   */
  async loadChat(chatId: string): Promise<{ chat: CachedChat | null; messages: CachedMessage[] }> {
    // Try cache first
    const { chat, fromCache: chatFromCache } = await this.getInstantChat(chatId);
    const { messages, fromCache: messagesFromCache } = await this.getInstantMessages(chatId);
    
    if (chat && chatFromCache && messagesFromCache) {
      // Start background refresh
      this.backgroundRefreshChat(chatId);
      return { chat, messages };
    }

    // Load from Firebase if not cached
    return this.loadChatFromFirebase(chatId);
  }

  /**
   * Get instant chat list for current user
   */
  async getInstantChatList(currentUserId: string): Promise<{ chats: CachedChat[]; fromCache: boolean }> {
    try {
      if (!this.cache.chats) return { chats: [], fromCache: false };

      const userChats = Object.values(this.cache.chats)
        .filter(cached => {
          return this.isCacheValid(cached) && 
                 cached.data.participants.includes(currentUserId);
        })
        .map(cached => cached.data)
        .sort((a, b) => b.lastActivity - a.lastActivity);

      if (userChats.length > 0) {
        console.log(`⚡ Instant chat list load: ${userChats.length} chats`);
        // Start background refresh
        this.backgroundRefreshChatList(currentUserId);
        return { chats: userChats, fromCache: true };
      }

      return { chats: [], fromCache: false };
    } catch (error) {
      console.error('❌ Error getting instant chat list:', error);
      return { chats: [], fromCache: false };
    }
  }

  // ===== BACKGROUND REFRESH METHODS =====

  private async backgroundRefreshUserProfile(userId: string): Promise<void> {
    try {
      const userDoc = await firestore().collection('users').doc(userId).get();
      if (userDoc.exists) {
        await this.cacheUserProfile(userId, userDoc.data());
      }
    } catch (error) {
      console.error('❌ Background user profile refresh failed:', error);
    }
  }

  private async backgroundRefreshChat(chatId: string): Promise<void> {
    try {
      // Refresh chat metadata
      const chatDoc = await firestore().collection('chats').doc(chatId).get();
      if (chatDoc.exists) {
        await this.cacheChat(chatId, chatDoc.data());
      }

      // Refresh recent messages
      const messagesSnapshot = await firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

      const messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      await this.cacheMessages(chatId, messages);
    } catch (error) {
      console.error('❌ Background chat refresh failed:', error);
    }
  }

  private async backgroundRefreshChatList(currentUserId: string): Promise<void> {
    try {
      const chatsSnapshot = await firestore()
        .collection('chats')
        .where('participants', 'array-contains', currentUserId)
        .orderBy('lastActivity', 'desc')
        .limit(50)
        .get();

      for (const doc of chatsSnapshot.docs) {
        await this.cacheChat(doc.id, doc.data());
      }
    } catch (error) {
      console.error('❌ Background chat list refresh failed:', error);
    }
  }

  private async loadChatFromFirebase(chatId: string): Promise<{ chat: CachedChat | null; messages: CachedMessage[] }> {
    try {
      const chatDoc = await firestore().collection('chats').doc(chatId).get();
      if (!chatDoc.exists) {
        return { chat: null, messages: [] };
      }

      const chatData = chatDoc.data();
      await this.cacheChat(chatId, chatData);

      const messagesSnapshot = await firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

      const messages = messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      await this.cacheMessages(chatId, messages);

      return { 
        chat: chatData as CachedChat, 
        messages: messages as CachedMessage[]
      };
    } catch (error) {
      console.error('❌ Error loading chat from Firebase:', error);
      return { chat: null, messages: [] };
    }
  }
}

export const InstantCache = new InstantCacheManager();
