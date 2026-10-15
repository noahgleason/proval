import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Longest side, in pixels, of an uploaded photo. Sharp on any phone screen, a fraction of the original's size. */
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;
/** The link page's blurred preview: small enough that nothing in it is recognizable. */
const BLUR_SIDE = 24;

export type ShrunkPhoto = {
  uri: string;
  base64: string;
  mimeType: 'image/jpeg';
  /** A tiny copy as a data: URI, shown blurred before anyone signs in. */
  blur: string | undefined;
};

/**
 * Resizes a picked photo so its longest side is at most MAX_SIDE and re-encodes it as JPEG.
 * Phone photos are often 3–5 MB; this brings them to roughly 300–600 KB.
 */
export async function shrinkPhoto(uri: string, width: number, height: number): Promise<ShrunkPhoto> {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_SIDE) {
    // Give only one side; the web version reads a null side as 0 instead of "keep the aspect ratio".
    context.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY, base64: true });
  if (!result.base64) throw new Error('Could not read that photo. Try another one.');
  return { uri: result.uri, base64: result.base64, mimeType: 'image/jpeg', blur: await tinyCopy(result.uri, width >= height) };
}

/** Optional: if it fails, the link page just shows a plain placeholder for this photo. */
async function tinyCopy(uri: string, landscape: boolean): Promise<string | undefined> {
  try {
    const context = ImageManipulator.manipulate(uri);
    context.resize(landscape ? { width: BLUR_SIDE } : { height: BLUR_SIDE });
    const image = await context.renderAsync();
    const tiny = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.5, base64: true });
    return tiny.base64 ? `data:image/jpeg;base64,${tiny.base64}` : undefined;
  } catch {
    return undefined;
  }
}
