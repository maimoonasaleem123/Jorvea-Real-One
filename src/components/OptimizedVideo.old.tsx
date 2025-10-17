import React, { useState, useCallback, useEffect, memo, useRef } from 'react';
import { View, ViewStyle, Dimensions } from 'react-native';
import Video from 'react-native-video';
import PerformanceManager from '../utils/PerformanceManager';

interface OptimizedVideoProps {
  source: { uri: string };
  style?: ViewStyle;
  placeholder?: React.ReactNode;
  enableMemoryOptimization?: boolean;
  cacheKey?: string;
  autoPlay?: boolean;
  pauseOnBackground?: boolean;
  onLoad?: (data: any) => void;
  onError?: (error: any) => void;
  onBuffer?: (data: any) => void;
  resizeMode?: 'contain' | 'cover' | 'stretch';
  paused?: boolean;
  muted?: boolean;
  repeat?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

const OptimizedVideo: React.FC<OptimizedVideoProps> = memo(({
  source,
  style,
  placeholder,
  enableMemoryOptimization = true,
  cacheKey,
  autoPlay = false,
  pauseOnBackground = true,
  onLoad,
  onError,
  onBuffer,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPaused, setIsPaused] = useState(!autoPlay);
  const videoRef = useRef<any>(null);
  
  const [videoId] = useState(() => 
    cacheKey || source.uri || `video_${Math.random()}`
  );

  // Calculate optimal video source
  const getOptimizedSource = useCallback(() => {
    if (!enableMemoryOptimization) {
      return source;
    }

    const uri = source.uri;
    
    // Add optimization parameters for network videos
    if (uri.startsWith('http')) {
      const separator = uri.includes('?') ? '&' : '?';
      return {
        uri: `${uri}${separator}w=${screenWidth}&quality=medium`
      };
    }

    return source;
  }, [source, enableMemoryOptimization]);

  // Register/unregister video with performance manager
  useEffect(() => {
    if (enableMemoryOptimization) {
      if (PerformanceManager.canLoadVideo(videoId)) {
        PerformanceManager.registerVideoLoad(videoId);
      }

      return () => {
        PerformanceManager.unregisterVideoLoad(videoId);
      };
    }
  }, [videoId, enableMemoryOptimization]);

  // Handle app state changes for background pause
  useEffect(() => {
    if (!pauseOnBackground) return;

    const { AppState } = require('react-native');
    
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background') {
        setIsPaused(true);
      } else if (nextAppState === 'active' && autoPlay) {
        setIsPaused(false);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [pauseOnBackground, autoPlay]);

  const handleLoad = useCallback((data: any) => {
    setIsLoading(false);
    onLoad?.(data);
  }, [onLoad]);

  const handleError = useCallback((error: any) => {
    setHasError(true);
    setIsLoading(false);
    onError?.(error);
    
    // Unregister failed video
    if (enableMemoryOptimization) {
      PerformanceManager.unregisterVideoLoad(videoId);
    }
  }, [onError, videoId, enableMemoryOptimization]);

  const handleBuffer = useCallback((data: any) => {
    onBuffer?.(data);
  }, [onBuffer]);

  // Don't render if performance manager says we can't load
  if (enableMemoryOptimization && !PerformanceManager.canLoadVideo(videoId)) {
    return placeholder ? <View style={style}>{placeholder}</View> : null;
  }

  if (hasError) {
    return placeholder ? <View style={style}>{placeholder}</View> : null;
  }

  return (
    <View style={style}>
      {isLoading && placeholder && (
        <View style={[style, { position: 'absolute', zIndex: 1 }]}>
          {placeholder}
        </View>
      )}
      
      <Video
        ref={videoRef}
        {...props}
        source={getOptimizedSource()}
        style={style}
        paused={isPaused}
        onLoad={handleLoad}
        onError={handleError}
        onBuffer={handleBuffer}
        resizeMode="cover"
        playInBackground={false}
        playWhenInactive={false}
        // Memory optimization settings
        bufferConfig={{
          minBufferMs: 2000,
          maxBufferMs: 5000,
          bufferForPlaybackMs: 1000,
          bufferForPlaybackAfterRebufferMs: 1500,
        }}
        maxBitRate={2000000} // 2Mbps max for memory efficiency
      />
    </View>
  );
});

OptimizedVideo.displayName = 'OptimizedVideo';

export default OptimizedVideo;
