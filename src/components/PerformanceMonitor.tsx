import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PerformanceStats {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  jsHeapSize: number;
}

export const PerformanceMonitor: React.FC<{ enabled?: boolean }> = ({ 
  enabled = __DEV__ 
}) => {
  // Use hardcoded colors for development overlay (context-independent)
  const colors = {
    background: 'rgba(0, 0, 0, 0.8)',
    surface: 'rgba(26, 26, 26, 0.9)',
    text: '#ffffff',
    textSecondary: '#cccccc',
    primary: '#007AFF',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF453A',
  };

  const [stats, setStats] = useState<PerformanceStats>({
    fps: 60,
    memoryUsage: 0,
    renderTime: 0,
    jsHeapSize: 0,
  });

  useEffect(() => {
    if (!enabled) return;

    let frameCount = 0;
    let lastTime = Date.now();
    let animationFrame: number;

    const measurePerformance = () => {
      const currentTime = Date.now();
      frameCount++;

      // Calculate FPS every second
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        
        // Get memory usage (if available)
        const memoryInfo = (performance as any)?.memory;
        const memoryUsage = memoryInfo ? Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024) : 0;
        const jsHeapSize = memoryInfo ? Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024) : 0;

        setStats({
          fps,
          memoryUsage,
          renderTime: 16.67, // Target 60fps = 16.67ms per frame
          jsHeapSize,
        });

        frameCount = 0;
        lastTime = currentTime;
      }

      animationFrame = requestAnimationFrame(measurePerformance);
    };

    measurePerformance();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [enabled]);

  if (!enabled) return null;

  const getPerformanceColor = (value: number, good: number, bad: number) => {
    if (value >= good) return colors.success;
    if (value <= bad) return colors.error;
    return colors.warning;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]}>Performance</Text>
      
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>FPS</Text>
          <Text style={[
            styles.value, 
            { color: getPerformanceColor(stats.fps, 55, 30) }
          ]}>
            {stats.fps}
          </Text>
        </View>

        <View style={styles.stat}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Memory</Text>
          <Text style={[
            styles.value, 
            { color: getPerformanceColor(100 - stats.memoryUsage, 70, 30) }
          ]}>
            {stats.memoryUsage}MB
          </Text>
        </View>

        <View style={styles.stat}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Heap</Text>
          <Text style={[
            styles.value, 
            { color: getPerformanceColor(100 - stats.jsHeapSize, 70, 30) }
          ]}>
            {stats.jsHeapSize}MB
          </Text>
        </View>
      </View>
    </View>
  );
};

// Performance optimization tips component (context-independent)
export const PerformanceTips: React.FC = () => {
  const colors = {
    background: 'rgba(0, 0, 0, 0.9)',
    surface: 'rgba(26, 26, 26, 0.9)',
    text: '#ffffff',
    textSecondary: '#cccccc',
    primary: '#007AFF',
  };

  const tips = [
    '🚀 Use React.memo for expensive components',
    '⚡ Implement useCallback for event handlers',
    '🎯 Use useMemo for expensive calculations',
    '📱 Enable removeClippedSubviews for long lists',
    '🎨 Optimize images with proper resolution',
    '💾 Implement lazy loading for large datasets',
    '🔄 Use virtualized lists for thousands of items',
    '⚖️ Avoid deep component trees',
  ];

  return (
    <View style={[styles.tipsContainer, { backgroundColor: colors.surface }]}>
      <Text style={[styles.tipsTitle, { color: colors.text }]}>
        Performance Tips
      </Text>
      {tips.map((tip, index) => (
        <Text key={index} style={[styles.tip, { color: colors.textSecondary }]}>
          {tip}
        </Text>
      ))}
    </View>
  );
};

// HOC to wrap components with performance monitoring
export const withPerformanceMonitoring = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) => {
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => {
    useEffect(() => {
      if (__DEV__) {
        const startTime = performance.now();
        
        return () => {
          const endTime = performance.now();
          const renderTime = endTime - startTime;
          
          if (renderTime > 100) { // Log slow renders
            console.warn(
              `🐌 Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`
            );
          }
        };
      }
    });

    return <Component {...(props as P)} />;
  });
  
  WrappedComponent.displayName = `withPerformanceMonitoring(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 10,
    padding: 8,
    borderRadius: 8,
    minWidth: 120,
    zIndex: 9999,
    opacity: 0.9,
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontSize: 10,
    marginBottom: 2,
  },
  value: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tipsContainer: {
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  tip: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
});
