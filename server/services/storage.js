import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';

/**
 * Storage utility for Railway Volume support
 * 
 * Railway Volumes persist data across container restarts.
 * Mount a volume at /data in your Railway service settings.
 * 
 * Setup in Railway:
 * 1. Go to your service settings
 * 2. Click "Add Volume"
 * 3. Set mount path to: /data
 * 4. Set size as needed (start with 5GB)
 */

// Base path for persistent storage (Railway Volume mount point)
const VOLUME_PATH = process.env.VOLUME_PATH || '/data';

// Fallback to local storage in development
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const BASE_PATH = IS_PRODUCTION ? VOLUME_PATH : path.join(process.cwd(), 'public');

// Storage directories
export const STORAGE_PATHS = {
  uploads: path.join(BASE_PATH, 'uploads'),      // Uploaded intro/secondary videos
  videos: path.join(BASE_PATH, 'videos'),        // Generated VSL videos
  previews: path.join(BASE_PATH, 'videos', 'previews'),  // Video previews
  thumbnails: path.join(BASE_PATH, 'videos', 'thumbnails'), // Video thumbnails
  temp: path.join(BASE_PATH, 'temp'),            // Temporary processing files
};

// Retention period in days (default: 30 days)
export const RETENTION_DAYS = parseInt(process.env.VIDEO_RETENTION_DAYS) || 30;

// Maximum storage limit in MB (default: 5GB = 5120MB to match Railway volume)
export const MAX_STORAGE_MB = parseInt(process.env.MAX_STORAGE_MB) || 5120;

/**
 * Initialize all storage directories
 */
export async function initStorage() {
  console.log('📂 Initializing storage...');
  console.log(`   Volume path: ${VOLUME_PATH}`);
  console.log(`   Base path: ${BASE_PATH}`);
  console.log(`   Production: ${IS_PRODUCTION}`);
  console.log(`   Retention: ${RETENTION_DAYS} days`);

  // Create all directories
  for (const [name, dirPath] of Object.entries(STORAGE_PATHS)) {
    try {
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
        console.log(`   ✅ Created ${name}: ${dirPath}`);
      } else {
        console.log(`   ✓ Exists ${name}: ${dirPath}`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to create ${name}: ${error.message}`);
      throw error;
    }
  }

  // Check if volume is properly mounted in production
  if (IS_PRODUCTION) {
    try {
      const testFile = path.join(BASE_PATH, '.volume-test');
      await fs.writeFile(testFile, new Date().toISOString());
      await fs.unlink(testFile);
      console.log('   ✅ Volume write test passed');
    } catch (error) {
      console.error('   ⚠️ Volume write test failed! Make sure Railway Volume is mounted at /data');
      console.error(`   Error: ${error.message}`);
    }
  }

  return STORAGE_PATHS;
}

/**
 * Get the upload path for a file
 */
export function getUploadPath(filename) {
  return path.join(STORAGE_PATHS.uploads, filename);
}

/**
 * Get the video output path for a lead
 */
export function getVideoPath(leadId) {
  return path.join(STORAGE_PATHS.videos, `${leadId}.mp4`);
}

/**
 * Get the preview path for a lead (GIF format for text message sharing)
 */
export function getPreviewPath(leadId) {
  return path.join(STORAGE_PATHS.previews, `${leadId}_preview.gif`);
}

/**
 * Get the thumbnail path for a lead
 */
export function getThumbnailPath(leadId) {
  return path.join(STORAGE_PATHS.thumbnails, `${leadId}.jpg`);
}

/**
 * Get temp directory for a lead
 */
export function getTempPath(leadId) {
  return path.join(STORAGE_PATHS.temp, leadId);
}

/**
 * Calculate expiration date (60 days from now)
 */
export function getExpirationDate() {
  const date = new Date();
  date.setDate(date.getDate() + RETENTION_DAYS);
  return date;
}

/**
 * Delete a file if it exists
 */
export async function deleteFile(filePath) {
  if (!filePath) return false;
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Failed to delete ${filePath}:`, error.message);
    }
    return false;
  }
}

/**
 * Delete all files associated with a video
 */
export async function deleteVideoFiles(videoRecord) {
  const deleted = [];
  
  if (videoRecord.video_path) {
    if (await deleteFile(videoRecord.video_path)) deleted.push('video');
  }
  if (videoRecord.preview_path) {
    if (await deleteFile(videoRecord.preview_path)) deleted.push('preview');
  }
  if (videoRecord.thumbnail_path) {
    if (await deleteFile(videoRecord.thumbnail_path)) deleted.push('thumbnail');
  }
  if (videoRecord.background_path) {
    if (await deleteFile(videoRecord.background_path)) deleted.push('background');
  }
  
  return deleted;
}

/**
 * Get storage statistics
 */
export async function getStorageStats() {
  const stats = {};
  
  for (const [name, dirPath] of Object.entries(STORAGE_PATHS)) {
    try {
      const files = await fs.readdir(dirPath);
      let totalSize = 0;
      
      for (const file of files) {
        try {
          const fileStat = await fs.stat(path.join(dirPath, file));
          if (fileStat.isFile()) {
            totalSize += fileStat.size;
          }
        } catch {}
      }
      
      stats[name] = {
        fileCount: files.length,
        totalSize,
        totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100
      };
    } catch {
      stats[name] = { error: 'Cannot read directory' };
    }
  }
  
  return stats;
}

export default {
  STORAGE_PATHS,
  RETENTION_DAYS,
  MAX_STORAGE_MB,
  initStorage,
  getUploadPath,
  getVideoPath,
  getPreviewPath,
  getThumbnailPath,
  getTempPath,
  getExpirationDate,
  deleteFile,
  deleteVideoFiles,
  getStorageStats,
};
