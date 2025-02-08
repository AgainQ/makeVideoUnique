import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';

// Input and output file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Input and output file paths
const inputFilePath = path.join(__dirname, 'videos/input.mp4');
const outputFilePath = path.join(__dirname, 'videos/output.mp4');

// Clear metadata with re-encoding (takes longer time)
// 50s video (10mb) => 6s
// 10s video (1mb) => 0.7s

// ---------------------------------------
// 2 clearAndSetCustomMetadata
// ---------------------------------------
// values don't have to be meaningful, they just have to be unique

function randomString(length = 12) {
  const randomString = Math.random()
    .toString(36) // Base 36 uses digits 0-9 and letters a-z. => 0.4fzyo82mv
    .substring(2, 2 + length);

  return randomString;
}

function randomTimeOffset(baseTime, maxOffsetSeconds = 60) {
  // Generate a random offset in milliseconds between 0 and maxOffsetSeconds * 1000
  const offsetMs = Math.floor(Math.random() * maxOffsetSeconds * 1000);
  // Add the offset to the base time
  return new Date(baseTime.getTime() + offsetMs);
}

function generateRandomMetadataOptions() {
  // Base time for timestamps
  const now = new Date();

  // Generate random timestamps with a max offset of 60 seconds (adjust as needed)
  const creationDateTime = randomTimeOffset(now, 60).toISOString();
  const modificationDateTime = randomTimeOffset(now, 60).toISOString();

  // Create unique values for each metadata field by appending random strings
  const dateOnly = now.toISOString().split('T')[0];
  const title = `${dateOnly}-${randomString()}`;
  const comment = `${randomString()}`;
  const artist = `${randomString()}`;
  const encoder = `${randomString()}`;

  // Construct the metadata options array for FFmpeg
  const metadataOptions = [
    '-metadata',
    `title=${title}`,
    '-metadata',
    `comment=${comment}`,
    '-metadata',
    `artist=${artist}`,
    '-metadata',
    `encoder=${encoder}`,
    '-metadata',
    `date=${dateOnly}`,
    '-metadata',
    `creation_time=${creationDateTime}`,
    '-metadata',
    `modification_time=${modificationDateTime}`,
  ];

  return metadataOptions;
}

async function clearAndSetCustomMetadata(filePath) {
  const metadataOptions = generateRandomMetadataOptions();

  ffmpeg(filePath)
    // Optionally clear existing metadata:
    .outputOptions('-map_metadata', '-1')
    // Add custom metadata fields:
    .outputOptions(metadataOptions)
    // If you want to avoid re-encoding, you can copy streams:
    .videoCodec('copy')
    .audioCodec('copy')
    .on('start', commandLine => {
      console.log('Spawned FFmpeg with command:', commandLine);
    })
    .on('progress', progress => {
      console.log(`Processing: ${progress.percent}% done`);
    })
    .on('end', () => {
      console.log('Custom metadata added and file saved as:', outputFilePath);
    })
    .on('error', err => {
      console.error('Error:', err.message);
    })
    .save(outputFilePath);
}

// clearAndSetCustomMetadata(inputFilePath);

// ---------------------------------------
// 3 increase video and audio speed by 1%
// ---------------------------------------

/**
 * Speed up both video and audio by 1% (i.e. 1.01× faster).
 *
 * @param {string} inputFile - Path to the input MP4 file.
 * @param {string} outputFile - Path to the output MP4 file.
 */
function speedUpVideoAndAudioSpeed(inputFile, outputFile) {
  const speedFactor = 1.01; // 1%
  // Calculate the video setpts factor (inverse of the speed factor)
  const videoSetptsFactor = 1 / speedFactor; // Approximately 0.990099

  ffmpeg(inputFile)
    .complexFilter([
      {
        filter: 'setpts',
        options: `${videoSetptsFactor}*PTS`,
        inputs: '0:v',
        outputs: 'v',
      },
      {
        filter: 'atempo',
        options: speedFactor,
        inputs: '0:a',
        outputs: 'a',
      },
    ])
    .outputOptions(['-map', '[v]', '-map', '[a]'])
    .on('start', commandLine => {
      console.log('Spawned FFmpeg with command:', commandLine);
    })
    .on('progress', progress => {
      console.log(`Processing: ${progress.percent}% done`);
    })
    .on('end', () => {
      console.log(
        'Speed increased by 1% for both video and audio. File saved as:',
        outputFile
      );
    })
    .on('error', err => {
      console.error('Error:', err.message);
    })
    .save(outputFile);
}

// speedUpVideoAndAudioSpeed(inputFilePath, outputFilePath); // 6s
// ---------------------------------------
// 4 add watermark = "subscribe" (last 4s)
// ---------------------------------------

