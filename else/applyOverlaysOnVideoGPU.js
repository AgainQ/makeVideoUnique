import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

// Input and output file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFilePath = path.join(__dirname, 'videos/1080_1.mp4');
const outputFilePath = path.join(__dirname, 'videos/output1080_1.mp4');

// Overlay file paths and constants
const GIF_PATH = 'overlay.gif';
const HAIR_PATH = 'hair.png';
const HAIR_ANGLE_ROTATE = 45;
const GIF_OVERLAY_DURATION = 3; // seconds before video end to add GIF animation
const SPEED_FACTOR = 1.01; // Increase speed by 1%

/**
 * Processes a video by:
 * 1. Speeding up the video and audio,
 * 2. Optionally overlaying an animated GIF on the last few seconds,
 * 3. Optionally overlaying a PNG (scaled to 360x360 and rotated) on top.
 *
 * This version uses GPU acceleration (CUDA/NVENC) for decoding and encoding.
 *
 * @param {string} videoPath - Path to the main input video file.
 * @param {string} outputPath - Path where the output video will be saved.
 * @param {boolean} hasHair - Whether to add the PNG overlay.
 * @param {boolean} hasSubscribeOverlay - Whether to add the GIF overlay.
 */
function makeVideoUnique(
  videoPath,
  outputPath,
  hasHair = true,
  hasSubscribeOverlay = true
) {
  // Calculate the factor for speeding up video (setpts filter) and audio (atempo)
  const videoSetptsFactor = 1 / SPEED_FACTOR;
  const angleRadians = (HAIR_ANGLE_ROTATE * Math.PI) / 180; // Convert degrees to radians

  // Get video duration using ffprobe
  ffmpeg.ffprobe(videoPath, (err, metadata) => {
    if (err) {
      console.error('Error retrieving video metadata:', err);
      return;
    }
    const videoDuration = parseFloat(metadata.format.duration);
    const overlayStartTime =
      videoDuration > GIF_OVERLAY_DURATION ? videoDuration - GIF_OVERLAY_DURATION : 0;

    // Build our filter chain dynamically.
    // (Note: these filters run on CPU. To have them run on GPU you would need
    // to use GPU‑based filters such as scale_npp, etc., and manage hwupload/hwdownload.)
    const filters = [];
    // 1. Speed up the main video.
    filters.push({
      filter: 'setpts',
      options: `${videoSetptsFactor}*PTS`,
      inputs: '0:v',
      outputs: 'v1',
    });
    // 2. Speed up the audio.
    filters.push({
      filter: 'atempo',
      options: SPEED_FACTOR,
      inputs: '0:a',
      outputs: 'a',
    });

    // Decide which additional inputs we have.
    let inputCount = 1; // index 0 is the main video
    let gifInputIndex = null;
    let hairInputIndex = null;

    if (hasSubscribeOverlay) {
      gifInputIndex = inputCount;
      inputCount++;
    }
    if (hasHair) {
      hairInputIndex = inputCount;
      inputCount++;
    }

    // 3. Add the GIF overlay if enabled.
    if (hasSubscribeOverlay) {
      // Build the enable expression so the GIF is shown only in the last few seconds.
      const gifEnableExpr = `between(t,${overlayStartTime},${videoDuration})`;

      // Delay the GIF stream so it doesn’t produce output too early.
      filters.push({
        filter: 'setpts',
        options: `PTS+${overlayStartTime}/TB`,
        inputs: `${gifInputIndex}:v`,
        outputs: 'delayedGif',
      });
      // Overlay the delayed GIF on top of the sped-up video.
      filters.push({
        filter: 'overlay',
        options: {
          x: '(main_w-overlay_w)/2',
          y: '(main_h-overlay_h)/2',
          format: 'auto',
          enable: gifEnableExpr,
        },
        inputs: ['v1', 'delayedGif'],
        outputs: 'v2',
      });
      // Update our base video stream to the result of the GIF overlay.
      // (Subsequent overlays will use this as input.)
      var baseVideo = 'v2';
    } else {
      var baseVideo = 'v1';
    }

    // 4. Add the PNG (hair) overlay if enabled.
    if (hasHair) {
      filters.push({
        filter: 'scale',
        options: '360:360',
        inputs: `${hairInputIndex}:v`,
        outputs: 'scaledOverlay',
      });
      filters.push({
        filter: 'rotate',
        options: `${angleRadians}:fillcolor=none`,
        inputs: 'scaledOverlay',
        outputs: 'rotatedOverlay',
      });
      filters.push({
        filter: 'overlay',
        options: {
          x: '(main_w-overlay_w)/2',
          y: '(main_h-overlay_h)/2',
        },
        inputs: [baseVideo, 'rotatedOverlay'],
        outputs: 'v',
      });
    } else {
      // If no PNG overlay is added, simply pass through the base video stream.
      filters.push({
        filter: 'null',
        inputs: baseVideo,
        outputs: 'v',
      });
    }

    // Build the ffmpeg command.
    // Here we add input options to use CUDA for hardware-accelerated decoding
    // and we specify h264_nvenc for GPU-accelerated encoding.
    let command = ffmpeg(videoPath)
      .inputOptions(['-hwaccel', 'cuda', '-hwaccel_device', '0'])
      .videoCodec('h264_nvenc');

    // Conditionally add the GIF input.
    if (hasSubscribeOverlay) {
      command = command.input(GIF_PATH).inputOptions(['-ignore_loop', '0']);
    }
    // Conditionally add the PNG (hair) input.
    if (hasHair) {
      command = command.input(HAIR_PATH);
    }

    // Build the ffmpeg command with the constructed filter chain.
    command
      .complexFilter(filters)
      // Map the final video ([v]) and audio ([a]) streams.
      .outputOptions(['-map', '[v]', '-map', '[a]', '-shortest'])
      .on('start', commandLine => {
        console.log('Spawned FFmpeg with command:', commandLine);
      })
      .on('progress', progress => {
        console.log(`Processing: ${progress.percent}% done`);
      })
      .on('end', () => {
        console.log('Processing complete. File saved as:', outputPath);
      })
      .on('error', err => {
        console.error('Error:', err.message);
      })
      .save(outputPath);
  });
}

// Example usage:
makeVideoUnique(inputFilePath, outputFilePath, true, true);
