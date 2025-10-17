import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  Vibration,
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');
const DOUBLE_TAP_DELAY = 300;
const VIEW_TRACKING_DELAY = 2000;

interface PerfectVideoPlayerProps {
  videoUrl: string;
  isActive: boolean;
  onViewIncrement: () => void;
  onSingleTap?: () => void;
  onDoubleTap?: () => void;
  poster?: string;
  muted?: boolean;
  onMuteToggle?: (muted: boolean) => void;
  style?: any;
}

const PerfectVideoPlayer: React.FC<PerfectVideoPlayerProps> = memo(({
  videoUrl,
  isActive,
  onViewIncrement,
  onSingleTap,
  onDoubleTap,
  poster,
  muted = false,
  onMuteToggle,
  style,
}) => {
  // Video state
  const [paused, setPaused] = useState(!isActive);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffering, setBuffering] = useState(false);
  
  // Refs
  const videoRef = useRef<VideoRef>(null);
  const viewTrackedRef = useRef(false);
  const viewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number | null>(null);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animations
  const progressAnim = useRef(new Animated.Value(0)).current;
  const heartAnim = useRef(new Animated.Value(0)).current;
  const loadingOpacity = useRef(new Animated.Value(1)).current;

  // Video control based on isActive prop
  useEffect(() => {
    setPaused(!isActive);
    
    // Reset view tracking when video becomes inactive
    if (!isActive) {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
    }
  }, [isActive]);

  // View tracking effect
  useEffect(() => {
    if (isActive && !viewTrackedRef.current && !loading && !error) {
      viewTimerRef.current = setTimeout(() => {
        onViewIncrement();
        viewTrackedRef.current = true;
      }, VIEW_TRACKING_DELAY);
    }

    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
        viewTimerRef.current = null;
      }
    };
  }, [isActive, loading, error, onViewIncrement]);

  // Reset view tracking when video URL changes
  useEffect(() => {
    viewTrackedRef.current = false;
    setLoading(true);
    setError(false);
    setCurrentTime(0);
    progressAnim.setValue(0);
  }, [videoUrl, progressAnim]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
      }
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
      }
    };
  }, []);

  // Video event handlers
  const handleLoad = useCallback((data: any) => {
    setLoading(false);
    setError(false);
    setDuration(data.duration);
    
    // Fade out loading indicator
    Animated.timing(loadingOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [loadingOpacity]);

  const handleProgress = useCallback((data: any) => {
    if (duration > 0) {
      setCurrentTime(data.currentTime);
      const progress = data.currentTime / duration;
      
      // Smooth progress animation
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 100,
        useNativeDriver: false,
      }).start();
    }
  }, [duration, progressAnim]);

  const handleError = useCallback((error: any) => {
    console.error('Video error:', error);
    setError(true);
    setLoading(false);
    
    Animated.timing(loadingOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [loadingOpacity]);

  const handleBuffer = useCallback(({ isBuffering }: { isBuffering: boolean }) => {
    setBuffering(isBuffering);
  }, []);

  const handleEnd = useCallback(() => {
    setCurrentTime(0);
    progressAnim.setValue(0);
    // Video will loop automatically due to repeat prop
  }, [progressAnim]);

  // Tap handling
  const handleTap = useCallback(() => {
    const now = Date.now();
    
    if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_TAP_DELAY) {
      // Double tap detected
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      
      if (onDoubleTap) {
        onDoubleTap();
        
        // Heart animation
        Animated.sequence([
          Animated.timing(heartAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(heartAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
        
        Vibration.vibrate(50);
      }
      
      lastTapRef.current = null;
    } else {
      // Single tap - wait to see if double tap follows
      lastTapRef.current = now;
      
      tapTimerRef.current = setTimeout(() => {
        if (lastTapRef.current === now) {
          if (onSingleTap) {
            onSingleTap();
          } else {
            // Default behavior: toggle pause
            setPaused(prev => !prev);
          }
          lastTapRef.current = null;
        }
      }, DOUBLE_TAP_DELAY);
    }
  }, [onSingleTap, onDoubleTap, heartAnim]);

  // Mute toggle
  const handleMuteToggle = useCallback(() => {
    const newMuted = !muted;
    if (onMuteToggle) {
      onMuteToggle(newMuted);
    }
  }, [muted, onMuteToggle]);

  return (
    <View style={[styles.container, style]}>
      {/* Video Player */}
      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={{ uri: videoUrl }}
            style={styles.video}
            resizeMode="cover"
            paused={paused}
            muted={muted}
            repeat={true}
            playWhenInactive={false}
            playInBackground={false}
            onLoad={handleLoad}
            onProgress={handleProgress}
            onError={handleError}
            onBuffer={handleBuffer}
            onEnd={handleEnd}
            poster={poster}
            posterResizeMode="cover"
            bufferConfig={{
              minBufferMs: 2000,
              maxBufferMs: 5000,
              bufferForPlaybackMs: 1000,
              bufferForPlaybackAfterRebufferMs: 1500,
            }}
            maxBitRate={2000000} // 2Mbps for better performance
            reportBandwidth={true}
          />
          
          {/* Loading Overlay */}
          <Animated.View 
            style={[
              styles.loadingOverlay,
              { opacity: loadingOpacity }
            ]}
            pointerEvents={loading ? 'auto' : 'none'}
          >
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading...</Text>
          </Animated.View>

          {/* Buffering Indicator */}
          {buffering && !loading && (
            <View style={styles.bufferingOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}

          {/* Error State */}
          {error && (
            <View style={styles.errorOverlay}>
              <Icon name="error-outline" size={48} color="#fff" />
              <Text style={styles.errorText}>Failed to load video</Text>
            </View>
          )}

          {/* Heart Animation */}
          <Animated.View
            style={[
              styles.heartContainer,
              {
                opacity: heartAnim,
                transform: [
                  {
                    scale: heartAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1.2],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Icon name="favorite" size={80} color="#ff3040" />
          </Animated.View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          {/* Pause Indicator */}
          {paused && !loading && !error && (
            <View style={styles.pauseIndicator}>
              <Icon name="play-arrow" size={60} color="rgba(255,255,255,0.8)" />
            </View>
          )}

          {/* Mute Button */}
          {onMuteToggle && (
            <TouchableWithoutFeedback onPress={handleMuteToggle}>
              <View style={styles.muteButton}>
                <Icon
                  name={muted ? "volume-off" : "volume-up"}
                  size={20}
                  color="#fff"
                />
              </View>
            </TouchableWithoutFeedback>
          )}
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width,
    height,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
    fontWeight: '500',
  },
  bufferingOverlay: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 15,
    padding: 8,
    zIndex: 3,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  heartContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
    zIndex: 4,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    zIndex: 1,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
  },
  pauseIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -30,
    marginLeft: -30,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  muteButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
});

PerfectVideoPlayer.displayName = 'PerfectVideoPlayer';

export default PerfectVideoPlayer;
