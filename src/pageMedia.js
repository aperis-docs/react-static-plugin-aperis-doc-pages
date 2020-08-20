import fs from 'fs';
import path from 'path';
import probeImageSize from 'probe-image-size';


/* Goes through spceified files and attaches metadata
   (such as image dimensions).
   TODO: Can also handle resizing. */
export async function prepareMedia(basePath, filenames) {
  if ((filenames || []).length < 1) {
    return [];
  }

  var media = [];

  for (const fn of filenames) {
    const extname = path.extname(fn);

    if (extname === '.png') {
      const imagePath = path.join(basePath, fn);
      const stream = fs.createReadStream(imagePath);

      let width, height;
      try {
        const probeResult = await probeImageSize(stream);
        width = parseInt(probeResult.width, 10);
        height = parseInt(probeResult.height, 10);
      } catch (e) {
        width = null;
        height = null;
        console.error("Failed to parse media data", basePath, fn, e);
      } finally {
        stream.close();
      }

      if (width !== null && height !== null) {
        media.push({
          filename: fn,
          type: 'image',
          dimensions: { width, height },
        });
      }
    } else if (extname === '.svg') {
      media.push({
        filename: fn,
        type: 'image',
      });
    }
  }
  return media;
}
