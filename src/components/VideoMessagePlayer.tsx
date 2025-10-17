import React, { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  StatusBar,
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface VideoMessagePlayerProps {
  videoUri: string;
  isMyMessage: boolean;
  onError?: (error: any) => void;
  onLoad?: (data: any) => void;
}

const VideoMessagePlayer: React.FC<VideoMessagePlayerProps> = ({
  videoUri,
  isMyMessage,
  onError,
  onLoad,
}) => {
  const [paused, setPaused] = useState(true); // Start paused
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [fullscreenPaused, setFullscreenPaused] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  const videoRef = useRef<any>(null);
  const fullscreenVideoRef = useRef<any>(null);

  const handlePlayPause = () => {
    setPaused(!paused);
  };

  const handleVideoPress = () => {
    if (paused) {
      // If paused, open fullscreen
      setShowFullscreen(true);
      setFullscreenPaused(false);
    } else {
      // If playing, pause it
      setPaused(true);
    }
  };

  const handleFullscreenPlayPause = () => {
    setFullscreenPaused(!fullscreenPaused);
  };

  const closeFullscreen = () => {
    setShowFullscreen(false);
    setFullscreenPaused(true);
    setPaused(true);
  };

  const handleLoad = (data: any) => {
    setDuration(data.duration);
    setIsLoading(false);
    if (onLoad) onLoad(data);
  };

  const handleProgress = (data: any) => {
    setCurrentTime(data.currentTime);
  };

  const handleFullscreenProgress = (data: any) => {
    setCurrentTime(data.currentTime);
  };

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleControlsToggle = () => {
    setShowControls(!showControls);
    // Auto-hide controls after 3 seconds
    setTimeout(() => setShowControls(false), 3000);
  };

  return (
    <>
      {/* Chat Video Message */}
      <View style={[
        styles.videoContainer,
        isMyMessage ? styles.myVideoContainer : styles.otherVideoContainer
      ]}>
        <TouchableOpacity 
          style={styles.videoTouchable}
          onPress={handleVideoPress}
          activeOpacity={0.8}
        >
          <Video
            ref={videoRef}
            source={{ uri: videoUri }}
            style={styles.chatVideo}
            paused={paused}
            repeat={false}
            resizeMode="cover"
            onLoad={handleLoad}
            onProgress={handleProgress}
            onError={onError}
            controls={false}
            playWhenInactive={false}
            playInBackground={false}
            ignoreSilentSwitch="ignore"
            poster={undefined}
            posterResizeMode="cover"
          />
          
          {/* Play Button Overlay */}
          {paused && (
            <View style={styles.playButtonOverlay}>
              <View style={styles.playButton}>
                <Icon name="play" size={24} color="#fff" />
              </View>
            </View>
          )}
          
          {/* Loading Indicator */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingIndicator}>
                <Icon name="videocam" size={20} color="#fff" />
              </View>
            </View>
          )}
          
          {/* Duration Badge */}
          {duration > 0 && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>
                {formatTime(duration)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Fullscreen Video Modal */}
      <Modal
        visible={showFullscreen}
        transparent={true}
        animationType="fade"
        onRequestClose={closeFullscreen}
      >
        <StatusBar hidden />
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity 
            style={styles.fullscreenTouchable}
            onPress={handleControlsToggle}
            activeOpacity={1}
          >
            <Video
              ref={fullscreenVideoRef}
              source={{ uri: videoUri }}
              style={styles.fullscreenVideo}
              paused={fullscreenPaused}
              repeat={false}
              resizeMode="contain"
              onLoad={handleLoad}
              onProgress={handleFullscreenProgress}
              onError={onError}
              controls={false}
              playWhenInactive={false}
              playInBackground={false}
              ignoreSilentSwitch="ignore"
            />
            
            {/* Fullscreen Controls */}
            {showControls && (
              <View style={styles.fullscreenControls}>
                {/* Top Controls */}
                <View style={styles.topControls}>
                  <TouchableOpacity onPress={closeFullscreen} style={styles.closeButton}>
                    <Icon name="close" size={28} color="#fff" />
                  </TouchableOpacity>
                </View>
                
                {/* Center Play/Pause */}
                <View style={styles.centerControls}>
                  <TouchableOpacity 
                    onPress={handleFullscreenPlayPause}
                    style={styles.fullscreenPlayButton}
                  >
                    <Icon 
                      name={fullscreenPaused ? "play" : "pause"} 
                      size={48} 
                      color="#fff" 
                    />
                  </TouchableOpacity>
                </View>
                
                {/* Bottom Controls */}
                <View style={styles.bottomControls}>
                  <View style={styles.progressContainer}>
                    <Text style={styles.timeText}>
                      {formatTime(currentTime)}
                    </Text>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.timeText}>
                      {formatTime(duration)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // Chat Video Styles
  videoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: screenWidth * 0.7,
    minWidth: 200,
    minHeight: 150,
    marginVertical: 4,
  },
  myVideoContainer: {
    alignSelf: 'flex-end',
  },
  otherVideoContainer: {
    alignSelf: 'flex-start',
  },
  videoTouchable: {
    position: 'relative',
  },
  chatVideo: {
    width: '100%',
    height: 200,
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4, // Optical alignment for play icon
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loadingIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Fullscreen Styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenTouchable: {
    flex: 1,
  },
  fullscreenVideo: {
    flex: 1,
    width: screenWidth,
    height: screenHeight,
  },
  fullscreenControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerControls: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenPlayButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4, // Optical alignment for play icon
  },
  bottomControls: {
    paddingBottom: 50,
    paddingHorizontal: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'center',
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
});

export default VideoMessagePlayer;
