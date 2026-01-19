import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { nanoid } from 'nanoid';
import pool from '../db.js';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${nanoid(8)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});



const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, MOV, and WebM are allowed.'));
    }
  }
});

// Create new campaign
router.post('/', upload.fields([
  { name: 'introVideo', maxCount: 1 },
  { name: 'secondaryVideo', maxCount: 1 }
]), async (req, res) => {
  try {
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
      display_tab
    } = req.body;

    const introVideoPath = req.files?.introVideo?.[0]?.path || null;
    const secondaryVideoPath = req.files?.secondaryVideo?.[0]?.path || null;

    const result = await pool.query(`
      INSERT INTO campaigns (
        name, intro_video_path, secondary_video_path,
        video_style, video_position, video_shape,
        video_title, video_description, calendar_url,
        button_text, button_link, text_color, bg_color,
        text_hover_color, bg_hover_color, dark_mode,
        display_delay, scroll_behavior, mouse_display, display_tab
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
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
      display_tab === 'true' || display_tab === true
    ]);

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

// Delete campaign
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM campaigns WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
