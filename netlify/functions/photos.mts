import type { Config, Context } from '@netlify/functions';
import { CORS, fail, imageStore, isUser, json, metaStore, preflight, toPhoto, type StoredPhoto } from '../lib/store';

const MAX_BYTES = 4_000_000; // stay under the ~6 MB function request limit after base64
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/**
 * POST /api/photos            → submit a photo for approval
 * GET  /api/photos/:id/image  → the image bytes (Blobs has no public URLs)
 */
export default async (req: Request, context: Context) => {
  if (req.method === 'OPTIONS') return preflight();

  if (req.method === 'GET') {
    const id = context.params.id;
    if (!id) return fail('Missing photo id', 404);
    const meta = (await metaStore().get(id, { type: 'json' })) as StoredPhoto | null;
    const bytes = await imageStore().get(id, { type: 'arrayBuffer' });
    if (!meta || !bytes) return fail('Not found', 404);
    return new Response(bytes, {
      headers: { 'Content-Type': meta.mimeType, 'Cache-Control': 'private, max-age=86400', ...CORS },
    });
  }

  if (req.method !== 'POST') return fail('Method not allowed', 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail('Body must be JSON');
  }

  const { uploaderId, caption, taggedIds, imageBase64, mimeType } = body;
  if (!isUser(uploaderId)) return fail('Unknown uploader');
  if (!Array.isArray(taggedIds) || taggedIds.length === 0 || !taggedIds.every(isUser)) {
    return fail('Tag at least one friend');
  }
  if (typeof imageBase64 !== 'string' || !imageBase64) return fail('Missing image');
  const type = typeof mimeType === 'string' && ALLOWED.includes(mimeType) ? mimeType : 'image/jpeg';

  const bytes = Buffer.from(imageBase64, 'base64');
  if (bytes.byteLength > MAX_BYTES) return fail('Photo is too large. Try a smaller one.', 413);

  const photo: StoredPhoto = {
    id: crypto.randomUUID(),
    uploaderId,
    caption: typeof caption === 'string' ? caption.slice(0, 150) : '',
    taggedIds: [...new Set(taggedIds.filter((id) => id !== uploaderId))],
    createdAt: new Date().toISOString(),
    reviews: {},
    mimeType: type,
  };
  if (photo.taggedIds.length === 0) return fail('Tag at least one friend besides yourself');

  await imageStore().set(photo.id, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  await metaStore().setJSON(photo.id, photo);

  return json(toPhoto(photo), 201);
};

export const config: Config = {
  path: ['/api/photos', '/api/photos/:id/image'],
};
