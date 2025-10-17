/**
 * CloudFlare Stream Video Player
 * Optimized HLS player for Instagram-like fast loading
 * Automatic chunking and adaptive bitrate
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

interface CloudFlareStreamPlayerProps {
  // CloudFlare Stream video UID or full HLS URL
  videoId?: string;
  hlsUrl?: string;
  
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
  
  // Performance
  preferredForwardBufferDuration?: number;
  maxBitRate?: number;
}

const CloudFlareStreamPlayer: React.FC<CloudFlareStreamPlayerProps> = ({
  videoId,
  hlsUrl,
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
  preferredForwardBufferDuration = 10,
  maxBitRate = 3000000, // 3 Mbps - let CloudFlare handle adaptive bitrate
}) => {
  const videoRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);

  // Build HLS URL from video ID or use provided URL
  const streamUrl = hlsUrl || (videoId 
    ? `https://customer-${videoId.substring(0, 8)}.cloudflarestream.com/${videoId}/manifest/video.m3u8`
    : '');

  // Build thumbnail URL if not provided
  const thumbnail = thumbnailUrl || (videoId
    ? `https://customer-${videoId.substring(0, 8)}.cloudflarestream.com/${videoId}/thumbnails/thumbnail.jpg`
    : undefined);

  useEffect(() => {
    if (!streamUrl) {
      console.error('❌ No video ID or HLS URL provided');
      setHasError(true);
    }
  }, [streamUrl]);

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
    } else {
      console.log('▶️ Playback resumed');
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
    // Force remount by key change would be handled by parent
  }, []);

  if (!streamUrl) {
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
      {showThumbnail && thumbnail && (
        <Image
          source={{ uri: thumbnail }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      )}

      {/* Video Player */}
      <Video
        ref={videoRef}
        source={{ uri: streamUrl }}
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
        // Instagram-like performance settings
        bufferConfig={{
          minBufferMs: 1500,          // Minimum buffer before playback starts
          bufferForPlaybackMs: 200,   // ULTRA LOW - instant start like Instagram
          maxBufferMs: 10000,         // Maximum buffer in advance
          bufferForPlaybackAfterRebufferMs: 1000, // Buffer after stalling
          cacheSizeMB: 200,           // Cache size for offline playback
        }}
        preferredForwardBufferDuration={preferredForwardBufferDuration}
        maxBitRate={maxBitRate}
        automaticallyWaitsToMinimizeStalling={false} // Instant start
        progressUpdateInterval={250}
        reportBandwidth={true}
      />

      {/* Loading Indicator */}
      {(isLoading || isBuffering) && !hasError && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          {isBuffering && (
            <Text style={styles.loadingText}>Buffering...</Text>
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
});

export default CloudFlareStreamPlayer;
