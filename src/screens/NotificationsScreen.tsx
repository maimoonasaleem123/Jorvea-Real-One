import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { FirebaseService } from '../services/firebaseService';
import { useAuth } from '../context/FastAuthContext';
import { RootStackParamList } from '../types';
import firestore from '@react-native-firebase/firestore';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  fromUserId: string;
  fromUser: {
    displayName: string;
    profilePicture: string;
  };
  postId?: string;
  postImage?: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

type NotificationsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<NotificationsScreenNavigationProp>();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Set up real-time listener for notifications
  useEffect(() => {
    if (!user?.uid) return;

    console.log('🔔 Setting up real-time notifications listener for user:', user.uid);

    const unsubscribe = firestore()
      .collection('notifications')
      .where('recipientId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(
        async (snapshot) => {
          console.log('📱 Real-time notifications update received:', snapshot.size, 'notifications');
          
          try {
            const notificationsList: Notification[] = [];

            for (const doc of snapshot.docs) {
              const data = doc.data();
              console.log('📝 Processing notification:', doc.id, data.type);

              // Get sender user data
              let senderData;
              try {
                senderData = await FirebaseService.getUserProfile(data.senderId);
              } catch (error) {
                console.warn('Failed to get sender data for notification:', doc.id);
                continue;
              }

              if (!senderData) {
                console.warn('No sender data found for notification:', doc.id);
                continue;
              }

              // Get post image if applicable
              let postImage = '';
              if (data.contentId && data.contentType === 'post') {
                try {
                  const postData = await FirebaseService.getPostById(data.contentId);
                  postImage = postData?.mediaUrls?.[0] || '';
                } catch (error) {
                  console.warn('Failed to get post data for notification:', doc.id);
                }
              }

              // Format timestamp
              let timestamp = new Date();
              if (data.createdAt) {
                if (data.createdAt.toDate) {
                  timestamp = data.createdAt.toDate();
                } else if (typeof data.createdAt === 'string') {
                  timestamp = new Date(data.createdAt);
                }
              }

              notificationsList.push({
                id: doc.id,
                type: data.type,
                fromUserId: data.senderId,
                fromUser: {
                  displayName: senderData.displayName || senderData.username || 'Unknown User',
                  profilePicture: senderData.profilePicture || 'https://via.placeholder.com/150',
                },
                postId: data.contentId,
                postImage,
                message: data.message || `${data.type}d your ${data.contentType || 'post'}`,
                timestamp,
                read: data.read || false,
              });
            }

            console.log(`✅ Processed ${notificationsList.length} notifications`);
            setNotifications(notificationsList);
          } catch (error) {
            console.error('❌ Error processing notifications:', error);
          } finally {
            setLoading(false);
          }
        },
        (error) => {
          console.error('❌ Error listening to notifications:', error);
          setLoading(false);
          Alert.alert('Error', 'Failed to load notifications. Please try again.');
        }
      );

    return () => {
      console.log('🔕 Cleaning up notifications listener');
      unsubscribe();
    };
  }, [user?.uid]);

  // Focus effect to mark notifications as read when screen is viewed
  useFocusEffect(
    useCallback(() => {
      if (notifications.length > 0) {
        // Mark all notifications as read after a short delay
        const markAsReadTimer = setTimeout(() => {
          markAllAsRead();
        }, 2000);

        return () => clearTimeout(markAsReadTimer);
      }
    }, [notifications])
  );

  const markAllAsRead = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      if (unreadNotifications.length === 0) return;

      console.log(`📖 Marking ${unreadNotifications.length} notifications as read`);

      const batch = firestore().batch();
      unreadNotifications.forEach(notification => {
        const ref = firestore().collection('notifications').doc(notification.id);
        batch.update(ref, { read: true });
      });

      await batch.commit();
      console.log('✅ All notifications marked as read');
    } catch (error) {
      console.error('❌ Error marking notifications as read:', error);
    }
  }, [user?.uid, notifications]);

  const loadNotifications = async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      console.log('🔄 Loading notifications via FirebaseService...');
      const userNotifications = await FirebaseService.getUserNotifications(user.uid);
      console.log(`📥 Loaded ${userNotifications.length} notifications from FirebaseService`);
      setNotifications(userNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await firestore().collection('notifications').doc(notificationId).update({
        read: true
      });
      
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    console.log('📱 Notification pressed:', notification.type, notification.id);
    
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate based on notification type
    switch (notification.type) {
      case 'like':
      case 'comment':
        if (notification.postId) {
          console.log('🖼️ Navigating to post:', notification.postId);
          navigation.navigate('PostDetail', { postId: notification.postId });
        }
        break;
      case 'follow':
        console.log('👤 Navigating to user profile:', notification.fromUserId);
        navigation.navigate('UserProfile', { userId: notification.fromUserId });
        break;
      default:
        console.log('📱 Unknown notification type:', notification.type);
        break;
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const getNotificationIcon = () => {
      switch (item.type) {
        case 'like':
          return <Icon name="heart" size={20} color="#E1306C" />;
        case 'comment':
          return <Icon name="chatbubble" size={20} color="#3797EF" />;
        case 'follow':
          return <Icon name="person-add" size={20} color="#00C896" />;
        case 'mention':
          return <Icon name="at" size={20} color="#8E8E93" />;
        default:
          return <Icon name="notifications" size={20} color="#8E8E93" />;
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.read && styles.unreadNotification
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <Image
          source={{ uri: item.fromUser.profilePicture }}
          style={styles.profileImage}
        />
        
        <View style={styles.notificationContent}>
          <Text style={styles.notificationText}>
            <Text style={styles.username}>{item.fromUser.displayName}</Text>
            {' ' + item.message}
          </Text>
          <Text style={styles.timestamp}>
            {getTimeAgo(item.timestamp)}
          </Text>
        </View>

        <View style={styles.notificationIcon}>
          {getNotificationIcon()}
        </View>

        {item.postImage && (
          <Image
            source={{ uri: item.postImage }}
            style={styles.postThumbnail}
          />
        )}

        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - timestamp.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h`;
    } else if (diffInDays < 7) {
      return `${diffInDays}d`;
    } else {
      return timestamp.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E1306C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#E1306C']}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="notifications-outline" size={64} color="#8E8E93" />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              When someone likes or comments on your posts, you'll see it here
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  listContainer: {
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5E5',
  },
  unreadNotification: {
    backgroundColor: '#F8F9FA',
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    marginRight: 8,
  },
  notificationText: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 18,
  },
  username: {
    fontWeight: '600',
    color: '#262626',
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  notificationIcon: {
    marginRight: 8,
  },
  postThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 4,
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E1306C',
    position: 'absolute',
    right: 8,
    top: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#262626',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationsScreen;
