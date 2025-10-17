const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

/**
 * 🎯 REELS ANALYTICS & VIEW TRACKING BACKEND
 * Advanced server-side view tracking and analytics
 */

// Get reel analytics
router.get('/analytics/:reelId', async (req, res) => {
  try {
    const { reelId } = req.params;
    
    // Get view records
    const viewsSnapshot = await admin.firestore()
      .collection('reelViews')
      .where('reelId', '==', reelId)
      .get();

    // Calculate statistics
    const views = viewsSnapshot.docs.map(doc => doc.data());
    const uniqueViewers = new Set(views.map(v => v.userId)).size;
    const totalViews = views.length;
    const avgWatchTime = views.reduce((sum, v) => sum + v.watchTime, 0) / totalViews;

    // Get reel data
    const reelDoc = await admin.firestore()
      .collection('reels')
      .doc(reelId)
      .get();
    
    const reelData = reelDoc.data();
    const duration = reelData?.duration || 15000;
    const completionRate = (avgWatchTime / duration) * 100;

    // Get engagement metrics
    const likesSnapshot = await admin.firestore()
      .collection('reels')
      .doc(reelId)
      .collection('likes')
      .get();

    const commentsSnapshot = await admin.firestore()
      .collection('reels')
      .doc(reelId)
      .collection('comments')
      .get();

    // Calculate engagement rate
    const engagementRate = ((likesSnapshot.size + commentsSnapshot.size) / totalViews) * 100;

    // Get view trend (last 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const viewTrend = views
      .filter(v => v.timestamp > sevenDaysAgo)
      .reduce((acc, v) => {
        const date = new Date(v.timestamp).toLocaleDateString();
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

    res.json({
      success: true,
      analytics: {
        totalViews,
        uniqueViewers,
        averageWatchTime: Math.round(avgWatchTime),
        completionRate: Math.round(completionRate),
        likes: likesSnapshot.size,
        comments: commentsSnapshot.size,
        engagementRate: Math.round(engagementRate * 100) / 100,
        viewTrend,
      },
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Track view (server-side validation)
router.post('/track-view', async (req, res) => {
  try {
    const { reelId, userId, deviceId, watchTime, timestamp } = req.body;

    // Validate required fields
    if (!reelId || !userId || !deviceId || !watchTime) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    // Check if already viewed
    const viewId = `${userId}_${reelId}_${deviceId}`;
    const existingView = await admin.firestore()
      .collection('reelViews')
      .doc(viewId)
      .get();

    if (existingView.exists) {
      return res.json({ 
        success: false, 
        reason: 'already_viewed' 
      });
    }

    // Validate watch time (minimum 3 seconds)
    if (watchTime < 3000) {
      return res.json({ 
        success: false, 
        reason: 'insufficient_watch_time' 
      });
    }

    // Bot detection
    const botCheck = await detectBot(userId, deviceId, watchTime);
    if (botCheck.isBot) {
      return res.json({ 
        success: false, 
        reason: 'bot_detected',
        confidence: botCheck.confidence,
      });
    }

    // Create view record
    await admin.firestore()
      .collection('reelViews')
      .doc(viewId)
      .set({
        reelId,
        userId,
        deviceId,
        watchTime,
        timestamp: timestamp || Date.now(),
        isValid: true,
        serverValidated: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Increment view count
    await admin.firestore()
      .collection('reels')
      .doc(reelId)
      .update({
        views: admin.firestore.FieldValue.increment(1),
        uniqueViewers: admin.firestore.FieldValue.arrayUnion(userId),
        lastViewedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get personalized feed
router.get('/feed/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    // Get user's viewed reels
    const viewedSnapshot = await admin.firestore()
      .collection('reelViews')
      .where('userId', '==', userId)
      .get();

    const viewedReelIds = viewedSnapshot.docs.map(doc => doc.data().reelId);

    // Get user's followed users
    const followsSnapshot = await admin.firestore()
      .collection('follows')
      .where('followerId', '==', userId)
      .get();

    const followedUserIds = followsSnapshot.docs.map(doc => doc.data().followingId);

    // Build feed query
    let feedQuery = admin.firestore()
      .collection('reels')
      .where('isActive', '==', true);

    // Exclude viewed reels (if possible - Firestore limitation)
    // We'll filter client-side instead

    // Get recent reels
    const reelsSnapshot = await feedQuery
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit) * 3) // Get more to filter
      .get();

    // Filter and score reels
    let reels = reelsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(reel => !viewedReelIds.includes(reel.id));

    // Score reels based on:
    // - Followed users (higher priority)
    // - Engagement rate
    // - Recency
    reels = reels.map(reel => {
      let score = 0;
      
      // Followed user bonus
      if (followedUserIds.includes(reel.userId)) {
        score += 100;
      }

      // Engagement score
      const engagement = (reel.likesCount || 0) + (reel.commentsCount || 0) * 2;
      score += engagement * 0.1;

      // Recency score (newer = better)
      const ageHours = (Date.now() - reel.createdAt?.toMillis()) / (1000 * 60 * 60);
      score += Math.max(0, 100 - ageHours);

      return { ...reel, score };
    });

    // Sort by score and return
    reels.sort((a, b) => b.score - a.score);
    const paginatedReels = reels.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      reels: paginatedReels,
      hasMore: reels.length > parseInt(offset) + parseInt(limit),
      totalAvailable: reels.length,
    });
  } catch (error) {
    console.error('Error getting feed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bot detection helper
async function detectBot(userId, deviceId, watchTime) {
  try {
    let botScore = 0;
    const reasons = [];

    // Check recent views from this user
    const recentViews = await admin.firestore()
      .collection('reelViews')
      .where('userId', '==', userId)
      .where('timestamp', '>', Date.now() - 60000) // Last minute
      .get();

    if (recentViews.size > 20) {
      botScore += 0.4;
      reasons.push('Too many views per minute');
    }

    // Check watch time
    if (watchTime < 1000) {
      botScore += 0.3;
      reasons.push('Watch time too short');
    }

    // Check device activity
    const deviceViews = await admin.firestore()
      .collection('reelViews')
      .where('deviceId', '==', deviceId)
      .where('timestamp', '>', Date.now() - 3600000) // Last hour
      .get();

    if (deviceViews.size > 100) {
      botScore += 0.3;
      reasons.push('Excessive device activity');
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

// Get trending reels
router.get('/trending', async (req, res) => {
  try {
    const { limit = 20, timeRange = '24h' } = req.query;

    // Calculate time range
    let hours = 24;
    if (timeRange === '7d') hours = 24 * 7;
    if (timeRange === '30d') hours = 24 * 30;

    const since = Date.now() - (hours * 60 * 60 * 1000);

    // Get recent reels
    const reelsSnapshot = await admin.firestore()
      .collection('reels')
      .where('createdAt', '>', admin.firestore.Timestamp.fromMillis(since))
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit) * 5)
      .get();

    // Calculate engagement score for each reel
    const reelsWithScore = reelsSnapshot.docs.map(doc => {
      const data = doc.data();
      const engagement = 
        (data.likesCount || 0) * 3 +
        (data.commentsCount || 0) * 5 +
        (data.shares || 0) * 7 +
        (data.views || 0) * 0.1;

      return {
        id: doc.id,
        ...data,
        engagementScore: engagement,
      };
    });

    // Sort by engagement and return top
    reelsWithScore.sort((a, b) => b.engagementScore - a.engagementScore);
    const trendingReels = reelsWithScore.slice(0, parseInt(limit));

    res.json({
      success: true,
      reels: trendingReels,
      timeRange,
    });
  } catch (error) {
    console.error('Error getting trending reels:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clean up invalid views (admin function)
router.post('/admin/cleanup-views', async (req, res) => {
  try {
    const { adminKey } = req.body;

    // Validate admin key (you should use proper auth)
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Find invalid views (watch time < 3 seconds)
    const invalidViews = await admin.firestore()
      .collection('reelViews')
      .where('watchTime', '<', 3000)
      .get();

    // Delete invalid views
    const batch = admin.firestore().batch();
    invalidViews.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    res.json({
      success: true,
      deletedCount: invalidViews.size,
    });
  } catch (error) {
    console.error('Error cleaning up views:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
