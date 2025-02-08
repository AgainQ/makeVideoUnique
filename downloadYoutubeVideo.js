import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
// import { Logger } from 'winston';
// import { DownloadYoutubeVideoError } from '../types/errors';

// Get the absolute path of the current file (for ESM compatibility)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Convert exec to a promise-based function
const execPromise = promisify(exec);

export async function downloadYoutubeVideo(url) {
  const videoId = url.split('/').at(-1);
  const downloadPath = path.resolve(__dirname, `videos/${videoId}.mp4`);

  console.log(`Downloading video...  ${url}`);

  try {
    const { stdout } = await execPromise(
      `yt-dlp -f  "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best" --merge-output-format mp4 \
      ${url} -o "${downloadPath}"`
    );

    console.log('Downloaded video');
  } catch (error) {
    throw new Error('Failed to download video');
    // throw new DownloadYoutubeVideoError(url, error.message);
  }
}
