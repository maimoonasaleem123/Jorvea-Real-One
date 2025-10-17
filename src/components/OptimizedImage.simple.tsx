import React, { useState, useCallback, memo } from 'react';
import { Image, ImageProps, Dimensions, View, StyleSheet } from 'react-native';

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  source: { uri: string } | number;
  placeholder?: React.ReactNode;
  lowQualitySource?: { uri: string };
  enableMemoryOptimization?: boolean;
  cacheKey?: string;
}

const { width: screenWidth } = Dimensions.get('window');

const OptimizedImage: React.FC<OptimizedImageProps> = memo(({
  source,
  placeholder,
  lowQualitySource,
  enableMemoryOptimization = false,
  cacheKey,
  onLoad,
  onError,
  style,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Calculate optimal image size
  const getOptimizedSource = useCallback(() => {
    if (typeof source === 'number') {
      return source; // Static images don't need optimization
    }

    if (!enableMemoryOptimization) {
      return source;
    }

    const uri = source.uri;

    // Add quality and size parameters if it's a network image
    if (uri.startsWith('http')) {
      const separator = uri.includes('?') ? '&' : '?';
      return {
        uri: `${uri}${separator}quality=80&w=${screenWidth}`
      };
    }

    return source;
  }, [source, enableMemoryOptimization]);

  const handleLoad = useCallback((event: any) => {
    setIsLoading(false);
    onLoad?.(event);
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
        <Image
          {...props}
          source={getOptimizedSource()}
          style={[StyleSheet.absoluteFill, { opacity: 0 }]}
          onLoad={handleLoad}
          onError={handleError}
        />
      </View>
    );
  }

  // Show low quality first if available
  if (isLoading && lowQualitySource) {
    return (
      <View style={style}>
        <Image
          {...props}
          source={lowQualitySource}
          style={[StyleSheet.absoluteFill, { opacity: 0.7 }]}
        />
        <Image
          {...props}
          source={getOptimizedSource()}
          style={[StyleSheet.absoluteFill, { opacity: 0 }]}
          onLoad={handleLoad}
          onError={handleError}
        />
      </View>
    );
  }

  return (
    <Image
      {...props}
      source={getOptimizedSource()}
      style={style}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
});

OptimizedImage.displayName = 'OptimizedImage';

export default OptimizedImage;
