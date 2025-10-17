/**
 * 🔥 INSTAGRAM MESSAGING SERVICE - Perfect Message Notifications & Management
 * 
 * Features:
 * - Real-time new message detection
 * - Red badge for unread messages in home
 * - Blue dot highlighting for new messages in chat list
 * - Automatic sorting: new message users at top
 * - Instagram-style notification system
 */

import firestore from '@react-native-firebase/firestore';
import { EventEmitter } from 'events';

export interface MessageNotification {
  chatId: string;
  senderId: string;
  senderName: string;
  senderProfilePicture?: string;
  messageText: string;
  timestamp: Date;
  isRead: boolean;
}

export interface ChatWithNotification {
  id: string;
  participants: string[];
  lastMessage: {
    text: string;
    senderId: string;
    timestamp: Date;
    isRead: boolean;
  };
  unreadCount: number;
  hasNewMessage: boolean;
  otherUser: {
    uid: string;
    displayName: string;
    profilePicture?: string;
  };
  updatedAt: Date;
}

class InstagramMessagingService extends EventEmitter {
  private static instance: InstagramMessagingService;
  private currentUserId?: string;
  private unsubscribeListeners: (() => void)[] = [];
  private messageCache = new Map<string, MessageNotification[]>();
  
  // Enhanced Instagram-style caching
  private chatsCache = new Map<string, ChatWithNotification[]>();
  private userCache = new Map<string, any>();
  private lastCacheTime = new Map<string, number>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  private readonly INSTANT_CACHE_DURATION = 30 * 1000; // 30 seconds for instant loading

  static getInstance(): InstagramMessagingService {
    if (!InstagramMessagingService.instance) {
      InstagramMessagingService.instance = new InstagramMessagingService();
    }
    return InstagramMessagingService.instance;
  }

  /**
   * 🎯 Initialize real-time message monitoring for a user
   */
  initializeForUser(userId: string) {
    console.log('💬 InstagramMessagingService: Initializing for user:', userId);
    
    this.cleanup(); // Clean up previous listeners
    this.currentUserId = userId;
    
    // Start listening to all user's chats for new messages
    this.listenToUserChats();
  }

  /**
   * � Get user chats with Instagram-style instant loading
   */
  async getUserChatsWithNotifications(): Promise<ChatWithNotification[]> {
    if (!this.currentUserId) return [];

    const cacheKey = `chats_${this.currentUserId}`;
    const now = Date.now();
    const lastCache = this.lastCacheTime.get(cacheKey) || 0;
    
    // Return cached data immediately for instant loading
    if (this.chatsCache.has(cacheKey) && (now - lastCache) < this.INSTANT_CACHE_DURATION) {
      console.log('⚡ Using instant cache for chats');
      return this.chatsCache.get(cacheKey) || [];
    }

    // Load from Firebase if cache is expired or doesn't exist
    try {
      const chats = await this.loadChatsFromFirebase();
      
      // Update cache
      this.chatsCache.set(cacheKey, chats);
      this.lastCacheTime.set(cacheKey, now);
      
      return chats;
    } catch (error) {
      console.error('❌ Error loading chats:', error);
      
      // Return cached data as fallback
      if (this.chatsCache.has(cacheKey)) {
        console.log('🔄 Using fallback cache for chats');
        return this.chatsCache.get(cacheKey) || [];
      }
      
      return [];
    }
  }

