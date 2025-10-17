import React, { useState, useCallback, memo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Video from 'react-native-video';

interface OptimizedVideoProps {
  source: { uri: string };
  placeholder?: React.ReactNode;
  enableMemoryOptimization?: boolean;
  cacheKey?: string;
  style?: any;
  onLoad?: (data: any) => void;
  onError?: (error: any) => void;
  [key: string]: any;
}

const OptimizedVideo: React.FC<OptimizedVideoProps> = memo(({
  source,
  placeholder,
  enableMemoryOptimization = false,
  cacheKey,
  onLoad,
  onError,
  style,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback((data: any) => {
    setIsLoading(false);
    onLoad?.(data);
  }, [onLoad]);

  const handleError = useCallback((error: any) => {
    setHasError(true);
    setIsLoading(false);
    onError?.(error);
  }, [onError]);

  // Show placeholder while loading
  if (isLoading && placeholder) {
    return (
      <View style={style}>
        {placeholder}
        <Video
          {...props}
          source={source}
          style={[StyleSheet.absoluteFill, { opacity: 0 }]}
          onLoad={handleLoad}
          onError={handleError}
        />
      </View>
    );
  }

  if (hasError && placeholder) {
    return <View style={style}>{placeholder}</View>;
  }

  return (
    <Video
      {...props}
      source={source}
      style={style}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
});

OptimizedVideo.displayName = 'OptimizedVideo';

export default OptimizedVideo;
