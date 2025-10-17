import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService, { Chat } from '../services/firebaseService';
import { RootStackParamList } from '../types';
import { BeautifulCard } from '../components/BeautifulCard';
import InstagramMessagingService, { ChatWithNotification } from '../services/InstagramMessagingService';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

interface ChatListItem {
  id: string;
  participants: string[];
  createdAt: Date;
  updatedAt: Date;
  isGroup: boolean;
  groupName?: string;
  isActive: boolean;
  otherUser?: {
    uid: string;
    displayName: string;
    profilePicture?: string;
  };
  lastMessageText?: string;
  lastMessageTime?: Date;
  unreadCount?: number;
}

interface ChatListScreenProps {
  route?: {
    params?: {
      shareContent?: {
        type: 'post' | 'reel';
        id: string;
        mediaUrls?: string[];
        videoUrl?: string;
        caption?: string;
        userName: string;
        userProfilePicture?: string;
        thumbnailUrl?: string;
        createdAt?: Date;
      };
    };
  };
}

export default function ChatListScreen({ route }: ChatListScreenProps): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatWithNotification[]>([]);
  const [loading, setLoading] = useState(true);
  
  const shareContent = route?.params?.shareContent;
  const isShareMode = !!shareContent;

  // Load chats when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadChatsWithNotifications();
    }, [user])
  );

  const loadChatsWithNotifications = async () => {
    if (!user) {
      console.log('🚫 No user found, skipping chat loading');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('� Loading chats with Instagram-style notifications for user:', user.uid);
      
      // Initialize messaging service for this user
      const messagingService = InstagramMessagingService.getInstance();
      messagingService.initializeForUser(user.uid);
      
      // Get chats with notification info
      const chatsWithNotifications = await messagingService.getUserChatsWithNotifications();
      
      console.log(`✅ Loaded ${chatsWithNotifications.length} chats with notifications`);
      setChats(chatsWithNotifications);
      
      // Set up real-time listeners
      messagingService.on('chats-updated', (updatedChats) => {
        console.log('🔄 Real-time chat updates received');
        setChats(updatedChats);
      });
      
    } catch (error) {
      console.error('❌ Error loading chats with notifications:', error);
      Alert.alert('Error', 'Failed to load chats. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const navigateToUserSearch = () => {
    navigation.navigate('ChatUserSearch');
  };

  const formatTime = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    
    if (hours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (hours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderChatItem = ({ item }: { item: ChatWithNotification }) => {
    try {
      if (!item || !item.otherUser) {
        console.warn('Invalid chat item:', item);
        return null;
      }

      const displayName = item.otherUser?.displayName || 'Unknown User';
      const avatarLetter = displayName.charAt(0)?.toUpperCase() || 'U';
      const lastMessage = item.lastMessage?.text || 'No messages yet';
      const unreadCount = item.unreadCount || 0;
      const hasNewMessage = item.hasNewMessage;

      return (
        <TouchableOpacity onPress={() => navigateToChat(item)} style={styles.chatItemContainer}>
          <BeautifulCard style={[styles.chatItem, hasNewMessage && styles.newMessageChat]}>
            <View style={styles.chatContent}>
              <View style={styles.avatarContainer}>
                {item.otherUser?.profilePicture ? (
                  <Image 
                    source={{ uri: item.otherUser.profilePicture }} 
                    style={styles.avatar} 
                  />
                ) : (
                  <View style={styles.defaultAvatar}>
                    <Text style={styles.avatarText}>
                      {avatarLetter}
                    </Text>
                  </View>
                )}
                
                {/* Instagram-style blue dot for new messages */}
                {hasNewMessage && (
                  <View style={styles.newMessageDot} />
                )}
              </View>
              
              <View style={styles.chatDetails}>
                <View style={styles.chatHeader}>
                  <Text style={[styles.userName, hasNewMessage && styles.newMessageUserName]} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {item.lastMessage?.timestamp && (
                    <Text style={[styles.timeText, hasNewMessage && styles.newMessageTime]}>
                      {formatTime(item.lastMessage.timestamp)}
                    </Text>
                  )}
                </View>
                
                <View style={styles.messageRow}>
                  <Text style={[styles.lastMessage, hasNewMessage && styles.newMessageText]} numberOfLines={1}>
                    {lastMessage}
                  </Text>
                  {unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </BeautifulCard>
        </TouchableOpacity>
      );
    } catch (error) {
      console.error('Error rendering chat item:', error);
      return null;
    }
  };

  const navigateToChat = (chat: ChatWithNotification) => {
    // Mark chat as read when opening
    InstagramMessagingService.getInstance().markChatAsRead(chat.id);
    
    if (isShareMode && shareContent) {
      navigation.navigate('ChatScreen', {
        chatId: chat.id,
        userId: chat.otherUser?.uid,
        shareContent: shareContent,
      });
    } else {
      navigation.navigate('ChatScreen', {
        chatId: chat.id,
        userId: chat.otherUser?.uid,
      });
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="chatbubbles-outline" size={80} color="#ccc" />
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>Start chatting with your friends!</Text>
      <TouchableOpacity style={styles.startChatButton} onPress={navigateToUserSearch}>
        <Icon name="add" size={24} color="#fff" />
        <Text style={styles.startChatText}>Start New Chat</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          <TouchableOpacity onPress={navigateToUserSearch} style={styles.headerButton}>
            <Icon name="add" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity onPress={navigateToUserSearch} style={styles.headerButton}>
          <Icon name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={chats.length === 0 ? styles.emptyListContainer : styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshing={loading}
        onRefresh={loadChatsWithNotifications}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  emptyListContainer: {
    flex: 1,
  },
  chatItemContainer: {
    marginVertical: 4,
  },
  chatItem: {
    padding: 0,
    marginHorizontal: 0,
  },
  chatContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  defaultAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  chatDetails: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#8e8e93',
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#8e8e93',
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8e8e93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  startChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startChatText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Instagram-style new message indicators
  newMessageChat: {
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  avatarContainer: {
    position: 'relative',
  },
  newMessageDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#fff',
  },
  newMessageUserName: {
    fontWeight: '700',
    color: '#000',
  },
  newMessageTime: {
    color: '#007AFF',
    fontWeight: '600',
  },
  newMessageText: {
    fontWeight: '600',
    color: '#000',
  },
});
