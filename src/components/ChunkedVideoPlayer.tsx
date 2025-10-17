/**
 * 🎬 CHUNKED STREAMING VIDEO PLAYER
 * Instagram-like instant video player with chunked loading
 * - Instant thumbnail display
 * - Seamless video transition
 * - Progressive chunk loading
 * - Perfect buffer management
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Text,
  Dimensions,
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import ChunkedStreamingEngine from '../services/ChunkedStreamingEngine';
import InstantThumbnailSystem from '../services/InstantThumbnailSystem';

const { width, height } = Dimensions.get('screen');

interface ChunkedVideoPlayerProps {
  reelId: string;
  videoUrl: string;
  thumbnailUrl: string;
  isActive: boolean;
  isFocused: boolean;
  shouldPlay: boolean;
  onLoad?: (data: any) => void;
  onProgress?: (data: any) => void;
  onEnd?: () => void;
  style?: any;
}

const ChunkedVideoPlayer: React.FC<ChunkedVideoPlayerProps> = ({
  reelId,
  videoUrl,
  thumbnailUrl,
  isActive,
  isFocused,
  shouldPlay,
  onLoad,
  onProgress,
  onEnd,
  style,
}) => {
  // ⚡ STATE MANAGEMENT
  const [playableUrl, setPlayableUrl] = useState<string | null>(null);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [showFirstFrame, setShowFirstFrame] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [bufferHealth, setBufferHealth] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // 🎯 REFS
  const videoRef = useRef<VideoRef>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const thumbnailFadeAnim = useRef(new Animated.Value(1)).current;
  
  // 🚀 ENGINES
  const streamingEngine = ChunkedStreamingEngine.getInstance();
  const thumbnailSystem = InstantThumbnailSystem.getInstance();

  // ⚡ INSTANT INITIALIZATION
  useEffect(() => {
    if (isActive) {
      initializeInstantPlayback();
    }
  }, [isActive, reelId]);

  // 🎬 SEAMLESS TRANSITION MANAGEMENT
  useEffect(() => {
    const displayStrategy = thumbnailSystem.getInstantDisplayStrategy(reelId, videoReady);
    
    setShowThumbnail(displayStrategy.showThumbnail);
    setShowFirstFrame(displayStrategy.showFirstFrame);
    
    // Smooth transitions
    if (videoReady && !showThumbnail) {
      performSeamlessTransition();
    }
  }, [videoReady, reelId]);

  // 📱 BUFFER HEALTH MONITORING
  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => {
        const health = streamingEngine.getBufferHealth(reelId);
        setBufferHealth(health);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isActive, reelId]);

  /**
   * ⚡ INSTANT PLAYBACK INITIALIZATION
   */
  const initializeInstantPlayback = useCallback(async () => {
    console.log(`⚡ Initializing instant playback: ${reelId}`);
    
    try {
      // 1. Prepare thumbnail instantly
      await thumbnailSystem.prepareThumbnail(reelId, thumbnailUrl, videoUrl);
      
      // 2. Initialize chunked video
      await streamingEngine.initializeChunkedVideo(reelId, videoUrl, thumbnailUrl);
      
      // 3. Load first segment instantly
      const firstSegmentReady = await streamingEngine.loadFirstSegmentInstantly(reelId);
      
      if (firstSegmentReady) {
        // 4. Get playable URL
        const url = streamingEngine.getPlayableUrl(reelId, 0);
        if (url) {
          setPlayableUrl(url);
          setIsLoading(false);
          console.log(`🔥 Instant playback ready: ${reelId}`);
        }
        
        // 5. Start progressive loading in background
        streamingEngine.startProgressiveLoading(reelId, 'high');
      }
    } catch (error) {
      console.error(`❌ Instant playback failed: ${reelId}`, error);
      setIsLoading(false);
      // Fallback to original URL
      setPlayableUrl(videoUrl);
    }
  }, [reelId, videoUrl, thumbnailUrl]);

  /**
   * 🌊 SEAMLESS TRANSITION
   */
  const performSeamlessTransition = useCallback(() => {
    // Fade out thumbnail, fade in video
    Animated.parallel([
      Animated.timing(thumbnailFadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowThumbnail(false);
    });
  }, [fadeAnim, thumbnailFadeAnim]);

  /**
   * 📺 VIDEO EVENT HANDLERS
   */
  const handleVideoLoad = useCallback((data: any) => {
    console.log(`📺 Video loaded: ${reelId}`);
    setVideoReady(true);
    setIsLoading(false);
    onLoad?.(data);
  }, [reelId, onLoad]);

  const handleProgress = useCallback((data: any) => {
    setCurrentTime(data.currentTime);
    
    // Update playable URL based on current time
    const url = streamingEngine.getPlayableUrl(reelId, data.currentTime);
    if (url && url !== playableUrl) {
      setPlayableUrl(url);
    }
    
    onProgress?.(data);
  }, [reelId, playableUrl, onProgress]);

  const handleVideoError = useCallback((error: any) => {
    console.error(`❌ Video error: ${reelId}`, error);
    setIsLoading(false);
    // Fallback to original URL
    setPlayableUrl(videoUrl);
  }, [reelId, videoUrl]);

  /**
   * 🎨 RENDER LOGIC
   */
  const renderThumbnail = () => {
    if (!showThumbnail) return null;

    return (
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
        
        {/* Loading indicator over thumbnail */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>
              {bufferHealth > 0 ? `${Math.round(bufferHealth)}%` : 'Loading...'}
            </Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const renderFirstFrame = () => {
    if (!showFirstFrame) return null;

    const thumbnailData = thumbnailSystem.getLoadingState(reelId);
    
    return (
      <View style={styles.firstFrameContainer}>
        <Image
          source={{ uri: thumbnailUrl }} // Use thumbnail as first frame fallback
          style={styles.firstFrame}
          resizeMode="cover"
        />
      </View>
    );
  };

  const renderVideo = () => {
    if (!playableUrl) return null;

    return (
      <Animated.View 
        style={[
          styles.videoContainer,
          { opacity: fadeAnim }
        ]}
      >
        <Video
          ref={videoRef}
          source={{ uri: playableUrl }}
          style={[styles.video, style]}
          resizeMode="cover"
          paused={!shouldPlay || !isFocused}
          repeat={true}
          onLoad={handleVideoLoad}
          onProgress={handleProgress}
          onEnd={onEnd}
          onError={handleVideoError}
          bufferConfig={{
            minBufferMs: 1000,
            maxBufferMs: 3000,
            bufferForPlaybackMs: 500,
            bufferForPlaybackAfterRebufferMs: 1000,
          }}
        />
      </Animated.View>
    );
  };

  const renderBufferIndicator = () => {
    if (bufferHealth >= 95 || !isActive) return null;

    return (
      <View style={styles.bufferIndicator}>
        <View style={[styles.bufferBar, { width: `${bufferHealth}%` }]} />
        <Text style={styles.bufferText}>{Math.round(bufferHealth)}%</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderThumbnail()}
      {renderFirstFrame()}
      {renderVideo()}
      {renderBufferIndicator()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width,
    height,
    backgroundColor: '#000',
    position: 'relative',
  },
  thumbnailContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  firstFrameContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  firstFrame: {
    width: '100%',
    height: '100%',
  },
  videoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  loadingText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  bufferIndicator: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    zIndex: 5,
  },
  bufferBar: {
    height: '100%',
    backgroundColor: '#1DB954',
    borderRadius: 2,
  },
  bufferText: {
    position: 'absolute',
    right: -30,
    top: -20,
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default ChunkedVideoPlayer;
