import firestore from '@react-native-firebase/firestore';
import { Alert } from 'react-native';

export interface ChatNotification {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  messagePreview: string;
  timestamp: Date;
  isRead: boolean;
  messageType: 'text' | 'reel' | 'post' | 'image' | 'video';
}

export interface UnreadChatInfo {
  chatId: string;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: Date;
  senderName: string;
  senderAvatar?: string;
}

class PerfectChatService {
  private static instance: PerfectChatService;
  private notificationListeners: Map<string, () => void> = new Map();

  private constructor() {}

  static getInstance(): PerfectChatService {
    if (!PerfectChatService.instance) {
      PerfectChatService.instance = new PerfectChatService();
    }
    return PerfectChatService.instance;
  }

  /**
   * Get all unread chats for a user with highlighting
   */
  async getUnreadChats(userId: string): Promise<UnreadChatInfo[]> {
    try {
      console.log('💬 PerfectChat: Loading unread chats for highlighting...');

      const unreadChats: UnreadChatInfo[] = [];

      // Get all unread chat references
      const unreadSnapshot = await firestore()
        .collection('users')
        .doc(userId)
        .collection('unreadChats')
        .orderBy('lastUpdated', 'desc')
        .get();

      if (unreadSnapshot.empty) {
        console.log('💬 PerfectChat: No unread chats found');
        return unreadChats;
      }

      // Get chat details for each unread chat
      const chatPromises = unreadSnapshot.docs.map(async (unreadDoc) => {
        try {
          const unreadData = unreadDoc.data();
          const chatId = unreadData.chatId;

          // Get chat details
          const chatDoc = await firestore().collection('chats').doc(chatId).get();
          if (!chatDoc.exists) return null;

          const chatData = chatDoc.data();
          if (!chatData) return null;

          // Get sender info (the other participant)
          const otherParticipantId = chatData.participants.find((p: string) => p !== userId);
          if (!otherParticipantId) return null;

          const senderDoc = await firestore().collection('users').doc(otherParticipantId).get();
          const senderData = senderDoc.exists ? senderDoc.data() : null;

          return {
            chatId,
            unreadCount: unreadData.unreadCount || 0,
            lastMessage: chatData.lastMessage || 'New message',
            lastMessageTime: chatData.lastMessageTime ? chatData.lastMessageTime.toDate() : new Date(),
            senderName: senderData?.displayName || senderData?.username || 'User',
            senderAvatar: senderData?.profilePicture,
          };
        } catch (error) {
          console.warn('Error loading unread chat details:', error);
          return null;
        }
      });

      const chatResults = await Promise.all(chatPromises);
      const validChats = chatResults.filter(chat => chat !== null) as UnreadChatInfo[];

      console.log(`✅ PerfectChat: Found ${validChats.length} unread chats`);
      return validChats;

    } catch (error) {
      console.error('❌ PerfectChat unread chats error:', error);
      return [];
    }
  }

  /**
   * Get total unread message count with instant updates
   */
  async getTotalUnreadCount(userId: string): Promise<number> {
    try {
      const unreadChats = await this.getUnreadChats(userId);
      const totalCount = unreadChats.reduce((sum, chat) => sum + chat.unreadCount, 0);
      
      console.log(`📊 PerfectChat: Total unread messages: ${totalCount}`);
      return totalCount;
    } catch (error) {
      console.error('Error getting total unread count:', error);
      return 0;
    }
  }

  /**
   * Listen for real-time unread message updates
   */
  listenForUnreadUpdates(
    userId: string,
    onUpdate: (unreadChats: UnreadChatInfo[], totalCount: number) => void
  ): () => void {
    console.log('🔔 PerfectChat: Setting up real-time unread listener...');

    const unsubscribe = firestore()
      .collection('users')
      .doc(userId)
      .collection('unreadChats')
      .onSnapshot(
        async (snapshot) => {
          try {
            console.log('🔔 PerfectChat: Unread chats updated in real-time');
            const unreadChats = await this.getUnreadChats(userId);
            const totalCount = unreadChats.reduce((sum, chat) => sum + chat.unreadCount, 0);
            onUpdate(unreadChats, totalCount);
          } catch (error) {
            console.error('Error in unread updates listener:', error);
          }
        },
        (error) => {
          console.error('Error setting up unread listener:', error);
        }
      );

    return unsubscribe;
  }

