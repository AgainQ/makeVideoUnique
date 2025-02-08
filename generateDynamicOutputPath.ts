import path from 'path';

export function generateDynamicOutputPath(inputFilePath: string, addedString: string) {
  const dirname = path.dirname(inputFilePath);
  const basename = path.basename(inputFilePath).split('.')[0] + addedString + '.mp4';
  const outputFilePath = path.join(dirname, basename);
  return outputFilePath;
}
