import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { nanoid } from 'nanoid';
import pool from '../db.js';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { STORAGE_PATHS, getStorageStats } from '../services/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Use persistent storage path for uploads
const uploadDir = STORAGE_PATHS.uploads;
console.log('📁 Upload directory (persistent):', uploadDir);

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${nanoid(8)}${path.extname(file.originalname)}`;
    console.log('📤 Saving file as:', uniqueName);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB limit
    fieldSize: 100 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    console.log('📥 Receiving file:', file.originalname, file.mimetype);
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only MP4, MOV, and WebM are allowed.`));
    }
  }
});

// Error handling middleware for multer
const handleUpload = (req, res, next) => {
  upload.fields([
    { name: 'introVideo', maxCount: 1 },
    { name: 'secondaryVideo', maxCount: 1 }
  ])(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'File too large. Maximum size is 100MB.' });
      }
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    } else if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
};

// Debug endpoint - list all campaigns with paths
router.get('/debug', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, intro_video_path, secondary_video_path, created_at 
      FROM campaigns 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    // List files in upload directory
    let uploadFiles = [];
    try {
      uploadFiles = await fs.readdir(uploadDir);
    } catch (e) {
      uploadFiles = ['Error reading directory: ' + e.message];
    }
    
    // Check if files exist for each campaign
    const campaignsWithFileStatus = await Promise.all(
      result.rows.map(async (campaign) => {
        let introExists = false;
        let secondaryExists = false;
        
        if (campaign.intro_video_path) {
          try {
            await fs.access(campaign.intro_video_path);
            introExists = true;
          } catch {}
        }
        
        if (campaign.secondary_video_path) {
          try {
            await fs.access(campaign.secondary_video_path);
            secondaryExists = true;
          } catch {}
        }
        
        return {
          ...campaign,
          intro_file_exists: introExists,
          secondary_file_exists: secondaryExists
        };
      })
    );
    
    // Get storage stats
    const storageStats = await getStorageStats();
    
    res.json({ 
      success: true, 
      campaigns: campaignsWithFileStatus,
      uploadDir,
      uploadFiles,
      storage: storageStats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test upload endpoint
router.post('/test-upload', handleUpload, async (req, res) => {
  try {
    console.log('🧪 Test upload received');
    console.log('Files:', req.files);
    
    const introVideo = req.files?.introVideo?.[0];
    
    if (introVideo) {
      // Verify file exists
      await fs.access(introVideo.path);
      res.json({
        success: true,
        message: 'File uploaded successfully',
        file: {
          originalName: introVideo.originalname,
          filename: introVideo.filename,
          path: introVideo.path,
          size: introVideo.size,
          mimetype: introVideo.mimetype
        }
      });
    } else {
      res.json({
        success: false,
        message: 'No file received',
        body: Object.keys(req.body)
      });
    }
  } catch (error) {
    console.error('Test upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new campaign
router.post('/', handleUpload, async (req, res) => {
  try {
    console.log('📝 Creating new campaign...');
    console.log('📁 Request files:', JSON.stringify(req.files, null, 2));
    console.log('📋 Request body keys:', Object.keys(req.body));
    
    const {
      name,
      video_style,
      video_position,
      video_shape,
      video_title,
      video_description,
      calendar_url,
      button_text,
      button_link,
      text_color,
      bg_color,
      text_hover_color,
      bg_hover_color,
      dark_mode,
      display_delay,
      scroll_behavior,
      mouse_display,
      display_tab,
      show_cta_button
    } = req.body;

    const introVideoPath = req.files?.introVideo?.[0]?.path || null;
    const secondaryVideoPath = req.files?.secondaryVideo?.[0]?.path || null;

    console.log('🎬 Intro video path:', introVideoPath);
    console.log('🎬 Secondary video path:', secondaryVideoPath);

    if (!introVideoPath) {
      console.log('⚠️ No intro video uploaded');
    }

    const result = await pool.query(`
      INSERT INTO campaigns (
        name, intro_video_path, secondary_video_path,
        video_style, video_position, video_shape,
        video_title, video_description, calendar_url,
        button_text, button_link, text_color, bg_color,
        text_hover_color, bg_hover_color, dark_mode,
        display_delay, scroll_behavior, mouse_display, display_tab,
        show_cta_button
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `, [
      name || 'Untitled Campaign',
      introVideoPath,
      secondaryVideoPath,
      video_style || 'small_bubble',
      video_position || 'bottom_left',
      video_shape || 'circle',
      video_title || 'A video for you 👋',
      video_description || '',
      calendar_url || '',
      button_text || '',
      button_link || '',
      text_color || '#ffffff',
      bg_color || '#6366f1',
      text_hover_color || '#ffffff',
      bg_hover_color || '#4f46e5',
      dark_mode === 'true' || dark_mode === true,
      parseInt(display_delay) || 10,
      scroll_behavior || 'stay_down',
      mouse_display || 'moving',
      display_tab === 'true' || display_tab === true,
      show_cta_button === 'true' || show_cta_button === true
    ]);

    console.log('✅ Campaign created:', result.rows[0].id);

    res.status(201).json({
      success: true,
      campaign: result.rows[0]
    });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all campaigns
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, 
        COUNT(DISTINCT l.id) as lead_count,
        COUNT(DISTINCT gv.id) as video_count
      FROM campaigns c
      LEFT JOIN leads l ON c.id = l.campaign_id
      LEFT JOIN generated_videos gv ON c.id = gv.campaign_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    res.json({ success: true, campaigns: result.rows });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single campaign with details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const campaignResult = await pool.query(
      'SELECT * FROM campaigns WHERE id = $1',
      [id]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const leadsResult = await pool.query(`
      SELECT l.*, gv.unique_slug, gv.status, gv.video_path, gv.preview_path, gv.views
      FROM leads l
      LEFT JOIN generated_videos gv ON l.id = gv.lead_id
      WHERE l.campaign_id = $1
      ORDER BY l.created_at DESC
    `, [id]);

    res.json({
      success: true,
      campaign: campaignResult.rows[0],
      leads: leadsResult.rows
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update campaign settings
router.put('/:id', upload.fields([
  { name: 'introVideo', maxCount: 1 },
  { name: 'secondaryVideo', maxCount: 1 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (req.files?.introVideo?.[0]) {
      updates.intro_video_path = req.files.introVideo[0].path;
    }
    if (req.files?.secondaryVideo?.[0]) {
      updates.secondary_video_path = req.files.secondaryVideo[0].path;
    }

    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');

    const result = await pool.query(
      `UPDATE campaigns SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, id]
    );

    res.json({ success: true, campaign: result.rows[0] });
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete campaign and all associated files
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get campaign to find intro/secondary video paths
    const campaignResult = await pool.query(
      'SELECT intro_video_path, secondary_video_path FROM campaigns WHERE id = $1',
      [id]
    );
    
    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    
    const campaign = campaignResult.rows[0];
    
    // Get all generated videos for this campaign to delete their files
    const videosResult = await pool.query(
      'SELECT video_path, preview_path, thumbnail_path, background_path FROM generated_videos WHERE campaign_id = $1',
      [id]
    );
    
    // Delete all generated video files
    let deletedFiles = [];
    for (const video of videosResult.rows) {
      if (video.video_path) {
        try { await fs.unlink(video.video_path); deletedFiles.push('video'); } catch {}
      }
      if (video.preview_path) {
        try { await fs.unlink(video.preview_path); deletedFiles.push('preview'); } catch {}
      }
      if (video.thumbnail_path) {
        try { await fs.unlink(video.thumbnail_path); deletedFiles.push('thumbnail'); } catch {}
      }
      if (video.background_path) {
        try { await fs.unlink(video.background_path); deletedFiles.push('background'); } catch {}
      }
    }
    
    // Delete campaign's uploaded intro/secondary videos
    if (campaign.intro_video_path) {
      try { await fs.unlink(campaign.intro_video_path); deletedFiles.push('intro'); } catch {}
    }
    if (campaign.secondary_video_path) {
      try { await fs.unlink(campaign.secondary_video_path); deletedFiles.push('secondary'); } catch {}
    }
    
    // Delete from database (cascades to leads and generated_videos)
    await pool.query('DELETE FROM campaigns WHERE id = $1', [id]);
    
    console.log(`🗑️ Deleted campaign ${id} and ${deletedFiles.length} files`);
    
    res.json({ success: true, deletedFiles: deletedFiles.length });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;



