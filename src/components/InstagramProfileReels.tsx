import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
  Alert,
  RefreshControl,
  ImageStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useTheme } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService, { Post, Reel } from '../services/firebaseService';
import VideoThumbnailService from '../services/VideoThumbnailService';

const { width } = Dimensions.get('window');
const gridItemSize = (width - 6) / 3; // 3 items per row with 2px gaps

interface InstagramProfileReelsProps {
  userId: string;
  isOwnProfile?: boolean;
  onReelPress?: (reel: Reel, index: number) => void;
}

interface ReelWithThumbnail extends Reel {
  thumbnailGenerated?: boolean;
  localThumbnail?: string;
}

type ContentItem = Post | ReelWithThumbnail;

const InstagramProfileReels: React.FC<InstagramProfileReelsProps> = ({
  userId,
  isOwnProfile = false,
  onReelPress,
}) => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  
  const [reels, setReels] = useState<ReelWithThumbnail[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels'>('posts');
  const [showFullscreenViewer, setShowFullscreenViewer] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [thumbnailsGenerating, setThumbnailsGenerating] = useState<Set<string>>(new Set());

  // Load user content
  const loadUserContent = useCallback(async () => {
    try {
      setLoading(true);
      
      const [userPosts, userReels] = await Promise.all([
        FirebaseService.getUserPosts(userId, 50),
        FirebaseService.getUserReels(userId, 50),
      ]);

      console.log('📱 Loaded user content:', { posts: userPosts.length, reels: userReels.length });
      
      setPosts(userPosts);
      setReels(userReels.map(reel => ({ ...reel, thumbnailGenerated: false })));
      
      // Generate thumbnails for reels that don't have them
      generateMissingThumbnails(userReels);
      
    } catch (error) {
      console.error('❌ Error loading user content:', error);
      Alert.alert('Error', 'Failed to load profile content');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserContent();
    setRefreshing(false);
  }, [loadUserContent]);

  // Generate thumbnails for reels without them
  const generateMissingThumbnails = useCallback(async (reelList: Reel[]) => {
    // Check multiple possible thumbnail field names
    const hasThumbnail = (reel: any) => {
      return !!(
        reel.thumbnailUrl || 
        reel.thumbnail || 
        reel.thumbnailURL || 
        reel.coverUrl || 
        reel.cover
      );
    };
    
    const reelsNeedingThumbnails = reelList.filter(reel => !hasThumbnail(reel));
    
    if (reelsNeedingThumbnails.length === 0) {
      console.log('✅ All reels already have thumbnails');
      return;
    }
    
    console.log(`📸 Generating thumbnails for ${reelsNeedingThumbnails.length} reels`);
    
    // Process thumbnails in batches to avoid overwhelming the system
    const batchSize = 3;
    for (let i = 0; i < reelsNeedingThumbnails.length; i += batchSize) {
      const batch = reelsNeedingThumbnails.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (reel) => {
        if (thumbnailsGenerating.has(reel.id)) return;
        
        setThumbnailsGenerating(prev => new Set(prev).add(reel.id));
        
        try {
          const result = await VideoThumbnailService.generateAndUploadThumbnail({
            url: reel.videoUrl,
            timeStamp: 2000, // 2 seconds
            quality: 0.8,
          });
          
          if (result.success && result.thumbnailUrl) {
            // Update Firestore with new thumbnail
            await FirebaseService.updateReel(reel.id, {
              thumbnailUrl: result.thumbnailUrl
            });
            
            // Update local state
            setReels(prev => prev.map(r => 
              r.id === reel.id 
                ? { ...r, thumbnailUrl: result.thumbnailUrl, thumbnailGenerated: true }
                : r
            ));
            
            console.log(`✅ Generated thumbnail for reel ${reel.id}`);
          }
        } catch (error) {
          console.error(`❌ Failed to generate thumbnail for reel ${reel.id}:`, error);
        } finally {
          setThumbnailsGenerating(prev => {
            const newSet = new Set(prev);
            newSet.delete(reel.id);
            return newSet;
          });
        }
      }));
      
      // Small delay between batches
      if (i + batchSize < reelsNeedingThumbnails.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }, [thumbnailsGenerating]);

  useEffect(() => {
    loadUserContent();
  }, [loadUserContent]);

  // Handle post press with long press for delete option
  const handlePostPress = useCallback((post: Post, index: number) => {
    (navigation as any).navigate('PostDetail', {
      postId: post.id,
      post,
      fromProfile: true,
    });
  }, [navigation]);

  // Handle post long press for own posts
  const handlePostLongPress = useCallback((post: Post) => {
    if (!isOwnProfile) return;
    
    Alert.alert(
      'Post Options',
      'What would you like to do with this post?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Post',
          style: 'destructive',
          onPress: () => handleDeletePost(post),
        },
        {
          text: 'Edit Privacy',
          onPress: () => handleEditPostPrivacy(post),
        },
      ]
    );
  }, [isOwnProfile]);

  // Handle reel long press for own reels
  const handleReelLongPress = useCallback((reel: Reel) => {
    if (!isOwnProfile) return;
    
    Alert.alert(
      'Reel Options',
      'What would you like to do with this reel?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Reel',
          style: 'destructive',
          onPress: () => handleDeleteReel(reel),
        },
        {
          text: 'Edit Privacy',
          onPress: () => handleEditReelPrivacy(reel),
        },
      ]
    );
  }, [isOwnProfile]);

  // Delete post functionality
  const handleDeletePost = useCallback(async (post: Post) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await FirebaseService.deletePostSimple(post.id);
              
              // Update local state
              setPosts(prev => prev.filter(p => p.id !== post.id));
              
              Alert.alert('Success', 'Post deleted successfully');
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, []);

  // Delete reel functionality
  const handleDeleteReel = useCallback(async (reel: Reel) => {
    Alert.alert(
      'Delete Reel',
      'Are you sure you want to delete this reel? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await FirebaseService.deleteReelSimple(reel.id);
              
              // Update local state
              setReels(prev => prev.filter(r => r.id !== reel.id));
              
              Alert.alert('Success', 'Reel deleted successfully');
            } catch (error) {
              console.error('Error deleting reel:', error);
              Alert.alert('Error', 'Failed to delete reel. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, []);

  // Edit post privacy
  const handleEditPostPrivacy = useCallback(async (post: Post) => {
    const currentPrivacy = post.isPrivate ? 'Private' : 'Public';
    const newPrivacy = post.isPrivate ? 'Public' : 'Private';
    
    Alert.alert(
      'Change Post Privacy',
      `This post is currently ${currentPrivacy}. Change to ${newPrivacy}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: `Make ${newPrivacy}`,
          onPress: async () => {
            try {
              setLoading(true);
              await FirebaseService.updatePost(post.id, {
                isPrivate: !post.isPrivate,
              });
              
              // Update local state
              setPosts(prev => prev.map(p => 
                p.id === post.id ? { ...p, isPrivate: !p.isPrivate } : p
              ));
              
              Alert.alert('Success', `Post is now ${newPrivacy.toLowerCase()}`);
            } catch (error) {
              console.error('Error updating post privacy:', error);
              Alert.alert('Error', 'Failed to update privacy. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, []);

  // Edit reel privacy
  const handleEditReelPrivacy = useCallback(async (reel: Reel) => {
    const currentPrivacy = reel.isPrivate ? 'Private' : 'Public';
    const newPrivacy = reel.isPrivate ? 'Public' : 'Private';
    
    Alert.alert(
      'Change Reel Privacy',
      `This reel is currently ${currentPrivacy}. Change to ${newPrivacy}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: `Make ${newPrivacy}`,
          onPress: async () => {
            try {
              setLoading(true);
              await FirebaseService.updateReel(reel.id, {
                isPrivate: !reel.isPrivate,
              });
              
              // Update local state
              setReels(prev => prev.map(r => 
                r.id === reel.id ? { ...r, isPrivate: !r.isPrivate } : r
              ));
              
              Alert.alert('Success', `Reel is now ${newPrivacy.toLowerCase()}`);
            } catch (error) {
              console.error('Error updating reel privacy:', error);
              Alert.alert('Error', 'Failed to update privacy. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, []);

  // Handle reel press
  const handleReelPress = useCallback((reel: Reel, index: number) => {
    if (onReelPress) {
      onReelPress(reel, index);
    } else {
      // Navigate to ReelsScreen with specific reel
      (navigation as any).navigate('Reels', {
        initialReelId: reel.id,
        fromProfile: true,
      });
    }
  }, [navigation, onReelPress]);

  // Open fullscreen viewer
  const openFullscreenViewer = useCallback((index: number) => {
    setSelectedIndex(index);
    setShowFullscreenViewer(true);
  }, []);

  // Render post grid item
  const renderPostItem = useCallback(({ item: post, index }: { item: Post; index: number }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => handlePostPress(post, index)}
      onLongPress={() => handlePostLongPress(post)}
      activeOpacity={0.8}
    >
      <Image
        source={{ 
          uri: post.mediaUrls?.[0] || '',
        }}
        style={styles.gridImage}
        resizeMode="cover"
      />
      
      {/* Privacy indicator */}
      {post.isPrivate && isOwnProfile && (
        <View style={styles.privacyIndicator}>
          <Icon name="lock-closed" size={12} color="#FFFFFF" />
        </View>
      )}
      
      {/* Multiple photos indicator */}
      {post.mediaUrls && post.mediaUrls.length > 1 && (
        <View style={styles.multipleIndicator}>
          <Icon name="copy-outline" size={16} color="#fff" />
        </View>
      )}
      
      {/* Video indicator */}
      {post.mediaType === 'video' && (
        <View style={styles.videoIndicator}>
          <Icon name="play" size={16} color="#fff" />
        </View>
      )}
      
      {/* Stats overlay */}
      <View style={styles.statsOverlay}>
        <View style={styles.statItem}>
          <Icon name="heart" size={14} color="#fff" />
          <Text style={styles.statText}>
            {FirebaseService.formatNumber(post.likesCount || 0)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="chatbubble" size={14} color="#fff" />
          <Text style={styles.statText}>
            {FirebaseService.formatNumber(post.commentsCount || 0)}
          </Text>
        </View>
      </View>

      {/* Delete button for own posts */}
      {isOwnProfile && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeletePost(post)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="trash" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  ), [handlePostPress, handlePostLongPress, isOwnProfile]);

  // Render reel grid item
  const renderReelItem = useCallback(({ item: reel, index }: { item: ReelWithThumbnail; index: number }) => {
    const isGeneratingThumbnail = thumbnailsGenerating.has(reel.id);
    
    // Try multiple thumbnail field names (handle different schemas)
    const getThumbnailUrl = () => {
      // Check all possible thumbnail field names
      if (reel.thumbnailUrl) return reel.thumbnailUrl;
      if ((reel as any).thumbnail) return (reel as any).thumbnail;
      if ((reel as any).thumbnailURL) return (reel as any).thumbnailURL;
      if ((reel as any).coverUrl) return (reel as any).coverUrl;
      if ((reel as any).cover) return (reel as any).cover;
      
      // Fallback: Use video URL with thumbnail query parameter
      if (reel.videoUrl) {
        // For videos, we can use the video URL as fallback (video player will show first frame)
        return reel.videoUrl;
      }
      
      return null;
    };
    
    const thumbnailUri = getThumbnailUrl();
    
    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => handleReelPress(reel, index)}
        onLongPress={() => handleReelLongPress(reel)}
        activeOpacity={0.8}
      >
        {thumbnailUri ? (
          <Image
            source={{ 
              uri: thumbnailUri,
            }}
            style={styles.gridImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.gridImage, styles.placeholderContainer]}>
            <Icon name="videocam" size={32} color="#999" />
          </View>
        )}
        
        {/* Privacy indicator */}
        {reel.isPrivate && isOwnProfile && (
          <View style={styles.privacyIndicator}>
            <Icon name="lock-closed" size={12} color="#FFFFFF" />
          </View>
        )}
        
        {/* Reel play indicator */}
        <View style={styles.reelPlayIndicator}>
          <Icon name="play" size={20} color="#fff" />
        </View>
        
        {/* Views count */}
        <View style={styles.viewsIndicator}>
          <Icon name="eye" size={12} color="#fff" />
          <Text style={styles.viewsText}>
            {FirebaseService.formatNumber(reel.viewsCount || 0)}
          </Text>
        </View>
        
        {/* Thumbnail generating indicator */}
        {isGeneratingThumbnail && (
          <View style={styles.thumbnailGeneratingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.generatingText}>Creating thumbnail...</Text>
          </View>
        )}
        
        {/* Duration badge */}
        {reel.duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {Math.floor(reel.duration / 60)}:{(reel.duration % 60).toString().padStart(2, '0')}
            </Text>
          </View>
        )}

        {/* Delete button for own reels */}
        {isOwnProfile && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteReel(reel)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="trash" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }, [handleReelPress, handleReelLongPress, thumbnailsGenerating, isOwnProfile]);

  // Tab content
  const currentContent = useMemo(() => {
    return activeTab === 'posts' ? posts : reels;
  }, [activeTab, posts, reels]);

  const renderItem = useMemo(() => {
    return activeTab === 'posts' ? renderPostItem : renderReelItem;
  }, [activeTab, renderPostItem, renderReelItem]);

  // Tab statistics
  const tabStats = useMemo(() => ({
    posts: posts.length,
    reels: reels.length,
  }), [posts.length, reels.length]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab selector */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'posts' && styles.activeTab,
            activeTab === 'posts' && { borderBottomColor: colors.text }
          ]}
          onPress={() => setActiveTab('posts')}
        >
          <Icon 
            name="grid-outline" 
            size={20} 
            color={activeTab === 'posts' ? colors.text : (colors as any).textSecondary || '#666'} 
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'posts' ? colors.text : (colors as any).textSecondary || '#666' }
          ]}>
            {tabStats.posts}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'reels' && styles.activeTab,
            activeTab === 'reels' && { borderBottomColor: colors.text }
          ]}
          onPress={() => setActiveTab('reels')}
        >
          <Icon 
            name="play-outline" 
            size={20} 
            color={activeTab === 'reels' ? colors.text : (colors as any).textSecondary || '#666'} 
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'reels' ? colors.text : (colors as any).textSecondary || '#666' }
          ]}>
            {tabStats.reels}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: (colors as any).textSecondary || '#666' }]}>
            Loading {activeTab}...
          </Text>
        </View>
      ) : currentContent.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon 
            name={activeTab === 'posts' ? "grid-outline" : "play-outline"} 
            size={64} 
            color={(colors as any).textSecondary || '#666'} 
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No {activeTab} yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: (colors as any).textSecondary || '#666' }]}>
            {isOwnProfile 
              ? `Start sharing ${activeTab} to see them here` 
              : `This user hasn't shared any ${activeTab} yet`
            }
          </Text>
        </View>
      ) : (
        <FlatList<ContentItem>
          data={currentContent}
          renderItem={renderItem as any}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContainer}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
          columnWrapperStyle={styles.gridRow}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={21}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
          getItemLayout={(data, index) => ({
            length: gridItemSize,
            offset: Math.floor(index / 3) * (gridItemSize + 2),
            index,
          })}
        />
      )}

      {/* Fullscreen Viewer Modal */}
      <Modal
        visible={showFullscreenViewer}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <SafeAreaView style={styles.fullscreenContainer}>
          <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.9)" />
          
          <View style={styles.fullscreenHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowFullscreenViewer(false)}
            >
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <FlatList<ContentItem>
            data={currentContent}
            renderItem={({ item, index }) => (
              <View style={styles.fullscreenItem}>
                <Image
                  source={{ uri: activeTab === 'posts' 
                    ? (item as Post).mediaUrls?.[0] || ''
                    : (item as ReelWithThumbnail).thumbnailUrl || (item as ReelWithThumbnail).videoUrl
                  }}
                  style={{
                    width: '100%',
                    height: '80%',
                  }}
                  resizeMode="contain"
                />
              </View>
            )}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={selectedIndex}
            getItemLayout={(data, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  gridContainer: {
    padding: 1,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  gridItem: {
    width: gridItemSize,
    height: gridItemSize,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  } as ImageStyle,
  multipleIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  reelPlayIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    padding: 12,
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  viewsIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viewsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  thumbnailGeneratingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  generatingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  privacyIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderContainer: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  fullscreenHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeButton: {
    padding: 8,
  },
  fullscreenItem: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  } as ImageStyle,
});

export default InstagramProfileReels;
