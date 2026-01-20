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
const FPS = 30;

// Loom-style scroll settings
const SCROLL_STEP_DURATION = 2.5;  // Total duration of each step (scroll + pause)
const SCROLL_PHASE_DURATION = 1.8; // How long the scroll part takes within each step
const PAUSE_PHASE_DURATION = 0.7;  // How long the pause takes (SCROLL_STEP_DURATION - SCROLL_PHASE_DURATION)

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

  // Get video duration using ffprobe
  async getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const duration = metadata.format.duration || 0;
          resolve(duration);
        }
      });
    });
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

  // Create Loom-style scrolling background video from screenshot
  // Scrolls in steps: scroll a bit -> pause -> scroll a bit -> pause
  // totalDuration = total video length
  // scrollDuration = how long the scrolling should take (before freezing at bottom)
  async createScrollingBackground(screenshotPath, outputPath, scrollDuration, totalDuration) {
    const effectiveTotalDuration = totalDuration || scrollDuration;
    
    return new Promise((resolve, reject) => {
      // Loom-style step scrolling formula
      // Creates a staircase effect: scroll smoothly for a bit, then pause, then scroll, then pause
      
      // Calculate number of steps based on scroll duration
      const numSteps = Math.max(3, Math.ceil(scrollDuration / SCROLL_STEP_DURATION));
      const stepDuration = scrollDuration / numSteps;
      const scrollPhase = stepDuration * 0.7; // 70% of each step is scrolling
      
      // FFmpeg expression for Loom-style step scrolling:
      // - floor(t/stepDuration) gives current step number
      // - mod(t, stepDuration) gives time within current step
      // - During scroll phase: smoothly interpolate within the step
      // - During pause phase: hold at step end position
      // - After scrollDuration: freeze at bottom
      
      // The formula creates smooth scrolling within each step, then a pause
      // progress = (step_num + smooth_progress_within_step) / num_steps
      // where smooth_progress_within_step uses easing for natural movement
      
      const scrollFormula = `
        if(lt(t,${scrollDuration}),
          (
            floor(t/${stepDuration}) + 
            if(lt(mod(t,${stepDuration}),${scrollPhase}),
              (mod(t,${stepDuration})/${scrollPhase})*(mod(t,${stepDuration})/${scrollPhase})*(3-2*(mod(t,${stepDuration})/${scrollPhase})),
              1
            )
          )/${numSteps},
          1
        )
      `.replace(/\s+/g, '');
      
      ffmpeg(screenshotPath)
        .inputOptions([
          '-loop 1'
        ])
        .outputOptions([
          `-t ${effectiveTotalDuration}`,
          `-vf scale=${VIEWPORT_WIDTH}:-1,crop=${VIEWPORT_WIDTH}:${VIEWPORT_HEIGHT}:0:'min(ih-${VIEWPORT_HEIGHT},(${scrollFormula})*(ih-${VIEWPORT_HEIGHT}))'`,
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
      fullscreenTransitionTime = 20 // Time in seconds when bubble transitions to fullscreen (ONLY for full_screen style)
    } = config;

    // Calculate overlay dimensions based on style
    let overlaySize;
    const smallBubbleSize = { width: 200, height: 200 };
    const bigBubbleSize = { width: 400, height: 400 };
    
    switch (style) {
      case 'big_bubble':
        overlaySize = bigBubbleSize;
        break;
      case 'full_screen':
        // For fullscreen with transition, start with small bubble size
        overlaySize = smallBubbleSize;
        break;
      default: // small_bubble
        overlaySize = smallBubbleSize;
    }

    // Calculate position for bubble in corner - use the actual overlay size for positioning
    let posX, posY;
    const padding = 20;
    switch (position) {
      case 'bottom_right':
        posX = VIEWPORT_WIDTH - overlaySize.width - padding;
        posY = VIEWPORT_HEIGHT - overlaySize.height - padding;
        break;
      case 'top_left':
        posX = padding;
        posY = padding;
        break;
      case 'top_right':
        posX = VIEWPORT_WIDTH - overlaySize.width - padding;
        posY = padding;
        break;
      default: // bottom_left
        posX = padding;
        posY = VIEWPORT_HEIGHT - overlaySize.height - padding;
    }

    return new Promise((resolve, reject) => {
      let filterComplex;
      let outputOptions;
      
      if (style === 'full_screen') {
        // FULLSCREEN MODE:
        // Phase 1 (from t=0 to fullscreenTransitionTime): 
        //   - Website scrolling as background
        //   - Uploaded video as a bubble in the corner FROM THE START (no delay)
        // Phase 2 (after fullscreenTransitionTime):
        //   - Uploaded video goes COMPLETELY FULLSCREEN
        //   - Website is NO LONGER VISIBLE AT ALL
        
        // Circle bubble filter for uploaded video (Phase 1)
        const circleBubbleFilter = shape === 'circle'
          ? `scale=${smallBubbleSize.width}:${smallBubbleSize.height},format=rgba,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lt((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2),(W/2)*(W/2)),255,0)'`
          : `scale=${smallBubbleSize.width}:${smallBubbleSize.height},format=rgba`;
        
        // Fullscreen filter for uploaded video (Phase 2) - scale to fill entire viewport
        const fullscreenFilter = `scale=${VIEWPORT_WIDTH}:${VIEWPORT_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIEWPORT_WIDTH}:${VIEWPORT_HEIGHT}`;
        
        filterComplex = [
          // Split the uploaded video into two streams for different phases
          `[1:v]split=2[ov_bubble_src][ov_fullscreen_src];`,
          
          // Create circle bubble version of uploaded video (for Phase 1)
          `[ov_bubble_src]${circleBubbleFilter}[video_bubble];`,
          
          // Create fullscreen version of uploaded video (for Phase 2)
          `[ov_fullscreen_src]${fullscreenFilter}[video_fullscreen];`,
          
          // Phase 1: Website background with bubble overlay FROM THE START (t=0) until fullscreenTransitionTime
          `[0:v][video_bubble]overlay=${posX}:${posY}:enable='lt(t,${fullscreenTransitionTime})'[phase1];`,
          
          // Phase 2: Uploaded video fullscreen completely replaces background (after fullscreenTransitionTime)
          `[phase1][video_fullscreen]overlay=0:0:enable='gte(t,${fullscreenTransitionTime})'[outv]`
        ].join('');
        
        outputOptions = [
          '-map [outv]',
          '-map 1:a?',
          '-c:v libx264',
          '-c:a aac',
          '-shortest',
          '-pix_fmt yuv420p'
        ];
      } else {
        // BUBBLE MODE (small_bubble or big_bubble):
        // - Bubble stays the SAME SIZE and SHAPE throughout the entire video
        // - NO transitions, NO fullscreen
        // - Video is ALWAYS VISIBLE from the start (no delay)
        // - Video plays until the uploaded video completes
        // - Background freezes on last frame when scrolling ends
        
        if (shape === 'circle') {
          // Circle mask for bubble - stays circle the ENTIRE time, visible from t=0
          filterComplex = [
            `[1:v]scale=${overlaySize.width}:${overlaySize.height},format=rgba,geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(lt((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2),(W/2)*(W/2)),255,0)'[ov];`,
            `[0:v][ov]overlay=${posX}:${posY}[outv]`
          ].join('');
        } else {
          // Square/rectangle overlay - stays square the ENTIRE time, visible from t=0
          filterComplex = [
            `[1:v]scale=${overlaySize.width}:${overlaySize.height}[ov];`,
            `[0:v][ov]overlay=${posX}:${posY}[outv]`
          ].join('');
        }
        
        outputOptions = [
          '-map [outv]',
          '-map 1:a?',
          '-c:v libx264',
          '-c:a aac',
          '-shortest',
          '-pix_fmt yuv420p'
        ];
      }

      const command = ffmpeg()
        .input(backgroundVideoPath)
        .input(overlayVideoPath);

      if (secondaryVideoPath) {
        command.input(secondaryVideoPath);
      }

      command
        .complexFilter(filterComplex)
        .outputOptions(outputOptions)
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
      // Step 1: Get the duration of the intro video
      console.log(`⏱️ Getting intro video duration...`);
      const introVideoDuration = await this.getVideoDuration(introVideoPath);
      console.log(`   Intro video duration: ${introVideoDuration.toFixed(2)}s`);

      // Step 2: Capture website screenshot
      console.log(`📸 Capturing website: ${websiteUrl}`);
      const screenshotPath = path.join(tempDir, 'screenshot.png');
      const captureResult = await this.captureWebsite(websiteUrl, screenshotPath);
      
      if (!captureResult.success) {
        throw new Error(`Failed to capture website: ${captureResult.error}`);
      }

      // Step 3: Create scrolling background video with Loom-style scroll
      console.log(`🎬 Creating Loom-style scrolling background...`);
      const backgroundVideoPath = path.join(tempDir, 'background.mp4');
      const videoStyle = settings.video_style || 'small_bubble';
      
      // Scroll duration is based on video length
      // Use 70% of video duration for scrolling, leaving 30% frozen at bottom
      // But cap scrolling at reasonable limits
      const scrollDuration = Math.min(Math.max(introVideoDuration * 0.7, 8), 45);
      
      // Total background duration needs to match the intro video
      const totalBackgroundDuration = introVideoDuration + 1; // Add 1s buffer
      
      console.log(`   Scroll duration: ${scrollDuration.toFixed(2)}s (Loom-style step scrolling)`);
      console.log(`   Total background: ${totalBackgroundDuration.toFixed(2)}s`);
      
      await this.createScrollingBackground(screenshotPath, backgroundVideoPath, scrollDuration, totalBackgroundDuration);

      // Step 4: Overlay video bubble
      console.log(`🔄 Overlaying video bubble (style: ${videoStyle})...`);
      const finalVideoPath = path.join(outputDir, `${leadId}.mp4`);
      await this.createVideoWithOverlay({
        backgroundVideoPath,
        overlayVideoPath: introVideoPath,
        secondaryVideoPath,
        outputPath: finalVideoPath,
        position: settings.video_position,
        shape: settings.video_shape,
        style: videoStyle,
        fullscreenTransitionTime: settings.fullscreen_transition_time || 20
      });

      // Step 5: Create preview
      console.log(`📹 Creating preview...`);
      const previewPath = path.join(STORAGE_PATHS.previews, `${leadId}_preview.mp4`);
      await fs.mkdir(path.dirname(previewPath), { recursive: true });
      await this.createPreview(finalVideoPath, previewPath, 8);

      // Step 6: Create thumbnail
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
