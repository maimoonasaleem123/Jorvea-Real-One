/**
 * Progressive Video Player Component
 * Implements Instagram-like progressive video loading and playback
 * - Starts playback with minimal buffer
 * - Shows loading indicators
 * - Handles network quality adaptation
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Animated } from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import ProgressiveVideoLoadingService from '../services/ProgressiveVideoLoadingService';

export interface ProgressiveVideoRef {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => Promise<number>;
}

export interface ProgressiveVideoProps {
  source: { uri: string };
  style?: any;
  resizeMode?: 'contain' | 'cover' | 'stretch';
  repeat?: boolean;
  paused?: boolean;
  muted?: boolean;
  onLoad?: (data: any) => void;
  onProgress?: (data: any) => void;
  onBuffer?: (data: { isBuffering: boolean }) => void;
  onReadyForDisplay?: () => void;
  poster?: string;
  posterResizeMode?: 'contain' | 'cover' | 'stretch';
  playInBackground?: boolean;
  playWhenInactive?: boolean;
  progressUpdateInterval?: number;
  videoId: string; // Unique identifier for progressive loading
  showLoadingIndicator?: boolean;
  showNetworkQuality?: boolean;
}

const ProgressiveVideoPlayer = forwardRef<ProgressiveVideoRef, ProgressiveVideoProps>(
  ({
    source,
    style,
    resizeMode = 'cover',
    repeat,
    paused,
    muted,
    onLoad,
    onProgress,
    onBuffer,
    onReadyForDisplay,
    poster,
    posterResizeMode,
    playInBackground,
    playWhenInactive,
    progressUpdateInterval,
    videoId,
    showLoadingIndicator = true,
    showNetworkQuality = false,
    ...props
  }, ref) => {
    const videoRef = useRef<VideoRef>(null);
    const progressiveService = ProgressiveVideoLoadingService.getInstance();
    
    // Progressive loading state
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [isBuffering, setIsBuffering] = useState(true);
    const [networkQuality, setNetworkQuality] = useState(progressiveService.getNetworkStatus());
    
    // Animations
    const loadingOpacity = useRef(new Animated.Value(1)).current;
    const contentOpacity = useRef(new Animated.Value(0)).current;

    useImperativeHandle(ref, () => ({
      play: () => videoRef.current?.resume?.(),
      pause: () => videoRef.current?.pause?.(),
      seek: (time: number) => videoRef.current?.seek?.(time),
      getCurrentTime: () => Promise.resolve(0), // Implement if needed
    }));

    useEffect(() => {
      initializeProgressiveLoading();
      updateNetworkStatus();
    }, [source.uri, videoId]);

    useEffect(() => {
      // Monitor service for readiness
      const checkReadiness = setInterval(() => {
        const ready = progressiveService.isVideoReady(videoId);
        const progress = progressiveService.getLoadingProgress(videoId);
        
        setIsVideoReady(ready);
        setLoadingProgress(progress);
        
        if (ready && !isVideoReady) {
          handleVideoReady();
        }
      }, 100);

      return () => clearInterval(checkReadiness);
    }, [videoId, isVideoReady]);

    /**
     * Initialize progressive loading for this video
     */
    const initializeProgressiveLoading = async () => {
      try {
        await progressiveService.startProgressiveLoading(
          videoId,
          source.uri,
          handleVideoReady,
          handleLoadingProgress
        );
      } catch (error) {
        console.error('Progressive loading initialization failed:', error);
      }
    };

    /**
     * Update network status periodically
     */
    const updateNetworkStatus = () => {
      const interval = setInterval(() => {
        setNetworkQuality(progressiveService.getNetworkStatus());
      }, 5000);

      return () => clearInterval(interval);
    };

    /**
     * Handle when video is ready for playback
     */
    const handleVideoReady = () => {
      console.log('🎬 Video ready for playback:', videoId);
      setIsVideoReady(true);
      setIsBuffering(false);
      
      // Animate content in
      Animated.parallel([
        Animated.timing(loadingOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      onReadyForDisplay?.();
    };

    /**
     * Handle loading progress updates
     */
    const handleLoadingProgress = (progress: number) => {
      setLoadingProgress(progress);
    };

    /**
     * Handle video load event
     */
    const handleVideoLoad = (data: any) => {
      console.log('📹 Video metadata loaded:', videoId);
      onLoad?.(data);
    };

    /**
     * Handle video progress
     */
    const handleVideoProgress = (data: any) => {
      onProgress?.(data);
    };

    /**
     * Handle buffering state
     */
    const handleBuffer = (data: { isBuffering: boolean }) => {
      setIsBuffering(data.isBuffering);
      onBuffer?.(data);
    };

    /**
     * Get network quality indicator color
     */
    const getNetworkQualityColor = () => {
      switch (networkQuality.speed) {
        case 'fast': return '#4CAF50';
        case 'medium': return '#FF9800';
        case 'slow': return '#F44336';
        default: return '#757575';
      }
    };

    /**
     * Get quality text
     */
    const getQualityText = () => {
      const optimal = progressiveService.getOptimalQuality();
      return optimal.charAt(0).toUpperCase() + optimal.slice(1);
    };

    return (
      <View style={[styles.container, style]}>
        {/* Video Component */}
        <Animated.View 
          style={[
            styles.videoContainer, 
            { opacity: contentOpacity }
          ]}>
          <Video
            ref={videoRef}
            source={source}
            style={styles.video}
            resizeMode={resizeMode}
            repeat={repeat}
            paused={paused || !isVideoReady} // Don't play until ready
            muted={muted}
            onLoad={handleVideoLoad}
            onProgress={handleVideoProgress}
            onBuffer={handleBuffer}
            poster={poster}
            posterResizeMode={posterResizeMode}
            playInBackground={playInBackground}
            playWhenInactive={playWhenInactive}
            progressUpdateInterval={progressUpdateInterval}
            bufferConfig={{
              minBufferMs: 3000, // 3 seconds minimum buffer
              maxBufferMs: 15000, // 15 seconds maximum buffer
              bufferForPlaybackMs: 2000, // Start playback after 2 seconds
              bufferForPlaybackAfterRebufferMs: 3000, // 3 seconds after rebuffer
            }}
            {...props}
          />
        </Animated.View>

        {/* Loading Overlay */}
        {showLoadingIndicator && (
          <Animated.View 
            style={[
              styles.loadingOverlay, 
              { opacity: loadingOpacity }
            ]}
            pointerEvents={isVideoReady ? 'none' : 'auto'}>
            
            {/* Main Loading Indicator */}
            <View style={styles.loadingContent}>
              <ActivityIndicator 
                size="large" 
                color="#ffffff" 
                style={styles.loadingSpinner}
              />
              
              {/* Loading Progress */}
              <Text style={styles.loadingText}>
                {loadingProgress < 100 ? `Loading ${Math.round(loadingProgress)}%` : 'Ready'}
              </Text>
              
              {/* Progress Bar */}
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <View 
                    style={[
                      styles.progressBarFill,
                      { width: `${loadingProgress}%` }
                    ]} 
                  />
                </View>
              </View>

              {/* Buffer Status */}
              {isBuffering && (
                <Text style={styles.bufferText}>
                  Buffering...
                </Text>
              )}
            </View>
          </Animated.View>
        )}

        {/* Network Quality Indicator */}
        {showNetworkQuality && (
          <View style={styles.networkIndicator}>
            <View 
              style={[
                styles.networkDot,
                { backgroundColor: getNetworkQualityColor() }
              ]} 
            />
            <Text style={styles.networkText}>
              {getQualityText()}
            </Text>
          </View>
        )}

        {/* Buffering Indicator */}
        {isVideoReady && isBuffering && (
          <View style={styles.bufferingIndicator}>
            <ActivityIndicator size="small" color="#ffffff" />
          </View>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoContainer: {
    flex: 1,
  },
  video: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    marginBottom: 16,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBarContainer: {
    width: 200,
    marginBottom: 8,
  },
  progressBarBackground: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 1.5,
  },
  bufferText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  networkIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1001,
  },
  networkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  networkText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '500',
  },
  bufferingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 20,
    zIndex: 1002,
  },
});

ProgressiveVideoPlayer.displayName = 'ProgressiveVideoPlayer';

export default ProgressiveVideoPlayer;
