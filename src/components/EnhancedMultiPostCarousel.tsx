import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';

const { width } = Dimensions.get('window');

interface EnhancedMultiPostCarouselProps {
  mediaUrls: string[];
  postId: string;
  onIndexChange?: (index: number) => void;
  height?: number;
}

export const EnhancedMultiPostCarousel: React.FC<EnhancedMultiPostCarouselProps> = ({
  mediaUrls,
  postId,
  onIndexChange,
  height = 300,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState<{ [key: number]: boolean }>({});
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = useCallback((event: any) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < mediaUrls.length) {
      setCurrentIndex(newIndex);
      onIndexChange?.(newIndex);
    }
  }, [currentIndex, mediaUrls.length, onIndexChange]);

  const goToIndex = useCallback((index: number) => {
    if (scrollViewRef.current && index >= 0 && index < mediaUrls.length) {
      scrollViewRef.current.scrollTo({ x: index * width, animated: true });
    }
  }, [mediaUrls.length]);

  const isVideo = (url: string): boolean => {
    return url.includes('.mp4') || url.includes('.mov') || url.includes('.avi');
  };

  const setImageLoading = (index: number, loading: boolean) => {
    setLoading(prev => ({ ...prev, [index]: loading }));
  };

  const renderMediaItem = (mediaUrl: string, index: number) => {
    if (!mediaUrl || mediaUrl.trim() === '') {
      return (
        <View key={index} style={[styles.mediaItem, { width, height }]}>
          <View style={styles.errorPlaceholder}>
            <Icon name="image-outline" size={50} color="#ccc" />
            <Text style={styles.errorText}>Media unavailable</Text>
          </View>
        </View>
      );
    }

    if (isVideo(mediaUrl)) {
      return (
        <View key={index} style={[styles.mediaItem, { width, height }]}>
          <Video
            source={{ uri: mediaUrl }}
            style={styles.media}
            resizeMode="cover"
            repeat={true}
            muted={true}
            paused={index !== currentIndex} // Only play current video
            controls={false}
            playInBackground={false}
            playWhenInactive={false}
          />
          <View style={styles.videoIndicator}>
            <Icon name="play" size={20} color="#fff" />
          </View>
        </View>
      );
    }

    return (
      <View key={index} style={[styles.mediaItem, { width, height }]}>
        {loading[index] && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
        <Image
          source={{ uri: mediaUrl }}
          style={styles.media}
          onLoadStart={() => setImageLoading(index, true)}
          onLoad={() => setImageLoading(index, false)}
          onError={() => setImageLoading(index, false)}
          resizeMode="cover"
        />
      </View>
    );
  };

  if (!mediaUrls || mediaUrls.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.errorPlaceholder}>
          <Icon name="image-outline" size={50} color="#ccc" />
          <Text style={styles.errorText}>No media available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        bounces={false}
        decelerationRate="fast"
      >
        {mediaUrls.map((mediaUrl, index) => renderMediaItem(mediaUrl, index))}
      </ScrollView>

      {/* Navigation Arrows */}
      {mediaUrls.length > 1 && (
        <>
          {currentIndex > 0 && (
            <TouchableOpacity
              style={[styles.navButton, styles.prevButton]}
              onPress={() => goToIndex(currentIndex - 1)}
            >
              <Icon name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          
          {currentIndex < mediaUrls.length - 1 && (
            <TouchableOpacity
              style={[styles.navButton, styles.nextButton]}
              onPress={() => goToIndex(currentIndex + 1)}
            >
              <Icon name="chevron-forward" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Page Indicators */}
      {mediaUrls.length > 1 && (
        <View style={styles.indicators}>
          {mediaUrls.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.indicator,
                index === currentIndex ? styles.activeIndicator : styles.inactiveIndicator
              ]}
              onPress={() => goToIndex(index)}
            />
          ))}
        </View>
      )}

      {/* Media Counter */}
      {mediaUrls.length > 1 && (
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {mediaUrls.length}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#f8f8f8',
  },
  scrollView: {
    flex: 1,
  },
  mediaItem: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 1,
  },
  errorPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  errorText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  videoIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  prevButton: {
    left: 10,
  },
  nextButton: {
    right: 10,
  },
  indicators: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  activeIndicator: {
    backgroundColor: '#fff',
  },
  inactiveIndicator: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  counter: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  counterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});