/**
 * Overlays a transparent GIF on top of a video.
 *
 * @param {string} videoPath - Path to the input video file.
 * @param {string} gifPath - Path to the transparent GIF file.
 * @param {string} outputPath - Path to the output video file.
 * @param {object} [overlayOptions] - Options for the overlay position.
 *                                    Default is top-left corner at (10,10).
 */
function overlayGifOnVideo(
  videoPath,
  outputPath,
  gifPath,
  overlayOptions = { x: 10, y: 10 }
) {
  ffmpeg(videoPath)
    // Add the GIF as an extra input.
    .input(gifPath)
    // When overlaying a GIF that loops, you might want to add -ignore_loop 0
    // to ensure the GIF loops for the duration of the video. (This can be added
    // as an input option in ffmpeg if needed.)
    //.inputOptions(['-ignore_loop 0'])

    // Use a complex filter to overlay the GIF on top of the video.
    // Here, [0:v] is the main video's video stream and [1:v] is the GIF stream.
    .complexFilter([
      {
        filter: 'overlay',
        options: {
          x: '(main_w-overlay_w)/2',
          y: '(main_h-overlay_h)/2',
          // The "format=auto" helps to preserve transparency.
          format: 'auto',
        },
        inputs: ['0:v', '1:v'],
        outputs: 'v',
      },
    ])
    // Map the filtered video stream and optionally map audio from the main input.
    // The "0:a?" means map audio from the first input if it exists.
    .outputOptions(['-map', '[v]', '-map', '0:a?'])
    .on('start', commandLine => {
      console.log('Spawned FFmpeg with command:', commandLine);
    })
    .on('progress', progress => {
      console.log(`Processing: ${progress.percent}% done`);
    })
    .on('end', () => {
      console.log('Overlay complete. File saved as:', outputPath);
    })
    .on('error', err => {
      console.error('Error:', err.message);
    })
    .save(outputPath);
}

// Example usage:
// overlayGifOnVideo(inputFilePath, 'output3.mp4', 'overlay1.gif', { x: 10, y: 10 });

// -----------------------

/**
 * Speed up video and audio by 1% and overlay a centered transparent GIF in one pass.
 *
 * @param {string} videoPath - Path to the input video file.
 * @param {string} gifPath - Path to the transparent GIF file.
 * @param {string} outputPath - Path to the output video file.
 */
function speedUpAndOverlay(videoPath, gifPath, outputPath) {
  const speedFactor = 1.01; // 1% increase
  const videoSetptsFactor = 1 / speedFactor; // ≈ 0.990099

  ffmpeg(videoPath)
    // Add the GIF as a second input.
    .input(gifPath)
    // Use complexFilter to apply all modifications in one go.
    .complexFilter([
      // First, speed up the video from the main input.
      {
        filter: 'setpts',
        options: `${videoSetptsFactor}*PTS`,
        inputs: '0:v',
        outputs: 'v1',
      },
      // Speed up the audio from the main input.
      {
        filter: 'atempo',
        options: speedFactor,
        inputs: '0:a',
        outputs: 'a',
      },
      // Overlay the GIF on top of the sped-up video.
      // Note: The overlay input is the second video input ('1:v').
      {
        filter: 'overlay',
        options: {
          // Center the overlay:
          x: '(main_w-overlay_w)/2',
          y: '(main_h-overlay_h)/2',
          format: 'auto',
        },
        inputs: ['v1', '1:v'],
        outputs: 'v',
      },
    ])
    // Map the resulting video and audio to the output.
    .outputOptions(['-map', '[v]', '-map', '[a]'])
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
}

// Example usage:
// speedUpAndOverlay(inputFilePath, 'overlay1.gif', 'output4.mp4');

// -----------------------

/**
 * Speed up video and audio by 1% and overlay a transparent GIF and a PNG image (hair.png)
 * on top, both centered.
 *
 * @param {string} videoPath - Path to the main input video file.
 * @param {string} gifPath - Path to the transparent GIF file.
 * @param {string} pngPath - Path to the PNG image file (e.g., "hair.png").
 * @param {string} outputPath - Path to the output video file.
 */