  /**
   * Mark specific chat as read (remove highlighting)
   */
  async markChatAsRead(userId: string, chatId: string): Promise<void> {
    try {
      console.log(`✅ PerfectChat: Marking chat ${chatId} as read...`);

      const batch = firestore().batch();

      // Remove from unread chats
      const unreadRef = firestore()
        .collection('users')
        .doc(userId)
        .collection('unreadChats')
        .doc(chatId);

      batch.delete(unreadRef);

      // Mark all messages in chat as read
      const messagesSnapshot = await firestore()
        .collection('messages')
        .where('chatId', '==', chatId)
        .where('recipientId', '==', userId)
        .where('isRead', '==', false)
        .get();

      messagesSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { 
          isRead: true,
          readAt: firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      console.log(`✅ PerfectChat: Chat ${chatId} marked as read`);

    } catch (error) {
      console.error('❌ PerfectChat mark as read error:', error);
      throw error;
    }
  }

  /**
   * Get recent notifications for display
   */
  async getRecentNotifications(userId: string, limit: number = 10): Promise<ChatNotification[]> {
    try {
      console.log('🔔 PerfectChat: Loading recent notifications...');

      const notifications: ChatNotification[] = [];

      // Get recent unread messages
      const messagesSnapshot = await firestore()
        .collection('messages')
        .where('recipientId', '==', userId)
        .where('isRead', '==', false)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      if (messagesSnapshot.empty) {
        console.log('🔔 PerfectChat: No recent notifications');
        return notifications;
      }

      // Process each message to create notification
      const notificationPromises = messagesSnapshot.docs.map(async (doc) => {
        try {
          const messageData = doc.data();
          
          // Get sender info
          const senderDoc = await firestore().collection('users').doc(messageData.senderId).get();
          const senderData = senderDoc.exists ? senderDoc.data() : null;

          return {
            id: doc.id,
            chatId: messageData.chatId,
            senderId: messageData.senderId,
            senderName: senderData?.displayName || senderData?.username || 'User',
            senderAvatar: senderData?.profilePicture,
            messagePreview: this.getMessagePreview(messageData),
            timestamp: messageData.timestamp ? messageData.timestamp.toDate() : new Date(),
            isRead: messageData.isRead || false,
            messageType: messageData.type || 'text',
          };
        } catch (error) {
          console.warn('Error processing notification:', error);
          return null;
        }
      });

      const notificationResults = await Promise.all(notificationPromises);
      const validNotifications = notificationResults.filter(n => n !== null) as ChatNotification[];

      console.log(`✅ PerfectChat: Loaded ${validNotifications.length} notifications`);
      return validNotifications;

    } catch (error) {
      console.error('❌ PerfectChat notifications error:', error);
      return [];
    }
  }

  /**
   * Get preview text for different message types
   */
  private getMessagePreview(messageData: any): string {
    switch (messageData.type) {
      case 'reel':
        return '📹 Shared a reel';
      case 'post':
        return '📸 Shared a post';
      case 'image':
        return '🖼️ Sent an image';
      case 'video':
        return '🎥 Sent a video';
      case 'audio':
        return '🎵 Sent an audio';
      default:
        return messageData.content || 'New message';
    }
  }

  /**
   * Create notification badge count
   */
  async getNotificationBadgeCount(userId: string): Promise<number> {
    try {
      const totalCount = await this.getTotalUnreadCount(userId);
      return Math.min(totalCount, 99); // Cap at 99 for UI
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  /**
   * Check if specific chat has unread messages
   */
  async hasChatUnreadMessages(userId: string, chatId: string): Promise<boolean> {
    try {
      const unreadDoc = await firestore()
        .collection('users')
        .doc(userId)
        .collection('unreadChats')
        .doc(chatId)
        .get();

      return unreadDoc.exists && (unreadDoc.data()?.unreadCount || 0) > 0;
    } catch (error) {
      console.error('Error checking chat unread status:', error);
      return false;
    }
  }

  /**
   * Clear all notifications for user
   */
  async clearAllNotifications(userId: string): Promise<void> {
    try {
      console.log('🧹 PerfectChat: Clearing all notifications...');

      const batch = firestore().batch();

      // Get all unread chats
      const unreadSnapshot = await firestore()
        .collection('users')
        .doc(userId)
        .collection('unreadChats')
        .get();

      // Delete all unread chat references
      unreadSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Mark all unread messages as read
      const messagesSnapshot = await firestore()
        .collection('messages')
        .where('recipientId', '==', userId)
        .where('isRead', '==', false)
        .get();

      messagesSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { 
          isRead: true,
          readAt: firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      console.log('✅ PerfectChat: All notifications cleared');

    } catch (error) {
      console.error('❌ PerfectChat clear notifications error:', error);
      throw error;
    }
  }
}

export default PerfectChatService;
