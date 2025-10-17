import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/FastAuthContext';
import { useNavigation } from '@react-navigation/native';
import FirebaseService from '../services/firebaseService';

const { width } = Dimensions.get('window');

interface SocialActivity {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'share' | 'story_view';
  userId: string;
  username: string;
  userAvatar: string;
  postId?: string;
  postImage?: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

interface TrendingTopic {
  id: string;
  hashtag: string;
  postsCount: number;
  trend: 'up' | 'down' | 'new';
}

interface SuggestedUser {
  id: string;
  username: string;
  avatar: string;
  followersCount: number;
  isVerified: boolean;
  mutualFriends: number;
  bio: string;
}

export default function SocialHubScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'activity' | 'trending' | 'suggestions'>('activity');
  const [activities, setActivities] = useState<SocialActivity[]>([]);
  const [trending, setTrending] = useState<TrendingTopic[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadData();
    
    // Set up real-time listener for activities
    const unsubscribe = FirebaseService.listenToActivities(user?.uid || '', (newActivities: any[]) => {
      setActivities(newActivities as SocialActivity[]);
      const unread = newActivities.filter((activity: any) => !activity.isRead).length;
      setUnreadCount(unread);
    });

    return unsubscribe;
  }, [user]);

  const loadData = async () => {
    try {
      const [activitiesData, trendingData, suggestionsData] = await Promise.all([
        FirebaseService.getUserActivities(user?.uid || ''),
        FirebaseService.getTrendingTopics(),
        FirebaseService.getSuggestedUsers(user?.uid || ''),
      ]);

      setActivities(activitiesData as SocialActivity[]);
      setTrending(trendingData as TrendingTopic[]);
      setSuggestions(suggestionsData as SuggestedUser[]);
      
      const unread = (activitiesData as SocialActivity[]).filter((activity: SocialActivity) => !activity.isRead).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error loading social hub data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const markActivityAsRead = async (activityId: string) => {
    try {
      await FirebaseService.markActivityAsRead(activityId);
      setActivities(prev => 
        prev.map(activity => 
          activity.id === activityId ? { ...activity, isRead: true } : activity
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking activity as read:', error);
    }
  };

  const followUser = async (userId: string) => {
    try {
      await FirebaseService.followUser(user?.uid || '', userId);
      setSuggestions(prev => prev.filter(suggestion => suggestion.id !== userId));
      Alert.alert('Success', 'User followed successfully!');
    } catch (error) {
      console.error('Error following user:', error);
      Alert.alert('Error', 'Failed to follow user');
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'like': return 'heart';
      case 'comment': return 'chatbubble';
      case 'follow': return 'person-add';
      case 'mention': return 'at';
      case 'share': return 'share';
      case 'story_view': return 'eye';
      default: return 'notifications';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'like': return '#ff3040';
      case 'comment': return '#1DA1F2';
      case 'follow': return '#10B981';
      case 'mention': return '#8B5CF6';
      case 'share': return '#F59E0B';
      case 'story_view': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const renderActivity = ({ item }: { item: SocialActivity }) => (
    <TouchableOpacity
      style={[styles.activityItem, !item.isRead && styles.unreadActivity]}
      onPress={() => {
        markActivityAsRead(item.id);
        if (item.postId) {
          // Simple navigation without type issues
          (navigation as any).navigate('PostDetail', { postId: item.postId });
        }
      }}
    >
      <View style={[styles.activityIcon, { backgroundColor: getActivityColor(item.type) }]}>
        <Icon name={getActivityIcon(item.type)} size={16} color="#fff" />
      </View>
      
      <Image source={{ uri: item.userAvatar }} style={styles.activityAvatar} />
      
      <View style={styles.activityContent}>
        <Text style={styles.activityText}>
          <Text style={styles.activityUsername}>{item.username}</Text>
          {' '}{item.message}
        </Text>
        <Text style={styles.activityTime}>{formatTimeAgo(item.timestamp)}</Text>
      </View>
      
      {item.postImage && (
        <Image source={{ uri: item.postImage }} style={styles.activityPostImage} />
      )}
      
      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  const renderTrendingTopic = ({ item }: { item: TrendingTopic }) => (
    <TouchableOpacity
      style={styles.trendingItem}
      onPress={() => (navigation as any).navigate('Search', { query: item.hashtag })}
    >
      <View style={styles.trendingContent}>
        <View style={styles.trendingHeader}>
          <Text style={styles.trendingHashtag}>#{item.hashtag}</Text>
          <View style={[styles.trendingBadge, { backgroundColor: getTrendColor(item.trend) }]}>
            <Icon 
              name={getTrendIcon(item.trend)} 
              size={12} 
              color="#fff" 
            />
          </View>
        </View>
        <Text style={styles.trendingCount}>
          {item.postsCount.toLocaleString()} posts
        </Text>
      </View>
    </TouchableOpacity>
  );

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return '#10B981';
      case 'down': return '#EF4444';
      case 'new': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return 'trending-up';
      case 'down': return 'trending-down';
      case 'new': return 'flash';
      default: return 'remove';
    }
  };

  const renderSuggestion = ({ item }: { item: SuggestedUser }) => (
    <View style={styles.suggestionItem}>
      <Image source={{ uri: item.avatar }} style={styles.suggestionAvatar} />
      
      <View style={styles.suggestionContent}>
        <View style={styles.suggestionHeader}>
          <Text style={styles.suggestionUsername}>{item.username}</Text>
          {item.isVerified && (
            <Icon name="checkmark-circle" size={16} color="#1DA1F2" />
          )}
        </View>
        
        <Text style={styles.suggestionBio} numberOfLines={2}>
          {item.bio}
        </Text>
        
        <View style={styles.suggestionStats}>
          <Text style={styles.suggestionStat}>
            {item.followersCount.toLocaleString()} followers
          </Text>
          {item.mutualFriends > 0 && (
            <Text style={styles.suggestionMutual}>
              {item.mutualFriends} mutual friends
            </Text>
          )}
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.followButton}
        onPress={() => followUser(item.id)}
      >
        <Text style={styles.followButtonText}>Follow</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    if (activeTab === 'activity') {
      return (
        <FlatList
          data={activities}
          renderItem={renderActivity}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      );
    } else if (activeTab === 'trending') {
      return (
        <FlatList
          data={trending}
          renderItem={renderTrendingTopic}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      );
    } else {
      return (
        <FlatList
          data={suggestions}
          renderItem={renderSuggestion}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Social Hub</Text>
        {unreadCount > 0 && (
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'activity' && styles.activeTab]}
          onPress={() => setActiveTab('activity')}
        >
          <Icon name="notifications" size={20} color={activeTab === 'activity' ? '#E1306C' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'activity' && styles.activeTabText]}>
            Activity
          </Text>
          {unreadCount > 0 && activeTab !== 'activity' && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'trending' && styles.activeTab]}
          onPress={() => setActiveTab('trending')}
        >
          <Icon name="trending-up" size={20} color={activeTab === 'trending' ? '#E1306C' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'trending' && styles.activeTabText]}>
            Trending
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'suggestions' && styles.activeTab]}
          onPress={() => setActiveTab('suggestions')}
        >
          <Icon name="people" size={20} color={activeTab === 'suggestions' ? '#E1306C' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'suggestions' && styles.activeTabText]}>
            Suggestions
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {renderContent()}

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => (navigation as any).navigate('CreatePost')}
        >
          <Icon name="add-circle" size={24} color="#E1306C" />
          <Text style={styles.quickActionText}>Post</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => (navigation as any).navigate('EnhancedCreateStory')}
        >
          <Icon name="camera" size={24} color="#E1306C" />
          <Text style={styles.quickActionText}>Story</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => (navigation as any).navigate('EnhancedCreateReel')}
        >
          <Icon name="videocam" size={24} color="#E1306C" />
          <Text style={styles.quickActionText}>Reel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => (navigation as any).navigate('VideoCall')}
        >
          <Icon name="call" size={24} color="#E1306C" />
          <Text style={styles.quickActionText}>Live</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    position: 'relative',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  notificationBadge: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#ff3040',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  notificationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#E1306C',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#E1306C',
    fontWeight: '600',
  },
  tabBadge: {
    position: 'absolute',
    top: 4,
    right: '25%',
    backgroundColor: '#ff3040',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
  },
  // Activity styles
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    position: 'relative',
  },
  unreadActivity: {
    backgroundColor: '#f8f9ff',
    borderLeftWidth: 3,
    borderLeftColor: '#E1306C',
  },
  activityIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 2,
  },
  activityUsername: {
    fontWeight: '600',
  },
  activityTime: {
    fontSize: 12,
    color: '#666',
  },
  activityPostImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginLeft: 8,
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E1306C',
  },
  // Trending styles
  trendingItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  trendingContent: {
    flex: 1,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  trendingHashtag: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E1306C',
  },
  trendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendingCount: {
    fontSize: 14,
    color: '#666',
  },
  // Suggestion styles
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  suggestionAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  suggestionUsername: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
  suggestionBio: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  suggestionStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionStat: {
    fontSize: 12,
    color: '#666',
    marginRight: 12,
  },
  suggestionMutual: {
    fontSize: 12,
    color: '#E1306C',
  },
  followButton: {
    backgroundColor: '#E1306C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});