function speedUpAndOverlayMultiple(videoPath, gifPath, pngPath, outputPath) {
  const speedFactor = 1.01; // Increase speed by 1%
  const videoSetptsFactor = 1 / speedFactor; // ≈ 0.990099

  ffmpeg(videoPath)
    // Add the GIF (second input) and the PNG (third input).
    .input(gifPath)
    .input(pngPath)
    // Build a complex filter chain:
    .complexFilter([
      // 1. Speed up the main video stream.
      {
        filter: 'setpts',
        options: `${videoSetptsFactor}*PTS`,
        inputs: '0:v',
        outputs: 'v1',
      },
      // 2. Speed up the audio stream.
      {
        filter: 'atempo',
        options: `${speedFactor}`,
        inputs: '0:a',
        outputs: 'a',
      },
      // 3. Overlay the GIF (input 1) onto the sped-up video.
      //    This centers the GIF on the video.
      {
        filter: 'overlay',
        options: {
          x: '(main_w-overlay_w)/2',
          y: '(main_h-overlay_h)/2',
          format: 'auto',
        },
        // Use the sped-up video from step 1 as the base and overlay the GIF.
        inputs: ['v1', '1:v'],
        outputs: 'v2',
      },
      // 4. Overlay the PNG (input 2) onto the result of the previous overlay.
      //    Again, centering it on the video.
      {
        filter: 'overlay',
        options: {
          x: '(main_w-overlay_w)/2',
          y: '(main_h-overlay_h)/2',
          format: 'auto',
        },
        // Use the output from the previous overlay as the base.
        inputs: ['v2', '2:v'],
        outputs: 'v',
      },
    ])
    // Map the final video and audio streams to the output.
    .outputOptions(['-map', '[v]', '-map', '[a]'])
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
}

// Example usage:
// speedUpAndOverlayMultiple(inputFilePath, 'overlay1.gif', 'hair8.png', 'output8.mp4');

// ------------------------

/**
 * Overlays an upscaled PNG image on top of a video.
 *
 * @param {string} videoPath - Path to the input video file.
 * @param {string} overlayPath - Path to the PNG image (e.g., "hair.png") which is originally 240x240.
 * @param {string} outputPath - Path to the output video file.
 * @param {string} upscaledSize - Desired size to upscale the overlay image (e.g., "480:480").
 */
function overlayUpscaledImage(
  videoPath,
  overlayPath,
  outputPath,
  upscaledSize = '480:480'
) {
  ffmpeg(videoPath)
    // Add the overlay image as a second input.
    .input(overlayPath)
    // Apply a complex filter:
    // 1. Scale the overlay image.
    // 2. Overlay the scaled image onto the main video (centered).
    .complexFilter([
      {
        filter: 'scale',
        options: upscaledSize, // e.g., upscale 240x240 to 480x480
        inputs: '1:v',
        outputs: 'scaledOverlay',
      },
      {
        filter: 'overlay',
        options: {
          x: '(main_w-overlay_w)/2',
          y: '(main_h-overlay_h)/2',
        },
        inputs: ['0:v', 'scaledOverlay'],
        outputs: 'v',
      },
    ])
    // Map the filtered video and audio (if available) to the output.
    .outputOptions(['-map', '[v]', '-map', '0:a?'])
    .on('start', commandLine => {
      console.log('Spawned FFmpeg with command:', commandLine);
    })
    .on('progress', progress => {
      console.log(`Processing: ${progress.percent}% done`);
    })
    .on('end', () => {
      console.log('Overlay complete. File saved as:', outputPath);
    })
    .on('error', err => {
      console.error('Error:', err.message);
    })
    .save(outputPath);
}

// Example usage:
// overlayUpscaledImage(inputFilePath, 'hair7.png', 'output12.mp4', '360:360'); // 7 good (output 10)

// ---------

function overlayRotatedAndScaledImage(videoPath, overlayPath, outputPath, angleDegrees) {
  // Convert degrees to radians for the rotate filter.
  const angleRadians = (angleDegrees * Math.PI) / 180;

  ffmpeg(videoPath)
    // Add the PNG image as a second input.
    .input(overlayPath)
    // Build the complex filter chain.
    // First, scale the overlay image to 360x360.
    // Then, rotate it by the specified angle with a transparent fill.
    // Finally, overlay the result onto the main video (centered).
    .complexFilter([
      {
        filter: 'scale',
        options: '360:360',
        inputs: '1:v',
        outputs: 'scaledOverlay',
      },
      {
        filter: 'rotate',
        options: `${angleRadians}:fillcolor=none`,
        inputs: 'scaledOverlay',
        outputs: 'rotatedOverlay',
      },
      {
        filter: 'overlay',
        options: {
          x: '(main_w-overlay_w)/2',
          y: '(main_h-overlay_h)/2',
        },
        inputs: ['0:v', 'rotatedOverlay'],
        outputs: 'v',
      },
    ])
    // Map the filtered video stream and audio (if available) to the output.
    .outputOptions(['-map', '[v]', '-map', '0:a?'])
    .on('start', commandLine => {
      console.log('Spawned FFmpeg with command:', commandLine);
    })
    .on('progress', progress => {
      console.log(`Processing: ${progress.percent}% done`);
    })
    .on('end', () => {
      console.log('Overlay (scaled and rotated) complete. File saved as:', outputPath);
    })
    .on('error', err => {
      console.error('Error:', err.message);
    })
    .save(outputPath);
}

