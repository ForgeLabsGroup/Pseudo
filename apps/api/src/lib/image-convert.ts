import convert from 'heic-convert';

/** iPhone photos. Most browsers can't display HEIC and Higgsfield/Gemini can't read it, so we store JPEG. */
const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
const SUPPORTED = ['image/jpeg', 'image/png', 'image/webp'];

/** HEIC/HEIF files start with an ISO-BMFF `ftyp` box whose brand is heic/heix/mif1/etc. */
function looksLikeHeic(data: Buffer): boolean {
  if (data.length < 12 || data.toString('latin1', 4, 8) !== 'ftyp') return false;
  return ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(
    data.toString('latin1', 8, 12),
  );
}

/**
 * Normalise an uploaded selfie to JPEG/PNG/WebP. Browsers often send HEIC with an empty or
 * octet-stream type, so detect by magic bytes too. Returns null if the format isn't supported.
 */
export async function normalizeImageUpload(
  data: Buffer,
  mimeType: string,
): Promise<{ data: Buffer; mimeType: string } | null> {
  if (HEIC_TYPES.includes(mimeType) || looksLikeHeic(data)) {
    if (!looksLikeHeic(data)) return null;
    const out = await convert({ buffer: data, format: 'JPEG', quality: 0.92 });
    return { data: Buffer.from(out), mimeType: 'image/jpeg' };
  }
  return SUPPORTED.includes(mimeType) ? { data, mimeType } : null;
}
