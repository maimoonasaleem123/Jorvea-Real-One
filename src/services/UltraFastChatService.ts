import firestore from '@react-native-firebase/firestore';
import { User } from '../types';

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  contentType: 'text' | 'reel' | 'post' | 'image';
  reelId?: string;
  postId?: string;
  imageUrl?: string;
  createdAt: any;
  isRead: boolean;
  readBy: string[];
}

export interface Chat {
  id: string;
  participants: string[];
  participantDetails: User[];
  lastMessage?: ChatMessage;
  lastMessageTime?: any;
  unreadCount: number;
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  createdAt: any;
  updatedAt: any;
}

export interface UnreadChatInfo {
  chatId: string;
  unreadCount: number;
  lastMessage: string;
  senderName: string;
  timestamp: any;
}

class UltraFastChatService {
  private static instance: UltraFastChatService;

  public static getInstance(): UltraFastChatService {
    if (!UltraFastChatService.instance) {
      UltraFastChatService.instance = new UltraFastChatService();
    }
    return UltraFastChatService.instance;
  }

  // 🚀 GET USER CHATS WITH UNREAD COUNTS
  async getUserChats(userId: string): Promise<Chat[]> {
    try {
      console.log('💬 Loading chats for user:', userId);

      const chatsSnapshot = await firestore()
        .collection('chats')
        .where('participants', 'array-contains', userId)
        .orderBy('updatedAt', 'desc')
        .get();

      const chats: Chat[] = [];

      for (const doc of chatsSnapshot.docs) {
        const chatData = doc.data();
        
        // Get participant details
        const participantDetails: User[] = [];
        for (const participantId of chatData.participants) {
          if (participantId !== userId) {
            const userDoc = await firestore()
              .collection('users')
              .doc(participantId)
              .get();
            
            if (userDoc.exists) {
              participantDetails.push({
                id: participantId,
                ...userDoc.data()
              } as User);
            }
          }
        }

        // Get last message
        let lastMessage: ChatMessage | undefined;
        const lastMessageSnapshot = await firestore()
          .collection('messages')
          .where('chatId', '==', doc.id)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        if (!lastMessageSnapshot.empty) {
          const messageData = lastMessageSnapshot.docs[0].data();
          lastMessage = {
            id: lastMessageSnapshot.docs[0].id,
            ...messageData
          } as ChatMessage;
        }

        // Count unread messages
        const unreadSnapshot = await firestore()
          .collection('messages')
          .where('chatId', '==', doc.id)
          .where('isRead', '==', false)
          .where('senderId', '!=', userId)
          .get();

        const chat: Chat = {
          id: doc.id,
          participants: chatData.participants,
          participantDetails,
          lastMessage,
          lastMessageTime: chatData.updatedAt,
          unreadCount: unreadSnapshot.size,
          isGroup: chatData.participants.length > 2,
          groupName: chatData.groupName,
          groupAvatar: chatData.groupAvatar,
          createdAt: chatData.createdAt,
          updatedAt: chatData.updatedAt,
        };

        chats.push(chat);
      }

      console.log(`✅ Loaded ${chats.length} chats with unread counts`);
      return chats;
    } catch (error) {
      console.error('❌ Error loading user chats:', error);
      throw error;
    }
  }

  // 🚀 GET TOTAL UNREAD MESSAGE COUNT
  async getTotalUnreadCount(userId: string): Promise<number> {
    try {
      const userChats = await this.getUserChats(userId);
      const totalUnread = userChats.reduce((total, chat) => total + chat.unreadCount, 0);
      
      console.log(`📬 Total unread messages: ${totalUnread}`);
      return totalUnread;
    } catch (error) {
      console.error('❌ Error getting total unread count:', error);
      return 0;
    }
  }

