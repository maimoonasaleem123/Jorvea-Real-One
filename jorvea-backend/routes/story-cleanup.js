/**
 * 🧹 Story Cleanup Routes
 * 
 * Handles automatic deletion of stories older than 24 hours
 * - Deletes from Firestore
 * - Deletes from Firebase Storage
 * - Deletes from Digital Ocean Spaces (if applicable)
 */

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const AWS = require('aws-sdk');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    const serviceAccount = require('../firebase-service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'jorvea-9f876.appspot.com'
    });
    console.log('✅ Firebase Admin initialized for story cleanup');
  } catch (error) {
    console.error('⚠️ Firebase Admin initialization error:', error.message);
    // Try initializing without service account (will use application default credentials)
    try {
      admin.initializeApp();
      console.log('✅ Firebase Admin initialized with default credentials');
    } catch (err) {
      console.error('❌ Failed to initialize Firebase Admin:', err.message);
    }
  }
}

// Configure Digital Ocean Spaces
const DO_CONFIG = {
  endpoint: process.env.DO_ENDPOINT || 'blr1.digitaloceanspaces.com',
  bucket: process.env.DO_BUCKET || 'jorvea',
  accessKeyId: process.env.DO_ACCESS_KEY || 'DO801XPFLWMJLWB62XBX',
  secretAccessKey: process.env.DO_SECRET_KEY || 'abGOCo+yDJkU4pzWxArmxAPZjo84IGg6d4k3c9rM2WQ',
  region: process.env.DO_REGION || 'blr1'
};

const spacesEndpoint = new AWS.Endpoint(DO_CONFIG.endpoint);
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: DO_CONFIG.accessKeyId,
  secretAccessKey: DO_CONFIG.secretAccessKey,
  region: DO_CONFIG.region,
});

/**
 * DELETE /api/stories/cleanup
 * 
 * Deletes all stories older than 24 hours
 * This endpoint can be called manually or via cron job
 */
