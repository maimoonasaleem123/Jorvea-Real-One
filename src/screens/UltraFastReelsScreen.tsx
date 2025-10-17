/**
 * 120 FPS Reels Screen
 * Ultra-smooth Instagram/TikTok-level performance
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Animated,
  Platform,
  Share,
  Vibration,
  Image,
  BackHandler,
  AppState,
  Modal,
  PanResponder,
  RefreshControl,
  TouchableWithoutFeedback,
  InteractionManager,
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconIonic from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import UltraHighPerformanceService from '../services/UltraHighPerformanceService';
import InstagramLikeLoadingService from '../services/InstagramLikeLoadingService';
import FirebaseService, { Reel } from '../services/firebaseService';
import ShareReelModal from '../components/ShareReelModal';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('screen');

// Optimized for ultra-smooth performance
const UltraFastReelsScreen = React.memo(() => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  
  // Performance-optimized state
  const [reels, setReels] = useState<Reel[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [likeCounts, setLikeCounts] = useState<{ [key: string]: number }>({});
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());
  
  // Ultra-fast refs
  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<{ [key: string]: VideoRef }>({});
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 100,
  });
  const lastProcessedIndex = useRef(-1);
  const isLoadingRef = useRef(false);
  const animationValues = useRef<{ [key: string]: Animated.Value }>({});

  // Ultra-fast performance props
  const optimizedFlatListProps = useMemo(() => 
    UltraHighPerformanceService.getOptimizedFlatListProps(), []
  );

  const optimizedVideoProps = useMemo(() => 
    UltraHighPerformanceService.getOptimizedVideoProps(), []
  );

  // Initialize ultra-high performance mode
  useEffect(() => {
    UltraHighPerformanceService.initialize();
  }, []);

  // Ultra-fast data loading with following priority
  const loadReels = useCallback(async (refresh = false) => {
    if (isLoadingRef.current && !refresh) return;
    
    isLoadingRef.current = true;
    
    try {
      if (refresh) {
        setRefreshing(true);
        setReels([]);
      } else {
        setIsLoading(true);
      }

      // Load with 80% following priority for maximum engagement
      const newReels = await InstagramLikeLoadingService.loadReelsWithFollowingPriority(
        refresh ? 0 : reels.length,
        10,
        0.8 // 80% following content
      );

      if (refresh) {
        setReels(newReels);
        setCurrentIndex(0);
      } else {
        setReels(prev => [...prev, ...newReels]);
      }

      // Preload user following data
      if (user?.uid) {
        const following = await FirebaseService.getUserFollowing(user.uid);
        setFollowingUsers(new Set(following));
      }

      // Preload like states with ultra-fast batch processing
      const likePromises = newReels.map(async (reel) => {
        if (user?.uid) {
          const [isLiked, likeCount] = await Promise.all([
            FirebaseService.isReelLiked(reel.id, user.uid),
            FirebaseService.getReelLikeCount(reel.id)
          ]);
          
          if (isLiked) {
            setLikedReels(prev => new Set([...prev, reel.id]));
          }
          
          setLikeCounts(prev => ({ ...prev, [reel.id]: likeCount }));
        }
      });

      await Promise.all(likePromises);
      
    } catch (error) {
      console.error('Error loading reels:', error);
      Alert.alert('Error', 'Failed to load reels. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, [reels.length, user?.uid]);

  // Ultra-fast like handling with optimistic updates
  const handleLike = useCallback(async (reel: Reel) => {
    if (!user?.uid) return;

    const isCurrentlyLiked = likedReels.has(reel.id);
    const currentCount = likeCounts[reel.id] || 0;

    // Optimistic update for ultra-fast UI response
    if (isCurrentlyLiked) {
      setLikedReels(prev => {
        const newSet = new Set(prev);
        newSet.delete(reel.id);
        return newSet;
      });
      setLikeCounts(prev => ({ ...prev, [reel.id]: Math.max(0, currentCount - 1) }));
    } else {
      setLikedReels(prev => new Set([...prev, reel.id]));
      setLikeCounts(prev => ({ ...prev, [reel.id]: currentCount + 1 }));
      
      // Ultra-smooth haptic feedback
      Vibration.vibrate(50);
    }

    // Background database update
    try {
      if (isCurrentlyLiked) {
        await FirebaseService.unlikeReel(reel.id, user.uid);
      } else {
        await FirebaseService.likeReel(reel.id, user.uid);
      }
    } catch (error) {
      // Revert optimistic update on error
      if (isCurrentlyLiked) {
        setLikedReels(prev => new Set([...prev, reel.id]));
        setLikeCounts(prev => ({ ...prev, [reel.id]: currentCount }));
      } else {
        setLikedReels(prev => {
          const newSet = new Set(prev);
          newSet.delete(reel.id);
          return newSet;
        });
        setLikeCounts(prev => ({ ...prev, [reel.id]: currentCount }));
      }
      console.error('Error updating like:', error);
    }
  }, [user?.uid, likedReels, likeCounts]);

  // Ultra-fast video management
  const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const visibleItem = viewableItems[0];
      const newIndex = visibleItem.index;
      
      if (newIndex !== lastProcessedIndex.current) {
        setCurrentIndex(newIndex);
        lastProcessedIndex.current = newIndex;
        
        // Ultra-fast video control
        Object.keys(videoRefs.current).forEach(key => {
          const videoRef = videoRefs.current[key];
          const reelIndex = parseInt(key.split('-')[1]);
          
          if (videoRef) {
            if (reelIndex === newIndex) {
              videoRef.seek(0);
            } else {
              // Pause non-visible videos for performance
              videoRef.seek(0);
            }
          }
        });
        
        // Preload next reels for ultra-smooth scrolling
        if (newIndex >= reels.length - 3 && !isLoadingRef.current) {
          loadMoreReels();
        }
      }
    }
  }, [reels.length]);

  // Ultra-fast load more
  const loadMoreReels = useCallback(async () => {
    if (isLoadingRef.current || loadingMore) return;
    
    setLoadingMore(true);
    
    try {
      // Load with 60% following priority for diversity
      const moreReels = await InstagramLikeLoadingService.loadReelsWithFollowingPriority(
        reels.length,
        5,
        0.6
      );
      
      setReels(prev => [...prev, ...moreReels]);
      
      // Preload like states
      if (user?.uid) {
        const likePromises = moreReels.map(async (reel) => {
          const [isLiked, likeCount] = await Promise.all([
            FirebaseService.isReelLiked(reel.id, user.uid),
            FirebaseService.getReelLikeCount(reel.id)
          ]);
          
          if (isLiked) {
            setLikedReels(prev => new Set([...prev, reel.id]));
          }
          
          setLikeCounts(prev => ({ ...prev, [reel.id]: likeCount }));
        });
        
        await Promise.all(likePromises);
      }
    } catch (error) {
      console.error('Error loading more reels:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [reels.length, user?.uid, loadingMore]);

  // Ultra-smooth animations
  const getAnimatedValue = useCallback((reelId: string) => {
    if (!animationValues.current[reelId]) {
      animationValues.current[reelId] = new Animated.Value(0);
    }
    return animationValues.current[reelId];
  }, []);

  const animateLike = useCallback((reelId: string) => {
    const animValue = getAnimatedValue(reelId);
    
    UltraHighPerformanceService.createUltraSmoothAnimation(animValue, 1, 150).start(() => {
      UltraHighPerformanceService.createUltraSmoothAnimation(animValue, 0, 150).start();
    });
  }, [getAnimatedValue]);

  // Ultra-fast reel item renderer
  const renderReelItem = useCallback(({ item, index }: { item: Reel; index: number }) => {
    const isLiked = likedReels.has(item.id);
    const likeCount = likeCounts[item.id] || 0;
    const isFollowing = followingUsers.has(item.userId);
    const animValue = getAnimatedValue(item.id);

    return (
      <View style={styles.reelContainer}>
        {/* Ultra-optimized video player */}
        <Video
          ref={(ref) => {
            if (ref) {
              videoRefs.current[`reel-${index}`] = ref;
            }
          }}
          source={{ uri: item.videoUrl }}
          style={styles.video}
          paused={index !== currentIndex}
          repeat={true}
          muted={false}
          resizeMode="cover"
          {...optimizedVideoProps}
          onError={(error) => console.error('Video error:', error)}
        />

        {/* Ultra-fast gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.gradient}
        />

        {/* Ultra-smooth action buttons */}
        <View style={styles.rightActions}>
          {/* Ultra-fast like button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              handleLike(item);
              animateLike(item.id);
            }}
            activeOpacity={0.7}
          >
            <Animated.View
              style={[
                styles.likeAnimation,
                {
                  transform: [{
                    scale: animValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.3],
                    }),
                  }],
                },
              ]}
            >
              <Icon
                name={isLiked ? "favorite" : "favorite-border"}
                size={32}
                color={isLiked ? "#ff3040" : "white"}
              />
            </Animated.View>
            <Text style={styles.actionText}>{likeCount}</Text>
          </TouchableOpacity>

          {/* Ultra-fast comment button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Comments', { reelId: item.id })}
            activeOpacity={0.7}
          >
            <IconIonic name="chatbubble-outline" size={30} color="white" />
            <Text style={styles.actionText}>{item.commentCount || 0}</Text>
          </TouchableOpacity>

          {/* Ultra-fast share button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setSelectedReel(item);
              setShareModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <IconIonic name="paper-plane-outline" size={28} color="white" />
          </TouchableOpacity>

          {/* Ultra-fast save button */}
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <IconIonic name="bookmark-outline" size={28} color="white" />
          </TouchableOpacity>
        </View>

        {/* Ultra-fast user info */}
        <View style={styles.bottomInfo}>
          <View style={styles.userInfo}>
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => navigation.navigate('Profile', { userId: item.userId })}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: item.userAvatar || 'https://via.placeholder.com/40' }}
                style={styles.avatar}
                {...UltraHighPerformanceService.getOptimizedImageProps()}
              />
              <Text style={styles.username}>@{item.username}</Text>
              {!isFollowing && item.userId !== user?.uid && (
                <TouchableOpacity style={styles.followButton} activeOpacity={0.8}>
                  <Text style={styles.followText}>Follow</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
        </View>
      </View>
    );
  }, [
    currentIndex,
    likedReels,
    likeCounts,
    followingUsers,
    navigation,
    user?.uid,
    handleLike,
    animateLike,
    getAnimatedValue,
    optimizedVideoProps
  ]);

  // Initialize ultra-fast loading
  useEffect(() => {
    loadReels(true);
  }, []);

  // Ultra-fast focus effect
  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true);
      
      return () => {
        StatusBar.setHidden(false);
      };
    }, [])
  );

  // Ultra-fast back handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });

    return () => backHandler.remove();
  }, [navigation]);

  if (isLoading && reels.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading ultra-smooth reels...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />
      
      {/* Ultra-fast FlatList with 120 FPS optimization */}
      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderReelItem}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadReels(true)}
            tintColor="white"
          />
        }
        onEndReached={loadMoreReels}
        onEndReachedThreshold={0.5}
        {...optimizedFlatListProps}
      />

      {/* Ultra-fast loading indicator */}
      {loadingMore && (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}

      {/* Ultra-smooth share modal */}
      <ShareReelModal
        visible={shareModalVisible}
        reel={selectedReel}
        onClose={() => {
          setShareModalVisible(false);
          setSelectedReel(null);
        }}
      />
    </SafeAreaView>
  );
});

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
    color: 'white',
    marginTop: 16,
    fontSize: 16,
  },
  reelContainer: {
    width,
    height,
  },
  video: {
    width,
    height,
    position: 'absolute',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  rightActions: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 24,
  },
  likeAnimation: {
    alignItems: 'center',
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 80,
  },
  userInfo: {
    marginBottom: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  username: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  followButton: {
    backgroundColor: '#ff3040',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  followText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  description: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
  },
  loadingMore: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 20,
  },
});

UltraFastReelsScreen.displayName = 'UltraFastReelsScreen';

export default UltraFastReelsScreen;
