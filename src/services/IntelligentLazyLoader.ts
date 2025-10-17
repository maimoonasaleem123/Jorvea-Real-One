import { useState, useCallback, useRef } from 'react';
import { Dimensions, ViewToken } from 'react-native';
import HyperSpeedService from './HyperSpeedService';

interface LazyLoadItem {
  id: string;
  type: 'post' | 'reel' | 'story';
  data?: any;
  loaded: boolean;
  loading: boolean;
  visible: boolean;
  priority: number;
}

interface LazyLoadConfig {
  initialLoadCount: number;
  preloadDistance: number;
  maxCacheSize: number;
  unloadDistance: number;
}

export class IntelligentLazyLoader {
  private static instance: IntelligentLazyLoader;
  private items = new Map<string, LazyLoadItem>();
  private visibleItems = new Set<string>();
  private loadingQueue: string[] = [];
  private isProcessing = false;

  // Optimal configurations
  private static readonly CONFIGS = {
    posts: {
      initialLoadCount: 3,      // Load only first 3 posts
      preloadDistance: 2,       // Preload 2 posts ahead
      maxCacheSize: 20,         // Keep max 20 posts in memory
      unloadDistance: 10,       // Unload posts 10+ positions away
    },
    reels: {
      initialLoadCount: 3,      // Load only first 3 reels
      preloadDistance: 2,       // Preload 2 reels ahead
      maxCacheSize: 15,         // Keep max 15 reels in memory
      unloadDistance: 8,        // Unload reels 8+ positions away
    },
    stories: {
      initialLoadCount: 5,      // Load first 5 stories
      preloadDistance: 3,       // Preload 3 stories ahead
      maxCacheSize: 25,         // Keep max 25 stories in memory
      unloadDistance: 15,       // Unload stories 15+ positions away
    }
  };

  static getInstance(): IntelligentLazyLoader {
    if (!IntelligentLazyLoader.instance) {
      IntelligentLazyLoader.instance = new IntelligentLazyLoader();
    }
    return IntelligentLazyLoader.instance;
  }

  // Initialize lazy loading for a content type
  async initializeLazyLoad(
    contentType: 'posts' | 'reels' | 'stories',
    totalItems: string[],
    loadCallback: (id: string) => Promise<any>
  ): Promise<LazyLoadItem[]> {
    const config = IntelligentLazyLoader.CONFIGS[contentType];
    console.log(`🎯 Initializing lazy load for ${contentType}: ${totalItems.length} total items`);

    // Create lazy load items
    const lazyItems: LazyLoadItem[] = totalItems.map((id, index) => ({
      id,
      type: contentType.slice(0, -1) as 'post' | 'reel' | 'story', // Remove 's' from end
      data: null,
      loaded: false,
      loading: false,
      visible: false,
      priority: this.calculatePriority(index, config.initialLoadCount),
    }));

    // Store in memory
    lazyItems.forEach(item => {
      this.items.set(item.id, item);
    });

    // Load only the initial visible items
    const initialItems = lazyItems.slice(0, config.initialLoadCount);
    await this.loadItems(initialItems.map(item => item.id), loadCallback);

    console.log(`⚡ LAZY LOAD: Loaded only ${config.initialLoadCount}/${totalItems.length} ${contentType} initially`);
    return lazyItems;
  }

  // Handle viewport changes (when user scrolls)
  async handleViewportChange(
    viewableItems: ViewToken[],
    contentType: 'posts' | 'reels' | 'stories',
    loadCallback: (id: string) => Promise<any>
  ): Promise<void> {
    const config = IntelligentLazyLoader.CONFIGS[contentType];
    
    // Update visible items
    this.visibleItems.clear();
    const currentIndices: number[] = [];
    
    for (const viewableItem of viewableItems) {
      const id = viewableItem.item?.id;
      if (id) {
        this.visibleItems.add(id);
        const item = this.items.get(id);
        if (item) {
          item.visible = true;
          currentIndices.push(viewableItem.index || 0);
        }
      }
    }

    if (currentIndices.length === 0) return;

    // Calculate items to preload (ahead of current position)
    const maxIndex = Math.max(...currentIndices);
    const preloadIndices = [];
    
    for (let i = maxIndex + 1; i <= maxIndex + config.preloadDistance; i++) {
      preloadIndices.push(i);
    }

    // Get items that need loading
    const itemsToLoad: string[] = [];
    const allItemIds = Array.from(this.items.keys());
    
    for (const index of preloadIndices) {
      if (index < allItemIds.length) {
        const id = allItemIds[index];
        const item = this.items.get(id);
        if (item && !item.loaded && !item.loading) {
          itemsToLoad.push(id);
        }
      }
    }

    // Load needed items
    if (itemsToLoad.length > 0) {
      console.log(`📦 LAZY PRELOAD: Loading ${itemsToLoad.length} items ahead`);
      await this.loadItems(itemsToLoad, loadCallback);
    }

    // Unload distant items to free memory
    await this.unloadDistantItems(currentIndices, config, allItemIds);
  }

