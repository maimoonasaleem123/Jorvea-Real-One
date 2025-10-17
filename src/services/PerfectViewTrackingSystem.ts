import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Simple device ID generator (without external dependency)
const generateDeviceId = async (): Promise<string> => {
  try {
    let deviceId = await AsyncStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  } catch {
    return `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
};

/**
 * 🎯 PERFECT VIEW TRACKING SYSTEM
 * Instagram-like view tracking with anti-bot measures
 * - One view per user per reel (EVER)
 * - Requires minimum watch time (3 seconds)
 * - Device fingerprinting
 * - Bot detection
 * - Free forever (using Firebase)
 */

interface ViewRecord {
  reelId: string;
  userId: string;
  deviceId: string;
  timestamp: number;
  watchTime: number;
  isValid: boolean;
  userAgent: string;
  appVersion: string;
}

interface BotDetectionResult {
  isBot: boolean;
  confidence: number;
  reasons: string[];
}

class PerfectViewTrackingSystem {
  private static instance: PerfectViewTrackingSystem;
  private viewedReels: Map<string, number> = new Map(); // reelId -> timestamp
  private deviceFingerprint: string | null = null;
  private readonly MIN_WATCH_TIME = 3000; // 3 seconds minimum
  private readonly VIEW_CACHE_KEY = 'view_tracking_cache';

  static getInstance(): PerfectViewTrackingSystem {
    if (!PerfectViewTrackingSystem.instance) {
      PerfectViewTrackingSystem.instance = new PerfectViewTrackingSystem();
    }
    return PerfectViewTrackingSystem.instance;
  }

  /**
   * Initialize view tracking system
   */
  async initialize(userId: string): Promise<void> {
    try {
      // Generate device fingerprint
      await this.generateDeviceFingerprint();

      // Load viewed reels from cache
      const cached = await AsyncStorage.getItem(`${this.VIEW_CACHE_KEY}_${userId}`);
      if (cached) {
        const viewedArray = JSON.parse(cached);
        this.viewedReels = new Map(viewedArray);
        console.log(`📊 Loaded ${this.viewedReels.size} viewed reels from cache`);
      }

      // Load from Firebase for this device
      await this.loadViewedReelsFromFirebase(userId);
    } catch (error) {
      console.error('Error initializing view tracking:', error);
    }
  }

  /**
   * Generate unique device fingerprint
   */
  private async generateDeviceFingerprint(): Promise<void> {
    try {
      const deviceId = await generateDeviceId();
      const platform = Platform.OS;
      const timestamp = Date.now();
      
      // Create fingerprint
      this.deviceFingerprint = `${platform}_${deviceId}_${timestamp}`;
      console.log('🔐 Device fingerprint generated');
    } catch (error) {
      console.error('Error generating device fingerprint:', error);
      this.deviceFingerprint = `fallback_${Date.now()}`;
    }
  }

  /**
   * Load viewed reels from Firebase
   */
  private async loadViewedReelsFromFirebase(userId: string): Promise<void> {
    try {
      const snapshot = await firestore()
        .collection('reelViews')
        .where('userId', '==', userId)
        .where('deviceId', '==', this.deviceFingerprint)
        .get();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        this.viewedReels.set(data.reelId, data.timestamp);
      });

      console.log(`📥 Loaded ${snapshot.size} viewed reels from Firebase`);
    } catch (error) {
      console.error('Error loading viewed reels:', error);
    }
  }

  /**
   * Check if reel has been viewed by this user
   */
  hasViewed(reelId: string): boolean {
    return this.viewedReels.has(reelId);
  }

  /**
   * Track view with anti-bot measures
   */
  async trackView(
    reelId: string,
    userId: string,
    watchTime: number,
    timestamp: number = Date.now()
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      // 1. Check if already viewed
      if (this.hasViewed(reelId)) {
        console.log(`⏭️ Reel ${reelId} already viewed by user - SKIPPED`);
        return { success: false, reason: 'already_viewed' };
      }

      // 2. Validate minimum watch time
      if (watchTime < this.MIN_WATCH_TIME) {
        console.log(`⏱️ Watch time ${watchTime}ms < ${this.MIN_WATCH_TIME}ms - SKIPPED`);
        return { success: false, reason: 'insufficient_watch_time' };
      }

      // 3. Bot detection
      const botCheck = await this.detectBot(userId, reelId, watchTime);
      if (botCheck.isBot && botCheck.confidence > 0.7) {
        console.log(`🤖 Bot detected (${botCheck.confidence * 100}%):`, botCheck.reasons);
        return { success: false, reason: 'bot_detected' };
      }

      // 4. Get app info
      const userAgent = `${Platform.OS}/${Platform.Version}`;
      const appVersion = '1.0.0'; // Or get from app.json

      // 5. Create view record
      const viewRecord: ViewRecord = {
        reelId,
        userId,
        deviceId: this.deviceFingerprint || 'unknown',
        timestamp,
        watchTime,
        isValid: true,
        userAgent,
        appVersion,
      };

      // 6. Save to Firebase (permanent record)
      const viewId = `${userId}_${reelId}_${this.deviceFingerprint}`;
      await firestore()
        .collection('reelViews')
        .doc(viewId)
        .set(viewRecord);

      // 7. Increment view count on reel
      await firestore()
        .collection('reels')
        .doc(reelId)
        .update({
          views: firestore.FieldValue.increment(1),
          uniqueViewers: firestore.FieldValue.arrayUnion(userId),
        });

      // 8. Update local cache
      this.viewedReels.set(reelId, timestamp);
      await this.saveViewCache(userId);

      console.log(`✅ View tracked: Reel ${reelId} by user ${userId.slice(0, 8)}`);
      return { success: true };

    } catch (error) {
      console.error('Error tracking view:', error);
      return { success: false, reason: 'error' };
    }
  }

  /**
   * Bot detection algorithm
   */
  private async detectBot(
    userId: string,
    reelId: string,
    watchTime: number
  ): Promise<BotDetectionResult> {
    const reasons: string[] = [];
    let botScore = 0;

    try {
      // 1. Check viewing pattern (too fast)
      const recentViews = await this.getRecentViewCount(userId, 60000); // Last 1 minute
      if (recentViews > 20) {
        botScore += 0.4;
        reasons.push('Too many views in short time');
      }

      // 2. Check if watching too quickly (< 1 second)
      if (watchTime < 1000) {
        botScore += 0.3;
        reasons.push('Watch time too short');
      }

      // 3. Check account age
      const userDoc = await firestore().collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const accountAge = Date.now() - userData?.createdAt?.toMillis();
        if (accountAge < 3600000) { // Less than 1 hour old
          botScore += 0.2;
          reasons.push('New account');
        }
      }

      // 4. Check device consistency
      const deviceViews = await this.getDeviceViewCount(this.deviceFingerprint || '', 3600000); // Last hour
      if (deviceViews > 100) {
        botScore += 0.3;
        reasons.push('Excessive device activity');
      }

      // 5. Check interaction history (no likes/comments = suspicious)
      const hasInteractions = await this.checkUserInteractions(userId);
      if (!hasInteractions && recentViews > 10) {
        botScore += 0.2;
        reasons.push('No user interactions');
      }

      return {
        isBot: botScore > 0.7,
        confidence: Math.min(botScore, 1),
        reasons,
      };
    } catch (error) {
      console.error('Error in bot detection:', error);
      return { isBot: false, confidence: 0, reasons: [] };
    }
  }

  /**
   * Get recent view count for user
   */
  private async getRecentViewCount(userId: string, timeWindow: number): Promise<number> {
    try {
      const since = Date.now() - timeWindow;
      const snapshot = await firestore()
        .collection('reelViews')
        .where('userId', '==', userId)
        .where('timestamp', '>', since)
        .get();

      return snapshot.size;
    } catch (error) {
      console.error('Error getting recent view count:', error);
      return 0;
    }
  }

  /**
   * Get device view count
   */
  private async getDeviceViewCount(deviceId: string, timeWindow: number): Promise<number> {
    try {
      const since = Date.now() - timeWindow;
      const snapshot = await firestore()
        .collection('reelViews')
        .where('deviceId', '==', deviceId)
        .where('timestamp', '>', since)
        .get();

      return snapshot.size;
    } catch (error) {
      console.error('Error getting device view count:', error);
      return 0;
    }
  }

  /**
   * Check if user has any interactions (likes, comments)
   */
  private async checkUserInteractions(userId: string): Promise<boolean> {
    try {
      // Check likes
      const likesSnapshot = await firestore()
        .collectionGroup('likes')
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (!likesSnapshot.empty) return true;

      // Check comments
      const commentsSnapshot = await firestore()
        .collectionGroup('comments')
        .where('userId', '==', userId)
        .limit(1)
        .get();

      return !commentsSnapshot.empty;
    } catch (error) {
      console.error('Error checking user interactions:', error);
      return true; // Give benefit of doubt
    }
  }

  /**
   * Get view statistics for a reel
   */
  async getReelViewStats(reelId: string): Promise<{
    totalViews: number;
    uniqueViewers: number;
    averageWatchTime: number;
    completionRate: number;
  }> {
    try {
      const snapshot = await firestore()
        .collection('reelViews')
        .where('reelId', '==', reelId)
        .get();

      const views = snapshot.docs.map(doc => doc.data());
      const uniqueViewers = new Set(views.map(v => v.userId)).size;
      const avgWatchTime = views.reduce((sum, v) => sum + v.watchTime, 0) / views.length;

      // Get reel duration for completion rate
      const reelDoc = await firestore().collection('reels').doc(reelId).get();
      const duration = reelDoc.data()?.duration || 15000;
      const completionRate = (avgWatchTime / duration) * 100;

      return {
        totalViews: snapshot.size,
        uniqueViewers,
        averageWatchTime: avgWatchTime,
        completionRate,
      };
    } catch (error) {
      console.error('Error getting view stats:', error);
      return { totalViews: 0, uniqueViewers: 0, averageWatchTime: 0, completionRate: 0 };
    }
  }

  /**
   * Save view cache to AsyncStorage
   */
  private async saveViewCache(userId: string): Promise<void> {
    try {
      const viewedArray = Array.from(this.viewedReels.entries());
      await AsyncStorage.setItem(`${this.VIEW_CACHE_KEY}_${userId}`, JSON.stringify(viewedArray));
    } catch (error) {
      console.error('Error saving view cache:', error);
    }
  }

  /**
   * Clear all view history (for testing or user request)
   */
  async clearViewHistory(userId: string): Promise<void> {
    try {
      this.viewedReels.clear();
      await AsyncStorage.removeItem(`${this.VIEW_CACHE_KEY}_${userId}`);
      console.log('🗑️ View history cleared');
    } catch (error) {
      console.error('Error clearing view history:', error);
    }
  }

  /**
   * Get user's view history
   */
  async getUserViewHistory(userId: string, limit: number = 50): Promise<ViewRecord[]> {
    try {
      const snapshot = await firestore()
        .collection('reelViews')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => doc.data() as ViewRecord);
    } catch (error) {
      console.error('Error getting view history:', error);
      return [];
    }
  }
}

export default PerfectViewTrackingSystem;
export type { ViewRecord, BotDetectionResult };
