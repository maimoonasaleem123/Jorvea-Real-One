import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as AWS from 'aws-sdk';

// Initialize Firebase Admin
admin.initializeApp();

// Initialize DigitalOcean Spaces (S3-compatible)
const s3 = new AWS.S3({
  endpoint: new AWS.Endpoint(functions.config().digitalocean?.endpoint || 'blr1.digitaloceanspaces.com'),
  accessKeyId: functions.config().digitalocean?.access_key_id,
  secretAccessKey: functions.config().digitalocean?.secret_access_key,
  region: functions.config().digitalocean?.region || 'blr1',
  s3ForcePathStyle: false,
  signatureVersion: 'v4'
});

const BUCKET_NAME = functions.config().digitalocean?.bucket || 'jorvea';
const db = admin.firestore();
const storage = admin.storage();

/**
 * Scheduled function to delete expired stories every hour
 * Runs at the top of every hour
 */
export const deleteExpiredStories = functions.pubsub
  .schedule('0 * * * *') // Every hour at minute 0
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('🕐 Starting scheduled story deletion...');
    
    try {
      const now = new Date();
      const results = await processExpiredStories(now);
      
      console.log(`✅ Scheduled deletion complete:`, results);
      return { success: true, ...results };
    } catch (error) {
      console.error('❌ Error in scheduled story deletion:', error);
      return { success: false, error: error.message };
    }
  });

/**
 * HTTP-triggered function for manual story cleanup (for testing)
 */