  /**
   * �📱 Load chats from Firebase with optimized queries
   */
  private async loadChatsFromFirebase(): Promise<ChatWithNotification[]> {
    if (!this.currentUserId) return [];

    const snapshot = await firestore()
      .collection('chats')
      .where('participants', 'array-contains', this.currentUserId)
      .orderBy('updatedAt', 'desc')
      .limit(50) // Limit for performance
      .get();

    const chats: ChatWithNotification[] = [];
    let totalUnreadCount = 0;

    for (const doc of snapshot.docs) {
      const chatData = doc.data();
      const chatId = doc.id;

      try {
        // Get other participant info with caching
        const otherUserId = chatData.participants.find((id: string) => id !== this.currentUserId);
        if (!otherUserId) continue;

        const otherUser = await this.getCachedUser(otherUserId);
        if (!otherUser) continue;

        // Get unread count for this chat
        const unreadCount = await this.getUnreadCount(chatId);
        const hasNewMessage = unreadCount > 0;

        if (hasNewMessage) {
          totalUnreadCount += unreadCount;
        }

        chats.push({
          id: chatId,
          participants: chatData.participants,
          lastMessage: {
            text: chatData.lastMessage?.text || '',
            senderId: chatData.lastMessage?.senderId || '',
            timestamp: chatData.lastMessage?.timestamp?.toDate() || new Date(),
            isRead: !hasNewMessage || chatData.lastMessage?.senderId === this.currentUserId
          },
          unreadCount,
          hasNewMessage,
          otherUser: {
            uid: otherUserId,
            displayName: otherUser.displayName || otherUser.username || 'Unknown User',
            profilePicture: otherUser.profilePicture || otherUser.photoURL
          },
          updatedAt: chatData.updatedAt?.toDate() || new Date()
        });

      } catch (error) {
        console.error('❌ Error processing chat:', chatId, error);
      }
    }

    // Sort chats: new messages first, then by last update time
    chats.sort((a, b) => {
      if (a.hasNewMessage && !b.hasNewMessage) return -1;
      if (!a.hasNewMessage && b.hasNewMessage) return 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    console.log(`💬 Loaded ${chats.length} chats from Firebase`);
    return chats;
  }

  /**
   * 👤 Get user data with caching
   */
  private async getCachedUser(userId: string): Promise<any> {
    const cacheKey = `user_${userId}`;
    const now = Date.now();
    const lastCache = this.lastCacheTime.get(cacheKey) || 0;

    // Return cached user if available and not expired
    if (this.userCache.has(cacheKey) && (now - lastCache) < this.CACHE_DURATION) {
      return this.userCache.get(cacheKey);
    }

    try {
      const userDoc = await firestore()
        .collection('users')
        .doc(userId)
        .get();

      const userData = userDoc.data();
      
      if (userData) {
        // Cache the user data
        this.userCache.set(cacheKey, userData);
        this.lastCacheTime.set(cacheKey, now);
      }

      return userData;
    } catch (error) {
      console.error('❌ Error loading user:', userId, error);
      
      // Return cached data as fallback
      if (this.userCache.has(cacheKey)) {
        return this.userCache.get(cacheKey);
      }
      
      return null;
    }
  }
  private listenToUserChats() {
    if (!this.currentUserId) return;

    const unsubscribe = firestore()
      .collection('chats')
      .where('participants', 'array-contains', this.currentUserId)
      .orderBy('updatedAt', 'desc')
      .onSnapshot(
        (snapshot) => {
          this.processChatUpdates(snapshot);
        },
        (error) => {
          console.error('❌ Error listening to chats:', error);
        }
      );

    this.unsubscribeListeners.push(unsubscribe);
  }

  /**
   * 🔄 Process chat updates and emit notifications
   */
  private async processChatUpdates(snapshot: any) {
    if (!this.currentUserId || !snapshot) return;

    const chats: ChatWithNotification[] = [];
    let totalUnreadCount = 0;
    let hasNewMessages = false;

    for (const doc of snapshot.docs) {
      const chatData = doc.data();
      const chatId = doc.id;

      try {
        // Get other participant info
        const otherUserId = chatData.participants.find((id: string) => id !== this.currentUserId);
        if (!otherUserId) continue;

        const otherUserDoc = await firestore()
          .collection('users')
          .doc(otherUserId)
          .get();

        const otherUser = otherUserDoc.data();
        if (!otherUser) continue;

        // Get unread count for this chat
        const unreadCount = await this.getUnreadCount(chatId);
        const hasNewMessage = unreadCount > 0;

        if (hasNewMessage) {
          totalUnreadCount += unreadCount;
          hasNewMessages = true;
        }

        chats.push({
          id: chatId,
          participants: chatData.participants,
          lastMessage: {
            text: chatData.lastMessage?.text || '',
            senderId: chatData.lastMessage?.senderId || '',
            timestamp: chatData.lastMessage?.timestamp?.toDate() || new Date(),
            isRead: !hasNewMessage || chatData.lastMessage?.senderId === this.currentUserId
          },
          unreadCount,
          hasNewMessage,
          otherUser: {
            uid: otherUserId,
            displayName: otherUser.displayName || otherUser.username || 'Unknown User',
            profilePicture: otherUser.profilePicture || otherUser.photoURL
          },
          updatedAt: chatData.updatedAt?.toDate() || new Date()
        });

      } catch (error) {
        console.error('❌ Error processing chat:', chatId, error);
      }
    }

    // Sort chats: new messages first, then by last update time
    chats.sort((a, b) => {
      // New messages always at top
      if (a.hasNewMessage && !b.hasNewMessage) return -1;
      if (!a.hasNewMessage && b.hasNewMessage) return 1;
      
      // Among new messages or non-new messages, sort by time
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    // Emit events for UI updates
    this.emit('chats-updated', chats);
    this.emit('unread-count-changed', totalUnreadCount);
    
    if (hasNewMessages) {
      this.emit('new-messages-detected', totalUnreadCount);
    }

    console.log(`💬 Chat updates processed: ${chats.length} chats, ${totalUnreadCount} unread`);
  }

  /**
   * 📊 Get unread message count for a specific chat with graceful error handling
   */
  private async getUnreadCount(chatId: string): Promise<number> {
    if (!this.currentUserId) return 0;

    try {
      // First try: Check if user is participant in chat
      const chatDoc = await firestore()
        .collection('chats')
        .doc(chatId)
        .get();

      if (!chatDoc.exists) {
        return 0;
      }

      const chatData = chatDoc.data();
      if (!chatData?.participants?.includes(this.currentUserId)) {
        return 0; // User not in this chat
      }

      // Try subcollection approach
      const messagesSnapshot = await firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .where('senderId', '!=', this.currentUserId)
        .where('isRead', '==', false)
        .limit(50) // Limit for performance
        .get();

      return messagesSnapshot.size;

    } catch (error) {
      console.warn('⚠️ Unread count check failed, using safe default:', error);
      return 0; // Safe default to prevent crashes
    }
  }

  /**
   * ✅ Mark messages as read in a chat with enhanced permission handling
   */
  async markChatAsRead(chatId: string): Promise<void> {
    if (!this.currentUserId) return;

    try {
      // First check if user is participant in this chat
      const chatDoc = await firestore()
        .collection('chats')
        .doc(chatId)
        .get();

      if (!chatDoc.exists) {
        console.warn('⚠️ Chat does not exist:', chatId);
        return;
      }

      const chatData = chatDoc.data();
      if (!chatData?.participants?.includes(this.currentUserId)) {
        console.warn('⚠️ User not participant in chat:', chatId);
        return;
      }

      // Try to mark messages as read
      try {
        const unreadMessages = await firestore()
          .collection('chats')
          .doc(chatId)
          .collection('messages')
          .where('senderId', '!=', this.currentUserId)
          .where('isRead', '==', false)
          .limit(50) // Limit for performance
          .get();

        if (unreadMessages.size > 0) {
          const batch = firestore().batch();
          unreadMessages.docs.forEach(doc => {
            batch.update(doc.ref, { isRead: true });
          });

          await batch.commit();
          console.log(`✅ Marked ${unreadMessages.size} messages as read in chat: ${chatId}`);
        }
        
      } catch (updateError) {
        console.warn('⚠️ Could not mark messages as read (continuing safely):', updateError);
        // Don't throw error, just log it
      }
      
      // Emit event for UI update regardless
      this.emit('chat-read', chatId);
      
    } catch (error) {
      console.warn('⚠️ Error in markChatAsRead (continuing safely):', error);
      // Don't throw - fail gracefully
    }
  }

  /**
   * 🔊 Get total unread message count for badge
   */
  async getTotalUnreadCount(): Promise<number> {
    if (!this.currentUserId) return 0;

    try {
      const chatsSnapshot = await firestore()
        .collection('chats')
        .where('participants', 'array-contains', this.currentUserId)
        .get();

      let totalUnread = 0;

      for (const chatDoc of chatsSnapshot.docs) {
        const unreadCount = await this.getUnreadCount(chatDoc.id);
        totalUnread += unreadCount;
      }

      return totalUnread;
    } catch (error) {
      console.error('❌ Error getting total unread count:', error);
      return 0;
    }
  }

  /**
   * 🧹 Cleanup listeners
   */
  cleanup() {
    this.unsubscribeListeners.forEach(unsubscribe => unsubscribe());
    this.unsubscribeListeners = [];
    this.removeAllListeners();
  }

}

export default InstagramMessagingService;
