import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
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
 * - NO loading indicators
 * - NO buffering overlays
 * - NO CC/settings/HLS indicators
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
  
  // Detect HLS format
  const isHLS = videoUrl?.toLowerCase().includes('.m3u8') || videoUrl?.toLowerCase().includes('/hls/');

  // Handle video load
  const handleLoad = useCallback((data: OnLoadData) => {
    if (__DEV__) {
      console.log(`✅ Video loaded: ${isHLS ? 'HLS' : 'Direct'} | Duration: ${data.duration}s`);
    }
    onLoad?.(data);
  }, [isHLS, onLoad]);

  // Handle progress
  const handleProgress = useCallback((data: OnProgressData) => {
    onProgress?.(data);
  }, [onProgress]);

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
        style={styles.video}
        paused={paused}
        muted={muted}
        repeat={repeat}
        resizeMode={resizeMode}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onBuffer={handleBuffer}
        onError={handleError}
        onEnd={onEnd}
        
        // ⚡ INSTAGRAM-OPTIMIZED BUFFER CONFIG
        bufferConfig={{
          minBufferMs: 1000,              // Minimal pre-buffering
          bufferForPlaybackMs: 100,       // ULTRA LOW - instant start
          maxBufferMs: 5000,              // Small buffer for fast startup
          bufferForPlaybackAfterRebufferMs: 500,
          cacheSizeMB: 200,
        }}
        
        // HLS settings
        preferredForwardBufferDuration={isHLS ? 3 : 5}
        maxBitRate={isHLS ? 0 : 2000000}  // Let HLS decide adaptively
        automaticallyWaitsToMinimizeStalling={false}
        progressUpdateInterval={250}
        reportBandwidth={true}
        
        // Platform-specific
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="ignore"
        mixWithOthers="mix"
        
        // iOS
        allowsExternalPlayback={false}
        
        // Android (ExoPlayer)
        useTextureView={false}
        disableFocus={true}
        
        // NO CONTROLS - Instagram style
        controls={false}
        
        // Poster disabled for instant playback
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
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
});

export default InstagramVideoPlayer;
