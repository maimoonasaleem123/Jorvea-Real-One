/**
 * FREE Professional Video Player
 * ✅ 100% FREE - No subscriptions
 * ✅ HLS Chunking - Automatic adaptive streaming
 * ✅ Multi-resolution - Auto quality adjustment
 * ✅ DigitalOcean Compatible
 * ✅ Instagram-like Performance
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Text,
  Dimensions,
} from 'react-native';
import Video, { OnLoadData, OnProgressData, OnBufferData } from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');

interface FreeVideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string;
  paused?: boolean;
  muted?: boolean;
  repeat?: boolean;
  resizeMode?: 'cover' | 'contain' | 'stretch';
  onLoad?: (data: OnLoadData) => void;
  onProgress?: (data: OnProgressData) => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
  onBuffer?: (isBuffering: boolean) => void;
  style?: any;
  showControls?: boolean;
}

const FreeVideoPlayer: React.FC<FreeVideoPlayerProps> = ({
  videoUrl,
  thumbnailUrl,
  paused = false,
  muted = false,
  repeat = true,
  resizeMode = 'cover',
  onLoad,
  onProgress,
  onEnd,
  onError,
  onBuffer,
  style,
  showControls = false,
}) => {
  const videoRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isHLS, setIsHLS] = useState(false);

  // Detect HLS URL
  useEffect(() => {
    const hlsDetected = videoUrl.includes('.m3u8');
    setIsHLS(hlsDetected);
    if (hlsDetected) {
      console.log('🎬 HLS Mode Enabled - Chunked Streaming Active');
      console.log('✨ Features: Adaptive bitrate, Multi-resolution, Low latency');
    } else {
      console.log('📹 Direct Mode - Optimized Buffer Settings');
    }
  }, [videoUrl]);

  const handleLoad = useCallback((data: OnLoadData) => {
    console.log('✅ Video Loaded:', {
      duration: `${Math.round(data.duration)}s`,
      isHLS: isHLS,
      naturalSize: data.naturalSize,
    });
    
    setIsLoading(false);
    setShowThumbnail(false);
    setDuration(data.duration);
    onLoad?.(data);
  }, [onLoad, isHLS]);

  const handleProgress = useCallback((data: OnProgressData) => {
    setCurrentTime(data.currentTime);
    onProgress?.(data);
  }, [onProgress]);

  const handleBuffer = useCallback((data: OnBufferData) => {
    const buffering = data.isBuffering;
    setIsBuffering(buffering);
    onBuffer?.(buffering);
    
    if (buffering) {
      console.log('⏳ Buffering... (Loading next chunk)');
    }
  }, [onBuffer]);

  const handleError = useCallback((error: any) => {
    console.error('❌ Video Error:', error);
    setHasError(true);
    setIsLoading(false);
    onError?.(error);
  }, [onError]);

  const handleEnd = useCallback(() => {
    console.log('⏹️ Video Ended');
    onEnd?.();
  }, [onEnd]);

  const retry = useCallback(() => {
    console.log('🔄 Retrying video load...');
    setHasError(false);
    setIsLoading(true);
    setShowThumbnail(true);
  }, []);

  if (!videoUrl) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color="#666" />
          <Text style={styles.errorText}>No video URL</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Thumbnail - Shows while loading */}
      {showThumbnail && thumbnailUrl && (
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      )}

      {/* Video Player with HLS Support */}
      <Video
        ref={videoRef}
        source={{ uri: videoUrl }}
        style={styles.video}
        paused={paused}
        muted={muted}
        repeat={repeat}
        resizeMode={resizeMode}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onBuffer={handleBuffer}
        onError={handleError}
        onEnd={handleEnd}
        // ⚡ INSTAGRAM-LIKE PERFORMANCE SETTINGS
        bufferConfig={{
          minBufferMs: isHLS ? 1500 : 2000,        // HLS needs less buffering
          bufferForPlaybackMs: isHLS ? 200 : 250,  // ULTRA LOW - instant start
          maxBufferMs: isHLS ? 8000 : 15000,       // HLS: 8s, Direct: 15s
          bufferForPlaybackAfterRebufferMs: isHLS ? 1000 : 1500,
          cacheSizeMB: 200,                        // Large cache
        }}
        // HLS-specific settings
        preferredForwardBufferDuration={isHLS ? 5 : 10}
        maxBitRate={isHLS ? 0 : 3000000}          // 0 = let HLS decide adaptively
        automaticallyWaitsToMinimizeStalling={false} // Instant start
        progressUpdateInterval={250}
        reportBandwidth={true}
        // Platform-specific
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="ignore"
        mixWithOthers="mix"
        // iOS-specific
        allowsExternalPlayback={false}
        // Android-specific (ExoPlayer handles HLS automatically)
        useTextureView={false}
        disableFocus={true}
      />

      {/* Loading Indicator */}
      {(isLoading || isBuffering) && !hasError && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>
            {isBuffering ? '⏳ Buffering...' : '⚡ Loading...'}
          </Text>
        </View>
      )}

      {/* Error State with Retry */}
      {hasError && (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color="#ff4444" />
          <Text style={styles.errorText}>Failed to load video</Text>
          <Text style={styles.errorHint}>Check your connection</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retry}>
            <Icon name="refresh" size={24} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* HLS Indicator (Debug Mode) */}
      {__DEV__ && isHLS && !isLoading && (
        <View style={styles.hlsIndicator}>
          <Icon name="hd" size={14} color="#fff" />
          <Text style={styles.hlsText}>HLS</Text>
        </View>
      )}

      {/* Progress Bar (Optional) */}
      {showControls && duration > 0 && !isLoading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${(currentTime / duration) * 100}%` }
              ]} 
            />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  errorHint: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0095f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  hlsIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 150, 136, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  hlsText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressBar: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0095f6',
  },
});

export default FreeVideoPlayer;
