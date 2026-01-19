import { Router } from 'express';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import VideoProcessor from '../services/videoProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Queue for processing videos
let processingQueue = [];
let isProcessing = false;

// Start video generation for campaign
router.post('/generate/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { leadIds } = req.body; // Optional: specific leads to process

    // Get campaign details
    const campaignResult = await pool.query(
      'SELECT * FROM campaigns WHERE id = $1',
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const campaign = campaignResult.rows[0];

    if (!campaign.intro_video_path) {
      return res.status(400).json({ success: false, error: 'No intro video uploaded for this campaign' });
    }

    // Get leads to process
    let leadsQuery = 'SELECT * FROM leads WHERE campaign_id = $1';
    const queryParams = [campaignId];

    if (leadIds && leadIds.length > 0) {
      leadsQuery += ' AND id = ANY($2)';
      queryParams.push(leadIds);
    }

    const leadsResult = await pool.query(leadsQuery, queryParams);
    const leads = leadsResult.rows;

    if (leads.length === 0) {
      return res.status(400).json({ success: false, error: 'No leads found for this campaign' });
    }

    // Add leads to processing queue
    const jobs = leads.map(lead => ({
      leadId: lead.id,
      campaignId,
      campaign,
      lead
    }));

    processingQueue.push(...jobs);

    // Start processing if not already running
    if (!isProcessing) {
      processQueue();
    }

    res.json({
      success: true,
      message: `Started processing ${leads.length} videos`,
      queueSize: processingQueue.length
    });
  } catch (error) {
    console.error('Generate videos error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process the video queue
async function processQueue() {
  if (processingQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const processor = new VideoProcessor();
  
  try {
    await processor.init();

    while (processingQueue.length > 0) {
      const job = processingQueue.shift();
      await processVideoJob(processor, job);
    }
  } catch (error) {
    console.error('Queue processing error:', error);
  } finally {
    await processor.close();
    isProcessing = false;
  }
}

// Process a single video job
async function processVideoJob(processor, job) {
  const { leadId, campaignId, campaign, lead } = job;
  const uniqueSlug = nanoid(11);
  const outputDir = path.join(__dirname, '../../public/videos');

  try {
    // Create pending video record
    await pool.query(`
      INSERT INTO generated_videos (lead_id, campaign_id, unique_slug, status)
      VALUES ($1, $2, $3, 'processing')
      ON CONFLICT (lead_id) DO UPDATE SET status = 'processing', updated_at = CURRENT_TIMESTAMP
    `, [leadId, campaignId, uniqueSlug]);

    console.log(`🎬 Processing video for lead ${leadId}: ${lead.website_url}`);

    // Generate the video
    const result = await processor.generateVSL({
      leadId,
      websiteUrl: lead.website_url,
      introVideoPath: campaign.intro_video_path,
      secondaryVideoPath: campaign.secondary_video_path,
      outputDir,
      settings: {
        video_style: campaign.video_style,
        video_position: campaign.video_position,
        video_shape: campaign.video_shape,
        display_delay: campaign.display_delay
      }
    });

    if (result.success) {
      // Update record with success
      await pool.query(`
        UPDATE generated_videos 
        SET status = 'completed',
            video_path = $1,
            preview_path = $2,
            thumbnail_path = $3,
            background_path = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE lead_id = $5
      `, [result.videoPath, result.previewPath, result.thumbnailPath, result.backgroundPath, leadId]);

      console.log(`✅ Video completed for lead ${leadId}`);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error(`❌ Video failed for lead ${leadId}:`, error);
    
    await pool.query(`
      UPDATE generated_videos 
      SET status = 'failed',
          error_message = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE lead_id = $2
    `, [error.message, leadId]);
  }
}

// Get processing status
router.get('/status/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) as total
      FROM generated_videos
      WHERE campaign_id = $1
    `, [campaignId]);

    const queuePosition = processingQueue.filter(j => j.campaignId === campaignId).length;

    res.json({
      success: true,
      status: result.rows[0],
      queuePosition,
      isProcessing
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve video file
router.get('/file/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      'SELECT video_path FROM generated_videos WHERE unique_slug = $1',
      [slug]
    );

    if (result.rows.length === 0 || !result.rows[0].video_path) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    res.sendFile(result.rows[0].video_path);
  } catch (error) {
    console.error('Serve video error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve preview file
router.get('/preview/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      'SELECT preview_path FROM generated_videos WHERE unique_slug = $1',
      [slug]
    );

    if (result.rows.length === 0 || !result.rows[0].preview_path) {
      return res.status(404).json({ success: false, error: 'Preview not found' });
    }

    res.sendFile(result.rows[0].preview_path);
  } catch (error) {
    console.error('Serve preview error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve thumbnail
router.get('/thumbnail/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      'SELECT thumbnail_path FROM generated_videos WHERE unique_slug = $1',
      [slug]
    );

    if (result.rows.length === 0 || !result.rows[0].thumbnail_path) {
      return res.status(404).json({ success: false, error: 'Thumbnail not found' });
    }

    res.sendFile(result.rows[0].thumbnail_path);
  } catch (error) {
    console.error('Serve thumbnail error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get landing page data
router.get('/landing/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(`
      SELECT 
        gv.*,
        l.first_name,
        l.last_name,
        l.company_name,
        l.website_url,
        c.video_title,
        c.video_description,
        c.calendar_url,
        c.button_text,
        c.button_link,
        c.text_color,
        c.bg_color,
        c.text_hover_color,
        c.bg_hover_color,
        c.dark_mode,
        c.display_tab
      FROM generated_videos gv
      JOIN leads l ON gv.lead_id = l.id
      JOIN campaigns c ON gv.campaign_id = c.id
      WHERE gv.unique_slug = $1
    `, [slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Video not found' });
    }

    // Increment view count
    await pool.query(
      'UPDATE generated_videos SET views = views + 1 WHERE unique_slug = $1',
      [slug]
    );

    // Log analytics
    await pool.query(`
      INSERT INTO video_analytics (video_id, event_type, ip_address, user_agent, referrer)
      SELECT id, 'view', $2, $3, $4 FROM generated_videos WHERE unique_slug = $1
    `, [slug, req.ip, req.get('user-agent'), req.get('referrer')]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get landing data error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
