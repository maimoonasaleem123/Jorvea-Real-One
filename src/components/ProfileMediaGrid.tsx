import React, { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  StyleSheet,
  Modal,
  Text,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { useTheme } from '../context/ThemeContext';
import { Post, Reel } from '../services/firebaseService';
import VideoMessagePlayer from './VideoMessagePlayer';

const { width } = Dimensions.get('window');
const GRID_SPACING = 2;
const GRID_ITEM_SIZE = (width - GRID_SPACING * 2) / 3;

interface ProfileMediaGridProps {
  posts: Post[];
  reels: Reel[];
  activeTab: 'posts' | 'reels';
  onTabChange: (tab: 'posts' | 'reels') => void;
  onPostPress?: (post: Post, index: number) => void;
  onReelPress?: (reel: Reel, index: number) => void;
  currentUserId?: string;
}

interface MediaItemProps {
  item: Post | Reel;
  index: number;
  onPress: () => void;
  type: 'post' | 'reel';
}

const MediaItem: React.FC<MediaItemProps> = ({ item, index, onPress, type }) => {
  const { colors } = useTheme();
  const [imageLoading, setImageLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleImageLoad = () => {
    setImageLoading(false);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const getMediaPreview = () => {
    const mediaUrl = 'mediaUrls' in item 
      ? (item.mediaUrls && item.mediaUrls.length > 0 ? item.mediaUrls[0] : '') 
      : 'videoUrl' in item ? item.videoUrl : '';
    const isVideo = type === 'reel' || ('mediaType' in item && item.mediaType === 'video');

    if (isVideo) {
      return (
        <View style={styles.videoPreview}>
          <Image
            source={{ uri: mediaUrl }}
            style={styles.mediaImage}
            onLoad={handleImageLoad}
          />
          <View style={styles.videoOverlay}>
            <Icon name="play" size={20} color="#fff" />
          </View>
          {type === 'reel' && (
            <View style={styles.reelIndicator}>
              <Icon name="videocam" size={16} color="#fff" />
            </View>
          )}
        </View>
      );
    }

    return (
      <Image
        source={{ uri: mediaUrl }}
        style={styles.mediaImage}
        onLoad={handleImageLoad}
        resizeMode="cover"
      />
    );
  };

  const getEngagementStats = () => {
    const likesCount = 'likes' in item ? item.likes?.length || 0 : 0;
    const commentsCount = 'comments' in item ? item.comments?.length || 0 : 0;
    
    if (type === 'reel') {
      const viewsCount = 'viewsCount' in item ? item.viewsCount || 0 : 0;
      return (
        <View style={styles.reelStats}>
          <View style={styles.statItem}>
            <Icon name="play" size={12} color="#fff" />
            <Text style={styles.statText}>{formatNumber(viewsCount)}</Text>
          </View>
        </View>
      );
    }

    if (likesCount > 0 || commentsCount > 0) {
      return (
        <View style={styles.postStats}>
          {likesCount > 0 && (
            <View style={styles.statItem}>
              <Icon name="heart" size={12} color="#fff" />
              <Text style={styles.statText}>{formatNumber(likesCount)}</Text>
            </View>
          )}
          {commentsCount > 0 && (
            <View style={styles.statItem}>
              <Icon name="chatbubble" size={12} color="#fff" />
              <Text style={styles.statText}>{formatNumber(commentsCount)}</Text>
            </View>
          )}
        </View>
      );
    }

    return null;
  };

  return (
    <TouchableOpacity
      style={[styles.mediaItem, { backgroundColor: colors.surface }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {imageLoading && (
        <View style={styles.loadingContainer}>
          <Icon name="image" size={24} color={colors.border} />
        </View>
      )}
      
      <Animated.View style={[styles.mediaContainer, { opacity: fadeAnim }]}>
        {getMediaPreview()}
        {getEngagementStats()}
      </Animated.View>
    </TouchableOpacity>
  );
};

interface MediaViewerProps {
  visible: boolean;
  items: (Post | Reel)[];
  initialIndex: number;
  type: 'posts' | 'reels';
  onClose: () => void;
  currentUserId?: string;
}

const MediaViewer: React.FC<MediaViewerProps> = ({
  visible,
  items,
  initialIndex,
  type,
  onClose,
  currentUserId,
}) => {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  const currentItem = items[currentIndex];

  const renderMediaItem = ({ item, index }: { item: Post | Reel; index: number }) => {
    const mediaUrl = 'mediaUrls' in item 
      ? (item.mediaUrls && item.mediaUrls.length > 0 ? item.mediaUrls[0] : '') 
      : 'videoUrl' in item ? item.videoUrl : '';
    const isVideo = type === 'reels' || ('mediaType' in item && item.mediaType === 'video');

    return (
      <View style={styles.fullScreenMedia}>
        {isVideo ? (
          <VideoMessagePlayer
            videoUri={mediaUrl}
            isMyMessage={false}
            onError={(error) => console.log('Video error:', error)}
            onLoad={(data) => console.log('Video loaded:', data)}
          />
        ) : (
          <Image
            source={{ uri: mediaUrl }}
            style={styles.fullScreenImage}
            resizeMode="contain"
          />
        )}
      </View>
    );
  };

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.viewerContainer, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.viewerHeader, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.viewerTitle, { color: colors.text }]}>
            {type === 'posts' ? 'Posts' : 'Reels'} ({currentIndex + 1}/{items.length})
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Media Content */}
        <FlatList
          ref={flatListRef}
          data={items}
          renderItem={renderMediaItem}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          onScroll={handleScroll}
          getItemLayout={(data, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
        />

        {/* Media Info */}
        <View style={[styles.mediaInfo, { backgroundColor: colors.surface }]}>
          <Text style={[styles.mediaDescription, { color: colors.text }]}>
            {currentItem.caption || ''}
          </Text>
          <View style={styles.mediaActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Icon name="heart-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Icon name="chatbubble-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Icon name="paper-plane-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const ProfileMediaGrid: React.FC<ProfileMediaGridProps> = ({
  posts,
  reels,
  activeTab,
  onTabChange,
  onPostPress,
  onReelPress,
  currentUserId,
}) => {
  const { colors } = useTheme();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerType, setViewerType] = useState<'posts' | 'reels'>('posts');
  const [viewerIndex, setViewerIndex] = useState(0);

  const currentData = activeTab === 'posts' ? posts : reels;

  const handleItemPress = (item: Post | Reel, index: number) => {
    if (activeTab === 'posts' && onPostPress) {
      onPostPress(item as Post, index);
    } else if (activeTab === 'reels' && onReelPress) {
      onReelPress(item as Reel, index);
    }
    
    // Open in viewer
    setViewerType(activeTab);
    setViewerIndex(index);
    setViewerVisible(true);
  };

  const renderTabButton = (tab: 'posts' | 'reels', icon: string, label: string) => {
    const isActive = activeTab === tab;
    const count = tab === 'posts' ? posts.length : reels.length;

    return (
      <TouchableOpacity
        style={[
          styles.tabButton,
          isActive && { borderBottomColor: colors.primary }
        ]}
        onPress={() => onTabChange(tab)}
      >
        <Icon 
          name={icon} 
          size={20} 
          color={isActive ? colors.primary : colors.textSecondary} 
        />
        <Text style={[
          styles.tabLabel,
          { color: isActive ? colors.primary : colors.textSecondary }
        ]}>
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  const renderMediaItem = ({ item, index }: { item: Post | Reel; index: number }) => (
    <MediaItem
      item={item}
      index={index}
      onPress={() => handleItemPress(item, index)}
      type={activeTab === 'posts' ? 'post' : 'reel'}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon 
        name={activeTab === 'posts' ? 'camera-outline' : 'videocam-outline'} 
        size={48} 
        color={colors.border} 
      />
      <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
        No {activeTab} yet
      </Text>
      <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
        Start creating to see your {activeTab} here
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab Buttons */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        {renderTabButton('posts', 'grid-outline', 'Posts')}
        {renderTabButton('reels', 'play-outline', 'Reels')}
      </View>

      {/* Media Grid */}
      {currentData.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={currentData}
          renderItem={renderMediaItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContainer}
          ItemSeparatorComponent={() => <View style={{ height: GRID_SPACING }} />}
          columnWrapperStyle={styles.gridRow}
        />
      )}

      {/* Media Viewer */}
      <MediaViewer
        visible={viewerVisible}
        items={currentData}
        initialIndex={viewerIndex}
        type={activeTab}
        onClose={() => setViewerVisible(false)}
        currentUserId={currentUserId}
      />
    </View>
  );
};

const formatNumber = (num: number): string => {
  if (num < 1000) return num.toString();
  if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
  return `${(num / 1000000).toFixed(1)}M`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  gridContainer: {
    padding: GRID_SPACING,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  mediaItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    marginBottom: GRID_SPACING,
    borderRadius: 8,
    overflow: 'hidden',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaContainer: {
    flex: 1,
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoPreview: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  postStats: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    gap: 8,
  },
  reelStats: {
    position: 'absolute',
    bottom: 4,
    left: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },

  // Viewer Styles
  viewerContainer: {
    flex: 1,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    padding: 8,
  },
  viewerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  fullScreenMedia: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  mediaInfo: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  mediaDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  mediaActions: {
    flexDirection: 'row',
    gap: 24,
  },
  actionButton: {
    padding: 8,
  },
});

export default ProfileMediaGrid;
