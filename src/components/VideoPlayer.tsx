import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Text,
  Dimensions,
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface VideoPlayerProps {
  source: { uri: string };
  style?: any;
  resizeMode?: 'contain' | 'cover' | 'stretch';
  onLoad?: (data: any) => void;
  onProgress?: (data: any) => void;
  onEnd?: () => void;
  paused?: boolean;
  repeat?: boolean;
  muted?: boolean;
  controlsEnabled?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  source,
  style,
  resizeMode = 'cover',
  onLoad,
  onProgress,
  onEnd,
  paused = false,
  repeat = true,
  muted = false,
  controlsEnabled = true,
}) => {
  const { colors } = useTheme();
  const videoRef = useRef<VideoRef>(null);
  const [isPlaying, setIsPlaying] = useState(!paused);
  const [isMuted, setIsMuted] = useState(muted);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControlsOverlay, setShowControlsOverlay] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(0)).current;

  const togglePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  const showControls = useCallback(() => {
    setShowControlsOverlay(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Auto hide controls after 3 seconds
    setTimeout(() => {
      hideControls();
    }, 3000);
  }, [controlsOpacity]);

  const hideControls = useCallback(() => {
    Animated.timing(controlsOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowControlsOverlay(false);
    });
  }, [controlsOpacity]);

  const handleVideoPress = useCallback(() => {
    if (!controlsEnabled) return;
    
    if (showControlsOverlay) {
      hideControls();
    } else {
      showControls();
    }
  }, [controlsEnabled, showControlsOverlay, showControls, hideControls]);

  const handleLoad = useCallback((data: any) => {
    setDuration(data.duration);
    onLoad?.(data);
  }, [onLoad]);

  const handleProgress = useCallback((data: any) => {
    setCurrentTime(data.currentTime);
    onProgress?.(data);
  }, [onProgress]);

  const seek = useCallback((time: number) => {
    videoRef.current?.seek(time);
    setCurrentTime(time);
  }, []);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={[styles.container, style]}>
      <Video
        ref={videoRef}
        source={source}
        style={styles.video}
        resizeMode={resizeMode}
        paused={!isPlaying}
        repeat={repeat}
        muted={isMuted}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={onEnd}
        progressUpdateInterval={250}
      />

      {/* Touch overlay for controls */}
      <TouchableOpacity
        style={styles.touchOverlay}
        onPress={handleVideoPress}
        activeOpacity={1}
      />

      {/* Controls overlay */}
      {controlsEnabled && showControlsOverlay && (
        <Animated.View
          style={[
            styles.controlsOverlay,
            { opacity: controlsOpacity }
          ]}
        >
          {/* Center play/pause button */}
          <TouchableOpacity
            style={styles.centerControl}
            onPress={togglePlayPause}
          >
            <View style={[styles.playButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
              <Icon
                name={isPlaying ? 'pause' : 'play'}
                size={40}
                color="#FFFFFF"
              />
            </View>
          </TouchableOpacity>

          {/* Bottom controls */}
          <View style={styles.bottomControls}>
            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPercentage}%`, backgroundColor: colors.primary }
                  ]}
                />
              </View>
            </View>

            {/* Control buttons */}
            <View style={styles.controlButtons}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={togglePlayPause}
              >
                <Icon
                  name={isPlaying ? 'pause' : 'play'}
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={toggleMute}
              >
                <Icon
                  name={isMuted ? 'volume-mute' : 'volume-high'}
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              <Text style={styles.timeText}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerControl: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  controlButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlButton: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    marginRight: 12,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    flex: 1,
    textAlign: 'right',
  },
});

export default VideoPlayer;
