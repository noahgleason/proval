import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Longest side, in pixels, of an uploaded photo. Sharp on any phone screen, a fraction of the original's size. */
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;

export type ShrunkPhoto = { uri: string; base64: string; mimeType: 'image/jpeg' };

/**
 * Resizes a picked photo so its longest side is at most MAX_SIDE and re-encodes it as JPEG.
 * Phone photos are often 3–5 MB; this brings them to roughly 300–600 KB.
 */
export async function shrinkPhoto(uri: string, width: number, height: number): Promise<ShrunkPhoto> {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_SIDE) {
    context.resize(width >= height ? { width: MAX_SIDE, height: null } : { width: null, height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
  if (!result.base64) throw new Error('Could not read that photo. Try another one.');
  return { uri: result.uri, base64: result.base64, mimeType: 'image/jpeg' };
}