// Example usage:
// This overlays the PNG (scaled to 360x360 and rotated by 45°) onto the input video.
// overlayRotatedAndScaledImage(inputFilePath, 'hair7.png', 'output13.mp4', 45);
// -----

// Clear metadata WITH re-encoding (takes longer)
// function clearMetadata() {
//   ffmpeg(inputFilePath)
//     .outputOptions('-map_metadata', '-1') // Clear all metadata
//     .on('start', commandLine => {
//       console.log('Spawned FFmpeg with command:', commandLine);
//     })
//     .on('progress', progress => {
//       console.log(`Processing: ${progress.percent}% done`);
//     })
//     .on('end', () => {
//       console.log('Metadata cleared and file saved as:', outputFilePath);
//     })
//     .on('error', err => {
//       console.error('Error:', err.message);
//     })
//     .save(outputFilePath);
// }

//  -------------------

/**
 * Processes a video by speeding up the video and audio by 1%, overlaying a GIF,
 * and then overlaying a PNG (scaled to 360x360 and rotated by the specified angle) on top.
 *
 * @param {string} videoPath - Path to the main input video file.
 * @param {string} gifPath - Path to the GIF file (with transparency) to overlay.
 * @param {string} pngPath - Path to the PNG file (to be scaled and rotated) to overlay.
 * @param {string} outputPath - Path where the output video will be saved.
 * @param {number} angleDegrees - Rotation angle (in degrees) for the PNG overlay.
 */
function processVideoWithOverlays(videoPath, gifPath, pngPath, outputPath, angleDegrees) {
  const speedFactor = 1.01; // Increase speed by 1%
  const videoSetptsFactor = 1 / speedFactor; // For setpts filter, ≈ 0.990099
  const angleRadians = (angleDegrees * Math.PI) / 180; // Convert degrees to radians

  ffmpeg(videoPath)
    // Add the GIF as the second input and the PNG as the third input.
    .input(gifPath)
    .input(pngPath)
    // Build a complex filter chain:
    .complexFilter([
      // 1. Speed up the main video (input 0) by adjusting presentation timestamps.
      {
        filter: 'setpts',
        options: `${videoSetptsFactor}*PTS`,
        inputs: '0:v',
        outputs: 'v1',
      },
      // 2. Speed up the main audio (input 0) using atempo.
      {
        filter: 'atempo',
        options: speedFactor,
        inputs: '0:a',
        outputs: 'a',
      },
      // 3. Overlay the GIF (input 1) on top of the sped-up video (v1).
      //    This produces an intermediate video labeled v2.
      {
        filter: 'overlay',
        options: {
          x: '(main_w-overlay_w)/2',
          y: '(main_h-overlay_h)/2',
          format: 'auto',
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
      //    The final composited video is labeled as v.
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
    // Map the final video ([v]) and the sped-up audio ([a]) to the output.
    .outputOptions(['-map', '[v]', '-map', '[a]'])
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
}

// Example usage:
processVideoWithOverlays(inputFilePath, 'overlay1.gif', 'hair7.png', 'output16.mp4', 90);

// -------------------

function readFileMetadata(filePath) {
  ffmpeg.ffprobe(filePath, (err, metadata) => {
    if (err) {
      console.error('Ошибка при получении метаданных:', err);
      return;
    }
    console.log('Метаданные файла:', metadata);
  });
}
// readFileMetadata(outputFilePath);

// I should make metadta of each video unique. Even if I am going to reupload the same video over and over again 100 times
// each video should contain unique metadata

// 1. Remove all metadata
// 2. Add custom metadata (title, comment, artist, encoder, date, creation_time or modification_time, encoder, tags?)
// 3. Change duration. => increase speed by 1%. (it will change binary data of the video) (ускорить и видео и ауодио)
// Will file size change too if I change duration?
// 4. Add invisilbe dot, watermark (пох не нужно, вотерки - подпишись будет достаточно)
// 5. Поставить вотерку подпишись

// Duration | should I even change it? how?
// Technical details | should I even change it? how? => no
// file size | should I even change it? how?
// change file-name to uuid

// ----------------------------------------
// format: {
// filename: 'C:\\Users\\godsh\\OneDrive\\Рабочий стол\\vk\\cleanmetadata\\output.mp4',

// ffmpeg -i input.mp4 -map_metadata -1 -c copy \
//   -metadata title="Unique Video Title 2025-02-06-XYZ" \
//   -metadata comment="Unique version with custom metadata, generated on 2025-02-06" \
//   -metadata creation_time="2025-02-06T12:34:56" \
//   -metadata encoder="CustomEncoder-1.0" \
//   -metadata artist="YourUniqueArtistName" \
//   output.mp4

// how to change video and audio streams
// maybe add some invisible dot
// change video speed a bit
