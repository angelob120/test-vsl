# Mass VSL Generator

Create personalized Video Sales Letters at scale. Upload your video, import leads, and generate unique landing pages for each prospect.

![Mass VSL Generator](https://img.shields.io/badge/Status-Production--Ready-brightgreen)

## Features

- 📹 **Video Upload** - Upload MP4/MOV/WebM intro videos (+ optional secondary video)
- 📊 **CSV Import** - Bulk import leads with automatic column detection
- 🎨 **Customization** - Video style, position, shape, colors, timing
- 🌐 **Website Capture** - Screenshots target websites as scrolling backgrounds
- 🎬 **Video Rendering** - FFmpeg-powered video generation with overlays
- 🔗 **Unique Links** - Each lead gets a personalized landing page
- 📈 **Analytics** - Track views and engagement
- 📥 **CSV Export** - Export all video links for email campaigns

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, Vite
- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **Video Processing**: FFmpeg, Puppeteer
- **Deployment**: Railway / Docker

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL database
- FFmpeg installed
- Chrome/Chromium for Puppeteer

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd mass-vsl-generator

# Install dependencies
npm install
cd client && npm install && cd ..

# Set up environment
cp .env.example .env
# Edit .env with your database URL

# Initialize database
npm run dev
# Database tables are created automatically on first run

# Build client for production
npm run build
```

### Development

```bash
# Run both server and client in development
npm run dev:all

# Or run separately:
npm run dev      # Server on port 3001
npm run client   # Client on port 5173
```

### Production

```bash
# Build and start
npm run build
npm start
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Server
PORT=3001
NODE_ENV=production

# App URL (for generating shareable links)
APP_URL=https://your-domain.com
```

## API Endpoints

### Campaigns
- `POST /api/campaigns` - Create campaign with video upload
- `GET /api/campaigns` - List all campaigns
- `GET /api/campaigns/:id` - Get campaign details
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign

### Leads
- `POST /api/leads/import/:campaignId` - Import CSV
- `GET /api/leads/campaign/:campaignId` - List leads
- `POST /api/leads/:campaignId` - Add single lead
- `GET /api/leads/export/:campaignId` - Export CSV with video links

### Videos
- `POST /api/videos/generate/:campaignId` - Start generation
- `GET /api/videos/status/:campaignId` - Check progress
- `GET /api/videos/landing/:slug` - Get landing page data
- `GET /api/videos/file/:slug` - Stream video file
- `GET /api/videos/preview/:slug` - Stream preview
- `GET /api/videos/thumbnail/:slug` - Get thumbnail

## Deployment to Railway

1. Push code to GitHub
2. Connect Railway to your repo
3. Add PostgreSQL plugin
4. Set environment variables:
   - `DATABASE_URL` (auto-set by Railway)
   - `APP_URL` = your Railway domain
   - `NODE_ENV` = production
5. Deploy!

## CSV Format

Your input CSV should have columns for:
- Website URL (required)
- First Name
- Last Name / Company Name
- Email
- Phone

The app auto-detects column names like "Website Link", "First Name", etc.

## Output CSV

Generated export includes:
- VideoSuccess (YES/NO)
- OriginUrls (target website)
- FirstName, LastName
- VideoLink (unique landing page URL)
- VideoHtmlEmail (embed code for emails)
- VideoPreview (preview video URL)
- BackgroundImageLink (thumbnail URL)

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│   React Client  │────▶│  Express Server  │
│   (Vite/SPA)    │     │   (API + Static) │
└─────────────────┘     └────────┬─────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │PostgreSQL│ │  FFmpeg  │ │Puppeteer │
              │(Railway) │ │ (Video)  │ │(Screenshot│
              └──────────┘ └──────────┘ └──────────┘
```

## License

MIT

---

Built with ❤️ for sales teams who want to scale personalized outreach.
