import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Text,
} from 'react-native';
import Video from 'react-native-video';
import HyperSpeedService from '../services/HyperSpeedService';

interface LazyMediaProps {
  id: string;
  type: 'image' | 'video';
  source: string;
  width?: number;
  height?: number;
  placeholder?: React.ReactNode;
  onLoad?: () => void;
  onError?: (error: any) => void;
  priority?: 'high' | 'medium' | 'low';
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  resizeMode?: 'cover' | 'contain' | 'stretch';
  style?: any;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const LazyMediaComponent: React.FC<LazyMediaProps> = ({
  id,
  type,
  source,
  width = SCREEN_WIDTH,
  height = 300,
  placeholder,
  onLoad,
  onError,
  priority = 'medium',
  autoPlay = false,
  muted = true,
  loop = true,
  resizeMode = 'cover',
  style,
}) => {
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedSource, setCachedSource] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  const viewRef = useRef<View>(null);
  const intersectionObserver = useRef<any>(null);

  // Check if media is in viewport
  const checkVisibility = useCallback(() => {
    if (viewRef.current) {
      viewRef.current.measureInWindow((x, y, w, h) => {
        const screenHeight = Dimensions.get('window').height;
        const isInViewport = y < screenHeight && (y + h) > 0;
        
        if (isInViewport && !isVisible) {
          setIsVisible(true);
          console.log(`👀 LAZY MEDIA: ${type} ${id} is now visible - starting load`);
        } else if (!isInViewport && isVisible) {
          setIsVisible(false);
          console.log(`👁️ LAZY MEDIA: ${type} ${id} is no longer visible`);
        }
      });
    }
  }, [isVisible, type, id]);

  // Initialize intersection observer
  useEffect(() => {
    // Check visibility every 100ms when component mounts
    const intervalId = setInterval(checkVisibility, 100);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [checkVisibility]);

  // Load media when visible
  useEffect(() => {
    if (isVisible && !loaded && !loading) {
      loadMedia();
    }
  }, [isVisible, loaded, loading]);

  const loadMedia = useCallback(async () => {
    if (loaded || loading) return;

    try {
      setLoading(true);
      setError(null);

      console.log(`📥 LAZY LOAD START: ${type} ${id}`);

      // Check HyperSpeed cache first
      const cacheKey = `lazy_media_${type}_${id}`;
      let mediaSource = await HyperSpeedService.getData<string>(cacheKey);

      if (mediaSource) {
        console.log(`⚡ CACHE HIT: ${type} ${id} loaded from cache`);
        setCachedSource(mediaSource);
      } else {
        console.log(`🌐 NETWORK LOAD: ${type} ${id} loading from network`);
        setCachedSource(source);
        
        // Cache the source for future use
        await HyperSpeedService.cacheData(cacheKey, source, priority);
      }

      setLoaded(true);
      onLoad?.();

    } catch (err: any) {
      console.error(`❌ LAZY LOAD ERROR: ${type} ${id}:`, err);
      setError(err.message || 'Failed to load media');
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [id, type, source, loaded, loading, priority, onLoad, onError]);

  const handleImageLoad = useCallback(() => {
    console.log(`✅ IMAGE LOADED: ${id}`);
    setLoading(false);
    onLoad?.();
  }, [id, onLoad]);

  const handleImageError = useCallback((err: any) => {
    console.error(`❌ IMAGE ERROR: ${id}:`, err);
    setError('Failed to load image');
    setLoading(false);
    onError?.(err);
  }, [id, onError]);

  const handleVideoLoad = useCallback(() => {
    console.log(`✅ VIDEO LOADED: ${id}`);
    setLoading(false);
    onLoad?.();
  }, [id, onLoad]);

  const handleVideoError = useCallback((err: any) => {
    console.error(`❌ VIDEO ERROR: ${id}:`, err);
    setError('Failed to load video');
    setLoading(false);
    onError?.(err);
  }, [id, onError]);

  // Render placeholder while loading or not visible
  const renderPlaceholder = () => {
    if (placeholder) {
      return placeholder;
    }

    return (
      <View style={[styles.placeholder, { width, height }, style]}>
        <ActivityIndicator size="small" color="#666" />
        <Text style={styles.placeholderText}>
          {loading ? 'Loading...' : 'Scroll to load'}
        </Text>
      </View>
    );
  };

  // Don't load anything if not visible
  if (!isVisible || (!loaded && !loading)) {
    return (
      <View ref={viewRef} style={[{ width, height }, style]}>
        {renderPlaceholder()}
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View ref={viewRef} style={[styles.errorContainer, { width, height }, style]}>
        <Text style={styles.errorText}>❌ {error}</Text>
        <Text style={styles.retryText}>Tap to retry</Text>
      </View>
    );
  }

  // Show loading state
  if (loading || !cachedSource) {
    return (
      <View ref={viewRef} style={[{ width, height }, style]}>
        {renderPlaceholder()}
      </View>
    );
  }

  // Render actual media
  return (
    <View ref={viewRef} style={[{ width, height }, style]}>
      {type === 'image' ? (
        <Image
          source={{ uri: cachedSource }}
          style={[{ width, height }, styles.media]}
          resizeMode={resizeMode}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      ) : (
        <Video
          source={{ uri: cachedSource }}
          style={[{ width, height }, styles.media]}
          resizeMode={resizeMode}
          repeat={loop}
          muted={muted}
          paused={!autoPlay}
          onLoad={handleVideoLoad}
          onError={handleVideoError}
        />
      )}
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
    </View>
  );
};

// Lazy loading for post images
export const LazyPostImage: React.FC<{
  postId: string;
  imageUrl: string;
  width?: number;
  height?: number;
  onLoad?: () => void;
}> = ({ postId, imageUrl, width, height, onLoad }) => (
  <LazyMediaComponent
    id={postId}
    type="image"
    source={imageUrl}
    width={width}
    height={height}
    priority="medium"
    onLoad={onLoad}
  />
);

// Lazy loading for reel videos
export const LazyReelVideo: React.FC<{
  reelId: string;
  videoUrl: string;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  onLoad?: () => void;
}> = ({ reelId, videoUrl, width, height, autoPlay = false, onLoad }) => (
  <LazyMediaComponent
    id={reelId}
    type="video"
    source={videoUrl}
    width={width}
    height={height}
    autoPlay={autoPlay}
    priority="high"
    onLoad={onLoad}
  />
);

// Lazy loading for profile pictures
export const LazyProfilePicture: React.FC<{
  userId: string;
  imageUrl: string;
  size?: number;
  onLoad?: () => void;
}> = ({ userId, imageUrl, size = 40, onLoad }) => (
  <LazyMediaComponent
    id={userId}
    type="image"
    source={imageUrl}
    width={size}
    height={size}
    priority="low"
    resizeMode="cover"
    onLoad={onLoad}
    style={{ borderRadius: size / 2 }}
  />
);

const styles = StyleSheet.create({
  media: {
    backgroundColor: '#f0f0f0',
  },
  placeholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
    marginBottom: 4,
  },
  retryText: {
    fontSize: 12,
    color: '#1976d2',
    textAlign: 'center',
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
  },
});

export default LazyMediaComponent;