  // Load specific items
  private async loadItems(itemIds: string[], loadCallback: (id: string) => Promise<any>): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const loadPromises = itemIds.map(async (id) => {
        const item = this.items.get(id);
        if (!item || item.loaded || item.loading) return;

        item.loading = true;
        
        try {
          // Try to get from HyperSpeed cache first
          let data = await HyperSpeedService.getData(`lazy_${item.type}_${id}`);
          
          if (!data) {
            // Load fresh data
            data = await loadCallback(id);
            // Cache for future lazy loading
            await HyperSpeedService.cacheData(`lazy_${item.type}_${id}`, data, 'medium');
          }

          item.data = data;
          item.loaded = true;
          item.loading = false;

          console.log(`✅ LAZY LOADED: ${item.type} ${id}`);
        } catch (error) {
          console.error(`❌ Lazy load failed for ${id}:`, error);
          item.loading = false;
        }
      });

      await Promise.all(loadPromises);
    } finally {
      this.isProcessing = false;
    }
  }

  // Unload items that are far from current view
  private async unloadDistantItems(
    currentIndices: number[],
    config: LazyLoadConfig,
    allItemIds: string[]
  ): Promise<void> {
    const minCurrentIndex = Math.min(...currentIndices);
    const maxCurrentIndex = Math.max(...currentIndices);
    
    const itemsToUnload: string[] = [];
    
    allItemIds.forEach((id, index) => {
      const distanceFromCurrent = Math.min(
        Math.abs(index - minCurrentIndex),
        Math.abs(index - maxCurrentIndex)
      );
      
      if (distanceFromCurrent > config.unloadDistance) {
        const item = this.items.get(id);
        if (item && item.loaded && !item.visible) {
          itemsToUnload.push(id);
        }
      }
    });

    // Unload distant items
    for (const id of itemsToUnload) {
      const item = this.items.get(id);
      if (item) {
        item.data = null;
        item.loaded = false;
        // Keep in HyperSpeed cache for quick reload if needed
        console.log(`🗑️ LAZY UNLOAD: Freed memory for ${item.type} ${id}`);
      }
    }

    if (itemsToUnload.length > 0) {
      console.log(`💾 MEMORY OPTIMIZED: Unloaded ${itemsToUnload.length} distant items`);
    }
  }

  // Calculate loading priority
  private calculatePriority(index: number, initialCount: number): number {
    if (index < initialCount) return 10; // Highest priority for initial items
    if (index < initialCount * 2) return 5; // Medium priority for next batch
    return 1; // Low priority for distant items
  }

  // Get item data
  getItemData(id: string): any {
    const item = this.items.get(id);
    return item?.data || null;
  }

  // Check if item is loaded
  isItemLoaded(id: string): boolean {
    const item = this.items.get(id);
    return item?.loaded || false;
  }

  // Check if item is loading
  isItemLoading(id: string): boolean {
    const item = this.items.get(id);
    return item?.loading || false;
  }

  // Force load specific item
  async forceLoadItem(id: string, loadCallback: (id: string) => Promise<any>): Promise<void> {
    await this.loadItems([id], loadCallback);
  }

  // Get memory usage stats
  getMemoryStats(): {
    totalItems: number;
    loadedItems: number;
    visibleItems: number;
    memoryUsage: string;
  } {
    const totalItems = this.items.size;
    const loadedItems = Array.from(this.items.values()).filter(item => item.loaded).length;
    const visibleItems = this.visibleItems.size;
    
    return {
      totalItems,
      loadedItems,
      visibleItems,
      memoryUsage: `${loadedItems}/${totalItems} items loaded (${Math.round(loadedItems/totalItems*100)}%)`,
    };
  }

  // Clear all data
  clear(): void {
    this.items.clear();
    this.visibleItems.clear();
    this.loadingQueue = [];
    console.log('🧹 LAZY LOADER: Cleared all data');
  }
}

// React hook for lazy loading
export const useLazyLoading = (
  contentType: 'posts' | 'reels' | 'stories',
  totalItems: string[],
  loadCallback: (id: string) => Promise<any>
) => {
  const [lazyItems, setLazyItems] = useState<LazyLoadItem[]>([]);
  const [stats, setStats] = useState({ totalItems: 0, loadedItems: 0, visibleItems: 0, memoryUsage: '' });
  const loader = useRef(IntelligentLazyLoader.getInstance());

  const initializeLazyLoad = useCallback(async () => {
    const items = await loader.current.initializeLazyLoad(contentType, totalItems, loadCallback);
    setLazyItems(items);
    updateStats();
  }, [contentType, totalItems, loadCallback]);

  const handleViewableItemsChanged = useCallback(async (info: { viewableItems: ViewToken[] }) => {
    await loader.current.handleViewportChange(info.viewableItems, contentType, loadCallback);
    updateStats();
  }, [contentType, loadCallback]);

  const updateStats = useCallback(() => {
    const newStats = loader.current.getMemoryStats();
    setStats(newStats);
  }, []);

  const getItemData = useCallback((id: string) => {
    return loader.current.getItemData(id);
  }, []);

  const isItemLoaded = useCallback((id: string) => {
    return loader.current.isItemLoaded(id);
  }, []);

  return {
    lazyItems,
    stats,
    initializeLazyLoad,
    handleViewableItemsChanged,
    getItemData,
    isItemLoaded,
  };
};

export default IntelligentLazyLoader;
