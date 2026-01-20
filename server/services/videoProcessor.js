import ffmpeg from 'fluent-ffmpeg';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { STORAGE_PATHS } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 720;
const SCROLL_DURATION = 15; // seconds for background scroll (default)
const FPS = 30;

export class VideoProcessor {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.browser = null;
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // Capture full-page screenshot of website
  async captureWebsite(url, outputPath) {
    const page = await this.browser.newPage();
    
    try {
      await page.setViewport({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
      
      // Navigate with timeout
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for page to stabilize
      await new Promise(r => setTimeout(r, 2000));

      // Get full page height
      const bodyHandle = await page.$('body');
      const { height: fullHeight } = await bodyHandle.boundingBox();
      await bodyHandle.dispose();

      // Capture full page screenshot
      await page.screenshot({
        path: outputPath,
        fullPage: true,
        type: 'png'
      });

      return { 
        success: true, 
        fullHeight: Math.min(fullHeight, 5000) // Cap at 5000px
      };
    } catch (error) {
      console.error(`Failed to capture ${url}:`, error.message);
      return { success: false, error: error.message };
    } finally {
      await page.close();
    }
  }

  // Create scrolling background video from screenshot
  async createScrollingBackground(screenshotPath, outputPath, duration = SCROLL_DURATION) {
    return new Promise((resolve, reject) => {
      // Use FFmpeg to create a smooth scrolling effect with easing
      // Using a cubic easing function for more natural scrolling
      // Formula: y = x^3 for smooth acceleration and deceleration
      const easingFormula = `(t/${duration})*(t/${duration})*(3-2*(t/${duration}))`;
      
      ffmpeg(screenshotPath)
        .inputOptions([
          '-loop 1'
        ])
        .outputOptions([
          `-t ${duration}`,
          `-vf scale=${VIEWPORT_WIDTH}:-1,crop=${VIEWPORT_WIDTH}:${VIEWPORT_HEIGHT}:0:'min(ih-${VIEWPORT_HEIGHT},${easingFormula}*(ih-${VIEWPORT_HEIGHT}))'`,
          '-c:v libx264',
          '-pix_fmt yuv420p',
          `-r ${FPS}`
        ])
        .output(outputPath)
        .on('end', () => resolve({ success: true }))
        .on('error', (err) => reject(err))
        .run();
    });
  }

  // Overlay video bubble on background
  async createVideoWithOverlay(config) {
    const {
      backgroundVideoPath,
      overlayVideoPath,
      secondaryVideoPath,
      outputPath,
      position = 'bottom_left',
      shape = 'circle',
      style = 'small_bubble',
      displayDelay = 2,
      fullscreenTransitionTime = 20 // Time in seconds when bubble transitions to rectangle/fullscreen
    } = config;

    // Calculate overlay dimensions based on style
    let overlaySize;
    let bubbleSize = { width: 200, height: 200 }; // Default bubble size
    
    switch (style) {
      case 'big_bubble':
        overlaySize = { width: 400, height: 400 };
        break;
      case 'full_screen':
        // For fullscreen with transition, start with bubble size
        overlaySize = bubbleSize;
        break;
      default: // small_bubble
        overlaySize = { width: 200, height: 200 };
    }

    // Calculate position for bubble in corner
    let posX, posY;
    const padding = 20;
    switch (position) {
      case 'bottom_right':
        posX = VIEWPORT_WIDTH - bubbleSize.width - padding;
        posY = VIEWPORT_HEIGHT - bubbleSize.height - padding;
        break;
      case 'top_left':
        posX = padding;
        posY = padding;
        break;
      case 'top_right':
        posX = VIEWPORT_WIDTH - bubbleSize.width - padding;
        posY = padding;
        break;
      default: // bottom_left
        posX = padding;
        posY = VIEWPORT_HEIGHT - bubbleSize.height - padding;
    }

    return new Promise((resolve, reject) => {
      let filterComplex;
      
      if (style === 'full_screen') {
        // FULLSCREEN MODE:
        // Phase 1 (displayDelay to fullscreenTransitionTime): 
        //   - Website scrolling as background
        //   - Uploaded video as a bubble in the corner
        // Phase 2 (after fullscreenTransitionTime):
        //   - Uploaded video goes COMPLETELY FULLSCREEN
        //   - Website is NO LONGER VISIBLE AT ALL
        
        // Circle bubble filter for uploaded video (Phase 1)
        const circleBubbleFilter = shape === 'circle'
          ? `scale=${bubbleSize.width}:${bubbleSize.height},format=rgba,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lt((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2),(W/2)*(W/2)),255,0)'`
          : `scale=${bubbleSize.width}:${bubbleSize.height},format=rgba`;
        
        // Fullscreen filter for uploaded video (Phase 2) - scale to fill entire viewport
        const fullscreenFilter = `scale=${VIEWPORT_WIDTH}:${VIEWPORT_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIEWPORT_WIDTH}:${VIEWPORT_HEIGHT}`;
        
        filterComplex = [
          // Split the uploaded video into two streams for different phases
          `[1:v]split=2[ov_bubble_src][ov_fullscreen_src];`,
          
          // Create circle bubble version of uploaded video (for Phase 1)
          `[ov_bubble_src]${circleBubbleFilter}[video_bubble];`,
          
          // Create fullscreen version of uploaded video (for Phase 2)
          `[ov_fullscreen_src]${fullscreenFilter}[video_fullscreen];`,
          
          // Phase 1: Website background with bubble overlay (from displayDelay to fullscreenTransitionTime)
          `[0:v][video_bubble]overlay=${posX}:${posY}:enable='gte(t,${displayDelay})*lt(t,${fullscreenTransitionTime})'[phase1];`,
          
          // Phase 2: Uploaded video fullscreen completely replaces background (after fullscreenTransitionTime)
          // Use overlay at 0:0 with the fullscreen video, enabled only after transition time
          // The fullscreen video covers the entire frame, making the background invisible
          `[phase1][video_fullscreen]overlay=0:0:enable='gte(t,${fullscreenTransitionTime})'[outv]`
        ].join('');
      } else if (shape === 'circle' && style !== 'full_screen') {
        // Circle mask for bubble
        filterComplex = [
          `[1:v]scale=${overlaySize.width}:${overlaySize.height},format=rgba,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lt((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2),(W/2)*(W/2)),255,0)'[ov];`,
          `[0:v][ov]overlay=${posX}:${posY}:enable='gte(t,${displayDelay})'[outv]`
        ].join('');
      } else {
        // Square/rectangle overlay
        filterComplex = [
          `[1:v]scale=${overlaySize.width}:${overlaySize.height}[ov];`,
          `[0:v][ov]overlay=${posX}:${posY}:enable='gte(t,${displayDelay})'[outv]`
        ].join('');
      }

      const command = ffmpeg()
        .input(backgroundVideoPath)
        .input(overlayVideoPath);

      if (secondaryVideoPath) {
        // Add secondary video after intro
        command.input(secondaryVideoPath);
      }

      command
        .complexFilter(filterComplex)
        .outputOptions([
          '-map [outv]',
          '-map 1:a?',
          '-c:v libx264',
          '-c:a aac',
          '-shortest',
          '-pix_fmt yuv420p'
        ])
        .output(outputPath)
        .on('end', () => resolve({ success: true }))
        .on('error', (err) => reject(err))
        .run();
    });
  }

  // Create 5-10 second preview
  async createPreview(inputPath, outputPath, duration = 8) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          `-t ${duration}`,
          '-c:v libx264',
          '-c:a aac',
          '-pix_fmt yuv420p'
        ])
        .output(outputPath)
        .on('end', () => resolve({ success: true }))
        .on('error', (err) => reject(err))
        .run();
    });
  }

  // Create thumbnail from video
  async createThumbnail(inputPath, outputPath, timeOffset = 3) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: [timeOffset],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '460x250'
        })
        .on('end', () => resolve({ success: true }))
        .on('error', (err) => reject(err));
    });
  }

  // Full pipeline to generate VSL for a lead
  async generateVSL(config) {
    const {
      leadId,
      websiteUrl,
      introVideoPath,
      secondaryVideoPath,
      outputDir,
      settings
    } = config;

    // Use persistent temp directory
    const tempDir = path.join(STORAGE_PATHS.temp, leadId);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Step 1: Capture website screenshot
      console.log(`📸 Capturing website: ${websiteUrl}`);
      const screenshotPath = path.join(tempDir, 'screenshot.png');
      const captureResult = await this.captureWebsite(websiteUrl, screenshotPath);
      
      if (!captureResult.success) {
        throw new Error(`Failed to capture website: ${captureResult.error}`);
      }

      // Step 2: Create scrolling background video
      console.log(`🎬 Creating scrolling background...`);
      const backgroundVideoPath = path.join(tempDir, 'background.mp4');
      const scrollDuration = settings.scroll_duration || 15;
      await this.createScrollingBackground(screenshotPath, backgroundVideoPath, scrollDuration);

      // Step 3: Overlay video bubble
      console.log(`🔄 Overlaying video bubble...`);
      const finalVideoPath = path.join(outputDir, `${leadId}.mp4`);
      await this.createVideoWithOverlay({
        backgroundVideoPath,
        overlayVideoPath: introVideoPath,
        secondaryVideoPath,
        outputPath: finalVideoPath,
        position: settings.video_position,
        shape: settings.video_shape,
        style: settings.video_style,
        displayDelay: settings.display_delay || 2,
        fullscreenTransitionTime: settings.fullscreen_transition_time || 20
      });

      // Step 4: Create preview
      console.log(`📹 Creating preview...`);
      const previewPath = path.join(STORAGE_PATHS.previews, `${leadId}_preview.mp4`);
      await fs.mkdir(path.dirname(previewPath), { recursive: true });
      await this.createPreview(finalVideoPath, previewPath, 8);

      // Step 5: Create thumbnail
      console.log(`🖼️ Creating thumbnail...`);
      const thumbnailPath = path.join(STORAGE_PATHS.thumbnails, `${leadId}.jpg`);
      await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });
      await this.createThumbnail(finalVideoPath, thumbnailPath);

      // Clean up temp files
      await fs.rm(tempDir, { recursive: true, force: true });

      return {
        success: true,
        videoPath: finalVideoPath,
        previewPath,
        thumbnailPath,
        backgroundPath: screenshotPath
      };

    } catch (error) {
      console.error(`❌ VSL generation failed for ${leadId}:`, error);
      // Clean up on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default VideoProcessor;