router.delete('/cleanup', async (req, res) => {
  console.log('🧹 Starting story cleanup...');
  
  try {
    const firestore = admin.firestore();
    const storage = admin.storage().bucket();
    
    // Calculate 24 hours ago timestamp
    const now = admin.firestore.Timestamp.now();
    const twentyFourHoursAgo = admin.firestore.Timestamp.fromMillis(
      now.toMillis() - (24 * 60 * 60 * 1000)
    );

    console.log(`🔍 Querying stories created before: ${twentyFourHoursAgo.toDate().toISOString()}`);

    // Query stories older than 24 hours
    const storiesSnapshot = await firestore
      .collection('stories')
      .where('createdAt', '<', twentyFourHoursAgo)
      .get();

    if (storiesSnapshot.empty) {
      console.log('✅ No expired stories found');
      return res.json({
        success: true,
        message: 'No expired stories to delete',
        deleted: 0,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🗑️ Found ${storiesSnapshot.size} expired stories`);

    const deletionResults = [];
    const errors = [];

    // Process each expired story
    for (const doc of storiesSnapshot.docs) {
      const storyId = doc.id;
      const storyData = doc.data();
      
      try {
        const result = {
          storyId,
          firestoreDeleted: false,
          storageDeleted: false,
          spacesDeleted: false,
          viewsDeleted: 0
        };

        // 1. Delete views subcollection
        try {
          const viewsSnapshot = await doc.ref.collection('views').get();
          const deleteBatch = firestore.batch();
          
          viewsSnapshot.docs.forEach(viewDoc => {
            deleteBatch.delete(viewDoc.ref);
          });
          
          if (!viewsSnapshot.empty) {
            await deleteBatch.commit();
            result.viewsDeleted = viewsSnapshot.size;
            console.log(`  ✅ Deleted ${viewsSnapshot.size} views for story ${storyId}`);
          }
        } catch (viewsError) {
          console.error(`  ⚠️ Error deleting views for story ${storyId}:`, viewsError.message);
        }

        // 2. Delete story document from Firestore
        try {
          await doc.ref.delete();
          result.firestoreDeleted = true;
          console.log(`  ✅ Deleted Firestore document: ${storyId}`);
        } catch (firestoreError) {
          console.error(`  ❌ Error deleting Firestore document ${storyId}:`, firestoreError.message);
          throw firestoreError;
        }

        // 3. Delete media from Firebase Storage
        if (storyData.mediaUrl && storyData.mediaUrl.includes('firebasestorage.googleapis.com')) {
          try {
            const urlParts = storyData.mediaUrl.split('/o/');
            if (urlParts.length > 1) {
              const filePath = decodeURIComponent(urlParts[1].split('?')[0]);
              await storage.file(filePath).delete();
              result.storageDeleted = true;
              console.log(`  ✅ Deleted Firebase Storage file: ${filePath}`);
            }
          } catch (storageError) {
            console.error(`  ⚠️ Error deleting Firebase Storage for story ${storyId}:`, storageError.message);
            // Don't throw, continue with other deletions
          }
        }

        // 4. Delete from Digital Ocean Spaces
        if (storyData.mediaUrl && storyData.mediaUrl.includes('digitaloceanspaces.com')) {
          try {
            const urlObj = new URL(storyData.mediaUrl);
            const key = urlObj.pathname.substring(1); // Remove leading /
            
            await s3.deleteObject({
              Bucket: DO_CONFIG.bucket,
              Key: key
            }).promise();
            
            result.spacesDeleted = true;
            console.log(`  ✅ Deleted DO Spaces file: ${key}`);
          } catch (spacesError) {
            console.error(`  ⚠️ Error deleting DO Spaces for story ${storyId}:`, spacesError.message);
            // Don't throw, continue
          }
        }

        deletionResults.push(result);
        console.log(`✅ Successfully processed story ${storyId}`);
        
      } catch (error) {
        console.error(`❌ Error processing story ${storyId}:`, error.message);
        errors.push({
          storyId,
          error: error.message
        });
      }
    }

    const response = {
      success: true,
      message: `Deleted ${deletionResults.length} expired stories`,
      deleted: deletionResults.length,
      totalFound: storiesSnapshot.size,
      deletionResults,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Cleanup complete! Deleted ${deletionResults.length}/${storiesSnapshot.size} stories`);
    
    return res.json(response);
    
  } catch (error) {
    console.error('❌ Story cleanup failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/stories/cleanup/status
 * 
 * Check how many stories are expired and ready for cleanup
 */
router.get('/cleanup/status', async (req, res) => {
  try {
    const firestore = admin.firestore();
    
    const now = admin.firestore.Timestamp.now();
    const twentyFourHoursAgo = admin.firestore.Timestamp.fromMillis(
      now.toMillis() - (24 * 60 * 60 * 1000)
    );

    // Count expired stories
    const expiredSnapshot = await firestore
      .collection('stories')
      .where('createdAt', '<', twentyFourHoursAgo)
      .get();

    // Count total active stories
    const activeSnapshot = await firestore
      .collection('stories')
      .where('createdAt', '>=', twentyFourHoursAgo)
      .get();

    return res.json({
      success: true,
      expiredStories: expiredSnapshot.size,
      activeStories: activeSnapshot.size,
      totalStories: expiredSnapshot.size + activeSnapshot.size,
      cutoffTime: twentyFourHoursAgo.toDate().toISOString(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error checking cleanup status:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/stories/cleanup/schedule
 * 
 * Manually trigger cleanup (useful for testing)
 */
router.post('/cleanup/schedule', async (req, res) => {
  console.log('📅 Manual cleanup triggered via schedule endpoint');
  
  try {
    // Call the cleanup endpoint internally
    const cleanupResponse = await fetch(`${req.protocol}://${req.get('host')}/api/stories/cleanup`, {
      method: 'DELETE'
    });
    
    const result = await cleanupResponse.json();
    
    return res.json({
      success: true,
      message: 'Manual cleanup triggered',
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error triggering manual cleanup:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
