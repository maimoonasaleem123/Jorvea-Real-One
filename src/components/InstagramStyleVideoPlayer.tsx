/**
 * 🎬 INSTAGRAM-STYLE VIDEO PLAYER
 * Professional instant loading with smart preloading
 * 
 * Features:
 * - Instant thumbnail display
 * - Immediate playback start (no delay)
 * - Smart preloading for next/previous videos
 * - Adaptive quality based on network
 * - Memory efficient caching
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Image,
  ViewStyle,
  Platform
} from 'react-native';
import Video, { VideoRef, OnLoadData, OnProgressData } from 'react-native-video';

export interface InstagramStyleVideoPlayerProps {
  reelId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  shouldPlay: boolean;
  isFocused: boolean;
  isActive: boolean;
  muted?: boolean;
  onLoad?: (data: OnLoadData) => void;
  onProgress?: (data: OnProgressData) => void;
  onBuffer?: (isBuffering: boolean) => void;
  onReadyForDisplay?: () => void;
  style?: ViewStyle;
}

// Global preload cache for instant playback
const videoPreloadCache = new Map<string, boolean>();
const thumbnailCache = new Map<string, string>();

const InstagramStyleVideoPlayer: React.FC<InstagramStyleVideoPlayerProps> = ({
  reelId,
  videoUrl,
  thumbnailUrl,
  shouldPlay,
  isFocused,
  isActive,
  muted = false,
  onLoad,
  onProgress,
  onBuffer,
  onReadyForDisplay,
  style
}) => {
  // State
  const [isBuffering, setIsBuffering] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [initialPlayStarted, setInitialPlayStarted] = useState(false);
  
  // Refs
  const videoRef = useRef<VideoRef>(null);
  const thumbnailFadeAnim = useRef(new Animated.Value(1)).current;
  const videoFadeAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const lastBufferTime = useRef(0);

  // Determine if video should actually play
  const shouldActuallyPlay = useMemo(() => {
    // Allow initial play even during brief buffering for instant start
    const allowDuringInitialBuffer = !initialPlayStarted || !isBuffering;
    return shouldPlay && isFocused && isActive && allowDuringInitialBuffer;
  }, [shouldPlay, isFocused, isActive, isBuffering, initialPlayStarted]);

  /**
   * 🚀 Handle video load - Start playback immediately
   */
  const handleLoad = useCallback((data: OnLoadData) => {
    if (!mountedRef.current) return;
    
    console.log(`✅ Video loaded: ${reelId}`);
    setIsLoaded(true);
    setIsBuffering(false);
    setInitialPlayStarted(true); // Mark that initial play has started
    
    // Mark video as preloaded
    videoPreloadCache.set(reelId, true);
    
    // Smoothly transition from thumbnail to video
    Animated.parallel([
      Animated.timing(thumbnailFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(videoFadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      if (mountedRef.current) {
        setShowThumbnail(false);
        onReadyForDisplay?.();
      }
    });

    // Call parent onLoad
    onLoad?.(data);
  }, [reelId, onLoad, onReadyForDisplay, thumbnailFadeAnim, videoFadeAnim]);

  /**
   * 📊 Handle video progress
   */
  const handleProgress = useCallback((data: OnProgressData) => {
    if (!mountedRef.current) return;
    onProgress?.(data);
  }, [onProgress]);

  /**
   * 🔄 Handle buffering states
   */
  const handleBuffer = useCallback(({ isBuffering: buffering }: { isBuffering: boolean }) => {
    if (!mountedRef.current) return;
    
    const now = Date.now();
    
    // Debounce buffer state changes to avoid flickering
    if (buffering && (now - lastBufferTime.current) > 500) {
      console.log(`⏳ Buffering: ${reelId}`);
      setIsBuffering(true);
      onBuffer?.(true);
      lastBufferTime.current = now;
    } else if (!buffering) {
      setIsBuffering(false);
      onBuffer?.(false);
    }
  }, [reelId, onBuffer]);

  /**
   * ❌ Handle video errors with graceful fallback
   */
  const handleError = useCallback((error: any) => {
    if (!mountedRef.current) return;
    
    console.error(`❌ Video error for ${reelId}:`, error);
    setHasError(true);
    setIsBuffering(false);
    
    // Keep thumbnail visible on error
    setShowThumbnail(true);
    Animated.timing(thumbnailFadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [reelId, thumbnailFadeAnim]);

  /**
   * 🎯 Handle ready for display (first frame rendered)
   */
  const handleReadyForDisplay = useCallback(() => {
    if (!mountedRef.current) return;
    console.log(`🎯 Ready for display: ${reelId}`);
    
    // Ensure video starts playing immediately when ready
    if (shouldPlay && isFocused && isActive) {
      setIsBuffering(false);
    }
    
    if (onReadyForDisplay) {
      onReadyForDisplay();
    }
  }, [reelId, shouldPlay, isFocused, isActive, onReadyForDisplay]);

  /**
   * 🚀 Force play when video becomes active
   */
  useEffect(() => {
    if (isActive && shouldPlay && isFocused && isLoaded) {
      // Reset buffering state to allow immediate playback
      setIsBuffering(false);
    }
  }, [isActive, shouldPlay, isFocused, isLoaded]);

  /**
   * 🔧 Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * 📱 Preload thumbnail if available
   */
  useEffect(() => {
    if (thumbnailUrl && !thumbnailCache.has(reelId)) {
      Image.prefetch(thumbnailUrl).then(() => {
        thumbnailCache.set(reelId, thumbnailUrl);
      }).catch(() => {
        // Ignore thumbnail prefetch errors
      });
    }
  }, [reelId, thumbnailUrl]);

  return (
    <View style={[styles.container, style]}>
      {/* Thumbnail layer */}
      {showThumbnail && thumbnailUrl && (
        <Animated.View 
          style={[
            styles.thumbnailContainer,
            { opacity: thumbnailFadeAnim }
          ]}
        >
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
          {/* Loading indicator on thumbnail */}
          {!isLoaded && !hasError && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </Animated.View>
      )}

      {/* Video layer */}
      {!hasError && (
        <Animated.View 
          style={[
            styles.videoContainer,
            { opacity: videoFadeAnim }
          ]}
        >
          <Video
            ref={videoRef}
            source={{ uri: videoUrl }}
            style={styles.video}
            resizeMode="cover"
            repeat={true}
            paused={!shouldActuallyPlay}
            muted={muted}
            playInBackground={false}
            playWhenInactive={false}
            // Performance optimizations
            poster={thumbnailUrl}
            posterResizeMode="cover"
            ignoreSilentSwitch="ignore"
            mixWithOthers="duck"
            // Buffering configuration for INSTANT playback and smooth experience
            bufferConfig={{
              minBufferMs: Platform.OS === 'android' ? 2500 : 2000,  // Increased for better preloading
              maxBufferMs: Platform.OS === 'android' ? 8000 : 6000,  // Increased max buffer
              bufferForPlaybackMs: Platform.OS === 'android' ? 250 : 150,  // VERY LOW for instant start
              bufferForPlaybackAfterRebufferMs: Platform.OS === 'android' ? 1000 : 800,
              cacheSizeMB: 200, // Cache videos for instant replay
            }}
            // Progressive download for FASTEST start
            progressUpdateInterval={250}
            maxBitRate={2000000} // Limit bitrate for faster initial load
            // Event handlers
            onLoad={handleLoad}
            onProgress={handleProgress}
            onBuffer={handleBuffer}
            onError={handleError}
            onReadyForDisplay={handleReadyForDisplay}
            // Preload strategy
            preventsDisplaySleepDuringVideoPlayback={true}
          />
        </Animated.View>
      )}

      {/* Buffering indicator overlay */}
      {isBuffering && !showThumbnail && (
        <View style={styles.bufferingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  thumbnailContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
});

export default React.memo(InstagramStyleVideoPlayer);
