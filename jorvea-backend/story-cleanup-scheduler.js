/**
 * 📅 Story Cleanup Scheduler
 * 
 * Runs story cleanup every hour using node-cron
 * This is better than shell cron as it works on all platforms
 */

const cron = require('node-cron');
const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const CLEANUP_SCHEDULE = '0 * * * *'; // Every hour at minute 0

/**
 * Trigger story cleanup
 */
async function triggerCleanup() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🧹 Triggering story cleanup...`);
  
  try {
    const response = await axios.delete(`${BACKEND_URL}/api/stories/cleanup`, {
      timeout: 60000 // 60 second timeout
    });
    
    console.log(`[${timestamp}] ✅ Cleanup successful:`, response.data);
    
    if (response.data.deleted > 0) {
      console.log(`  📊 Deleted ${response.data.deleted} stories`);
      console.log(`  🗑️ Cleanup results:`, response.data.deletionResults);
    } else {
      console.log(`  ℹ️ No expired stories to delete`);
    }
    
    return response.data;
    
  } catch (error) {
    console.error(`[${timestamp}] ❌ Cleanup failed:`, error.message);
    
    if (error.response) {
      console.error(`  HTTP ${error.response.status}:`, error.response.data);
    }
    
    throw error;
  }
}

/**
 * Initialize scheduler
 */
function initializeScheduler() {
  console.log('📅 Initializing story cleanup scheduler...');
  console.log(`   Schedule: ${CLEANUP_SCHEDULE} (every hour)`);
  console.log(`   Backend URL: ${BACKEND_URL}`);
  
  // Schedule cleanup every hour
  const task = cron.schedule(CLEANUP_SCHEDULE, async () => {
    try {
      await triggerCleanup();
    } catch (error) {
      console.error('Scheduled cleanup error:', error.message);
      // Don't throw, let scheduler continue
    }
  }, {
    timezone: "UTC" // Use UTC for consistency
  });
  
  console.log('✅ Story cleanup scheduler initialized');
  console.log('   Next run:', task.nextDate().toString());
  
  return task;
}

/**
 * Run cleanup immediately (for testing)
 */
async function runImmediately() {
  console.log('🚀 Running cleanup immediately...');
  
  try {
    await triggerCleanup();
    console.log('✅ Immediate cleanup completed');
  } catch (error) {
    console.error('❌ Immediate cleanup failed:', error.message);
    process.exit(1);
  }
}

// If run directly, execute immediately
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--now')) {
    // Run immediately and exit
    runImmediately().then(() => process.exit(0));
  } else {
    // Start scheduler
    initializeScheduler();
    
    // Keep process running
    console.log('📌 Scheduler is running. Press Ctrl+C to stop.');
  }
}

module.exports = {
  initializeScheduler,
  triggerCleanup,
  runImmediately
};
