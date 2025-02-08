import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

// Input and output file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFilePath = path.join(__dirname, 'videos/720_3.mp4');
const outputFilePath = path.join(__dirname, 'videos/output720_3.mp4');

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

    // Build our filter chain dynamically
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
    /* 
       We must now decide which additional inputs we have.
       The main video is always input index 0.
       If hasSubscribeOverlay is true, we add the GIF as the next input.
       If hasHair is true, we add the PNG as the next input.
       (Their index depends on the order they’re added.)
    */
    let inputCount = 1; // 0 is the main video
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

    // Start building the ffmpeg command with the main video
    let command = ffmpeg(videoPath);
    // Conditionally add the GIF input.
    if (hasSubscribeOverlay) {
      command = command.input(GIF_PATH).inputOptions(['-ignore_loop', '0']);
    }
    // Conditionally add the PNG (hair) input.
    if (hasHair) {
      command = command.input(HAIR_PATH);
    }

    // Base video stream (from the main video sped-up) is in "v1".
    let baseVideo = 'v1';

    // 3. If the GIF overlay is enabled, add its filters.
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
      baseVideo = 'v2';
    }

    // 4. If the PNG (hair) overlay is enabled, add its filters.
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

// const inputFilePathq = 'videos/6.mp4';
// ffmpeg.ffprobe(inputFilePathq, (err, metadata) => {
//   if (err) {
//     console.error('Error retrieving metadata:', err);
//     return;
//   }

//   // Find the first video stream
//   const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');

//   if (videoStream) {
//     const width = videoStream.width;
//     const height = videoStream.height;
//     console.log(`Resolution: ${width}x${height}`);
//   } else {
//     console.log('No video stream found.');
//   }
// });
