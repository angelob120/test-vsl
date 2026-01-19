import { Router } from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Parser } from 'json2csv';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import pool from '../db.js';

const router = Router();

// Configure multer for CSV uploads
const csvUpload = multer({
  dest: '/tmp/csv-uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Import leads from CSV
router.post('/import/:campaignId', csvUpload.single('file'), async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { columnMapping } = req.body;
    
    // Parse column mapping from JSON string
    const mapping = typeof columnMapping === 'string' 
      ? JSON.parse(columnMapping) 
      : columnMapping;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No CSV file provided' });
    }

    // Verify campaign exists
    const campaignCheck = await pool.query(
      'SELECT id FROM campaigns WHERE id = $1',
      [campaignId]
    );

    if (campaignCheck.rows.length === 0) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const leads = [];
    const errors = [];

    // Parse CSV file
    await new Promise((resolve, reject) => {
      createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => {
          try {
            const lead = {
              website_url: row[mapping.website_url] || row['Website Link'] || row['Website'] || row['URL'],
              first_name: row[mapping.first_name] || row['First Name'] || row['FirstName'] || '',
              last_name: row[mapping.last_name] || row['Last Name'] || row['LastName'] || '',
              company_name: row[mapping.company_name] || row['Company Name'] || row['Company'] || '',
              email: row[mapping.email] || row['Email'] || '',
              phone: row[mapping.phone] || row['Phone'] || ''
            };

            if (lead.website_url) {
              leads.push(lead);
            } else {
              errors.push({ row, error: 'Missing website URL' });
            }
          } catch (err) {
            errors.push({ row, error: err.message });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Insert leads into database
    const insertedLeads = [];
    for (const lead of leads) {
      try {
        const result = await pool.query(`
          INSERT INTO leads (campaign_id, website_url, first_name, last_name, company_name, email, phone)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [campaignId, lead.website_url, lead.first_name, lead.last_name, lead.company_name, lead.email, lead.phone]);
        
        insertedLeads.push(result.rows[0]);
      } catch (err) {
        errors.push({ lead, error: err.message });
      }
    }

    // Clean up uploaded file
    await fs.unlink(req.file.path).catch(() => {});

    res.json({
      success: true,
      imported: insertedLeads.length,
      errors: errors.length,
      leads: insertedLeads,
      errorDetails: errors.slice(0, 10) // Return first 10 errors
    });
  } catch (error) {
    console.error('Import leads error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get leads for campaign
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const result = await pool.query(`
      SELECT l.*, 
        gv.unique_slug, 
        gv.status, 
        gv.video_path, 
        gv.preview_path,
        gv.thumbnail_path,
        gv.views,
        gv.created_at as video_created_at
      FROM leads l
      LEFT JOIN generated_videos gv ON l.id = gv.lead_id
      WHERE l.campaign_id = $1
      ORDER BY l.created_at DESC
    `, [campaignId]);

    res.json({ success: true, leads: result.rows });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add single lead
router.post('/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { website_url, first_name, last_name, company_name, email, phone } = req.body;

    if (!website_url) {
      return res.status(400).json({ success: false, error: 'Website URL is required' });
    }

    const result = await pool.query(`
      INSERT INTO leads (campaign_id, website_url, first_name, last_name, company_name, email, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [campaignId, website_url, first_name || '', last_name || '', company_name || '', email || '', phone || '']);

    res.status(201).json({ success: true, lead: result.rows[0] });
  } catch (error) {
    console.error('Add lead error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update lead
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { website_url, first_name, last_name, company_name, email, phone } = req.body;

    const result = await pool.query(`
      UPDATE leads 
      SET website_url = COALESCE($1, website_url),
          first_name = COALESCE($2, first_name),
          last_name = COALESCE($3, last_name),
          company_name = COALESCE($4, company_name),
          email = COALESCE($5, email),
          phone = COALESCE($6, phone)
      WHERE id = $7
      RETURNING *
    `, [website_url, first_name, last_name, company_name, email, phone, id]);

    res.json({ success: true, lead: result.rows[0] });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete lead
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM leads WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export leads with video links as CSV
router.get('/export/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const appUrl = process.env.APP_URL || 'https://ai-vsl-production.up.railway.app';

    const result = await pool.query(`
      SELECT 
        l.id,
        CASE WHEN gv.status = 'completed' THEN 'YES' ELSE 'NO' END as "VideoSuccess",
        l.website_url as "OriginUrls",
        l.first_name as "FirstName",
        COALESCE(l.last_name, l.company_name) as "LastName",
        CASE WHEN gv.unique_slug IS NOT NULL 
          THEN CONCAT($1, '/v/', gv.unique_slug)
          ELSE '' END as "VideoLink",
        CASE WHEN gv.unique_slug IS NOT NULL 
          THEN CONCAT('<a href="', $1, '/v/', gv.unique_slug, '"><img src="', $1, '/api/videos/thumbnail/', gv.unique_slug, '" width="460" height="250" /></a>')
          ELSE '' END as "VideoHtmlEmail",
        CASE WHEN gv.preview_path IS NOT NULL 
          THEN CONCAT($1, '/api/videos/preview/', gv.unique_slug)
          ELSE '' END as "VideoPreview",
        CASE WHEN gv.thumbnail_path IS NOT NULL 
          THEN CONCAT($1, '/api/videos/thumbnail/', gv.unique_slug)
          ELSE '' END as "BackgroundImageLink",
        l.email as "Email",
        l.phone as "Phone"
      FROM leads l
      LEFT JOIN generated_videos gv ON l.id = gv.lead_id
      WHERE l.campaign_id = $2
      ORDER BY l.created_at
    `, [appUrl, campaignId]);

    const parser = new Parser();
    const csvData = parser.parse(result.rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=campaign-${campaignId}-export.csv`);
    res.send(csvData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
