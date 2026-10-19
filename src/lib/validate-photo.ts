import { PHOTO_UPLOAD } from "./config";

export function validatePhotoFile(file: File): string[] {
  const errors: string[] = [];
  const looksRight = /\.(jpe?g|png|heic|heif)$/i.test(file.name);
  if (!PHOTO_UPLOAD.acceptedTypes.includes(file.type) && !looksRight) {
    errors.push("Please upload a JPG, PNG, or HEIC photo.");
  }
  if (file.size > PHOTO_UPLOAD.maxBytes) {
    errors.push(`File is too large (max ${(PHOTO_UPLOAD.maxBytes / (1024 * 1024)).toFixed(0)} MB).`);
  }
  return errors;
}

/** Client-only (needs a decoded <img> + its average luminance). */
export function checkPhotoQuality(img: HTMLImageElement, avgLuminance255: number): string[] {
  const warnings: string[] = [];
  const shortSide = Math.min(img.naturalWidth, img.naturalHeight);
  if (shortSide < PHOTO_UPLOAD.minShortSidePx) {
    warnings.push(
      `This photo is lower resolution than ideal (${shortSide}px short side). It may look soft once printed.`
    );
  }
  if (avgLuminance255 < PHOTO_UPLOAD.minAverageLuminance) {
    warnings.push("This photo looks quite dark. Lithophanes work best with good contrast and lighter tones.");
  }
  return warnings;
}
