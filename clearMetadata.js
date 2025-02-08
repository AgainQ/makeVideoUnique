// ---------------------------------------
// 1 clearMetadata without re-encoding
// ---------------------------------------
// function clearMetadata() {
// ffmpeg(inputFilePath)
//   .outputOptions('-map_metadata', '-1') // Clear all metadata
//   .videoCodec('copy') // Copy video stream
//   .audioCodec('copy') // Copy audio stream
//   .on('start', commandLine => {
//     console.log('Spawned FFmpeg with command:', commandLine);
//   })
//   .on('progress', progress => {
//     console.log(`Processing: ${progress.percent}% done`);
//   })
//   .on('end', () => {
//     console.log('Metadata cleared and file saved as:', outputFilePath);
//   })
//   .on('error', err => {
//     console.error('Error:', err.message);
//   })
//   .save(outputFilePath);
// }
