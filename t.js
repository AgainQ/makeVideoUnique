import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

// Input and output file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Input and output file paths
const inputFilePath = path.join(__dirname, 'videos/input.mp4');
const outputFilePath = path.join(__dirname, 'videos/output.mp4');

/**
 * Processes a video by:
 * 1. Speeding up the video and audio by 1% (i.e. 1.01× faster),
 * 2. Overlaying an animated GIF (active only for the last 4 seconds, dynamically computed),
 * 3. Overlaying a PNG (scaled to 360x360 and rotated by the specified angle) on top.
 *
 * The -shortest flag is used to force FFmpeg to stop encoding when the shortest input ends.
 *
 * @param {string} videoPath - Path to the main input video file.
 * @param {string} gifPath - Path to the GIF file (with transparency and animation) to overlay.
 * @param {string} pngPath - Path to the PNG file (to be scaled and rotated) to overlay.
 * @param {string} outputPath - Path where the output video will be saved.
 * @param {number} angleDegrees - Rotation angle (in degrees) for the PNG overlay.
 */
function processVideoWithDynamicGifOverlay(
  videoPath,
  gifPath,
  pngPath,
  outputPath,
  angleDegrees
) {
  const speedFactor = 1.01; // Increase speed by 1%
  const videoSetptsFactor = 1 / speedFactor; // ≈ 0.990099
  const angleRadians = (angleDegrees * Math.PI) / 180; // Convert degrees to radians

  // First, use ffprobe to get the video's duration.
  ffmpeg.ffprobe(videoPath, (err, metadata) => {
    if (err) {
      console.error('Error retrieving video metadata:', err);
      return;
    }

    const duration = parseFloat(metadata.format.duration);
    // For videos shorter than 4 seconds, show the GIF for the entire video.
    const overlayStartTime = duration > 4 ? duration - 4 : 0;
    const gifEnableExpr = `between(t,${overlayStartTime},${duration})`;
    console.log(
      `Video duration: ${duration}s. Enabling GIF overlay from t=${overlayStartTime} to t=${duration}`
    );

    ffmpeg(videoPath)
      // Add the GIF as the second input with the option to preserve its animation.
      .input(gifPath)
      .inputOptions(['-ignore_loop', '0'])
      // Add the PNG as the third input.
      .input(pngPath)
      // Build the complex filter chain.
      .complexFilter([
        // 1. Speed up the main video.
        {
          filter: 'setpts',
          options: `${videoSetptsFactor}*PTS`,
          inputs: '0:v',
          outputs: 'v1',
        },
        // 2. Speed up the audio.
        {
          filter: 'atempo',
          options: speedFactor,
          inputs: '0:a',
          outputs: 'a',
        },
        // 3. Overlay the animated GIF (input 1) onto the sped-up video (v1) with dynamic timing.
        {
          filter: 'overlay',
          options: {
            x: '(main_w-overlay_w)/2',
            y: '(main_h-overlay_h)/2',
            format: 'auto',
            enable: gifEnableExpr,
          },
          inputs: ['v1', '1:v'],
          outputs: 'v2',
        },
        // 4. Scale the PNG (input 2) to 360x360.
        {
          filter: 'scale',
          options: '360:360',
          inputs: '2:v',
          outputs: 'scaledOverlay',
        },
        // 5. Rotate the scaled PNG by the specified angle.
        {
          filter: 'rotate',
          options: `${angleRadians}:fillcolor=none`,
          inputs: 'scaledOverlay',
          outputs: 'rotatedOverlay',
        },
        // 6. Overlay the rotated PNG on top of the video from step 3 (v2).
        {
          filter: 'overlay',
          options: {
            x: '(main_w-overlay_w)/2',
            y: '(main_h-overlay_h)/2',
          },
          inputs: ['v2', 'rotatedOverlay'],
          outputs: 'v',
        },
      ])
      // Map the final video ([v]) and audio ([a]) to the output.
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
processVideoWithDynamicGifOverlay(
  inputFilePath,
  'overlay1.gif',
  'hair7.png',
  'output19.mp4',
  45
);
