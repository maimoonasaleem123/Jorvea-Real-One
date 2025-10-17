/**
 * Firebase Functions + Digital Ocean Spaces
 * 100% FREE HLS Conversion with YOUR storage
 * 
 * ARCHITECTURE:
 * 1. Upload video to Digital Ocean Spaces
 * 2. Call this Firebase Function via HTTP
 * 3. Function downloads from Digital Ocean
 * 4. Converts to HLS with FFmpeg
 * 5. Uploads HLS files back to Digital Ocean
 * 6. Returns .m3u8 URL
 * 
 * COST: Firebase Functions only = FREE for ~6,600 conversions/month
 * Digital Ocean: You already have it!
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const AWS = require('aws-sdk');
const axios = require('axios');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// Configure Digital Ocean Spaces (S3-compatible)
// Use environment variables or hardcode your credentials here
const DO_CONFIG = {
  endpoint: 'blr1.digitaloceanspaces.com',
  bucket: 'jorvea',
  accessKeyId: 'DO801XPFLWMJLWB62XBX',
  secretAccessKey: 'abGOCo+yDJkU4pzWxArmxAPZjo84IGg6d4k3c9rM2WQ',
  region: 'blr1',
  cdnUrl: 'https://jorvea.blr1.cdn.digitaloceanspaces.com'
};

const spacesEndpoint = new AWS.Endpoint(DO_CONFIG.endpoint);
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: DO_CONFIG.accessKeyId,
  secretAccessKey: DO_CONFIG.secretAccessKey,
  region: DO_CONFIG.region,
});

const BUCKET_NAME = DO_CONFIG.bucket;

/**
 * HTTP Endpoint: Convert video to HLS
 * 
 * POST /convertToHLS
 * Body: {
 *   videoUrl: "https://your-space.nyc3.digitaloceanspaces.com/reels/video.mp4",
 *   videoId: "123456",
 *   userId: "user123"
 * }
 * 
 * Returns: {
 *   success: true,
 *   hlsUrl: "https://your-space.nyc3.digitaloceanspaces.com/reels/hls/123456/master.m3u8",
 *   thumbnailUrl: "...",
 *   duration: 30.5
 * }
 */