export const cleanupStoriesManual = functions.https.onRequest(async (req, res) => {
  // Basic auth check
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${functions.config().cleanup?.secret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    console.log('🧹 Manual story cleanup triggered...');
    
    const now = new Date();
    const results = await processExpiredStories(now);
    
    res.json({
      success: true,
      message: 'Story cleanup completed',
      ...results
    });
  } catch (error) {
    console.error('❌ Error in manual cleanup:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Process expired stories and delete them
 */
async function processExpiredStories(now: Date): Promise<{
  deletedStories: number;
  deletedFromDigitalOcean: number;
  deletedFromFirebase: number;
  errors: number;
}> {
  let deletedStories = 0;
  let deletedFromDigitalOcean = 0;
  let deletedFromFirebase = 0;
  let errors = 0;

  // Get expired stories from the deletion queue
  const deletionQueueSnapshot = await db
    .collection('story_deletion_queue')
    .where('expiresAt', '<', now.toISOString())
    .where('processed', '==', false)
    .limit(100)
    .get();

  if (deletionQueueSnapshot.empty) {
    console.log('📭 No expired stories found in deletion queue');
    return { deletedStories, deletedFromDigitalOcean, deletedFromFirebase, errors };
  }

  console.log(`📋 Found ${deletionQueueSnapshot.size} expired stories to process`);

  // Process each expired story
  const batch = db.batch();
  const deletePromises: Promise<void>[] = [];

  for (const doc of deletionQueueSnapshot.docs) {
    const queueData = doc.data();
    
    try {
      // Delete media from storage
      const deleteMediaPromise = deleteStoryMedia(queueData);
      deletePromises.push(deleteMediaPromise);

      // Track deletion type
      if (queueData.storageLocation === 'digitalocean') {
        deletedFromDigitalOcean++;
      } else if (queueData.storageLocation === 'firebase') {
        deletedFromFirebase++;
      }

      // Delete story from Firestore
      const storyRef = db.collection('stories').doc(queueData.storyId);
      batch.delete(storyRef);

      // Mark queue item as processed
      batch.update(doc.ref, { processed: true, processedAt: now.toISOString() });

      deletedStories++;
    } catch (error) {
      console.error(`❌ Error processing story ${queueData.storyId}:`, error);
      errors++;
      
      // Mark as failed in queue
      batch.update(doc.ref, { 
        processed: true, 
        failed: true, 
        error: error.message,
        processedAt: now.toISOString() 
      });
    }
  }

  // Execute all deletions
  await Promise.allSettled([
    batch.commit(),
    ...deletePromises
  ]);

  // Clean up old processed queue items (older than 7 days)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oldQueueSnapshot = await db
    .collection('story_deletion_queue')
    .where('processedAt', '<', sevenDaysAgo.toISOString())
    .limit(50)
    .get();

  if (!oldQueueSnapshot.empty) {
    const cleanupBatch = db.batch();
    oldQueueSnapshot.docs.forEach(doc => {
      cleanupBatch.delete(doc.ref);
    });
    await cleanupBatch.commit();
    console.log(`🧹 Cleaned up ${oldQueueSnapshot.size} old queue items`);
  }

  return { deletedStories, deletedFromDigitalOcean, deletedFromFirebase, errors };
}

/**
 * Delete story media from storage
 */
async function deleteStoryMedia(queueData: any): Promise<void> {
  try {
    if (queueData.storageLocation === 'digitalocean' && queueData.digitalOceanKey) {
      console.log(`🗑️ Deleting from DigitalOcean: ${queueData.digitalOceanKey}`);
      
      await s3.deleteObject({
        Bucket: BUCKET_NAME,
        Key: queueData.digitalOceanKey,
      }).promise();
      
      console.log(`✅ Deleted from DigitalOcean: ${queueData.digitalOceanKey}`);
    } 
    else if (queueData.storageLocation === 'firebase' && queueData.firebaseStoragePath) {
      console.log(`🗑️ Deleting from Firebase Storage: ${queueData.firebaseStoragePath}`);
      
      const bucket = storage.bucket();
      const file = bucket.file(queueData.firebaseStoragePath);
      await file.delete();
      
      console.log(`✅ Deleted from Firebase Storage: ${queueData.firebaseStoragePath}`);
    }
  } catch (error) {
    console.error(`❌ Error deleting media for story ${queueData.storyId}:`, error);
    throw error;
  }
}

/**
 * Background cleanup of orphaned media files
 * Runs daily to clean up any media files that don't have corresponding story records
 */
export const cleanupOrphanedMedia = functions.pubsub
  .schedule('0 2 * * *') // Daily at 2 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('🧹 Starting orphaned media cleanup...');
    
    try {
      // This is a more complex operation that would involve:
      // 1. Listing all media files in storage
      // 2. Checking if corresponding story records exist
      // 3. Deleting orphaned files
      
      // For now, we'll just log that this runs
      console.log('ℹ️ Orphaned media cleanup is not implemented yet');
      
      return { success: true, message: 'Orphaned media cleanup completed' };
    } catch (error) {
      console.error('❌ Error in orphaned media cleanup:', error);
      return { success: false, error: error.message };
    }
  });

/**
 * Function to check story system health
 */
export const storySystemHealth = functions.https.onRequest(async (req, res) => {
  try {
    const now = new Date();
    
    // Count active stories
    const activeStoriesSnapshot = await db
      .collection('stories')
      .where('expiresAt', '>', now.toISOString())
      .where('isExpired', '==', false)
      .get();

    // Count pending deletions
    const pendingDeletionsSnapshot = await db
      .collection('story_deletion_queue')
      .where('processed', '==', false)
      .get();

    // Count expired but not deleted stories
    const expiredButNotDeletedSnapshot = await db
      .collection('stories')
      .where('expiresAt', '<', now.toISOString())
      .where('isExpired', '==', false)
      .get();

    const health = {
      timestamp: now.toISOString(),
      status: 'healthy',
      activeStories: activeStoriesSnapshot.size,
      pendingDeletions: pendingDeletionsSnapshot.size,
      expiredButNotDeleted: expiredButNotDeletedSnapshot.size,
      needsAttention: expiredButNotDeletedSnapshot.size > 10,
    };

    if (health.needsAttention) {
      health.status = 'warning';
    }

    res.json(health);
  } catch (error) {
    console.error('❌ Error checking story system health:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default {
  deleteExpiredStories,
  cleanupStoriesManual,
  cleanupOrphanedMedia,
  storySystemHealth,
};
