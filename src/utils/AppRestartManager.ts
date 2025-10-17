import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import MemoryManager from './MemoryManager';

class AppRestartManager {
  private static instance: AppRestartManager;
  private isRestarting = false;
  private restartAttempts = 0;
  private maxRestartAttempts = 3;

  static getInstance(): AppRestartManager {
    if (!AppRestartManager.instance) {
      AppRestartManager.instance = new AppRestartManager();
    }
    return AppRestartManager.instance;
  }

  /**
   * Handle app restart when returning from background
   */
  async handleAppRestart(): Promise<void> {
    if (this.isRestarting) {
      console.log('🔄 App restart already in progress');
      return;
    }

    try {
      this.isRestarting = true;
      this.restartAttempts++;
      
      console.log(`🚀 Starting app restart (attempt ${this.restartAttempts})`);

      // Step 1: Emergency cleanup
      await this.performEmergencyCleanup();

      // Step 2: Clear navigation state
      await this.clearNavigationState();

      // Step 3: Reset memory management
      await this.resetMemoryManagement();

      // Step 4: Clear problematic cache
      await this.clearProblematicCache();

      // Step 5: Reset performance counters
      await this.resetPerformanceCounters();

      console.log('✅ App restart completed successfully');
      this.restartAttempts = 0;

    } catch (error) {
      console.error(`❌ App restart failed (attempt ${this.restartAttempts}):`, error);
      
      if (this.restartAttempts < this.maxRestartAttempts) {
        // Retry with exponential backoff
        const delay = Math.pow(2, this.restartAttempts) * 1000;
        setTimeout(() => this.handleAppRestart(), delay);
      } else {
        console.error('🚨 Max restart attempts reached, continuing anyway');
        this.restartAttempts = 0;
      }
    } finally {
      this.isRestarting = false;
    }
  }

  /**
   * Perform emergency cleanup to prevent crashes
   */
  private async performEmergencyCleanup(): Promise<void> {
    try {
      // Force garbage collection if possible
      if (global.gc) {
        global.gc();
      }
      
      // Clear image cache
      await MemoryManager.clearImageCache();

      console.log('✅ Emergency cleanup completed');
    } catch (error) {
      console.warn('⚠️ Emergency cleanup failed:', error);
    }
  }

  /**
   * Clear navigation state that might cause crashes
   */
  private async clearNavigationState(): Promise<void> {
    try {
      const navigationKeys = [
        '@navigation_state',
        '@react-navigation',
        '@REACT_NAVIGATION_STATE',
        'NAVIGATION_STATE'
      ];

      for (const key of navigationKeys) {
        try {
          await AsyncStorage.removeItem(key);
        } catch (error) {
          // Continue with other keys even if one fails
        }
      }

      console.log('✅ Navigation state cleared');
    } catch (error) {
      console.warn('⚠️ Navigation state cleanup failed:', error);
    }
  }

  /**
   * Reset memory management system
   */
  private async resetMemoryManagement(): Promise<void> {
    try {
      // Get current memory stats
      const stats = await MemoryManager.getStorageStats();
      console.log('📊 Memory before reset:', Math.round(stats.totalSize / 1024 / 1024 * 100) / 100 + 'MB');

      // Force cleanup
      await MemoryManager.clearImageCache();

      console.log('✅ Memory management reset');
    } catch (error) {
      console.warn('⚠️ Memory management reset failed:', error);
    }
  }

  /**
   * Clear problematic cache data
   */
  private async clearProblematicCache(): Promise<void> {
    try {
      const problematicKeys = [
        '@app_crash_data',
        '@error_logs',
        '@temp_data',
        '@cache_overflow',
        '@video_cache',
        '@image_cache_large'
      ];

      for (const key of problematicKeys) {
        try {
          await AsyncStorage.removeItem(key);
        } catch (error) {
          // Continue with other keys
        }
      }

      console.log('✅ Problematic cache cleared');
    } catch (error) {
      console.warn('⚠️ Problematic cache cleanup failed:', error);
    }
  }

  /**
   * Reset performance counters
   */
  private async resetPerformanceCounters(): Promise<void> {
    try {
      // Clear performance logs
      const performanceKeys = [
        '@performance_logs',
        '@memory_warnings',
        '@crash_reports'
      ];

      for (const key of performanceKeys) {
        try {
          await AsyncStorage.removeItem(key);
        } catch (error) {
          // Continue
        }
      }

      console.log('✅ Performance counters reset');
    } catch (error) {
      console.warn('⚠️ Performance counters reset failed:', error);
    }
  }

  /**
   * Save app state before going to background
   */
  async saveAppState(currentRoute?: string): Promise<void> {
    try {
      const appState = {
        timestamp: Date.now(),
        currentRoute: currentRoute || 'MainTabs',
        version: '1.0.0',
        platform: Platform.OS,
        restartCount: this.restartAttempts
      };

      await AsyncStorage.setItem('@app_safe_state', JSON.stringify(appState));
      console.log('✅ App state saved');
    } catch (error) {
      console.warn('⚠️ Failed to save app state:', error);
    }
  }

  /**
   * Restore app state when returning from background
   */
  async restoreAppState(): Promise<any> {
    try {
      const stateData = await AsyncStorage.getItem('@app_safe_state');
      if (stateData) {
        const parsed = JSON.parse(stateData);
        console.log('📱 Restored app state from:', new Date(parsed.timestamp));
        return parsed;
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Failed to restore app state:', error);
      return null;
    }
  }

  /**
   * Check if app crashed during last session
   */
  async checkForPreviousCrash(): Promise<boolean> {
    try {
      const crashFlag = await AsyncStorage.getItem('@app_crashed');
      if (crashFlag === 'true') {
        console.log('🚨 Previous crash detected, performing recovery');
        await AsyncStorage.removeItem('@app_crashed');
        return true;
      }
      return false;
    } catch (error) {
      console.warn('⚠️ Crash check failed:', error);
      return false;
    }
  }

  /**
   * Mark app as crashed (called by error handlers)
   */
  async markAppAsCrashed(): Promise<void> {
    try {
      await AsyncStorage.setItem('@app_crashed', 'true');
    } catch (error) {
      console.warn('⚠️ Failed to mark app as crashed:', error);
    }
  }

  /**
   * Clear crash flag (called when app starts successfully)
   */
  async clearCrashFlag(): Promise<void> {
    try {
      await AsyncStorage.removeItem('@app_crashed');
    } catch (error) {
      console.warn('⚠️ Failed to clear crash flag:', error);
    }
  }
}

export default AppRestartManager;