exports.convertToHLS = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes
    memory: '2GB',
  })
  .https
  .onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      return res.status(204).send('');
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { videoUrl, videoId, userId } = req.body;

    if (!videoUrl || !videoId) {
      return res.status(400).json({ 
        error: 'Missing required fields: videoUrl, videoId' 
      });
    }

    console.log('🎬 Starting HLS conversion');
    console.log('📹 Video URL:', videoUrl);
    console.log('🆔 Video ID:', videoId);

    const tempDir = os.tmpdir();
    const tempInputPath = path.join(tempDir, `input_${videoId}.mp4`);
    const tempOutputDir = path.join(tempDir, `hls_${videoId}`);

    try {
      // Step 1: Download video from Digital Ocean
      console.log('📥 Downloading from Digital Ocean...');
      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(tempInputPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      console.log('✅ Download complete');

      // Step 2: Get video metadata
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(tempInputPath, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const duration = parseFloat(metadata.format.duration);
      const width = videoStream.width;
      const height = videoStream.height;

      console.log(`📐 Video: ${width}x${height}, ${duration.toFixed(1)}s`);

      // Create output directory
      if (!fs.existsSync(tempOutputDir)) {
        fs.mkdirSync(tempOutputDir, { recursive: true });
      }

      // Step 3: Convert to HLS with multiple resolutions
      console.log('🔄 Starting FFmpeg conversion...');

      const resolutions = [];

      // Determine which resolutions to create based on input
      if (height >= 1080) {
        resolutions.push({ name: '1080p', height: 1080, bitrate: '5000k' });
      }
      if (height >= 720) {
        resolutions.push({ name: '720p', height: 720, bitrate: '2800k' });
      }
      if (height >= 480) {
        resolutions.push({ name: '480p', height: 480, bitrate: '1400k' });
      }

      // Always have at least one resolution
      if (resolutions.length === 0) {
        resolutions.push({ 
          name: 'original', 
          height: height, 
          bitrate: '1400k' 
        });
      }

      console.log(`📊 Creating ${resolutions.length} resolution(s):`, 
        resolutions.map(r => r.name).join(', '));

      // Convert each resolution
      const variantPlaylists = [];

      for (const res of resolutions) {
        const outputPath = path.join(tempOutputDir, `${res.name}.m3u8`);
        const scale = `scale=-2:${res.height}`;

        await new Promise((resolve, reject) => {
          ffmpeg(tempInputPath)
            .outputOptions([
              '-c:v libx264',           // Video codec
              '-c:a aac',               // Audio codec
              '-b:v ' + res.bitrate,    // Video bitrate
              '-b:a 128k',              // Audio bitrate
              '-vf ' + scale,           // Scale video
              '-f hls',                 // HLS format
              '-hls_time 6',            // 6-second segments
              '-hls_list_size 0',       // Keep all segments
              '-hls_segment_filename', path.join(tempOutputDir, `${res.name}_%03d.ts`)
            ])
            .output(outputPath)
            .on('progress', (progress) => {
              if (progress.percent) {
                console.log(`⏳ ${res.name}: ${progress.percent.toFixed(1)}%`);
              }
            })
            .on('end', () => {
              console.log(`✅ ${res.name} complete`);
              resolve();
            })
            .on('error', (err) => {
              console.error(`❌ ${res.name} error:`, err);
              reject(err);
            })
            .run();
        });

        variantPlaylists.push({
          name: res.name,
          file: `${res.name}.m3u8`,
          bandwidth: parseInt(res.bitrate) * 1000,
          resolution: `${Math.round(res.height * 16 / 9)}x${res.height}`
        });
      }

      // Step 4: Create master playlist
      console.log('📝 Creating master playlist...');
      let masterPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

      for (const variant of variantPlaylists) {
        masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},RESOLUTION=${variant.resolution}\n`;
        masterPlaylist += `${variant.file}\n`;
      }

      const masterPath = path.join(tempOutputDir, 'master.m3u8');
      fs.writeFileSync(masterPath, masterPlaylist);
      console.log('✅ Master playlist created');

      // Step 5: Generate thumbnail
      console.log('📸 Generating thumbnail...');
      const thumbnailPath = path.join(tempOutputDir, 'thumbnail.jpg');
      const thumbnailTime = duration * 0.1; // 10% into video

      await new Promise((resolve, reject) => {
        ffmpeg(tempInputPath)
          .screenshots({
            timestamps: [thumbnailTime],
            filename: 'thumbnail.jpg',
            folder: tempOutputDir,
            size: '1080x?'
          })
          .on('end', () => {
            console.log('✅ Thumbnail generated');
            resolve();
          })
          .on('error', reject);
      });

      // Step 6: Upload all files to Digital Ocean
      console.log('☁️ Uploading to Digital Ocean Spaces...');

      const uploadPromises = [];
      const files = fs.readdirSync(tempOutputDir);
      const hlsFolder = `reels/hls/${videoId}`;

      for (const file of files) {
        const filePath = path.join(tempOutputDir, file);
        const fileContent = fs.readFileSync(filePath);
        const key = `${hlsFolder}/${file}`;

        let contentType = 'application/octet-stream';
        if (file.endsWith('.m3u8')) contentType = 'application/x-mpegURL';
        else if (file.endsWith('.ts')) contentType = 'video/MP2T';
        else if (file.endsWith('.jpg')) contentType = 'image/jpeg';

        const uploadParams = {
          Bucket: BUCKET_NAME,
          Key: key,
          Body: fileContent,
          ACL: 'public-read',
          ContentType: contentType,
        };

        uploadPromises.push(
          s3.upload(uploadParams).promise()
            .then(() => console.log(`✅ Uploaded: ${file}`))
        );
      }

      await Promise.all(uploadPromises);
      console.log('🎉 All files uploaded!');

      // Step 7: Build URLs (use CDN for better performance)
      const baseUrl = DO_CONFIG.cdnUrl;
      const hlsUrl = `${baseUrl}/${hlsFolder}/master.m3u8`;
      const thumbnailUrl = `${baseUrl}/${hlsFolder}/thumbnail.jpg`;

      // Step 8: Update Firestore
      if (userId) {
        try {
          const db = admin.firestore();
          await db.collection('reels').doc(videoId).update({
            videoUrl: hlsUrl,
            thumbnailUrl: thumbnailUrl,
            duration: duration,
            isHLS: true,
            resolutions: variantPlaylists.map(v => v.name),
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log('✅ Firestore updated');
        } catch (err) {
          console.error('⚠️ Firestore update failed:', err);
        }
      }

      // Cleanup
      console.log('🧹 Cleaning up temp files...');
      fs.rmSync(tempOutputDir, { recursive: true, force: true });
      fs.unlinkSync(tempInputPath);

      // Return success
      return res.status(200).json({
        success: true,
        hlsUrl,
        thumbnailUrl,
        duration,
        resolutions: variantPlaylists.map(v => v.name),
        message: '🎉 HLS conversion complete!'
      });

    } catch (error) {
      console.error('❌ Conversion failed:', error);

      // Cleanup on error
      try {
        if (fs.existsSync(tempOutputDir)) {
          fs.rmSync(tempOutputDir, { recursive: true, force: true });
        }
        if (fs.existsSync(tempInputPath)) {
          fs.unlinkSync(tempInputPath);
        }
      } catch (cleanupError) {
        console.error('⚠️ Cleanup error:', cleanupError);
      }

      return res.status(500).json({
        success: false,
        error: error.message || 'Conversion failed'
      });
    }
  });

/**
 * Health check endpoint
 */
exports.healthCheck = functions.https.onRequest((req, res) => {
  res.json({
    status: 'healthy',
    service: 'HLS Conversion Service',
    storage: 'Digital Ocean Spaces',
    ffmpeg: ffmpegPath,
    timestamp: new Date().toISOString()
  });
});

/**
 * Scheduled Function: Clean up stories older than 24 hours
 * Runs every hour to check and delete expired stories
 * Deletes from both Firestore and Storage
 */
exports.cleanupExpiredStories = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    console.log('🧹 Starting story cleanup...');
    
    try {
      const now = admin.firestore.Timestamp.now();
      const twentyFourHoursAgo = admin.firestore.Timestamp.fromMillis(
        now.toMillis() - (24 * 60 * 60 * 1000)
      );

      // Query stories older than 24 hours
      const storiesSnapshot = await admin
        .firestore()
        .collection('stories')
        .where('createdAt', '<', twentyFourHoursAgo)
        .get();

      if (storiesSnapshot.empty) {
        console.log('✅ No expired stories found');
        return null;
      }

      console.log(`🗑️ Found ${storiesSnapshot.size} expired stories`);

      // Delete each story
      const deletePromises = storiesSnapshot.docs.map(async (doc) => {
        const storyData = doc.data();
        const batch = admin.firestore().batch();

        try {
          // Delete story document from Firestore
          batch.delete(doc.ref);

          // Delete story views subcollection
          const viewsSnapshot = await doc.ref.collection('views').get();
          viewsSnapshot.docs.forEach(viewDoc => {
            batch.delete(viewDoc.ref);
          });

          // Commit Firestore deletions
          await batch.commit();

          // Delete media from Firebase Storage
          if (storyData.mediaUrl) {
            try {
              // Extract storage path from URL
              // Format: https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile.jpg?...
              const urlParts = storyData.mediaUrl.split('/o/');
              if (urlParts.length > 1) {
                const filePath = decodeURIComponent(urlParts[1].split('?')[0]);
                await admin.storage().bucket().file(filePath).delete();
                console.log(`🗑️ Deleted storage file: ${filePath}`);
              }
            } catch (storageError) {
              console.error('Error deleting storage file:', storageError.message);
              // Continue even if storage delete fails
            }
          }

          // Delete from Digital Ocean Spaces if using DO storage
          if (storyData.mediaUrl && storyData.mediaUrl.includes('digitaloceanspaces.com')) {
            try {
              const urlObj = new URL(storyData.mediaUrl);
              const key = urlObj.pathname.substring(1); // Remove leading /
              
              await s3.deleteObject({
                Bucket: BUCKET_NAME,
                Key: key
              }).promise();
              
              console.log(`🗑️ Deleted DO Spaces file: ${key}`);
            } catch (doError) {
              console.error('Error deleting DO Spaces file:', doError.message);
              // Continue even if DO delete fails
            }
          }

          console.log(`✅ Deleted story ${doc.id}`);
        } catch (error) {
          console.error(`❌ Error deleting story ${doc.id}:`, error.message);
        }
      });

      await Promise.all(deletePromises);
      console.log(`✅ Cleanup complete! Deleted ${storiesSnapshot.size} stories`);
      
      return null;
    } catch (error) {
      console.error('❌ Story cleanup failed:', error);
      return null;
    }
  });

/**
 * HTTP Endpoint: Manual story cleanup trigger (for testing)
 * GET /cleanupStories
 */
exports.manualCleanupStories = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  console.log('🧹 Manual story cleanup triggered...');
  
  try {
    const now = admin.firestore.Timestamp.now();
    const twentyFourHoursAgo = admin.firestore.Timestamp.fromMillis(
      now.toMillis() - (24 * 60 * 60 * 1000)
    );

    const storiesSnapshot = await admin
      .firestore()
      .collection('stories')
      .where('createdAt', '<', twentyFourHoursAgo)
      .get();

    if (storiesSnapshot.empty) {
      return res.json({
        success: true,
        message: 'No expired stories found',
        deleted: 0
      });
    }

    const deletePromises = storiesSnapshot.docs.map(async (doc) => {
      const storyData = doc.data();
      const batch = admin.firestore().batch();

      try {
        batch.delete(doc.ref);
        const viewsSnapshot = await doc.ref.collection('views').get();
        viewsSnapshot.docs.forEach(viewDoc => batch.delete(viewDoc.ref));
        await batch.commit();

        if (storyData.mediaUrl) {
          try {
            const urlParts = storyData.mediaUrl.split('/o/');
            if (urlParts.length > 1) {
              const filePath = decodeURIComponent(urlParts[1].split('?')[0]);
              await admin.storage().bucket().file(filePath).delete();
            }
          } catch (e) {
            console.error('Storage delete error:', e.message);
          }

          if (storyData.mediaUrl.includes('digitaloceanspaces.com')) {
            try {
              const urlObj = new URL(storyData.mediaUrl);
              const key = urlObj.pathname.substring(1);
              await s3.deleteObject({ Bucket: BUCKET_NAME, Key: key }).promise();
            } catch (e) {
              console.error('DO Spaces delete error:', e.message);
            }
          }
        }
      } catch (error) {
        console.error(`Error deleting story ${doc.id}:`, error.message);
      }
    });

    await Promise.all(deletePromises);

    return res.json({
      success: true,
      message: `Deleted ${storiesSnapshot.size} expired stories`,
      deleted: storiesSnapshot.size
    });
  } catch (error) {
    console.error('Manual cleanup failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
