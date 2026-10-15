import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Profile photos are stored as this many pixels square: sharp at any size the app shows them, about 25 KB. */
const SIDE = 256;

export type AvatarPhoto = { uri: string; base64: string; mimeType: 'image/jpeg' };

/** Crops the middle square out of a picked photo and shrinks it to SIDE × SIDE. */
export async function avatarPhoto(uri: string, width: number, height: number): Promise<AvatarPhoto> {
  const side = Math.min(width, height);
  const context = ImageManipulator.manipulate(uri);
  context.crop({ originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side });
  context.resize({ width: SIDE });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  if (!result.base64) throw new Error('Could not read that photo. Try another one.');
  return { uri: result.uri, base64: result.base64, mimeType: 'image/jpeg' };
}
