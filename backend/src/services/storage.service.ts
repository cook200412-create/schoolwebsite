import { randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { env } from '../config/env';
import { DocumentModel } from '../models/operations';
import { ApiError } from '../utils/http';

const ALLOWED: Record<string, { ext: string; magic: number[][] }> = {
  'application/pdf': { ext: '.pdf', magic: [[0x25, 0x50, 0x44, 0x46]] },
  'image/jpeg': { ext: '.jpg', magic: [[0xff, 0xd8, 0xff]] },
  'image/png': { ext: '.png', magic: [[0x89, 0x50, 0x4e, 0x47]] },
};
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 5 },
  fileFilter: (_req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(ApiError.badRequest('Only PDF, JPG or PNG files are allowed') as any)),
});

const rootDir = () => path.resolve(env.UPLOAD_DIR);

/** Validates real file signature (not just the client-declared MIME type), then stores privately. */
export async function saveFile(file: Express.Multer.File, meta: { owner?: string; student?: string; admission?: string }) {
  const rule = ALLOWED[file.mimetype];
  if (!rule || !rule.magic.some((m) => m.every((b, i) => file.buffer[i] === b))) throw ApiError.badRequest('File content does not match its type');
  const key = `${randomBytes(16).toString('hex')}${rule.ext}`;
  let storage: 'local' | 'cloudinary' = 'local';
  if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET });
    const res: any = await new Promise((resolve, reject) =>
      cloudinary.uploader.upload_stream({ type: 'authenticated', resource_type: 'auto', folder: 'ssv-private' }, (e, r) => (e ? reject(e) : resolve(r))).end(file.buffer));
    storage = 'cloudinary';
    return DocumentModel.create({ ...meta, originalName: file.originalname.slice(0, 200), mimeType: file.mimetype, size: file.size, storage, key: res.public_id });
  }
  await fs.mkdir(rootDir(), { recursive: true });
  await fs.writeFile(path.join(rootDir(), key), file.buffer, { mode: 0o600 });
  return DocumentModel.create({ ...meta, originalName: file.originalname.slice(0, 200), mimeType: file.mimetype, size: file.size, storage, key });
}

export async function readLocal(key: string) {
  return fs.readFile(path.join(rootDir(), path.basename(key)));
}

export async function cloudinarySignedUrl(publicId: string) {
  const { v2: cloudinary } = await import('cloudinary');
  cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET });
  return cloudinary.url(publicId, { type: 'authenticated', sign_url: true, secure: true, expires_at: Math.floor(Date.now() / 1000) + 300 } as any);
}
