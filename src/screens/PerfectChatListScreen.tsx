import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import UltraFastShareService, { ShareTarget } from '../services/UltraFastShareService';
import PerfectChatService, { UnreadChatInfo } from '../services/PerfectChatService';
import firestore from '@react-native-firebase/firestore';

const { width } = Dimensions.get('window');

interface Chat {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTime: Date;
  lastMessageType: 'text' | 'reel' | 'post' | 'image';
  unreadCount: number;
  otherUser: {
    id: string;
    name: string;
    avatar?: string;
    username?: string;
    isOnline: boolean;
  };
}

const PerfectChatListScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  const perfectChatService = PerfectChatService.getInstance();
  const ultraFastShareService = UltraFastShareService.getInstance();

  // Load chats when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        loadChats();
        setupRealTimeListener();
      }
    }, [user?.uid])
  );

  const loadChats = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      console.log('📱 Loading chats for user:', user.uid);

      // Get all chats where user is a participant
      const chatsSnapshot = await firestore()
        .collection('chats')
        .where('participants', 'array-contains', user.uid)
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get();

      if (chatsSnapshot.empty) {
        console.log('💬 No chats found');
        setChats([]);
        setLoading(false);
        return;
      }

      // Process each chat
      const chatPromises = chatsSnapshot.docs.map(async (doc) => {
        try {
          const chatData = doc.data();
          const chatId = doc.id;

          // Get the other participant
          const otherUserId = chatData.participants.find((p: string) => p !== user.uid);
          if (!otherUserId) return null;

          // Get other user details
          const userDoc = await firestore().collection('users').doc(otherUserId).get();
          const userData = userDoc.exists ? userDoc.data() : null;

          // Get unread count
          const unreadCount = await perfectChatService.hasChatUnreadMessages(user.uid, chatId) ? 1 : 0;

          return {
            id: chatId,
            participants: chatData.participants,
            lastMessage: chatData.lastMessage || 'No messages yet',
            lastMessageTime: chatData.lastMessageTime ? chatData.lastMessageTime.toDate() : new Date(),
            lastMessageType: chatData.lastMessageType || 'text',
            unreadCount,
            otherUser: {
              id: otherUserId,
              name: userData?.displayName || userData?.username || 'User',
              avatar: userData?.profilePicture,
              username: userData?.username,
              isOnline: userData?.isOnline || false,
            },
          };
        } catch (error) {
          console.warn('Error processing chat:', error);
          return null;
        }
      });

      const chatResults = await Promise.all(chatPromises);
      const validChats = chatResults.filter(chat => chat !== null) as Chat[];

      // Sort by last message time
      validChats.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

      setChats(validChats);

      // Update total unread count
      const totalUnread = validChats.reduce((sum, chat) => sum + chat.unreadCount, 0);
      setTotalUnreadCount(totalUnread);

      console.log(`✅ Loaded ${validChats.length} chats`);
    } catch (error) {
      console.error('❌ Error loading chats:', error);
      Alert.alert('Error', 'Failed to load chats. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setupRealTimeListener = () => {
    if (!user?.uid) return;

    return perfectChatService.listenForUnreadUpdates(
      user.uid,
      (unreadChats, totalCount) => {
        setTotalUnreadCount(totalCount);
        // Refresh chats when unread status changes
        loadChats();
      }
    );
  };

  const openChat = async (chat: Chat) => {
    try {
      // Mark chat as read
      if (chat.unreadCount > 0) {
        await perfectChatService.markChatAsRead(user?.uid || '', chat.id);
      }

      // Navigate to chat screen
      (navigation as any).navigate('ChatScreen', {
        chatId: chat.id,
        otherUser: chat.otherUser,
        chatTitle: chat.otherUser.name,
      });
    } catch (error) {
      console.error('Error opening chat:', error);
    }
  };

  const startNewChat = () => {
    (navigation as any).navigate('UserSearchScreen', {
      mode: 'chat',
      title: 'Send Message',
    });
  };

  const formatLastMessageTime = (date: Date): string => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}d`;
    return date.toLocaleDateString();
  };

  const getMessagePreview = (message: string, type: string): string => {
    switch (type) {
      case 'reel':
        return '📹 Shared a reel';
      case 'post':
        return '📸 Shared a post';
      case 'image':
        return '🖼️ Photo';
      case 'video':
        return '🎥 Video';
      default:
        return message.length > 50 ? `${message.substring(0, 50)}...` : message;
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.otherUser.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (chat.otherUser.username && chat.otherUser.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderChatItem = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      style={[styles.chatItem, item.unreadCount > 0 && styles.unreadChatItem]}
      onPress={() => openChat(item)}
      activeOpacity={0.7}
    >
      <View style={styles.chatAvatar}>
        <Image
          source={{ uri: item.otherUser.avatar || 'https://via.placeholder.com/50?text=👤' }}
          style={styles.avatarImage}
        />
        {item.otherUser.isOnline && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={[styles.chatName, item.unreadCount > 0 && styles.unreadChatName]}>
            {item.otherUser.name}
          </Text>
          <Text style={styles.chatTime}>
            {formatLastMessageTime(item.lastMessageTime)}
          </Text>
        </View>

        <View style={styles.chatMessage}>
          <Text style={[styles.lastMessage, item.unreadCount > 0 && styles.unreadLastMessage]} numberOfLines={1}>
            {getMessagePreview(item.lastMessage, item.lastMessageType)}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="chat-bubble-outline" size={64} color="rgba(255,255,255,0.3)" />
      <Text style={styles.emptyStateTitle}>No conversations yet</Text>
      <Text style={styles.emptyStateText}>Start a new conversation by searching for users</Text>
      <TouchableOpacity style={styles.startChatButton} onPress={startNewChat}>
        <Text style={styles.startChatButtonText}>Start New Chat</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Messages</Text>
          {totalUnreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{totalUnreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.newChatButton} onPress={startNewChat}>
          <Icon name="edit" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="rgba(255,255,255,0.7)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Chat List */}
      <FlatList
        data={filteredChats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadChats}
            tintColor="#fff"
            colors={['#ff3040']}
          />
        }
        ListEmptyComponent={loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff3040" />
            <Text style={styles.loadingText}>Loading conversations...</Text>
          </View>
        ) : (
          renderEmptyState()
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerBadge: {
    backgroundColor: '#ff3040',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  newChatButton: {
    backgroundColor: '#ff3040',
    borderRadius: 20,
    padding: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 25,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  chatList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  chatItem: {
    flexDirection: 'row',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  unreadChatItem: {
    backgroundColor: 'rgba(255,48,64,0.05)',
  },
  chatAvatar: {
    position: 'relative',
    marginRight: 15,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#000',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  unreadChatName: {
    fontWeight: 'bold',
  },
  chatTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  chatMessage: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  unreadLastMessage: {
    color: '#fff',
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#ff3040',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 18,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 12,
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 24,
  },
  startChatButton: {
    backgroundColor: '#ff3040',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startChatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PerfectChatListScreen;
