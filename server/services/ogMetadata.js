import pool from '../db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fetch video metadata for OG tags
 */
export async function getVideoMetadata(slug) {
  try {
    const result = await pool.query(`
      SELECT 
        gv.*,
        l.first_name,
        l.last_name,
        l.company_name,
        l.website_url,
        c.video_title,
        c.video_description,
        c.name as campaign_name
      FROM generated_videos gv
      JOIN leads l ON gv.lead_id = l.id
      JOIN campaigns c ON gv.campaign_id = c.id
      WHERE gv.unique_slug = $1 AND gv.status = 'completed'
    `, [slug]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error fetching video metadata:', error);
    return null;
  }
}

/**
 * Generate personalized text by replacing tokens
 */
function personalize(text, data) {
  if (!text || !data) return text || '';
  return text
    .replace(/@FirstName/gi, data.first_name || '')
    .replace(/@CompanyName/gi, data.company_name || data.last_name || '')
    .replace(/@LastName/gi, data.last_name || '');
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate HTML with Open Graph meta tags for video sharing
 */
export async function generateOGHtml(slug, baseUrl, indexHtmlPath) {
  const metadata = await getVideoMetadata(slug);
  
  // Read the original index.html
  let indexHtml;
  try {
    indexHtml = await fs.readFile(indexHtmlPath, 'utf-8');
  } catch (error) {
    console.error('Error reading index.html:', error);
    return null;
  }

  // If no metadata found, return original HTML (React will handle 404)
  if (!metadata) {
    return indexHtml;
  }

  // Build URLs
  const videoUrl = `${baseUrl}/v/${slug}`;
  const thumbnailUrl = `${baseUrl}/api/videos/thumbnail/${slug}`;
  const videoFileUrl = `${baseUrl}/api/videos/file/${slug}`;

  // Personalize content
  const companyName = metadata.company_name || metadata.last_name || 'You';
  const title = `A video for ${companyName}`;
  const description = metadata.video_description 
    ? personalize(metadata.video_description, metadata)
    : `Watch this personalized video created just for ${companyName}`;

  // Escape for HTML attributes
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCompanyName = escapeHtml(companyName);

  // Build OG meta tags
  const ogTags = `
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="video.other" />
    <meta property="og:url" content="${videoUrl}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${thumbnailUrl}" />
    <meta property="og:image:width" content="1280" />
    <meta property="og:image:height" content="720" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:video" content="${videoFileUrl}" />
    <meta property="og:video:type" content="video/mp4" />
    <meta property="og:video:width" content="1280" />
    <meta property="og:video:height" content="720" />
    <meta property="og:site_name" content="Video Message" />

    <!-- Twitter -->
    <meta name="twitter:card" content="player" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${thumbnailUrl}" />
    <meta name="twitter:player" content="${videoUrl}" />
    <meta name="twitter:player:width" content="1280" />
    <meta name="twitter:player:height" content="720" />

    <!-- iMessage / Apple -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <link rel="image_src" href="${thumbnailUrl}" />

    <!-- LinkedIn -->
    <meta property="og:image:secure_url" content="${thumbnailUrl}" />

    <!-- Additional SEO -->
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${videoUrl}" />
  `;

  // Update the page title
  const dynamicTitle = `${safeTitle} | Video Message`;

  // Inject OG tags into the HTML head
  // Replace existing meta description and title
  let modifiedHtml = indexHtml
    // Update title
    .replace(
      /<title>.*?<\/title>/i, 
      `<title>${dynamicTitle}</title>`
    )
    // Remove existing meta description (we'll add our own)
    .replace(
      /<meta name="description"[^>]*>/i,
      ''
    )
    // Inject OG tags right before </head>
    .replace(
      '</head>',
      `${ogTags}\n  </head>`
    );

  return modifiedHtml;
}

/**
 * Check if request is from a social media crawler/bot
 */
export function isCrawler(userAgent) {
  if (!userAgent) return false;
  
  const crawlerPatterns = [
    // Social media
    'facebookexternalhit',
    'Facebot',
    'Twitterbot',
    'LinkedInBot',
    'Pinterest',
    'Slackbot',
    'TelegramBot',
    'WhatsApp',
    'Discordbot',
    // iMessage / Apple
    'iMessageLinkPrevie',
    'AppleWebKit',
    // Search engines
    'Googlebot',
    'bingbot',
    // Generic bots
    'bot',
    'crawler',
    'spider',
    'preview',
    'fetch',
    'curl',
    'wget',
  ];

  const ua = userAgent.toLowerCase();
  return crawlerPatterns.some(pattern => ua.includes(pattern.toLowerCase()));
}
