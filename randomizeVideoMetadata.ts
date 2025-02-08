import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateDynamicOutputPath } from './generateDynamicOutputPath.ts';
import fs from 'fs';

// Input and output file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function randomString(length: number = 12) {
  const randomString = Math.random()
    .toString(36) // Base 36 uses digits 0-9 and letters a-z. => 0.4fzyo82mv
    .substring(2, 2 + length);

  return randomString;
}

function randomTimeOffset(baseTime: Date, maxOffsetSeconds: number = 60) {
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

/**
 *
 * @param inputFilePath
 * @returns filePath = inputFilePath + '_cleared'
 */
export function randomizeVideoMetadata(inputFilePath: string): Promise<string> {
  const outputFilePath = generateDynamicOutputPath(inputFilePath, '_cleared');

  return new Promise<string>((resolve, reject) => {
    // Assuming generateRandomMetadataOptions() is defined as in your code
    const metadataOptions = generateRandomMetadataOptions();

    ffmpeg(inputFilePath)
      .outputOptions('-map_metadata', '-1')
      .outputOptions(metadataOptions)
      .videoCodec('copy')
      .audioCodec('copy')
      .on('end', () => {
        console.log('Step 2 complete. Metadata added to file:', outputFilePath);
        fs.unlinkSync(inputFilePath);
        resolve(outputFilePath);
      })
      .on('error', err => {
        console.error('Error during metadata processing:', err.message);
        reject(err);
      })
      .save(outputFilePath);
  });
}
