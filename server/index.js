import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool, { initDatabase } from './db.js';
import campaignRoutes from './routes/campaigns.js';
import leadRoutes from './routes/leads.js';
import videoRoutes from './routes/videos.js';
import { initStorage, STORAGE_PATHS } from './services/storage.js';
import { startCleanupScheduler } from './services/cleanup.js';
import { generateOGHtml, isCrawler } from './services/ogMetadata.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

console.log('🚀 Starting Mass VSL Generator...');
console.log(`📂 Server directory: ${__dirname}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔌 Port: ${PORT}`);

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Static files for uploads and videos (served from persistent storage)
app.use('/uploads', express.static(STORAGE_PATHS.uploads));
app.use('/videos', express.static(STORAGE_PATHS.videos));

// API Routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/videos', videoRoutes);

// Health check - basic (no DB required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Health check - with DB
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

// Serve React app - ALWAYS (not just production)
const clientDistPath = path.join(__dirname, '../client/dist');
console.log(`📁 Serving static files from: ${clientDistPath}`);

// Debug endpoint - check files
app.get('/debug', async (req, res) => {
  const fs = await import('fs/promises');
  try {
    const serverDir = __dirname;
    const distPath = clientDistPath;
    const distExists = await fs.access(distPath).then(() => true).catch(() => false);
    let distFiles = [];
    if (distExists) {
      distFiles = await fs.readdir(distPath);
    }
    res.json({
      serverDir,
      distPath,
      distExists,
      distFiles,
      cwd: process.cwd(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT
      }
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.use(express.static(clientDistPath));

// Landing page route with dynamic OG meta tags for video previews
// This enables rich link previews when sharing video links via text, social media, etc.
app.get('/v/:slug', async (req, res) => {
  const { slug } = req.params;
  const indexHtmlPath = path.join(clientDistPath, 'index.html');
  
  // Determine base URL for OG tags
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = `${protocol}://${host}`;

  try {
    // Generate HTML with dynamic OG tags
    const html = await generateOGHtml(slug, baseUrl, indexHtmlPath);
    
    if (html) {
      res.setHeader('Content-Type', 'text/html');
      // Cache for crawlers, but allow revalidation
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      return res.send(html);
    }
  } catch (error) {
    console.error('Error generating OG HTML:', error);
  }

  // Fallback to regular index.html
  res.sendFile(indexHtmlPath);
});

// Catch-all for React Router - serve index.html for any unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// Initialize database and start server
async function start() {
  // Initialize persistent storage first
  try {
    await initStorage();
    console.log('✅ Storage initialized');
  } catch (error) {
    console.error('⚠️ Storage initialization failed:', error.message);
    console.error('Videos may not persist across restarts!');
  }

  // Start server - Railway requires binding to 0.0.0.0
  const HOST = '0.0.0.0';
  const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on ${HOST}:${PORT}`);
    console.log(`📺 API available at http://localhost:${PORT}/api`);
    console.log(`🌐 App available at http://localhost:${PORT}`);
  });

  // Increase timeout for large file uploads (5 minutes)
  server.timeout = 300000;
  server.keepAliveTimeout = 300000;
  server.headersTimeout = 310000;

  // Then try database connection
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');

    // Initialize schema
    await initDatabase();
    console.log('✅ Database schema ready');
    
    // Start cleanup scheduler after database is ready
    startCleanupScheduler();
  } catch (error) {
    console.error('⚠️ Database connection failed:', error.message);
    console.error('App will continue running but database features won\'t work');
  }
}

start();
