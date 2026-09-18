import { Directory, File, Paths } from 'expo-file-system';
import type { OcrLine } from './parse';

export class OcrUnavailableError extends Error {}

/**
 * Runs Google ML Kit on-device text recognition (fully offline).
 * Needs a development/production build — it throws OcrUnavailableError in Expo Go.
 */
export async function recognizeImage(uri: string): Promise<OcrLine[]> {
  let TextRecognition: typeof import('@react-native-ml-kit/text-recognition').default;
  try {
    TextRecognition = (await import('@react-native-ml-kit/text-recognition')).default;
  } catch {
    throw new OcrUnavailableError('Text recognition module not found.');
  }
  let result;
  try {
    result = await TextRecognition.recognize(uri);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (/linked|expo managed|not.*found/i.test(msg)) throw new OcrUnavailableError(msg);
    throw e;
  }
  const lines: OcrLine[] = result.blocks.flatMap((b) =>
    b.lines.map((l) => ({ text: l.text, top: l.frame?.top, left: l.frame?.left, height: l.frame?.height })),
  );
  // Reading order: top-to-bottom, then left-to-right for lines on the same row.
  return lines.sort((a, b) => {
    const ta = a.top ?? 0;
    const tb = b.top ?? 0;
    const rowTol = 0.5 * Math.max(a.height ?? 0, b.height ?? 0);
    if (Math.abs(ta - tb) > rowTol) return ta - tb;
    return (a.left ?? 0) - (b.left ?? 0);
  });
}

/** Copies a picked image (which lives in a temporary cache) into permanent app storage. */
export async function persistImage(uri: string): Promise<string> {
  const dir = new Directory(Paths.document, 'receipts');
  dir.create({ idempotent: true, intermediates: true });
  const ext = uri.match(/\.(jpe?g|png|webp|heic)(\?|$)/i)?.[1] ?? 'jpg';
  const dest = new File(dir, `${Date.now()}.${ext}`);
  await new File(uri).copy(dest);
  return dest.uri;
}

export function deleteImage(uri: string | null) {
  if (!uri || !uri.includes('/receipts/')) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Best effort — a leftover image isn't worth crashing over.
  }
}
