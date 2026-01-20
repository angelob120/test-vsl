import pool from '../db.js';
import { deleteVideoFiles, RETENTION_DAYS, MAX_STORAGE_MB, getStorageStats } from './storage.js';

/**
 * Cleanup service for auto-deleting expired videos
 * 
 * Videos are automatically deleted after RETENTION_DAYS (default: 30 days)
 * Also deletes oldest videos when storage limit is exceeded
 * Runs every hour to check for and delete expired content
 */

// Cleanup interval in milliseconds (1 hour)
const CLEANUP_INTERVAL = 60 * 60 * 1000;

let cleanupTimer = null;

/**
 * Delete expired videos from database and filesystem
 * Also deletes associated leads
 */
export async function cleanupExpiredVideos() {
  console.log('🧹 Running cleanup for expired videos...');
  
  try {
    // Find all expired videos
    const expiredResult = await pool.query(`
      SELECT id, lead_id, video_path, preview_path, thumbnail_path, background_path, unique_slug, created_at, expires_at
      FROM generated_videos
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
    `);

    const expiredVideos = expiredResult.rows;
    
    if (expiredVideos.length === 0) {
      console.log('   ✓ No expired videos found');
      return { deleted: 0 };
    }

    console.log(`   Found ${expiredVideos.length} expired videos to delete`);

    let deletedCount = 0;
    let errorCount = 0;

    for (const video of expiredVideos) {
      try {
        // Delete files from filesystem
        const deletedFiles = await deleteVideoFiles(video);
        
        // Delete from database (this will cascade delete the video due to foreign key)
        // First delete the video, then the lead
        await pool.query('DELETE FROM generated_videos WHERE id = $1', [video.id]);
        
        // Also delete the associated lead
        if (video.lead_id) {
          await pool.query('DELETE FROM leads WHERE id = $1', [video.lead_id]);
        }
        
        deletedCount++;
        console.log(`   ✓ Deleted video ${video.unique_slug} and lead (files: ${deletedFiles.join(', ') || 'none'})`);
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Failed to delete video ${video.id}:`, error.message);
      }
    }

    console.log(`🧹 Cleanup complete: ${deletedCount} deleted, ${errorCount} errors`);
    
    return { deleted: deletedCount, errors: errorCount };
  } catch (error) {
    console.error('🧹 Cleanup error:', error.message);
    return { deleted: 0, errors: 1, message: error.message };
  }
}

/**
 * Clean up old videos that don't have expires_at set
 * (Migration for videos created before the expires_at column was added)
 * Also deletes associated leads
 */
export async function cleanupLegacyVideos() {
  console.log('🧹 Checking for legacy videos without expiration date...');
  
  try {
    // Find videos without expires_at that are older than retention period
    const legacyResult = await pool.query(`
      SELECT id, lead_id, video_path, preview_path, thumbnail_path, background_path, unique_slug, created_at
      FROM generated_videos
      WHERE expires_at IS NULL 
        AND created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'
    `);

    const legacyVideos = legacyResult.rows;
    
    if (legacyVideos.length === 0) {
      console.log('   ✓ No legacy expired videos found');
      return { deleted: 0 };
    }

    console.log(`   Found ${legacyVideos.length} legacy videos to delete`);

    let deletedCount = 0;

    for (const video of legacyVideos) {
      try {
        await deleteVideoFiles(video);
        await pool.query('DELETE FROM generated_videos WHERE id = $1', [video.id]);
        
        // Also delete the associated lead
        if (video.lead_id) {
          await pool.query('DELETE FROM leads WHERE id = $1', [video.lead_id]);
        }
        
        deletedCount++;
      } catch (error) {
        console.error(`   ❌ Failed to delete legacy video ${video.id}:`, error.message);
      }
    }

    return { deleted: deletedCount };
  } catch (error) {
    console.error('🧹 Legacy cleanup error:', error.message);
    return { deleted: 0, message: error.message };
  }
}

/**
 * Clean up oldest videos when storage limit is exceeded
 * Deletes oldest videos and their associated leads until storage is under limit
 */
export async function cleanupStorageLimit() {
  console.log(`🧹 Checking storage limit (max: ${MAX_STORAGE_MB}MB)...`);
  
  try {
    // Get current storage usage
    const stats = await getStorageStats();
    const totalStorageMB = (stats.videos?.totalSizeMB || 0) + 
                           (stats.previews?.totalSizeMB || 0) + 
                           (stats.thumbnails?.totalSizeMB || 0);
    
    console.log(`   Current storage: ${totalStorageMB.toFixed(2)}MB / ${MAX_STORAGE_MB}MB`);
    
    if (totalStorageMB <= MAX_STORAGE_MB) {
      console.log('   ✓ Storage is within limit');
      return { deleted: 0, freedMB: 0 };
    }
    
    // Need to free up space - delete oldest videos first
    const excessMB = totalStorageMB - MAX_STORAGE_MB;
    console.log(`   ⚠️ Storage exceeded by ${excessMB.toFixed(2)}MB - cleaning up oldest videos...`);
    
    // Get oldest videos ordered by creation date
    const oldestVideos = await pool.query(`
      SELECT id, lead_id, video_path, preview_path, thumbnail_path, background_path, unique_slug, created_at
      FROM generated_videos
      WHERE status = 'completed'
      ORDER BY created_at ASC
      LIMIT 50
    `);
    
    let deletedCount = 0;
    let freedBytes = 0;
    const targetFreeBytes = excessMB * 1024 * 1024 * 1.2; // Free 20% more than needed
    
    for (const video of oldestVideos.rows) {
      if (freedBytes >= targetFreeBytes) {
        break;
      }
      
      try {
        // Estimate size of this video's files
        const deletedFiles = await deleteVideoFiles(video);
        
        // Assume average of ~5MB per video set (conservative estimate)
        freedBytes += 5 * 1024 * 1024;
        
        // Delete from database
        await pool.query('DELETE FROM generated_videos WHERE id = $1', [video.id]);
        
        // Also delete the associated lead
        if (video.lead_id) {
          await pool.query('DELETE FROM leads WHERE id = $1', [video.lead_id]);
        }
        
        deletedCount++;
        console.log(`   ✓ Deleted oldest video ${video.unique_slug} and lead`);
      } catch (error) {
        console.error(`   ❌ Failed to delete video ${video.id}:`, error.message);
      }
    }
    
    const freedMB = freedBytes / 1024 / 1024;
    console.log(`🧹 Storage cleanup complete: ${deletedCount} videos deleted, ~${freedMB.toFixed(2)}MB freed`);
    
    return { deleted: deletedCount, freedMB };
  } catch (error) {
    console.error('🧹 Storage limit cleanup error:', error.message);
    return { deleted: 0, freedMB: 0, message: error.message };
  }
}

/**
 * Set expiration date for videos that don't have one
 */
export async function setMissingExpirations() {
  try {
    const result = await pool.query(`
      UPDATE generated_videos 
      SET expires_at = created_at + INTERVAL '${RETENTION_DAYS} days'
      WHERE expires_at IS NULL
      RETURNING id
    `);
    
    if (result.rowCount > 0) {
      console.log(`   ✓ Set expiration for ${result.rowCount} existing videos`);
    }
    
    return result.rowCount;
  } catch (error) {
    // Column might not exist yet, that's ok
    if (!error.message.includes('does not exist')) {
      console.error('Error setting expirations:', error.message);
    }
    return 0;
  }
}

/**
 * Start the cleanup scheduler
 */
export function startCleanupScheduler() {
  console.log(`📅 Starting cleanup scheduler (every ${CLEANUP_INTERVAL / 1000 / 60} minutes)`);
  console.log(`   Video retention: ${RETENTION_DAYS} days`);
  console.log(`   Max storage: ${MAX_STORAGE_MB}MB`);
  
  // Run immediately on startup
  setTimeout(async () => {
    await setMissingExpirations();
    await cleanupExpiredVideos();
    await cleanupLegacyVideos();
    await cleanupStorageLimit();
  }, 5000); // Wait 5 seconds after startup
  
  // Then run periodically
  cleanupTimer = setInterval(async () => {
    await cleanupExpiredVideos();
    await cleanupStorageLimit();
  }, CLEANUP_INTERVAL);
  
  return cleanupTimer;
}

/**
 * Stop the cleanup scheduler
 */
export function stopCleanupScheduler() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    console.log('📅 Cleanup scheduler stopped');
  }
}

/**
 * Get cleanup stats
 */
export async function getCleanupStats() {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at < NOW()) as expired_count,
        COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at >= NOW()) as active_count,
        COUNT(*) FILTER (WHERE expires_at IS NULL) as no_expiry_count,
        MIN(expires_at) FILTER (WHERE expires_at >= NOW()) as next_expiry,
        COUNT(*) as total_count
      FROM generated_videos
    `);
    
    return stats.rows[0];
  } catch (error) {
    return { error: error.message };
  }
}

export default {
  cleanupExpiredVideos,
  cleanupLegacyVideos,
  cleanupStorageLimit,
  setMissingExpirations,
  startCleanupScheduler,
  stopCleanupScheduler,
  getCleanupStats,
};
