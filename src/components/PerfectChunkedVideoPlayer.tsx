/**
 * 🎬 PERFECT CHUNKED VIDEO PLAYER
 * Instagram-style instant loading with zero errors
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Image,
  ViewStyle
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import PerfectChunkedStreamingEngine from '../services/PerfectChunkedStreamingEngine';
import PerfectInstantThumbnailSystem from '../services/PerfectInstantThumbnailSystem';

export interface PerfectChunkedVideoPlayerProps {
  reelId: string;
  videoUrl: string;
  thumbnailUrl: string;
  shouldPlay: boolean;
  isFocused: boolean;
  isActive: boolean;
  onLoad?: (data: any) => void;
  onProgress?: (data: any) => void;
  style?: ViewStyle;
}

// Singleton instances
const chunkedEngine = new PerfectChunkedStreamingEngine();
const thumbnailSystem = new PerfectInstantThumbnailSystem();

const PerfectChunkedVideoPlayer: React.FC<PerfectChunkedVideoPlayerProps> = ({
  reelId,
  videoUrl,
  thumbnailUrl,
  shouldPlay,
  isFocused,
  isActive,
  onLoad,
  onProgress,
  style
}) => {
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [playableUrl, setPlayableUrl] = useState(videoUrl);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [canStartPlayback, setCanStartPlayback] = useState(false);
  const [chunkProgress, setChunkProgress] = useState(0);
  const [showFirstFrame, setShowFirstFrame] = useState(false);
  const [bufferHealth, setBufferHealth] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const thumbnailFadeAnim = useRef(new Animated.Value(1)).current;
  const videoRef = useRef<VideoRef>(null);

  /**
   * 🚀 INITIALIZE INSTANT PLAYBACK
   */
  const initializeInstantPlayback = useCallback(async () => {
    if (!isActive) return;

    console.log(`🚀 Initializing perfect playback: ${reelId}`);
    setIsLoading(true);

    try {
      // Initialize instant playback system
      setCanStartPlayback(false);
      setChunkProgress(0);
      
      // Start thumbnail loading immediately
      thumbnailSystem.prepareThumbnail(reelId, thumbnailUrl, videoUrl);
      
      // Initialize chunked streaming with immediate feedback
      const initResult = await chunkedEngine.initializeChunkedVideo(reelId, videoUrl, 'high');
      
      // Check for 1-second chunk availability
      const firstChunkReady = await chunkedEngine.checkFirstSecondChunk(reelId);
      
      if (firstChunkReady) {
        console.log(`⚡ 1-second chunk ready: ${reelId}`);
        setCanStartPlayback(true);
        setChunkProgress(1);
        performSeamlessTransition();
      } else {
        console.log(`📺 Direct playback for: ${reelId}`);
        // Start direct playback immediately
        setCanStartPlayback(true);
        setPlayableUrl(videoUrl);
        performSeamlessTransition();
      }
      
      const bufferHealth = chunkedEngine.getBufferHealth(reelId);
      setBufferHealth(bufferHealth);
      setIsLoading(false);
      
    } catch (error) {
      console.log(`� Instant fallback for: ${reelId}`);
      // Always start playback immediately with fallback
      setCanStartPlayback(true);
      setPlayableUrl(videoUrl);
      setIsLoading(false);
      performSeamlessTransition();
    }
  }, [reelId, videoUrl, thumbnailUrl, isActive]);

  /**
   * 🎬 PERFORM SEAMLESS TRANSITION
   */
  const performSeamlessTransition = useCallback(() => {
    console.log(`🎬 Seamless transition: ${reelId}`);

    // Get the best playable URL
    const bestUrl = chunkedEngine.getPlayableUrl(reelId, currentTime) || videoUrl;
    setPlayableUrl(bestUrl);

    // Animated transition: thumbnail → video
    Animated.sequence([
      // Show video with fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }),
      // Fade out thumbnail
      Animated.timing(thumbnailFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(() => {
      setShowThumbnail(false);
    });
  }, [reelId, currentTime, videoUrl]);

  /**
   * 🔄 UPDATE PLAYABLE URL
   */
  const updatePlayableUrl = useCallback(() => {
    if (!isActive) return;

    const newUrl = chunkedEngine.getPlayableUrl(reelId, currentTime);
    if (newUrl && newUrl !== playableUrl) {
      setPlayableUrl(newUrl);
    }

    const newBufferHealth = chunkedEngine.getBufferHealth(reelId);
    setBufferHealth(newBufferHealth);
  }, [reelId, currentTime, playableUrl, isActive]);

  /**
   * 📹 HANDLE VIDEO LOAD
   */
  const handleVideoLoad = useCallback((data: any) => {
    console.log(`📹 Video loaded: ${reelId}`);
    setIsLoading(false);
    onLoad?.(data);
  }, [reelId, onLoad]);

  /**
   * ⏯️ HANDLE VIDEO PROGRESS
   */
  const handleVideoProgress = useCallback((data: any) => {
    setCurrentTime(data.currentTime);
    onProgress?.(data);
    
    // Update playable URL if needed
    updatePlayableUrl();
  }, [updatePlayableUrl, onProgress]);

  /**
   * ❌ HANDLE VIDEO ERROR
   */
  const handleVideoError = useCallback((error: any) => {
    console.log(`🔄 Video error fallback: ${reelId}`, error);
    setIsLoading(false);
    // Always fallback to original URL
    setPlayableUrl(videoUrl);
  }, [reelId, videoUrl]);

  // Initialize when active
  useEffect(() => {
    if (isActive) {
      initializeInstantPlayback();
    }
  }, [isActive, initializeInstantPlayback]);

  // Update URL periodically when playing
  useEffect(() => {
    if (shouldPlay && isActive && !isLoading) {
      const interval = setInterval(updatePlayableUrl, 1000);
      return () => clearInterval(interval);
    }
  }, [shouldPlay, isActive, isLoading, updatePlayableUrl]);

  /**
   * 🎨 RENDER THUMBNAIL LAYER
   */
  const renderThumbnail = () => {
    if (!showThumbnail) return null;

    const displayStrategy = thumbnailSystem.getInstantDisplayStrategy(reelId);

    return (
      <Animated.View 
        style={[
          styles.thumbnailContainer,
          { opacity: thumbnailFadeAnim }
        ]}
      >
        {displayStrategy.shouldShowThumbnail ? (
          <Image
            source={{ uri: displayStrategy.thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.blurPlaceholder, { backgroundColor: '#4f46e5' }]} />
        )}
        
        {/* Loading indicator */}
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

  /**
   * 📹 RENDER VIDEO LAYER
   */
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
          paused={!shouldPlay || !isFocused || !canStartPlayback}
          repeat
          onLoad={handleVideoLoad}
          onProgress={handleVideoProgress}
          onError={handleVideoError}
          poster={thumbnailUrl}
          posterResizeMode="cover"
          playInBackground={false}
          playWhenInactive={false}
          progressUpdateInterval={100}
          bufferConfig={{
            minBufferMs: 1000,        // Start playing after 1 second buffer
            maxBufferMs: 5000,        // Keep 5 seconds buffered
            bufferForPlaybackMs: 500, // Start playback after 0.5 seconds
            bufferForPlaybackAfterRebufferMs: 1000
          }}
        />
      </Animated.View>
    );
  };

  /**
   * 📊 RENDER BUFFER INDICATOR
   */
  const renderBufferIndicator = () => {
    if (!isActive || bufferHealth >= 100) return null;

    return (
      <View style={styles.bufferIndicator}>
        <View 
          style={[
            styles.bufferBar,
            { width: `${bufferHealth}%` }
          ]} 
        />
        <Text style={styles.bufferText}>{bufferHealth}%</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* Thumbnail Layer */}
      {renderThumbnail()}
      
      {/* Video Layer */}
      {renderVideo()}
      
      {/* Buffer Indicator */}
      {renderBufferIndicator()}
      
      {/* Chunk Progress Indicator */}
      {chunkProgress > 0 && chunkProgress < 100 && (
        <View style={styles.chunkProgressContainer}>
          <View style={styles.chunkProgressBar}>
            <View 
              style={[
                styles.chunkProgressFill, 
                { width: `${chunkProgress}%` }
              ]} 
            />
          </View>
          <Text style={styles.chunkProgressText}>
            {chunkProgress < 10 ? '⚡ Starting...' : `📶 ${chunkProgress}%`}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative'
  },
  thumbnailContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2
  },
  thumbnail: {
    width: '100%',
    height: '100%'
  },
  blurPlaceholder: {
    width: '100%',
    height: '100%',
    opacity: 0.7
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)'
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 10,
    fontWeight: '600'
  },
  videoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1
  },
  video: {
    width: '100%',
    height: '100%'
  },
  bufferIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    zIndex: 3
  },
  bufferBar: {
    height: '100%',
    backgroundColor: '#4f46e5',
    borderRadius: 2
  },
  bufferText: {
    position: 'absolute',
    right: 0,
    top: -20,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  chunkProgressContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 3,
    alignItems: 'center'
  },
  chunkProgressBar: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden'
  },
  chunkProgressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 2
  },
  chunkProgressText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center'
  }
});

export default PerfectChunkedVideoPlayer;
