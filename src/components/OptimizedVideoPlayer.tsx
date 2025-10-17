/**
 * Optimized Video Player for DigitalOcean Storage
 * FREE - Uses react-native-video with Instagram-like performance
 * Works with both direct URLs and HLS streaming
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Text,
} from 'react-native';
import Video, { OnLoadData, OnProgressData, OnBufferData } from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface OptimizedVideoPlayerProps {
  // Video URL (direct or HLS)
  videoUrl: string;
  
  // Optional thumbnail URL
  thumbnailUrl?: string;
  
  // Video properties
  paused?: boolean;
  muted?: boolean;
  repeat?: boolean;
  resizeMode?: 'cover' | 'contain' | 'stretch';
  
  // Callbacks
  onLoad?: (data: OnLoadData) => void;
  onProgress?: (data: OnProgressData) => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
  onBuffer?: (isBuffering: boolean) => void;
  
  // Style
  style?: any;
  
  // Performance tuning
  enableHLS?: boolean; // Auto-detect HLS URLs
}

const OptimizedVideoPlayer: React.FC<OptimizedVideoPlayerProps> = ({
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
  enableHLS = true,
}) => {
  const videoRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);

  // Detect if URL is HLS
  const isHLS = enableHLS && videoUrl.includes('.m3u8');

  useEffect(() => {
    if (!videoUrl) {
      console.error('❌ No video URL provided');
      setHasError(true);
    }
  }, [videoUrl]);

  const handleLoad = useCallback((data: OnLoadData) => {
    console.log('✅ Video loaded:', data.duration, 'seconds');
    setIsLoading(false);
    setShowThumbnail(false);
    onLoad?.(data);
  }, [onLoad]);

  const handleProgress = useCallback((data: OnProgressData) => {
    onProgress?.(data);
  }, [onProgress]);

  const handleBuffer = useCallback((data: OnBufferData) => {
    const buffering = data.isBuffering;
    setIsBuffering(buffering);
    onBuffer?.(buffering);
    
    if (buffering) {
      console.log('⏳ Buffering...');
    }
  }, [onBuffer]);

  const handleError = useCallback((error: any) => {
    console.error('❌ Video error:', error);
    setHasError(true);
    setIsLoading(false);
    onError?.(error);
  }, [onError]);

  const handleEnd = useCallback(() => {
    console.log('⏹️ Video ended');
    onEnd?.();
  }, [onEnd]);

  const retry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    setShowThumbnail(true);
  }, []);

  if (!videoUrl) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color="#666" />
          <Text style={styles.errorText}>No video URL provided</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Thumbnail */}
      {showThumbnail && thumbnailUrl && (
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      )}

      {/* Video Player */}
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
          minBufferMs: 2000,              // Minimum buffer (2 seconds)
          bufferForPlaybackMs: 250,       // ULTRA LOW - instant start
          maxBufferMs: 15000,             // Maximum buffer (15 seconds)
          bufferForPlaybackAfterRebufferMs: 1500,
          cacheSizeMB: 200,               // Large cache for smooth playback
        }}
        // Enhanced settings for both direct and HLS playback
        preferredForwardBufferDuration={10}
        maxBitRate={isHLS ? 0 : 3000000} // Let HLS decide, or 3Mbps for direct
        automaticallyWaitsToMinimizeStalling={false} // Instant start
        progressUpdateInterval={250}
        reportBandwidth={true}
        // iOS specific
        allowsExternalPlayback={false}
        playInBackground={false}
        playWhenInactive={false}
        // Android specific
        ignoreSilentSwitch="ignore"
        mixWithOthers="mix"
      />

      {/* Loading Indicator */}
      {(isLoading || isBuffering) && !hasError && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          {isBuffering && (
            <Text style={styles.loadingText}>Loading...</Text>
          )}
        </View>
      )}

      {/* Error State */}
      {hasError && (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color="#666" />
          <Text style={styles.errorText}>Failed to load video</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retry}>
            <Icon name="refresh" size={24} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* HLS Indicator (Debug) */}
      {__DEV__ && isHLS && (
        <View style={styles.hlsIndicator}>
          <Text style={styles.hlsText}>HLS</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
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
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 150, 136, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  hlsText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default OptimizedVideoPlayer;
