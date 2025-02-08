import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateDynamicOutputPath } from './generateDynamicOutputPath';
import * as fs from 'fs';

// Overlay file paths and constants
const GIF_PATH = 'overlay.gif';
const HAIR_PATH = 'hair.png';
const HAIR_ANGLE_ROTATE = 45;
const GIF_OVERLAY_DURATION = 3; // seconds before video end to add GIF animation
const SPEED_FACTOR = 1.01; // Increase speed by 1%

// Define an interface for the filter complex objects.
interface FilterComplexOption {
  filter: string;
  options?: string | { [key: string]: any };
  inputs?: string | string[];
  outputs?: string;
}

export function applyOverlaysOnVideo(
  inputFilePath: string,
  hasHair: boolean = true,
  hasSubscribeOverlay: boolean = true
): Promise<string> {
  // Generate a dynamic output path based on the input video.
  const outputFilePath: string = generateDynamicOutputPath(inputFilePath, '_final');

  return new Promise<string>((resolve, reject) => {
    // Retrieve the video metadata using ffprobe.
    ffmpeg.ffprobe(inputFilePath, (err: Error | null, metadata: any) => {
      if (err) {
        console.error('Error retrieving video metadata:', err);
        return reject(err);
      }
      const videoDuration: number = parseFloat(metadata.format.duration);
      const overlayStartTime: number =
        videoDuration > GIF_OVERLAY_DURATION ? videoDuration - GIF_OVERLAY_DURATION : 0;

      // Calculate factors and convert degrees to radians.
      const videoSetptsFactor: number = 1 / SPEED_FACTOR;
      const angleRadians: number = (HAIR_ANGLE_ROTATE * Math.PI) / 180;

      // Build our filter chain dynamically.
      const filters: FilterComplexOption[] = [];

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
        options: String(SPEED_FACTOR),
        inputs: '0:a',
        outputs: 'a',
      });

      /*
       Decide which additional inputs we have.
       The main video is always input index 0.
       If hasSubscribeOverlay is true, we add the GIF as the next input.
       If hasHair is true, we add the PNG as the next input.
      */
      let inputCount: number = 1; // main video is input index 0
      let gifInputIndex: number | null = null;
      let hairInputIndex: number | null = null;

      if (hasSubscribeOverlay) {
        gifInputIndex = inputCount;
        inputCount++;
      }
      if (hasHair) {
        hairInputIndex = inputCount;
        inputCount++;
      }

      // Start building the ffmpeg command with the main video.
      let command = ffmpeg(inputFilePath);
      // Conditionally add the GIF input.
      if (hasSubscribeOverlay) {
        command = command.input(GIF_PATH).inputOptions(['-ignore_loop', '0']);
      }
      // Conditionally add the PNG (hair) input.
      if (hasHair) {
        command = command.input(HAIR_PATH);
      }

      // Base video stream (from the main video sped-up) is in "v1".
      let baseVideo: string = 'v1';

      // 3. If the GIF overlay is enabled, add its filters.
      if (hasSubscribeOverlay && gifInputIndex !== null) {
        // Build the enable expression so the GIF is shown only in the last few seconds.
        const gifEnableExpr: string = `between(t,${overlayStartTime},${videoDuration})`;

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
      if (hasHair && hairInputIndex !== null) {
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
        // Uncomment these event listeners for debugging if desired.
        // .on('start', commandLine => {
        //   console.log('Spawned FFmpeg with command:', commandLine);
        // })
        // .on('progress', progress => {
        //   console.log(`Processing: ${progress.percent}% done`);
        // })
        .on('end', () => {
          console.log('Processing complete. File saved as:', outputFilePath);
          fs.unlinkSync(inputFilePath);
          resolve(outputFilePath);
        })
        .on('error', (err: Error) => {
          console.error('Error:', err.message);
          reject(err);
        })
        .save(outputFilePath);
    });
  });
}

// Test
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const inputFilePath: string = path.join(__dirname, 'videos/720_3.mp4');

// (async () => {
//   try {
//     const result = await applyOverlaysOnVideo(inputFilePath, true, true);
//     console.log('Video processing finished:', result);
//   } catch (error) {
//     console.error('Video processing error:', error);
//   }
// })();
