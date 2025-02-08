import path from 'path';
import { downloadYoutubeVideo } from './downloadYoutubeVideo.js';
import { randomizeVideoMetadata } from './randomizeVideoMetadata.ts';
import { applyOverlaysOnVideo } from './applyOverlaysOnVideo.ts';

const urls = ['https://www.youtube.com/shorts/Y-2w8GnIqLc'];

async function processVideo() {
  const dirname = path.resolve(
    'C:\\Users\\godsh\\OneDrive\\Рабочий стол\\vk\\zmakeVideoUnique\\videos'
  );
  // 1
  await downloadYoutubeVideo(urls[0]);

  const filePath = path.join(dirname, 'Y-2w8GnIqLc.mp4');
  // 2
  const filePath2 = await randomizeVideoMetadata(filePath);
  // 3
  const filePath3 = await applyOverlaysOnVideo(filePath2);
}

processVideo();
