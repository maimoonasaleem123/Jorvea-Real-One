import React, { useState, useCallback, useEffect, memo } from 'react';
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
  style,
  placeholder,
  lowQualitySource,
  enableMemoryOptimization = true,
  cacheKey,
  onLoad,
  onError,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageId] = useState(() => 
    cacheKey || (typeof source === 'object' ? source.uri : `static_${Math.random()}`)
  );

  // Calculate optimal image size
  const getOptimizedSource = useCallback(() => {
    if (typeof source === 'number') {
      return source; // Static images don't need optimization
    }

    if (!enableMemoryOptimization) {
      return source;
    }

    const imageQuality = PerformanceManager.getImageQuality();
    const uri = source.uri;

    // Add quality and size parameters if it's a network image
    if (uri.startsWith('http')) {
      const separator = uri.includes('?') ? '&' : '?';
      return {
        uri: `${uri}${separator}quality=${Math.round(imageQuality * 100)}&w=${screenWidth}`
      };
    }

    return source;
  }, [source, enableMemoryOptimization]);

  // Register/unregister image with performance manager
  useEffect(() => {
    if (enableMemoryOptimization && typeof source === 'object') {
      if (PerformanceManager.canLoadImage(imageId)) {
        PerformanceManager.registerImageLoad(imageId);
      }

      return () => {
        PerformanceManager.unregisterImageLoad(imageId);
      };
    }
  }, [imageId, enableMemoryOptimization, source]);

  const handleLoad = useCallback((event: any) => {
    setIsLoading(false);
    onLoad?.(event);
  }, [onLoad]);

  const handleError = useCallback((error: any) => {
    setHasError(true);
    setIsLoading(false);
    onError?.(error);
    
    // Unregister failed image
    if (enableMemoryOptimization) {
      PerformanceManager.unregisterImageLoad(imageId);
    }
  }, [onError, imageId, enableMemoryOptimization]);

  // Don't render if performance manager says we can't load
  if (enableMemoryOptimization && typeof source === 'object' && !PerformanceManager.canLoadImage(imageId)) {
    return placeholder ? <View style={style}>{placeholder}</View> : null;
  }

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
