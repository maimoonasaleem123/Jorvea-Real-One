import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Share,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  doc,
  updateDoc,
  increment,
  onSnapshot,
  where,
  startAfter,
  DocumentSnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import PerfectChunkedVideoPlayer from '../components/PerfectChunkedVideoPlayer';
import PerfectChunkedStreamingEngine from '../services/PerfectChunkedStreamingEngine';
import PerfectInstantThumbnailSystem from '../services/PerfectInstantThumbnailSystem';

const { width, height } = Dimensions.get('window');

interface Reel {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  userAvatar?: string;
  videoUrl: string;
  thumbnailUrl: string;
  caption: string;
  hashtags: string[];
  likes: number;
  comments: number;
  shares: number;
  views: number;
  duration: number;
  createdAt: any;
  isPublic: boolean;
  effects?: {
    filter: string;
    speed: number;
    brightness: number;
    contrast: number;
    saturation: number;
  };
}

interface EnhancedReelsTabProps {}

const EnhancedReelsTab: React.FC<EnhancedReelsTabProps> = () => {
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastDocument, setLastDocument] = useState<DocumentSnapshot | null>(null);
  const [hasMoreReels, setHasMoreReels] = useState(true);
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  
  // Streaming engines
  const streamingEngine = useRef(new PerfectChunkedStreamingEngine()).current;
  const thumbnailSystem = useRef(new PerfectInstantThumbnailSystem()).current;
  
  // Animation values
  const heartAnimation = useRef(new Animated.Value(0)).current;
  const createButtonScale = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      loadReels();
      
      return () => {
        // Cleanup streaming when leaving screen
        try {
          streamingEngine.cleanup();
        } catch (error) {
          console.log('Cleanup error (safe to ignore):', error);
        }
      };
    }, [])
  );

  useEffect(() => {
    if (reels.length > 0) {
      // Execute perfect prefetch strategy for current reel
      executePerfectPrefetch(currentIndex);
    }
  }, [currentIndex, reels]);

  const loadReels = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
      setLastDocument(null);
      setHasMoreReels(true);
    } else {
      setIsLoading(true);
    }

    try {
      const firestore = getFirestore();
      const reelsCollection = collection(firestore, 'reels');
      
      let reelsQuery = query(
        reelsCollection,
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      if (!refresh && lastDocument) {
        reelsQuery = query(
          reelsCollection,
          where('isPublic', '==', true),
          orderBy('createdAt', 'desc'),
          startAfter(lastDocument),
          limit(10)
        );
      }

      const snapshot = await getDocs(reelsQuery);
      const newReels: Reel[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        newReels.push({
          id: doc.id,
          ...data,
        } as Reel);
      });

      if (refresh) {
        setReels(newReels);
        setCurrentIndex(0);
      } else {
        setReels(prev => [...prev, ...newReels]);
      }

      if (snapshot.docs.length > 0) {
        setLastDocument(snapshot.docs[snapshot.docs.length - 1]);
      }

      setHasMoreReels(snapshot.docs.length === 10);

      // Load user preferences
      await loadUserPreferences();

    } catch (error) {
      console.error('Error loading reels:', error);
      Alert.alert('Error', 'Failed to load reels. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const loadUserPreferences = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) return;

      const firestore = getFirestore();
      
      // Load liked reels
      const likesQuery = query(
        collection(firestore, 'likes'),
        where('userId', '==', user.uid)
      );
      const likesSnapshot = await getDocs(likesQuery);
      const likedReelIds = new Set<string>();
      likesSnapshot.forEach(doc => {
        likedReelIds.add(doc.data().reelId);
      });
      setLikedReels(likedReelIds);

      // Load followed users
      const followsQuery = query(
        collection(firestore, 'follows'),
        where('followerId', '==', user.uid)
      );
      const followsSnapshot = await getDocs(followsQuery);
      const followedUserIds = new Set<string>();
      followsSnapshot.forEach(doc => {
        followedUserIds.add(doc.data().followingId);
      });
      setFollowedUsers(followedUserIds);

    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const executePerfectPrefetch = async (index: number) => {
    try {
      setTimeout(async () => {
        try {
          if (reels[index]) {
            // Current reel - instant load
            await streamingEngine.initializeStreamSafely(reels[index].id, reels[index].videoUrl);
            await thumbnailSystem.prepareThumbnail(reels[index].id, reels[index].thumbnailUrl);
          }
          
          if (reels[index + 1]) {
            // Next reel - full preload
            await streamingEngine.preloadFullVideoSafely(reels[index + 1].id, reels[index + 1].videoUrl);
            await thumbnailSystem.prepareThumbnail(reels[index + 1].id, reels[index + 1].thumbnailUrl);
          }
          
          if (reels[index + 2]) {
            // Next+1 reel - partial preload
            await streamingEngine.preloadSegmentsSafely(reels[index + 2].id, reels[index + 2].videoUrl, 3);
            await thumbnailSystem.prepareThumbnail(reels[index + 2].id, reels[index + 2].thumbnailUrl);
          }
        } catch (error) {
          console.log('Prefetch error (safe to ignore):', error);
        }
      }, 100);
    } catch (error) {
      console.log('Execute prefetch error (safe to ignore):', error);
    }
  };

  const loadMoreReels = async () => {
    if (isLoadingMore || !hasMoreReels) return;
    
    setIsLoadingMore(true);
    await loadReels(false);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      setCurrentIndex(newIndex);
      
      // Update view count
      updateViewCount(reels[newIndex]?.id);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const updateViewCount = async (reelId: string) => {
    if (!reelId) return;
    
    try {
      const firestore = getFirestore();
      const reelRef = doc(firestore, 'reels', reelId);
      await updateDoc(reelRef, {
        views: increment(1),
      });
    } catch (error) {
      console.error('Error updating view count:', error);
    }
  };

  const handleLike = async (reelId: string) => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to like reels.');
      return;
    }

    try {
      const firestore = getFirestore();
      const isLiked = likedReels.has(reelId);
      
      if (isLiked) {
        // Unlike
        setLikedReels(prev => {
          const newSet = new Set(prev);
          newSet.delete(reelId);
          return newSet;
        });
        
        const reelRef = doc(firestore, 'reels', reelId);
        await updateDoc(reelRef, {
          likes: increment(-1),
        });
        
        // Remove like document
        const likeQuery = query(
          collection(firestore, 'likes'),
          where('userId', '==', user.uid),
          where('reelId', '==', reelId)
        );
        const likeSnapshot = await getDocs(likeQuery);
        likeSnapshot.forEach(async (doc) => {
          await doc.ref.delete();
        });
        
      } else {
        // Like
        setLikedReels(prev => new Set(prev).add(reelId));
        
        // Animate heart
        Animated.sequence([
          Animated.timing(heartAnimation, {
            toValue: 1.5,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(heartAnimation, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
        
        const reelRef = doc(firestore, 'reels', reelId);
        await updateDoc(reelRef, {
          likes: increment(1),
        });
        
        // Add like document
        await doc(collection(firestore, 'likes')).set({
          userId: user.uid,
          reelId,
          createdAt: new Date(),
        });
      }
      
      // Update local state
      setReels(prev => prev.map(reel => 
        reel.id === reelId 
          ? { ...reel, likes: reel.likes + (isLiked ? -1 : 1) }
          : reel
      ));
      
    } catch (error) {
      console.error('Error handling like:', error);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    }
  };

  const handleShare = async (reel: Reel) => {
    try {
      await Share.share({
        message: `Check out this reel: ${reel.caption}\n\n${reel.videoUrl}`,
        title: 'Share Reel',
      });
      
      // Update share count
      const firestore = getFirestore();
      const reelRef = doc(firestore, 'reels', reel.id);
      await updateDoc(reelRef, {
        shares: increment(1),
      });
      
      setReels(prev => prev.map(r => 
        r.id === reel.id 
          ? { ...r, shares: r.shares + 1 }
          : r
      ));
      
    } catch (error) {
      console.error('Error sharing reel:', error);
    }
  };

  const handleFollow = async (userId: string) => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to follow users.');
      return;
    }

    try {
      const firestore = getFirestore();
      const isFollowing = followedUsers.has(userId);
      
      if (isFollowing) {
        // Unfollow
        setFollowedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
        
        const followQuery = query(
          collection(firestore, 'follows'),
          where('followerId', '==', user.uid),
          where('followingId', '==', userId)
        );
        const followSnapshot = await getDocs(followQuery);
        followSnapshot.forEach(async (doc) => {
          await doc.ref.delete();
        });
        
      } else {
        // Follow
        setFollowedUsers(prev => new Set(prev).add(userId));
        
        await doc(collection(firestore, 'follows')).set({
          followerId: user.uid,
          followingId: userId,
          createdAt: new Date(),
        });
      }
      
    } catch (error) {
      console.error('Error handling follow:', error);
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    }
  };

  const navigateToCreateReel = () => {
    // Animate create button
    Animated.sequence([
      Animated.timing(createButtonScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(createButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    navigation.navigate('CreateReels' as never);
  };

  const navigateToComments = (reelId: string) => {
    navigation.navigate('Comments' as never, { reelId } as never);
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const renderReelItem = ({ item, index }: { item: Reel; index: number }) => {
    const isActive = index === currentIndex;
    const isLiked = likedReels.has(item.id);
    const isFollowing = followedUsers.has(item.userId);
    
    return (
      <View style={styles.reelContainer}>
        <PerfectChunkedVideoPlayer
          reelId={item.id}
          videoUrl={item.videoUrl}
          thumbnailUrl={item.thumbnailUrl}
          shouldPlay={isActive}
          isFocused={isActive}
          isActive={isActive}
          onLoad={() => {}}
          onProgress={() => {}}
          style={styles.video}
        />

        {/* Content Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
          style={styles.contentOverlay}
        >
          {/* User Info */}
          <View style={styles.userInfo}>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>
                {item.userName || item.userEmail?.split('@')[0] || 'User'}
              </Text>
              <Text style={styles.caption} numberOfLines={2}>
                {item.caption}
              </Text>
              {item.hashtags && item.hashtags.length > 0 && (
                <Text style={styles.hashtags}>
                  {item.hashtags.map(tag => `#${tag}`).join(' ')}
                </Text>
              )}
            </View>
            
            {item.userId !== getAuth().currentUser?.uid && (
              <TouchableOpacity
                style={[styles.followButton, isFollowing && styles.followingButton]}
                onPress={() => handleFollow(item.userId)}
              >
                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleLike(item.id)}
          >
            <Animated.View style={{ transform: [{ scale: heartAnimation }] }}>
              <Ionicons 
                name={isLiked ? "heart" : "heart-outline"} 
                size={32} 
                color={isLiked ? "#ff3366" : "#fff"} 
              />
            </Animated.View>
            <Text style={styles.actionText}>{formatCount(item.likes)}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigateToComments(item.id)}
          >
            <Ionicons name="chatbubble-outline" size={30} color="#fff" />
            <Text style={styles.actionText}>{formatCount(item.comments)}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleShare(item)}
          >
            <Ionicons name="paper-plane-outline" size={30} color="#fff" />
            <Text style={styles.actionText}>{formatCount(item.shares)}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="bookmark-outline" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading Reels...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reels</Text>
        <Animated.View style={{ transform: [{ scale: createButtonScale }] }}>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={navigateToCreateReel}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Reels List */}
      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderReelItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={loadMoreReels}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadReels(true)}
            tintColor="#fff"
            colors={['#ff3366']}
          />
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : null
        }
        getItemLayout={(data, index) => ({
          length: height,
          offset: height * index,
          index,
        })}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ff3366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelContainer: {
    width,
    height,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  contentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 80,
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 60,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  hashtags: {
    color: '#87ceeb',
    fontSize: 13,
    marginTop: 4,
  },
  followButton: {
    backgroundColor: '#ff3366',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 15,
  },
  followingButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  followingButtonText: {
    color: '#fff',
  },
  actionButtons: {
    position: 'absolute',
    right: 15,
    bottom: 150,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 25,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  loadMoreContainer: {
    padding: 20,
    alignItems: 'center',
  },
});

export default EnhancedReelsTab;
