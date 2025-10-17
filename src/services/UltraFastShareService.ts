import firestore from '@react-native-firebase/firestore';
import { Alert } from 'react-native';
import { Reel, Post } from './firebaseService';

export interface ShareTarget {
  id: string;
  name: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: Date;
  username?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  type: 'text' | 'reel' | 'post';
  reelData?: Reel;
  postData?: Post;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
  isActive: boolean;
}

class UltraFastShareService {
  private static instance: UltraFastShareService;
  private friendsCache: Map<string, ShareTarget[]> = new Map();
  private chatsCache: Map<string, ShareTarget[]> = new Map();

  private constructor() {}

  static getInstance(): UltraFastShareService {
    if (!UltraFastShareService.instance) {
      UltraFastShareService.instance = new UltraFastShareService();
    }
    return UltraFastShareService.instance;
  }

  /**
   * Get friends for sharing with online status
   */
  async getFriendsForSharing(userId: string): Promise<ShareTarget[]> {
    try {
      // Check cache first
      if (this.friendsCache.has(userId)) {
        return this.friendsCache.get(userId)!;
      }

      console.log('📲 UltraFast: Loading friends for sharing...');

      // Get user's following list
      const userDoc = await firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();
      const following = userData?.following || [];

      if (following.length === 0) {
        console.log('📲 UltraFast: No friends found');
        return [];
      }

      // Get friend details in batches (Firestore limit)
      const friends: ShareTarget[] = [];
      const batchSize = 10;

      for (let i = 0; i < following.length; i += batchSize) {
        const batch = following.slice(i, i + batchSize);
        const friendPromises = batch.map(async (friendId: string) => {
          try {
            const friendDoc = await firestore().collection('users').doc(friendId).get();
            const friendData = friendDoc.data();
            
            if (friendData) {
              return {
                id: friendId,
                name: friendData.displayName || friendData.username,
                avatar: friendData.profilePicture,
                isOnline: friendData.isOnline || false,
                lastSeen: friendData.lastSeen?.toDate(),
                username: friendData.username,
              };
            }
            return null;
          } catch (error) {
            console.warn(`Failed to get friend ${friendId}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(friendPromises);
        friends.push(...batchResults.filter(friend => friend !== null) as ShareTarget[]);
      }

      // Cache for 5 minutes
      this.friendsCache.set(userId, friends);
      setTimeout(() => this.friendsCache.delete(userId), 5 * 60 * 1000);

      console.log(`📲 UltraFast: Loaded ${friends.length} friends for sharing`);
      return friends;

    } catch (error) {
      console.error('📲 UltraFast: Error loading friends for sharing:', error);
      return [];
    }
  }

  /**
   * Get recent chats for sharing
   */
  async getRecentChatsForSharing(userId: string): Promise<ShareTarget[]> {
    try {
      // Check cache first
      if (this.chatsCache.has(userId)) {
        return this.chatsCache.get(userId)!;
      }

      console.log('💬 UltraFast: Loading recent chats...');

      // Use chats collection instead of messages to avoid complex query
      const chatsSnapshot = await firestore()
        .collection('chats')
        .where('participants', 'array-contains', userId)
        .orderBy('updatedAt', 'desc')
        .limit(20)
        .get();

      const uniqueUsers = new Set<string>();
      const recentChats: ShareTarget[] = [];

      for (const chatDoc of chatsSnapshot.docs) {
        const chatData = chatDoc.data();
        const otherUserId = chatData.participants.find((id: string) => id !== userId);
        
        if (otherUserId && !uniqueUsers.has(otherUserId)) {
          uniqueUsers.add(otherUserId);
          
          try {
            const userDoc = await firestore().collection('users').doc(otherUserId).get();
            const userData = userDoc.data();
            
            if (userData) {
              recentChats.push({
                id: otherUserId,
                name: userData.displayName || userData.username,
                avatar: userData.profilePicture,
                isOnline: userData.isOnline || false,
                lastSeen: userData.lastSeen?.toDate(),
                username: userData.username,
              });
            }
          } catch (error) {
            console.warn(`Failed to get user ${otherUserId}:`, error);
          }
        }

        if (recentChats.length >= 10) break; // Limit to 10 recent chats
      }

      // Cache for 2 minutes
      this.chatsCache.set(userId, recentChats);
      setTimeout(() => this.chatsCache.delete(userId), 2 * 60 * 1000);

      console.log(`💬 UltraFast: Loaded ${recentChats.length} recent chats`);
      return recentChats;

    } catch (error) {
      console.error('💬 UltraFast: Error loading recent chats:', error);
      return [];
    }
  }

  /**
   * Search users for sharing
   */
  async searchUsersForSharing(query: string, currentUserId: string): Promise<ShareTarget[]> {
    try {
      if (query.trim().length < 2) return [];

      console.log(`🔍 UltraFast: Searching users for: ${query}`);

      const searchPromises = [
        // Search by username
        firestore()
          .collection('users')
          .where('username', '>=', query.toLowerCase())
          .where('username', '<=', query.toLowerCase() + '\uf8ff')
          .limit(10)
          .get(),
        
        // Search by display name
        firestore()
          .collection('users')
          .where('displayName', '>=', query)
          .where('displayName', '<=', query + '\uf8ff')
          .limit(10)
          .get(),
      ];

      const [usernameResults, displayNameResults] = await Promise.all(searchPromises);
      const uniqueUsers = new Map<string, ShareTarget>();

      // Process username results
      usernameResults.forEach(doc => {
        const userData = doc.data();
        if (userData && doc.id !== currentUserId) {
          uniqueUsers.set(doc.id, {
            id: doc.id,
            name: userData.displayName || userData.username,
            avatar: userData.profilePicture,
            isOnline: userData.isOnline || false,
            lastSeen: userData.lastSeen?.toDate(),
            username: userData.username,
          });
        }
      });

      // Process display name results
      displayNameResults.forEach(doc => {
        const userData = doc.data();
        if (userData && doc.id !== currentUserId) {
          uniqueUsers.set(doc.id, {
            id: doc.id,
            name: userData.displayName || userData.username,
            avatar: userData.profilePicture,
            isOnline: userData.isOnline || false,
            lastSeen: userData.lastSeen?.toDate(),
            username: userData.username,
          });
        }
      });

      const results = Array.from(uniqueUsers.values());
      console.log(`🔍 UltraFast: Found ${results.length} users`);
      return results;

    } catch (error) {
      console.error('🔍 UltraFast: Error searching users:', error);
      return [];
    }
  }

  /**
   * Get or create a chat between two users (ensures single chat per user pair)
   */
  async getOrCreateChat(senderId: string, recipientId: string): Promise<string> {
    const participants = [senderId, recipientId].sort();

    try {
      console.log(`💬 UltraFast: Looking for chat between ${senderId} and ${recipientId}`);

      // First, check if a chat already exists with these participants
      const existingChatQuery = await firestore()
        .collection('chats')
        .where('participants', 'array-contains', senderId)
        .get();

      // Look for a chat that contains both users
      for (const doc of existingChatQuery.docs) {
        const chatData = doc.data();
        if (
          chatData.participants.length === 2 &&
          chatData.participants.includes(recipientId)
        ) {
          console.log(`💬 Using existing chat: ${doc.id}`);
          return doc.id;
        }
      }

      // Create new chat if none exists
      console.log(`💬 Creating new chat between users`);
      const timestamp = firestore.FieldValue.serverTimestamp();
      
      const newChatRef = await firestore().collection('chats').add({
        participants,
        createdAt: timestamp,
        updatedAt: timestamp,
        isActive: true,
        lastMessage: '',
        lastMessageTime: timestamp,
        lastMessageType: 'text',
      });

      console.log(`✅ Created new chat: ${newChatRef.id}`);
      return newChatRef.id;
    } catch (error) {
      console.error(`❌ Error creating/getting chat:`, error);
      throw error;
    }
  }

  /**
   * Share reel to multiple users with enhanced error handling and fallback
   */
  async shareReelToUsers(
    senderId: string,
    recipientIds: string[],
    reel: Reel,
    customMessage?: string
  ): Promise<boolean> {
    try {
      console.log(`📤 UltraFast: Sharing reel to ${recipientIds.length} users...`);

      // Clean and validate reel data to prevent undefined fields
      const cleanReelData = this.cleanReelData(reel);

      // Get sender info for proper message display
      const senderDoc = await firestore().collection('users').doc(senderId).get();
      const senderData = senderDoc.data();
      const senderName = senderData?.displayName || senderData?.username || 'User';
      const senderAvatar = senderData?.profilePicture || '';

      // Use batch operations for atomicity
      const batch = firestore().batch();
      const timestamp = firestore.FieldValue.serverTimestamp();

      // Create messages for each recipient
      for (const recipientId of recipientIds) {
        // Get or create chat (ensures no duplicates)
        const chatId = await this.getOrCreateChat(senderId, recipientId);

        // Create message document
        const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const messageRef = firestore().collection('messages').doc(messageId);

        const messageData = {
          id: messageId,
          senderId,
          senderName,
          senderAvatar,
          recipientId,
          chatId,
          participants: [senderId, recipientId].sort(),
          content: customMessage || '📹 Shared a reel with you',
          message: customMessage || '📹 Shared a reel with you', // Add message field for compatibility
          messageType: 'reel',
          createdAt: timestamp,
          timestamp,
          isRead: false,
          type: 'reel',
          reelData: cleanReelData,
        };

        batch.set(messageRef, messageData);

        // Update chat document (use set with merge to create if not exists)
        const chatRef = firestore().collection('chats').doc(chatId);
        const chatData = {
          lastMessage: customMessage || 'Shared a reel',
          lastMessageTime: timestamp,
          lastMessageType: 'reel',
          updatedAt: timestamp,
        };

        batch.set(chatRef, chatData, { merge: true });

        // Update unread count for recipient (with error handling)
        try {
          const unreadRef = firestore()
            .collection('users')
            .doc(recipientId)
            .collection('unreadChats')
            .doc(chatId);

          batch.set(unreadRef, {
            chatId,
            unreadCount: firestore.FieldValue.increment(1),
            lastUpdated: timestamp,
          }, { merge: true });
        } catch (unreadError) {
          console.warn(`⚠️ Could not update unread count for ${recipientId}:`, unreadError);
          // Continue without failing the entire operation
        }
      }

      // Commit the batch
      await batch.commit();

      console.log(`✅ UltraFast: Successfully shared reel to ${recipientIds.length} users`);
      return true;

    } catch (error) {
      console.error('❌ UltraFast reel sharing error:', error);
      
      // Try fallback approach if batch fails
      try {
        console.log('🔄 Attempting fallback individual sharing...');
        return await this.shareReelIndividually(senderId, recipientIds, reel, customMessage);
      } catch (fallbackError) {
        console.error('❌ Fallback sharing also failed:', fallbackError);
        throw new Error(`Failed to share reel: ${error.message}`);
      }
    }
  }

  /**
   * Clean reel data to remove undefined fields and ensure Firebase compatibility
   */
  private cleanReelData(reel: Reel): any {
    const cleanData: any = {
      id: reel.id || '',
      videoUrl: reel.videoUrl || '',
      caption: reel.caption || '',
      userId: reel.userId || '',
    };

    // Only add fields if they have valid values
    if (reel.thumbnailUrl) {
      cleanData.thumbnailUrl = reel.thumbnailUrl;
    }

    if (reel.user) {
      cleanData.user = {
        id: reel.user.id || '',
        displayName: reel.user.displayName || '',
        username: reel.user.username || '',
        profilePicture: reel.user.profilePicture || '',
      };
    }

    if (reel.duration !== undefined && reel.duration !== null) {
      cleanData.duration = reel.duration;
    }

    if (reel.likes && Array.isArray(reel.likes)) {
      cleanData.likes = reel.likes;
    }

    if (reel.views !== undefined && reel.views !== null) {
      cleanData.views = reel.views;
    }

    if (reel.createdAt) {
      cleanData.createdAt = reel.createdAt;
    }

    if (reel.music) {
      cleanData.music = {
        title: reel.music.title || '',
        artist: reel.music.artist || '',
        audioUrl: reel.music.audioUrl || '', // Use audioUrl instead of url
      };
    }

    return cleanData;
  }

  /**
   * Fallback method to share reel individually if batch fails
   */
  private async shareReelIndividually(
    senderId: string,
    recipientIds: string[],
    reel: Reel,
    customMessage?: string
  ): Promise<boolean> {
    let successCount = 0;
    const timestamp = firestore.FieldValue.serverTimestamp();
    
    // Get sender info
    const senderDoc = await firestore().collection('users').doc(senderId).get();
    const senderData = senderDoc.data();
    const senderName = senderData?.displayName || senderData?.username || 'User';
    const senderAvatar = senderData?.profilePicture || '';
    
    // Clean reel data to prevent undefined fields
    const cleanReelData = this.cleanReelData(reel);

    for (const recipientId of recipientIds) {
      try {
        const chatId = [senderId, recipientId].sort().join('_');
        const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create message individually
        await firestore().collection('messages').doc(messageId).set({
          id: messageId,
          senderId,
          senderName,
          senderAvatar,
          recipientId,
          chatId,
          participants: [senderId, recipientId],
          content: customMessage || '📹 Shared a reel with you',
          message: customMessage || '📹 Shared a reel with you', // Add message field for compatibility
          messageType: 'reel',
          createdAt: timestamp,
          timestamp,
          isRead: false,
          type: 'reel',
          reelData: cleanReelData,
        });

        // Update chat individually
        await firestore().collection('chats').doc(chatId).set({
          id: chatId,
          participants: [senderId, recipientId],
          lastMessage: customMessage || 'Shared a reel',
          lastMessageTime: timestamp,
          lastMessageType: 'reel',
          updatedAt: timestamp,
        }, { merge: true });

        successCount++;
        console.log(`✅ Successfully shared to ${recipientId}`);

      } catch (individualError) {
        console.error(`❌ Failed to share to ${recipientId}:`, individualError);
        // Continue with other recipients
      }
    }

    if (successCount > 0) {
      console.log(`✅ Fallback sharing completed: ${successCount}/${recipientIds.length} successful`);
      return true;
    } else {
      throw new Error('All individual sharing attempts failed');
    }
  }

  /**
   * Clean and validate post data to prevent undefined field values
   */
  private cleanPostData(post: Post): any {
    const cleaned: any = {};
    
    // Only include defined fields
    if (post.id !== undefined) cleaned.id = post.id;
    if (post.mediaUrls !== undefined && Array.isArray(post.mediaUrls)) {
      cleaned.mediaUrls = post.mediaUrls.filter(url => url !== undefined);
    }
    if (post.caption !== undefined) cleaned.caption = post.caption;
    if (post.userId !== undefined) cleaned.userId = post.userId;
    if (post.user !== undefined) {
      // Clean user object too
      const cleanUser: any = {};
      if (post.user.id !== undefined) cleanUser.id = post.user.id;
      if (post.user.username !== undefined) cleanUser.username = post.user.username;
      if (post.user.profilePicture !== undefined) cleanUser.profilePicture = post.user.profilePicture;
      if (post.user.displayName !== undefined) cleanUser.displayName = post.user.displayName;
      
      if (Object.keys(cleanUser).length > 0) {
        cleaned.user = cleanUser;
      }
    }
    
    return cleaned;
  }

  /**
   * Share post to multiple users with enhanced error handling
   */
  async sharePostToUsers(
    senderId: string,
    recipientIds: string[],
    post: Post,
    customMessage?: string
  ): Promise<boolean> {
    try {
      console.log(`📤 UltraFast: Sharing post to ${recipientIds.length} users...`);

      // Clean and validate post data to prevent undefined fields
      const cleanPostData = this.cleanPostData(post);

      // Get sender info for proper message display
      const senderDoc = await firestore().collection('users').doc(senderId).get();
      const senderData = senderDoc.data();
      const senderName = senderData?.displayName || senderData?.username || 'User';
      const senderAvatar = senderData?.profilePicture || '';

      const batch = firestore().batch();
      const timestamp = firestore.FieldValue.serverTimestamp();

      // Create messages for each recipient
      for (const recipientId of recipientIds) {
        // Get or create chat (ensures no duplicates)
        const chatId = await this.getOrCreateChat(senderId, recipientId);

        // Create message document
        const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const messageRef = firestore().collection('messages').doc(messageId);

        const messageData = {
          id: messageId,
          senderId,
          senderName,
          senderAvatar,
          recipientId,
          chatId,
          participants: [senderId, recipientId].sort(),
          content: customMessage || '📸 Shared a post with you',
          message: customMessage || '📸 Shared a post with you', // Add message field for compatibility
          messageType: 'post',
          createdAt: timestamp,
          timestamp,
          isRead: false,
          type: 'post',
          postData: cleanPostData,
        };

        batch.set(messageRef, messageData);

        // Update chat document (use set with merge to create if not exists)
        const chatRef = firestore().collection('chats').doc(chatId);
        const chatData = {
          lastMessage: customMessage || 'Shared a post',
          lastMessageTime: timestamp,
          lastMessageType: 'post',
          updatedAt: timestamp,
        };

        batch.set(chatRef, chatData, { merge: true });

        // Update unread count for recipient
        try {
          const unreadRef = firestore()
            .collection('users')
            .doc(recipientId)
            .collection('unreadChats')
            .doc(chatId);

          batch.set(unreadRef, {
            chatId,
            unreadCount: firestore.FieldValue.increment(1),
            lastUpdated: timestamp,
          }, { merge: true });
        } catch (unreadError) {
          console.warn(`⚠️ Could not update unread count for ${recipientId}:`, unreadError);
        }
      }

      // Commit the batch
      await batch.commit();

      console.log(`✅ UltraFast: Successfully shared post to ${recipientIds.length} users`);
      return true;

    } catch (error) {
      console.error('❌ UltraFast post sharing error:', error);
      throw new Error(`Failed to share post: ${error.message}`);
    }
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.friendsCache.clear();
    this.chatsCache.clear();
    console.log('🧹 UltraFast: Caches cleared');
  }
}

export default UltraFastShareService;
