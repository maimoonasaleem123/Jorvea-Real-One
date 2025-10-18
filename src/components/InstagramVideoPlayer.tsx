import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform, Image } from 'react-native';
import Video, { VideoRef, OnLoadData, OnProgressData, OnBufferData } from 'react-native-video';

interface InstagramVideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string;
  paused?: boolean;
  muted?: boolean;
  repeat?: boolean;
  resizeMode?: 'contain' | 'cover' | 'stretch';
  onLoad?: (data: OnLoadData) => void;
  onProgress?: (data: OnProgressData) => void;
  onBuffer?: (buffering: boolean) => void;
  onError?: (error: any) => void;
  onEnd?: () => void;
  style?: any;
}

/**
 * 🚀 INSTAGRAM-STYLE VIDEO PLAYER
 * - Shows THUMBNAIL immediately (no black screen)
 * - Transitions to video once loaded
 * - NO loading indicators
 * - NO buffering overlays
 * - INSTANT playback like Instagram
 * - Clean, minimal, FAST
 */
const InstagramVideoPlayer: React.FC<InstagramVideoPlayerProps> = ({
  videoUrl,
  thumbnailUrl,
  paused = false,
  muted = false,
  repeat = false,
  resizeMode = 'cover',
  onLoad,
  onProgress,
  onBuffer,
  onError,
  onEnd,
  style,
}) => {
  const videoRef = useRef<VideoRef>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);
  
  // Detect HLS format
  const isHLS = videoUrl?.toLowerCase().includes('.m3u8') || videoUrl?.toLowerCase().includes('/hls/');

  // Reset thumbnail when video URL changes
  useEffect(() => {
    setShowThumbnail(true);
    setVideoLoaded(false);
  }, [videoUrl]);

  // Handle video load
  const handleLoad = useCallback((data: OnLoadData) => {
    if (__DEV__) {
      console.log(`✅ Video loaded: ${isHLS ? 'HLS' : 'Direct'} | Duration: ${data.duration}s`);
    }
    setVideoLoaded(true);
    // Hide thumbnail after video starts playing
    setTimeout(() => {
      setShowThumbnail(false);
    }, 100);
    onLoad?.(data);
  }, [isHLS, onLoad]);

  // Handle progress
  const handleProgress = useCallback((data: OnProgressData) => {
    // Hide thumbnail once video starts playing
    if (data.currentTime > 0.1 && showThumbnail) {
      setShowThumbnail(false);
    }
    onProgress?.(data);
  }, [onProgress, showThumbnail]);

  // Handle buffering (silent - no UI)
  const handleBuffer = useCallback((data: OnBufferData) => {
    onBuffer?.(data.isBuffering);
  }, [onBuffer]);

  // Handle errors
  const handleError = useCallback((error: any) => {
    console.error('❌ Video playback error:', {
      error,
      url: videoUrl,
      isHLS,
      platform: Platform.OS,
    });
    onError?.(error);
  }, [videoUrl, isHLS, onError]);

  return (
    <View style={[styles.container, style]}>
      {/* 🖼️ INSTAGRAM-STYLE: Show thumbnail immediately to avoid black screen */}
      {showThumbnail && thumbnailUrl && (
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.thumbnail}
          resizeMode={resizeMode}
        />
      )}
      
      <Video
        ref={videoRef}
        source={{ 
          uri: videoUrl,
          // Android-specific headers for HLS
          ...(Platform.OS === 'android' && isHLS && {
            headers: {
              'Accept': '*/*',
              'User-Agent': 'Instagram/Android',
            },
          }),
        }}
        style={[styles.video, showThumbnail && styles.videoHidden]}
        paused={paused}
        muted={muted}
        repeat={repeat}
        resizeMode={resizeMode}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onBuffer={handleBuffer}
        onError={handleError}
        onEnd={onEnd}
        
        // ⚡ ULTRA-FAST CHUNK-BASED LOADING - Instagram/TikTok Style
        // Start playback INSTANTLY with minimal buffering
        bufferConfig={{
          minBufferMs: 500,               // Minimum buffer: 0.5s
          bufferForPlaybackMs: 50,        // Start after 50ms (INSTANT!)
          maxBufferMs: 3000,              // Max buffer: 3s (load in chunks)
          bufferForPlaybackAfterRebufferMs: 200, // Fast rebuffer
          cacheSizeMB: 100,               // Moderate cache
        }}
        
        // HLS adaptive streaming settings
        preferredForwardBufferDuration={isHLS ? 2 : 3}  // 2-3 seconds ahead
        maxBitRate={isHLS ? 0 : 1500000}  // Let HLS decide quality adaptively
        automaticallyWaitsToMinimizeStalling={false}   // Don't wait - play now!
        progressUpdateInterval={250}
        reportBandwidth={true}
        
        // Performance optimization
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="ignore"
        mixWithOthers="mix"
        
        // iOS specific
        allowsExternalPlayback={false}
        
        // Android ExoPlayer optimization
        useTextureView={false}           // Faster rendering
        disableFocus={true}
        
        // NO CONTROLS - Instagram style
        controls={false}
        
        // NO poster for instant playback
        poster=""
        posterResizeMode="cover"
      />
      
      {/* NO OVERLAYS - Pure Instagram style */}
      {/* NO loading indicators */}
      {/* NO buffering screens */}
      {/* NO CC/settings/HLS badges */}
      {/* Just pure video */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  thumbnail: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    zIndex: 1,
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  videoHidden: {
    opacity: 0,
  },
});

export default InstagramVideoPlayer;
