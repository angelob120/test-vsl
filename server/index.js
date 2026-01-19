import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool, { initDatabase } from './db.js';
import campaignRoutes from './routes/campaigns.js';
import leadRoutes from './routes/leads.js';
import videoRoutes from './routes/videos.js';

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

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use('/videos', express.static(path.join(__dirname, '../public/videos')));

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

// Landing page route - must be before catch-all
app.get('/v/:slug', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
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
  // Start server first - Railway requires binding to 0.0.0.0
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
  } catch (error) {
    console.error('⚠️ Database connection failed:', error.message);
    console.error('App will continue running but database features won\'t work');
  }
}

start();