  // 🚀 SEND REEL TO CHAT
  async sendReelToChat(
    senderId: string,
    chatId: string,
    reelId: string,
    customMessage?: string
  ): Promise<boolean> {
    try {
      console.log('📤 Sending reel to chat:', { chatId, reelId });

      const batch = firestore().batch();

      // Create reel message
      const messageRef = firestore().collection('messages').doc();
      batch.set(messageRef, {
        chatId,
        senderId,
        content: customMessage || 'Shared a reel',
        contentType: 'reel',
        reelId,
        createdAt: firestore.FieldValue.serverTimestamp(),
        isRead: false,
        readBy: [senderId],
      });

      // Update chat with last message
      const chatRef = firestore().collection('chats').doc(chatId);
      batch.update(chatRef, {
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();

      console.log('✅ Reel sent to chat successfully');
      return true;
    } catch (error) {
      console.error('❌ Error sending reel to chat:', error);
      return false;
    }
  }

  // 🚀 SEND POST TO CHAT
  async sendPostToChat(
    senderId: string,
    chatId: string,
    postId: string,
    customMessage?: string
  ): Promise<boolean> {
    try {
      console.log('📤 Sending post to chat:', { chatId, postId });

      const batch = firestore().batch();

      // Create post message
      const messageRef = firestore().collection('messages').doc();
      batch.set(messageRef, {
        chatId,
        senderId,
        content: customMessage || 'Shared a post',
        contentType: 'post',
        postId,
        createdAt: firestore.FieldValue.serverTimestamp(),
        isRead: false,
        readBy: [senderId],
      });

      // Update chat with last message
      const chatRef = firestore().collection('chats').doc(chatId);
      batch.update(chatRef, {
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();

      console.log('✅ Post sent to chat successfully');
      return true;
    } catch (error) {
      console.error('❌ Error sending post to chat:', error);
      return false;
    }
  }

  // 🚀 CREATE OR GET CHAT BETWEEN USERS
  async createOrGetChat(currentUserId: string, targetUserId: string): Promise<string> {
    try {
      console.log('💬 Creating/getting chat between:', currentUserId, targetUserId);

      // Check if chat already exists
      const existingChatSnapshot = await firestore()
        .collection('chats')
        .where('participants', 'array-contains', currentUserId)
        .get();

      for (const doc of existingChatSnapshot.docs) {
        const chatData = doc.data();
        if (
          chatData.participants.length === 2 &&
          chatData.participants.includes(targetUserId)
        ) {
          console.log('✅ Found existing chat:', doc.id);
          return doc.id;
        }
      }

      // Create new chat
      const newChatRef = firestore().collection('chats').doc();
      await newChatRef.set({
        participants: [currentUserId, targetUserId],
        isGroup: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      console.log('✅ Created new chat:', newChatRef.id);
      return newChatRef.id;
    } catch (error) {
      console.error('❌ Error creating/getting chat:', error);
      throw error;
    }
  }

  // 🚀 MARK MESSAGES AS READ
  async markMessagesAsRead(chatId: string, userId: string): Promise<boolean> {
    try {
      console.log('👀 Marking messages as read:', { chatId, userId });

      const unreadMessages = await firestore()
        .collection('messages')
        .where('chatId', '==', chatId)
        .where('isRead', '==', false)
        .where('senderId', '!=', userId)
        .get();

      if (unreadMessages.empty) {
        return true;
      }

      const batch = firestore().batch();

      unreadMessages.docs.forEach(doc => {
        batch.update(doc.ref, {
          isRead: true,
          readBy: firestore.FieldValue.arrayUnion(userId),
        });
      });

      await batch.commit();

      console.log(`✅ Marked ${unreadMessages.size} messages as read`);
      return true;
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
      return false;
    }
  }

  // 🚀 LISTEN TO CHAT MESSAGES
  subscribeToMessages(
    chatId: string,
    onMessagesUpdate: (messages: ChatMessage[]) => void
  ): () => void {
    console.log('👂 Subscribing to messages for chat:', chatId);

    return firestore()
      .collection('messages')
      .where('chatId', '==', chatId)
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        (snapshot) => {
          const messages: ChatMessage[] = [];
          
          snapshot.docs.forEach(doc => {
            messages.push({
              id: doc.id,
              ...doc.data()
            } as ChatMessage);
          });

          onMessagesUpdate(messages);
        },
        (error) => {
          console.error('❌ Error listening to messages:', error);
        }
      );
  }

  // 🚀 LISTEN TO UNREAD COUNT
  subscribeToUnreadCount(
    userId: string,
    onUnreadCountUpdate: (count: number) => void
  ): () => void {
    console.log('👂 Subscribing to unread count for user:', userId);

    return firestore()
      .collection('messages')
      .where('receiverId', '==', userId)
      .where('isRead', '==', false)
      .onSnapshot(
        async (snapshot) => {
          const unreadCount = snapshot.size;
          onUnreadCountUpdate(unreadCount);
        },
        (error) => {
          console.error('❌ Error listening to unread count:', error);
        }
      );
  }
}

export default UltraFastChatService;
