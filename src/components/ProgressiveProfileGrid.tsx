import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Post, Reel } from '../services/firebaseService';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const postImageSize = isTablet ? (width - 20) / 4 : (width - 6) / 3;

interface ProgressiveProfileGridProps {
  items: (Post | Reel)[];
  type: 'posts' | 'reels';
  onItemPress: (item: Post | Reel, index: number) => void;
  loadingDelay?: number; // Delay between loading each item in milliseconds
}

interface GridItem {
  item: Post | Reel;
  originalIndex: number;
  loaded: boolean;
  loading: boolean;
}

export const ProgressiveProfileGrid: React.FC<ProgressiveProfileGridProps> = ({
  items,
  type,
  onItemPress,
  loadingDelay = 200, // Default 200ms delay between items (Instagram-like)
}) => {
  const [gridItems, setGridItems] = useState<GridItem[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Initialize grid items
  useEffect(() => {
    const initialGridItems: GridItem[] = items.map((item, index) => ({
      item,
      originalIndex: index,
      loaded: false,
      loading: false,
    }));
    
    setGridItems(initialGridItems);
    setLoadingProgress(0);
    
    // Start progressive loading
    startProgressiveLoading(initialGridItems);
  }, [items, loadingDelay]);

  const startProgressiveLoading = useCallback(async (itemsToLoad: GridItem[]) => {
    if (itemsToLoad.length === 0) return;
    
    console.log(`📱 ProgressiveProfileGrid: Starting progressive loading of ${itemsToLoad.length} ${type}`);
    
    for (let i = 0; i < itemsToLoad.length; i++) {
      // Update loading state
      setGridItems(currentItems => 
        currentItems.map((gridItem, index) => 
          index === i 
            ? { ...gridItem, loading: true }
            : gridItem
        )
      );
      
      // Simulate loading delay (Instagram-like progressive appearance)
      await new Promise(resolve => setTimeout(resolve, loadingDelay));
      
      // Mark as loaded
      setGridItems(currentItems => 
        currentItems.map((gridItem, index) => 
          index === i 
            ? { ...gridItem, loaded: true, loading: false }
            : gridItem
        )
      );
      
      // Update progress
      setLoadingProgress(((i + 1) / itemsToLoad.length) * 100);
    }
    
    console.log(`✅ ProgressiveProfileGrid: Completed loading ${itemsToLoad.length} ${type}`);
  }, [loadingDelay, type]);

  const renderGridItem = useCallback(({ item: gridItem, index }: { item: GridItem; index: number }) => {
    const { item, originalIndex, loaded, loading } = gridItem;
    
    // Show placeholder while loading or not yet loaded
    if (!loaded) {
      return (
        <View style={[styles.postGridItem, { width: postImageSize, height: postImageSize }]}>
          <View style={[styles.placeholder, { width: postImageSize, height: postImageSize }]}>
            {loading ? (
              <ActivityIndicator size="small" color="#E1306C" />
            ) : (
              <View style={styles.placeholderBox} />
            )}
          </View>
        </View>
      );
    }

    const handlePress = () => {
      onItemPress(item, originalIndex);
    };

    // Render loaded item
    return (
      <TouchableOpacity
        style={[styles.postGridItem, { width: postImageSize, height: postImageSize }]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Image */}
        <Image
          source={{ uri: item.imageUrl || item.thumbnailUrl }}
          style={styles.postGridImage}
          resizeMode="cover"
        />

        {/* Type indicators */}
        {type === 'posts' && 'images' in item && item.images && item.images.length > 1 && (
          <View style={styles.carouselIndicator}>
            <Icon name="copy-outline" size={12} color="#fff" />
          </View>
        )}
        
        {type === 'reels' && (
          <View style={styles.videoIndicator}>
            <Icon name="play" size={12} color="#fff" />
          </View>
        )}

        {/* Stats overlay */}
        <View style={styles.postStatsOverlay}>
          <View style={styles.postStat}>
            <Icon name="heart" size={10} color="#fff" />
            <Text style={styles.postStatText}>
              {item.likesCount || 0}
            </Text>
          </View>
          
          {type === 'posts' && (
            <View style={styles.postStat}>
              <Icon name="chatbubble" size={10} color="#fff" />
              <Text style={styles.postStatText}>
                {item.commentsCount || 0}
              </Text>
            </View>
          )}
          
          {type === 'reels' && 'viewsCount' in item && (
            <View style={styles.postStat}>
              <Icon name="play" size={10} color="#fff" />
              <Text style={styles.postStatText}>
                {item.viewsCount || 0}
              </Text>
            </View>
          )}
        </View>

        {/* Reel duration */}
        {type === 'reels' && 'duration' in item && item.duration && (
          <View style={styles.reelDurationIndicator}>
            <Text style={styles.reelDurationText}>
              {Math.round(item.duration)}s
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [type, onItemPress]);

  const keyExtractor = useCallback((item: GridItem, index: number) => {
    return `${type}_${item.item.id}_${index}`;
  }, [type]);

  if (gridItems.length === 0) {
    return (
      <View style={styles.noContentContainer}>
        <Icon 
          name={type === 'posts' ? "camera-outline" : "videocam-outline"} 
          size={64} 
          color="#ccc" 
        />
        <Text style={styles.noContentText}>
          {type === 'posts' ? 'No posts yet' : 'No reels yet'}
        </Text>
        <Text style={styles.noContentSubtext}>
          {type === 'posts' ? 'Start sharing your moments!' : 'Create your first reel!'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Loading progress indicator */}
      {loadingProgress < 100 && loadingProgress > 0 && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Loading {type}... {Math.round(loadingProgress)}%
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${loadingProgress}%` }
              ]} 
            />
          </View>
        </View>
      )}
      
      {/* Grid */}
      <FlatList
        data={gridItems}
        renderItem={renderGridItem}
        keyExtractor={keyExtractor}
        numColumns={3}
        scrollEnabled={false}
        contentContainerStyle={styles.grid}
        removeClippedSubviews={true}
        maxToRenderPerBatch={6}
        initialNumToRender={6}
        windowSize={10}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9f9f9',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  progressBar: {
    height: 2,
    backgroundColor: '#eee',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E1306C',
    borderRadius: 1,
  },
  grid: {
    paddingHorizontal: 1,
  },
  postGridItem: {
    margin: 1,
    position: 'relative',
    borderRadius: 2,
    overflow: 'hidden',
  },
  postGridImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderBox: {
    width: 30,
    height: 30,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  carouselIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postStatsOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
  },
  postStatText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '500',
    marginLeft: 2,
  },
  reelDurationIndicator: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reelDurationText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '500',
  },
  noContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  noContentText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
    marginTop: 16,
    textAlign: 'center',
  },
  noContentSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default ProgressiveProfileGrid;
