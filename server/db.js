import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database schema
export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Campaigns table
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        intro_video_path VARCHAR(500),
        secondary_video_path VARCHAR(500),
        video_style VARCHAR(50) DEFAULT 'small_bubble',
        video_position VARCHAR(50) DEFAULT 'bottom_left',
        video_shape VARCHAR(50) DEFAULT 'circle',
        video_title VARCHAR(255) DEFAULT 'A video for you 👋',
        video_description TEXT,
        calendar_url VARCHAR(500),
        button_text VARCHAR(100),
        button_link VARCHAR(500),
        text_color VARCHAR(20) DEFAULT '#ffffff',
        bg_color VARCHAR(20) DEFAULT '#6366f1',
        text_hover_color VARCHAR(20) DEFAULT '#ffffff',
        bg_hover_color VARCHAR(20) DEFAULT '#4f46e5',
        dark_mode BOOLEAN DEFAULT false,
        display_delay INTEGER DEFAULT 10,
        scroll_behavior VARCHAR(50) DEFAULT 'stay_down',
        mouse_display VARCHAR(50) DEFAULT 'moving',
        display_tab BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Leads table
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
        website_url VARCHAR(500) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        company_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Generated videos table
      CREATE TABLE IF NOT EXISTS generated_videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
        unique_slug VARCHAR(20) UNIQUE NOT NULL,
        video_path VARCHAR(500),
        preview_path VARCHAR(500),
        background_path VARCHAR(500),
        thumbnail_path VARCHAR(500),
        status VARCHAR(50) DEFAULT 'pending',
        error_message TEXT,
        views INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Video analytics table
      CREATE TABLE IF NOT EXISTS video_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id UUID REFERENCES generated_videos(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        ip_address VARCHAR(50),
        user_agent TEXT,
        referrer VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_videos_lead ON generated_videos(lead_id);
      CREATE INDEX IF NOT EXISTS idx_videos_campaign ON generated_videos(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_videos_slug ON generated_videos(unique_slug);
      CREATE INDEX IF NOT EXISTS idx_analytics_video ON video_analytics(video_id);
    `);
    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
