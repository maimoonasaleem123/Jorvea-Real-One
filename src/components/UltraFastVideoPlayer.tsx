/**
 * 🎬 ULTRA FAST VIDEO PLAYER
 * Zero-delay video player with Instagram/TikTok performance
 * - Instant start with thumbnail overlay
 * - Perfect pause/play controls
 * - Restart from beginning on swipe back
 * - No black screens ever
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Text,
} from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import SmartProgressiveReelsEngine, { ReelOptimized } from '../services/UltraFastReelsEngine';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface UltraFastVideoPlayerProps {
  reel: ReelOptimized;
  isVisible: boolean;
  isFocused: boolean;
  onLoad?: (data: any) => void;
  onProgress?: (data: any) => void;
  onEnd?: () => void;
  shouldPlay: boolean;
  onPlayPauseToggle?: () => void;
}

const UltraFastVideoPlayer: React.FC<UltraFastVideoPlayerProps> = ({
  reel,
  isVisible,
  isFocused,
  onLoad,
  onProgress,
  onEnd,
  shouldPlay,
  onPlayPauseToggle,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [videoPaused, setVideoPaused] = useState(!shouldPlay);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [error, setError] = useState(false);
  
  const videoRef = useRef<any>(null);
  const engine = SmartProgressiveReelsEngine.getInstance();
  const playButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // � ULTRA AGGRESSIVE READY CHECK - Instant start for big reels!
  useEffect(() => {
    const checkReadiness = () => {
      const ready = engine.isVideoReady(reel.id);
      const progressData = engine.getLoadingProgress(reel.id);
      
      setPreloadProgress(progressData.progress);
      setVideoReady(ready);
      
      // � INSTANT START - Even 1% is enough for big reels!
      if (ready && isFocused && progressData.progress >= 1) {
        // Video is ready instantly, start playing immediately
        setShowThumbnail(false);
        setIsLoading(false);
        console.log(`� INSTANT START at ${progressData.progress}% for reel:`, reel.id);
      }
    };

    checkReadiness();
    
    // Check every 10ms for ultra-aggressive response
    const interval = setInterval(checkReadiness, 10);
    
    return () => clearInterval(interval);
  }, [reel.id, isFocused]);

  // 🎮 PLAY/PAUSE CONTROL
  useEffect(() => {
    setVideoPaused(!shouldPlay || !isFocused);
    
    if (!shouldPlay) {
      setShowPlayButton(true);
    } else {
      setShowPlayButton(false);
    }
  }, [shouldPlay, isFocused]);

  // 🔄 RESTART FROM BEGINNING
  useEffect(() => {
    if (isFocused && videoRef.current) {
      // Always start from beginning when reel becomes focused
      videoRef.current.seek(0);
      setError(false);
      
      console.log(`🔄 Restarting reel from beginning: ${reel.id}`);
    }
  }, [isFocused, reel.id]);

  // 📦 PREPARE VIDEO ON MOUNT
  useEffect(() => {
    engine.priorityLoad(reel);
  }, [reel.id]);

  const handleVideoLoad = useCallback((data: any) => {
    console.log(`✅ Video loaded: ${reel.id}`);
    setIsLoading(false);
    setError(false);
    
    // Hide thumbnail after video loads
    if (isFocused) {
      setTimeout(() => setShowThumbnail(false), 200);
    }
    
    onLoad?.(data);
  }, [reel.id, isFocused, onLoad]);

  const handleVideoError = useCallback((error: any) => {
    console.error(`❌ Video error for ${reel.id}:`, error);
    setError(true);
    setIsLoading(false);
  }, [reel.id]);

  const handlePlayPausePress = useCallback(() => {
    const newPausedState = !videoPaused;
    setVideoPaused(newPausedState);
    setShowPlayButton(newPausedState);
    
    // Hide play button after 2 seconds if playing
    if (!newPausedState) {
      if (playButtonTimeoutRef.current) {
        clearTimeout(playButtonTimeoutRef.current);
      }
      playButtonTimeoutRef.current = setTimeout(() => {
        setShowPlayButton(false);
      }, 2000);
    }
    
    onPlayPauseToggle?.();
    console.log(`🎮 Video ${newPausedState ? 'paused' : 'playing'}: ${reel.id}`);
  }, [videoPaused, onPlayPauseToggle, reel.id]);

  const handleVideoProgress = useCallback((data: any) => {
    onProgress?.(data);
  }, [onProgress]);

  const handleVideoEnd = useCallback(() => {
    console.log(`🏁 Video ended: ${reel.id}`);
    onEnd?.();
  }, [reel.id, onEnd]);

  if (!isVisible) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* 🖼️ INSTANT THUMBNAIL - Always show first for no black screens */}
      {reel.thumbnailUrl && (
        <Image
          source={{ uri: reel.thumbnailUrl }}
          style={[
            styles.thumbnail, 
            { 
              opacity: showThumbnail ? 1 : 0,
              zIndex: showThumbnail ? 10 : 1,
            }
          ]}
          resizeMode="cover"
        />
      )}

      {/* 🎬 VIDEO PLAYER */}
      <Video
        ref={videoRef}
        source={{ uri: reel.videoUrl }}
        style={styles.video}
        resizeMode="cover"
        paused={videoPaused}
        repeat={false}
        playWhenInactive={false}
        playInBackground={false}
        onLoad={handleVideoLoad}
        onError={handleVideoError}
        onProgress={handleVideoProgress}
        onEnd={handleVideoEnd}
        poster={reel.thumbnailUrl}
        posterResizeMode="cover"
        ignoreSilentSwitch="ignore"
        bufferConfig={{
          minBufferMs: 2000,
          maxBufferMs: 5000,
          bufferForPlaybackMs: 1000,
          bufferForPlaybackAfterRebufferMs: 1500,
        }}
      />

      {/* 🎮 PLAY/PAUSE OVERLAY */}
      <TouchableOpacity
        style={styles.playPauseOverlay}
        onPress={handlePlayPausePress}
        activeOpacity={0.7}
      >
        {(showPlayButton || videoPaused) && (
          <View style={styles.playButtonContainer}>
            <Icon
              name={videoPaused ? "play" : "pause"}
              size={60}
              color="rgba(255, 255, 255, 0.9)"
            />
          </View>
        )}
      </TouchableOpacity>

      {/* ⏳ LOADING INDICATOR - Hide when 10% ready */}
      {isLoading && !error && preloadProgress < 10 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          {preloadProgress > 0 && (
            <Text style={styles.progressText}>
              {Math.round(preloadProgress)}%
            </Text>
          )}
        </View>
      )}

      {/* ❌ ERROR STATE */}
      {error && (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={50} color="#ff4444" />
          <Text style={styles.errorText}>Video unavailable</Text>
        </View>
      )}

      {/* 🎯 DEBUG INFO (Remove in production) */}
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Ready: {videoReady ? '✅' : '❌'} | 
            Progress: {preloadProgress}% | 
            Playing: {preloadProgress >= 10 ? '▶️' : '⏳'} |
            Paused: {videoPaused ? '⏸️' : '▶️'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: screenWidth,
    height: screenHeight,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  video: {
    width: screenWidth,
    height: screenHeight,
    backgroundColor: '#000',
  },
  thumbnail: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: screenWidth,
    height: screenHeight,
    zIndex: 2,
    backgroundColor: '#000',
  },
  playPauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  playButtonContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 50,
    padding: 20,
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 10,
    fontWeight: '600',
  },
  errorContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    marginTop: 10,
    fontWeight: '600',
  },
  debugInfo: {
    position: 'absolute',
    top: 50,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 5,
    borderRadius: 5,
    zIndex: 5,
  },
  debugText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});

export default UltraFastVideoPlayer;
