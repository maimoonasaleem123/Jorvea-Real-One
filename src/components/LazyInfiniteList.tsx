import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  FlatList,
  VirtualizedList,
  View,
  Dimensions,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { IntelligentLazyLoader } from '../services/IntelligentLazyLoader';

interface LazyListItem {
  id: string;
  type: 'post' | 'reel' | 'story';
  data: any;
}

interface LazyInfiniteListProps {
  items: LazyListItem[];
  renderItem: ({ item, index }: { item: LazyListItem; index: number }) => React.ReactElement;
  onLoadMore?: () => void;
  loading?: boolean;
  hasMore?: boolean;
  horizontal?: boolean;
  numColumns?: number;
  contentType: 'posts' | 'reels' | 'stories';
  initialLoadCount?: number;
  loadAheadDistance?: number;
  unloadDistance?: number;
  onItemVisible?: (item: LazyListItem, index: number) => void;
  onItemHidden?: (item: LazyListItem, index: number) => void;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement;
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement;
  keyExtractor?: (item: LazyListItem) => string;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const LazyInfiniteList: React.FC<LazyInfiniteListProps> = ({
  items,
  renderItem,
  onLoadMore,
  loading = false,
  hasMore = true,
  horizontal = false,
  numColumns = 1,
  contentType,
  initialLoadCount,
  loadAheadDistance,
  unloadDistance,
  onItemVisible,
  onItemHidden,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  keyExtractor,
  refreshing = false,
  onRefresh,
}) => {
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const [loadedItems, setLoadedItems] = useState<LazyListItem[]>([]);
  const [currentViewableItems, setCurrentViewableItems] = useState<any[]>([]);

  // Initialize lazy loader
  const lazyLoader = useMemo(() => {
    return new IntelligentLazyLoader();
  }, []);

  // Update loaded items when items change or lazy loader parameters change
  useEffect(() => {
    updateLoadedItems();
  }, [items, currentViewableItems]);

  const updateLoadedItems = useCallback(() => {
    const config = lazyLoader.getConfig(contentType);
    const currentIndex = getCurrentIndex();
    
    // Calculate range of items to load
    const startIndex = Math.max(0, currentIndex - config.loadAheadDistance);
    const endIndex = Math.min(
      items.length - 1,
      currentIndex + config.initialLoadCount + config.loadAheadDistance
    );

    // Create array with loaded and placeholder items
    const newLoadedItems: LazyListItem[] = items.map((item, index) => {
      const shouldLoad = index >= startIndex && index <= endIndex;
      const isVisible = visibleItems.has(item.id);

      if (shouldLoad || isVisible) {
        return item;
      } else {
        // Return placeholder item
        return {
          id: `placeholder_${index}`,
          type: item.type,
          data: { ...item.data, isPlaceholder: true, originalIndex: index },
        };
      }
    });

    setLoadedItems(newLoadedItems);

    console.log(`📋 LAZY LIST: Updated loaded items for ${contentType}`);
    console.log(`   Items total: ${items.length}`);
    console.log(`   Loaded range: ${startIndex} - ${endIndex}`);
    console.log(`   Visible items: ${visibleItems.size}`);
  }, [items, contentType, visibleItems, currentViewableItems, lazyLoader]);

  const getCurrentIndex = useCallback(() => {
    if (currentViewableItems.length === 0) return 0;
    return currentViewableItems[0]?.index || 0;
  }, [currentViewableItems]);

  const handleViewableItemsChanged = useCallback(({ viewableItems, changed }) => {
    setCurrentViewableItems(viewableItems);

    const newVisibleItems = new Set<string>();
    
    viewableItems.forEach((viewableItem: any) => {
      const item = viewableItem.item as LazyListItem;
      newVisibleItems.add(item.id);
    });

    // Track visibility changes
    changed.forEach((changedItem: any) => {
      const item = changedItem.item as LazyListItem;
      
      if (changedItem.isViewable) {
        console.log(`👀 ITEM VISIBLE: ${item.type} ${item.id} at index ${changedItem.index}`);
        onItemVisible?.(item, changedItem.index);
      } else {
        console.log(`👁️ ITEM HIDDEN: ${item.type} ${item.id} at index ${changedItem.index}`);
        onItemHidden?.(item, changedItem.index);
      }
    });

    setVisibleItems(newVisibleItems);
  }, [onItemVisible, onItemHidden]);

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 100,
  }), []);

  const handleEndReached = useCallback(() => {
    if (!loading && hasMore && onLoadMore) {
      console.log(`📥 LAZY LIST: Loading more ${contentType}...`);
      onLoadMore();
    }
  }, [loading, hasMore, onLoadMore, contentType]);

  const renderOptimizedItem = useCallback(({ item, index }: { item: LazyListItem; index: number }) => {
    // Check if this is a placeholder item
    if (item.data?.isPlaceholder) {
      return renderPlaceholder(item, index);
    }

    // Render actual item
    return renderItem({ item, index });
  }, [renderItem]);

  const renderPlaceholder = useCallback((item: LazyListItem, index: number) => {
    const estimatedHeight = getEstimatedItemHeight(item.type);
    
    return (
      <View style={[styles.placeholder, { height: estimatedHeight }]}>
        <View style={styles.placeholderContent}>
          <ActivityIndicator size="small" color="#ccc" />
          <Text style={styles.placeholderText}>Loading {item.type}...</Text>
        </View>
      </View>
    );
  }, []);

  const getEstimatedItemHeight = useCallback((type: string) => {
    switch (type) {
      case 'post': return 400;
      case 'reel': return SCREEN_HEIGHT * 0.8;
      case 'story': return 200;
      default: return 300;
    }
  }, []);

  const renderFooter = useCallback(() => {
    if (ListFooterComponent) {
      return <ListFooterComponent />;
    }

    if (loading) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color="#666" />
          <Text style={styles.footerText}>Loading more {contentType}...</Text>
        </View>
      );
    }

    if (!hasMore) {
      return (
        <View style={styles.footer}>
          <Text style={styles.footerText}>No more {contentType} to load</Text>
        </View>
      );
    }

    return null;
  }, [loading, hasMore, contentType, ListFooterComponent]);

  const renderEmpty = useCallback(() => {
    if (ListEmptyComponent) {
      return <ListEmptyComponent />;
    }

    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#666" />
          <Text style={styles.emptyText}>Loading {contentType}...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No {contentType} available</Text>
      </View>
    );
  }, [loading, contentType, ListEmptyComponent]);

  const getItemLayout = useCallback((data: any, index: number) => {
    const estimatedHeight = getEstimatedItemHeight(data?.[index]?.type || 'post');
    return {
      length: estimatedHeight,
      offset: estimatedHeight * index,
      index,
    };
  }, [getEstimatedItemHeight]);

  const defaultKeyExtractor = useCallback((item: LazyListItem) => item.id, []);

  // Performance optimizations
  const optimizedProps = useMemo(() => ({
    removeClippedSubviews: true,
    maxToRenderPerBatch: 5,
    updateCellsBatchingPeriod: 100,
    initialNumToRender: lazyLoader.getConfig(contentType).initialLoadCount,
    windowSize: 10,
    getItemLayout: horizontal ? undefined : getItemLayout,
  }), [contentType, horizontal, getItemLayout, lazyLoader]);

  return (
    <FlatList
      data={loadedItems}
      renderItem={renderOptimizedItem}
      keyExtractor={keyExtractor || defaultKeyExtractor}
      horizontal={horizontal}
      numColumns={horizontal ? 1 : numColumns}
      onViewableItemsChanged={handleViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={renderEmpty}
      refreshing={refreshing}
      onRefresh={onRefresh}
      {...optimizedProps}
      style={styles.list}
    />
  );
};

// Specialized components for different content types
export const LazyPostsList: React.FC<Omit<LazyInfiniteListProps, 'contentType'>> = (props) => (
  <LazyInfiniteList {...props} contentType="posts" />
);

export const LazyReelsList: React.FC<Omit<LazyInfiniteListProps, 'contentType'>> = (props) => (
  <LazyInfiniteList {...props} contentType="reels" />
);

export const LazyStoriesList: React.FC<Omit<LazyInfiniteListProps, 'contentType' | 'horizontal'>> = (props) => (
  <LazyInfiniteList {...props} contentType="stories" horizontal={true} />
);

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  placeholder: {
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  placeholderContent: {
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default LazyInfiniteList;
